import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { catalog } from '../packages/car-catalog/src/index.ts';
import {
  parseOwnerCsv,
  transmissionLabel,
  validateOwnerDirectory,
} from '../packages/car-catalog/src/owner-directory-import.ts';
import type { OwnerDirectory, OwnerModel } from '../packages/car-catalog/src/owner-directory.ts';
const folder = 'data/raw/owner-directory',
  target = 'packages/car-catalog/data/owner-directory.json';
const manifest = JSON.parse(await readFile(`${folder}/manifest.json`, 'utf8')) as {
  sources: Omit<OwnerDirectory['sources'][number], 'records'>[];
};
if (manifest.sources.length !== 6)
  throw new Error('All six reviewed English CSV resources are required.');
const canonicalMakes = new Map(catalog.cars.map((c) => [c.make.toLowerCase(), c.make]));
const canonicalModels = new Map(
  catalog.cars.map((c) => [`${c.make.toLowerCase()}|${c.model.toLowerCase()}`, c.model]),
);
const models = new Map<string, OwnerModel>(),
  sources: OwnerDirectory['sources'] = [];
function getModel(year: number, rawMake: string, rawModel: string) {
  const make = canonicalMakes.get(rawMake.toLowerCase()) ?? rawMake,
    model = canonicalModels.get(`${make.toLowerCase()}|${rawModel.toLowerCase()}`) ?? rawModel,
    key = `${year}|${make.toLowerCase()}|${model.toLowerCase()}`;
  let value = models.get(key);
  if (!value) {
    value = { year, make, model, choices: [], sourceIds: [] };
    models.set(key, value);
  }
  return value;
}
for (const source of manifest.sources) {
  const bytes = await readFile(`${folder}/${source.sha256}`);
  if (
    createHash('sha256').update(bytes).digest('hex') !== source.sha256 ||
    bytes.length !== source.bytes
  )
    throw new Error(`Owner source checksum differs: ${source.title}`);
  const encoding =
    source.sha256 === '46088cd4853987ef7a684f0b0af86e93e83dfaa378607a4750958c996248639c'
      ? 'windows-1252'
      : 'utf-8';
  const rows = parseOwnerCsv(
      new TextDecoder(encoding, { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''),
    ),
    headers = rows.shift()!.map((x) => x.trim().toLowerCase());
  const required = ['model year', 'make', 'model', 'transmission'];
  if (required.some((h) => !headers.includes(h))) throw new Error('Owner source columns changed.');
  const field = (row: string[], key: string) => row[headers.indexOf(key)]?.trim() ?? '';
  let records = 0;
  for (const row of rows) {
    const ys = field(row, 'model year');
    if (!/^\d{4}$/.test(ys)) continue;
    const year = Number(ys);
    if (year < 1995 || year > 2026)
      throw new Error('Review new owner model years before accepting.');
    const make = field(row, 'make'),
      model = field(row, 'model');
    if (!make || !model) throw new Error('Owner source identity is empty.');
    records++;
    const item = getModel(year, make, model);
    if (!item.sourceIds.includes(source.id)) item.sourceIds.push(source.id);
    const electric = source.title.startsWith('Battery-electric'),
      plugin = source.title.startsWith('Plug-in'),
      fuelCode = field(row, plugin ? 'fuel type 2' : 'fuel type');
    const fuel = electric
        ? 'Electric'
        : plugin
          ? 'Plug-in hybrid'
          : ({
              X: 'Gasoline',
              Z: 'Premium gasoline',
              D: 'Diesel',
              E: 'Flex-fuel',
              N: 'Natural gas',
            }[fuelCode] ?? fuelCode),
      litres = field(row, 'engine size (l)');
    const label = [
      electric ? 'Electric' : litres ? `${litres} L` : null,
      transmissionLabel(field(row, 'transmission')),
      electric ? null : fuel,
    ]
      .filter(Boolean)
      .join(' · ');
    if (!item.choices.some((c) => !c.catalogId && c.label === label))
      item.choices.push({ label, engine: label.slice(0, 200) });
  }
  if (records < 100) throw new Error(`Owner source is unexpectedly small: ${source.title}`);
  sources.push({ ...source, records });
}
for (const car of catalog.cars) {
  if (car.recordKind !== 'retail-trim' || car.year === null) continue;
  const item = getModel(car.year, car.make, car.model);
  item.choices.push({ label: car.trim, engine: car.trim.slice(0, 200), catalogId: car.id });
}
const d = validateOwnerDirectory(
  {
    schemaVersion: 1,
    reviewedAt: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Edmonton',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(
      new Date(
        manifest.sources
          .map((s) => s.capturedAt)
          .sort()
          .at(-1)!,
      ),
    ),
    sources,
    models: [...models.values()].sort(
      (a, b) =>
        b.year - a.year ||
        a.make.localeCompare(b.make, 'en-CA') ||
        a.model.localeCompare(b.model, 'en-CA'),
    ),
  },
  catalog,
);
const serialized = await format(JSON.stringify(d), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (process.argv.includes('--offline')) {
  const old = JSON.parse(await readFile(target, 'utf8'));
  d.reviewedAt = old.reviewedAt;
  const replay = await format(JSON.stringify(d), {
    ...(await resolveConfig(target)),
    filepath: target,
  });
  if (replay !== (await readFile(target, 'utf8')))
    throw new Error('Owner directory offline replay differs.');
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
}
console.log(
  JSON.stringify({
    models: d.models.length,
    years: [Math.min(...d.models.map((m) => m.year)), Math.max(...d.models.map((m) => m.year))],
    makes: new Set(d.models.map((m) => m.make)).size,
    ratings: sources.reduce((n, s) => n + s.records, 0),
    choices: d.models.reduce((n, m) => n + m.choices.length, 0),
  }),
);
