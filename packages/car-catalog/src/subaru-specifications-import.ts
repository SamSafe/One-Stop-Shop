import { z } from 'zod';
import type { SubaruSnapshot } from './subaru-import';

const sourceUrl = z.url().refine((raw) => {
  const url = new URL(raw);
  return (
    url.protocol === 'https:' &&
    ['m.subaru.ca', 'www.subaru.ca'].includes(url.hostname) &&
    !url.username &&
    !url.password
  );
});
const cellSchema = z.strictObject({
  manufacturerId: z.number().int().positive(),
  value: z.string().max(200),
  status: z.enum(['S', 'N', 'O', 'A']).nullable(),
});
const modelSchema = z.strictObject({
  model: z.string().min(1),
  year: z.number().int(),
  title: z.string().min(1),
  source: z.strictObject({
    url: sourceUrl,
    responseUrl: sourceUrl,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  trims: z
    .array(
      z.strictObject({
        manufacturerId: z.number().int().positive(),
        name: z.string().min(1),
        modelCode: z.string().min(1),
      }),
    )
    .min(1)
    .max(100),
  rows: z
    .array(
      z.strictObject({
        label: z.string().min(1).max(200),
        cells: z.array(cellSchema).min(1).max(100),
      }),
    )
    .min(1)
    .max(100),
});
export const subaruSpecificationsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  models: z.array(modelSchema).min(1).max(100),
});
export type SubaruSpecificationsSnapshot = z.infer<typeof subaruSpecificationsSchema>;
export type SubaruSpecificationsModel = SubaruSpecificationsSnapshot['models'][number];

export function subaruSpecText(raw: string) {
  return raw
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, (_match, entity: string) => {
      const named: Record<string, string> = {
        nbsp: ' ',
        amp: '&',
        quot: '"',
        apos: "'",
        lt: '<',
        gt: '>',
      };
      const value = entity.toLowerCase();
      return (
        named[value] ??
        String.fromCodePoint(
          value.startsWith('#x') ? parseInt(value.slice(2), 16) : Number(value.slice(1)),
        )
      );
    })
    .replace(/\s+/g, ' ')
    .trim();
}

const supportedRow =
  /^(?:Cargo volume \(L\): Seats (?:up|folded)|(?:Length|Height) \(mm\)|Width \(mm\): Body|(?:Headroom|Legroom) \(mm\): (?:Front|Rear)|(?:Automatic|Manual) transmission \((?:City|Hwy|Combined)\) \((?:L\/100 km|Imperial MPG)\)|All-electric range \(AER\): Up to \(km\) in ideal conditions\*\*|Engine: .+|Engine layout: .+|Transmission: .+|Drivetrain: .+|Output \(max\): .+|Horsepower \(peak\) \(hp\): .+)$/;

export function parseSubaruSpecifications(html: string, model: string, year: number) {
  const title = subaruSpecText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  if (title !== `Specifications - ${year} ${model} - Subaru Canada`)
    throw new Error(`Subaru specification model/year mismatch: ${model} ${year}.`);
  const columns = html.split(/<div\b[^>]*class="car-spec-column for-car-(\d+)"[^>]*>/);
  const trims = new Map<number, { manufacturerId: number; name: string; modelCode: string }>();
  for (let index = 1; index < columns.length; index += 2) {
    const manufacturerId = Number(columns[index]),
      chunk = columns[index + 1]!;
    const name = chunk.match(/<div class="car-name">\s*<p>([\s\S]*?)<\/p>/)?.[1];
    const code = chunk.match(
      /<span\b[^>]*class=['"][^'"]*\bmodelcode\b[^'"]*['"][^>]*>([^<]+)<\/span>/,
    )?.[1];
    if (!name || !code) continue;
    const trim = { manufacturerId, name: subaruSpecText(name), modelCode: subaruSpecText(code) };
    if (
      trims.has(manufacturerId) &&
      JSON.stringify(trims.get(manufacturerId)) !== JSON.stringify(trim)
    )
      throw new Error(`Conflicting Subaru specification trim: ${manufacturerId}.`);
    trims.set(manufacturerId, trim);
  }
  const rows = new Map<string, SubaruSpecificationsModel['rows'][number]>();
  for (const chunk of html.split(/<div\b[^>]*class="scrolling-row car-spec-row[^\"]*"[^>]*>/)) {
    const rawTitle = chunk.match(/<div class="spec-title">([\s\S]*?)<\/div>/)?.[1];
    if (!rawTitle) continue;
    const label = subaruSpecText(rawTitle);
    if (!supportedRow.test(label)) continue;
    const cells = [
      ...chunk.matchAll(
        /<div class="car-spec-column for-car-(\d+)">\s*<div class="spec-value">([\s\S]*?)<\/div>/g,
      ),
    ].map(([, id, raw]) => ({
      manufacturerId: Number(id),
      value: subaruSpecText(raw!),
      status: raw!.match(/class=['"]symbol ([A-Z])['"]/)?.[1] ?? null,
    }));
    if (!cells.length) continue;
    const row = { label, cells };
    if (rows.has(label) && JSON.stringify(rows.get(label)) !== JSON.stringify(row))
      throw new Error(`Conflicting Subaru specification row: ${label}.`);
    rows.set(label, row as SubaruSpecificationsModel['rows'][number]);
  }
  return { model, year, title, trims: [...trims.values()], rows: [...rows.values()] };
}

export function validateSubaruSpecifications(
  input: unknown,
  lineup: SubaruSnapshot,
): SubaruSpecificationsSnapshot {
  const snapshot = subaruSpecificationsSchema.parse(input);
  if (snapshot.models.length !== lineup.models.length)
    throw new Error('Incomplete Subaru specification model list.');
  const found = new Set<string>();
  for (const model of snapshot.models) {
    const key = `${model.year}:${model.model}`;
    const expected = lineup.models.find(
      (entry) => entry.name === model.model && entry.year === model.year,
    );
    if (
      !expected ||
      found.has(key) ||
      model.title !== `Specifications - ${model.year} ${model.model} - Subaru Canada`
    )
      throw new Error(`Unexpected Subaru specification identity: ${key}.`);
    found.add(key);
    const expectedTrims = lineup.trims.filter(
      (trim) => trim.model === model.model && trim.year === model.year,
    );
    for (const raw of [model.source.url, model.source.responseUrl]) {
      const url = new URL(raw),
        requested = new URL(expectedTrims[0]!.specificationsUrl);
      if (
        url.pathname !== requested.pathname ||
        ['WebSiteID', 'WebPageID', 'ModelYear'].some(
          (name) => url.searchParams.get(name) !== requested.searchParams.get(name),
        )
      )
        throw new Error(`Unexpected Subaru specification URL: ${key}.`);
    }
    if (
      model.trims.length !== expectedTrims.length ||
      new Set(model.trims.map((trim) => trim.manufacturerId)).size !== expectedTrims.length ||
      model.trims.some(
        (trim) =>
          !expectedTrims.some(
            (entry) =>
              entry.manufacturerId === trim.manufacturerId && entry.modelCode === trim.modelCode,
          ),
      )
    )
      throw new Error(`Incomplete or changed Subaru specification trims: ${key}.`);
    const expectedIds = new Set(expectedTrims.map((trim) => trim.manufacturerId));
    if (new Set(model.rows.map((row) => row.label)).size !== model.rows.length)
      throw new Error(`Duplicate Subaru specification rows: ${key}.`);
    for (const row of model.rows) {
      if (
        !supportedRow.test(row.label) ||
        row.cells.length !== expectedIds.size ||
        new Set(row.cells.map((cell) => cell.manufacturerId)).size !== expectedIds.size ||
        row.cells.some((cell) => !expectedIds.has(cell.manufacturerId))
      )
        throw new Error(`Incomplete Subaru specification columns: ${key}, ${row.label}.`);
    }
  }
  return snapshot;
}
