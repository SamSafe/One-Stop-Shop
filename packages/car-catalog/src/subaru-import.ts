import { z } from 'zod';

export const subaruLineupUrl = 'https://www.subaru.ca/WebPage.aspx?WebPageID=16564';
const subaruUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    ['www.subaru.ca', 'm.subaru.ca'].includes(url.hostname) &&
    !url.username &&
    !url.password
  );
});
const integerText = z.string().regex(/^\d+$/).transform(Number);
const trimSchema = z.object({
  CarID: integerText,
  year: integerText,
  TrimName: z.string().min(1),
  ModelCode: z.string().min(1),
  Price: integerText,
  Specifications: integerText,
  seating: integerText,
  IsHybrid: z.boolean(),
  IsPlugInHybrid: z.boolean(),
  IsElectric: z.boolean(),
});
const modelSchema = z.object({
  ModelYear: z.number().int(),
  RangeId: z.number().int(),
  DisplayModelName: z.string().min(1),
});
export const subaruIndexSchema = z.object({
  Subaru: z.record(z.string(), z.array(trimSchema).min(1)),
  Models: z.record(z.string(), modelSchema),
});
const priceSchema = z.object({
  Year: z.number().int(),
  RangeId: z.number().int(),
  Trims: z
    .array(
      z.object({
        ID: z.number().int(),
        Transmissions: z
          .array(
            z.object({
              ID: z.number().int(),
              MSRP: z.number().min(10000).max(10000000),
              Name: z.string().min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export const subaruSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  lineup: z.strictObject({
    url: z.literal(subaruLineupUrl),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  models: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        year: z.number().int(),
        rangeId: z.number().int(),
        pricingUrl: subaruUrl,
        pricingSha256: z.string().regex(/^[a-f0-9]{64}$/),
        trimIds: z.array(z.number().int()).min(1),
      }),
    )
    .min(1),
  trims: z
    .array(
      z.strictObject({
        manufacturerId: z.number().int(),
        model: z.string().min(1),
        year: z.number().int(),
        trim: z.string().min(1),
        modelCode: z.string().min(1),
        transmission: z.string().min(1),
        msrpCad: z.number().min(10000).max(10000000),
        seats: z.number().int().min(2).max(15),
        powertrain: z.enum(['Electric', 'Plug-in hybrid', 'Hybrid', 'Gasoline']),
        pricingUrl: subaruUrl,
        specificationsUrl: subaruUrl,
      }),
    )
    .min(1),
});
export type SubaruSnapshot = z.infer<typeof subaruSnapshotSchema>;

// Match the browser's embedded JSON nodes without evaluating any remote script.
export function embeddedJson(html: string, id: string, tag: 'script' | 'div'): unknown {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)) throw new Error('Invalid JSON node ID.');
  const opening = new RegExp(`<${tag}\\b[^>]*\\bid=["']${id}["'][^>]*>`).exec(html);
  if (!opening) throw new Error(`Manufacturer JSON node is missing: ${id}`);
  let value = html.slice(opening.index + opening[0].length).trimStart();
  if (tag === 'div')
    value = value.replace(
      /&(quot|amp|lt|gt|apos|#39|#\d+|#x[0-9a-f]+);/gi,
      (_match, entity: string) => {
        const named: Record<string, string> = {
          quot: '"',
          amp: '&',
          lt: '<',
          gt: '>',
          apos: "'",
          '#39': "'",
        };
        if (named[entity.toLowerCase()]) return named[entity.toLowerCase()]!;
        return String.fromCodePoint(
          entity.toLowerCase().startsWith('#x')
            ? parseInt(entity.slice(2), 16)
            : Number(entity.slice(1)),
        );
      },
    );
  if (value[0] !== '{' && value[0] !== '[') throw new Error(`Manufacturer JSON is invalid: ${id}`);
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') {
      if (--depth === 0) return JSON.parse(value.slice(0, index + 1));
    }
  }
  throw new Error(`Manufacturer JSON is truncated: ${id}`);
}

export function subaruPricingUrl(pageId: number, year: number) {
  return `https://m.subaru.ca/WebPage.aspx?WebSiteID=282&WebPageID=${pageId}&ModelYear=${year}`;
}

export function subaruModels(html: string) {
  const index = subaruIndexSchema.parse(embeddedJson(html, 'Cars', 'script'));
  return Object.entries(index.Models).map(([key, model]) => {
    const trims = index.Subaru[key];
    if (!trims?.length || trims.some((trim) => trim.year !== model.ModelYear))
      throw new Error(`Subaru model/year mismatch: ${key}`);
    return { ...model, key, trims, pricingUrl: subaruPricingUrl(trims[0]!.Price, model.ModelYear) };
  });
}

export function subaruModelPrices(
  model: ReturnType<typeof subaruModels>[number],
  html: string,
): SubaruSnapshot['trims'] {
  const pricing = priceSchema.parse(embeddedJson(html, 'preloadedTrimData', 'div'));
  if (pricing.Year !== model.ModelYear || pricing.RangeId !== model.RangeId)
    throw new Error(`Subaru pricing model/year mismatch: ${model.key}`);
  const offered = new Map(model.trims.map((trim) => [trim.CarID, trim]));
  const result = pricing.Trims.flatMap((trim) =>
    trim.Transmissions.map((transmission) => {
      const entry = offered.get(transmission.ID);
      if (!entry) throw new Error(`Unreconciled Subaru trim: ${transmission.ID}`);
      return {
        manufacturerId: transmission.ID,
        model: model.DisplayModelName,
        year: pricing.Year,
        trim: entry.TrimName,
        modelCode: entry.ModelCode,
        transmission: transmission.Name,
        msrpCad: transmission.MSRP,
        seats: entry.seating,
        powertrain: entry.IsElectric
          ? ('Electric' as const)
          : entry.IsPlugInHybrid
            ? ('Plug-in hybrid' as const)
            : entry.IsHybrid
              ? ('Hybrid' as const)
              : ('Gasoline' as const),
        pricingUrl: model.pricingUrl,
        specificationsUrl: subaruPricingUrl(entry.Specifications, entry.year),
      };
    }),
  );
  if (
    result.length !== offered.size ||
    new Set(result.map((trim) => trim.manufacturerId)).size !== offered.size
  )
    throw new Error(`Incomplete Subaru retail trim list: ${model.key}`);
  return result;
}

export function validateSubaruSnapshot(input: unknown): SubaruSnapshot {
  const result = subaruSnapshotSchema.parse(input);
  const ids = new Set<number>();
  for (const model of result.models) {
    const expected = [...model.trimIds].sort((a, b) => a - b);
    const found = result.trims
      .filter((trim) => trim.model === model.name && trim.year === model.year)
      .map((trim) => trim.manufacturerId)
      .sort((a, b) => a - b);
    if (JSON.stringify(found) !== JSON.stringify(expected))
      throw new Error(`Incomplete Subaru model: ${model.name}`);
  }
  for (const trim of result.trims) {
    if (ids.has(trim.manufacturerId))
      throw new Error(`Duplicate Subaru trim: ${trim.manufacturerId}`);
    ids.add(trim.manufacturerId);
    if (
      !result.models.some(
        (model) =>
          model.name === trim.model &&
          model.year === trim.year &&
          model.trimIds.includes(trim.manufacturerId) &&
          model.pricingUrl === trim.pricingUrl,
      )
    )
      throw new Error(`Unreferenced Subaru trim: ${trim.manufacturerId}`);
  }
  return result;
}
