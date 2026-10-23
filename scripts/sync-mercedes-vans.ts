import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  mercedesContext,
  validateMercedesSnapshot,
} from '../packages/car-catalog/src/mercedes-import.ts';
import {
  mercedesVanInventoryUrl,
  mercedesVanDirectoryUrl,
  mercedesVanInitUrl,
  mercedesVanModelsUrl,
  mercedesVanClients,
  mercedesVanDirectory,
  mercedesVanInventoryReferences,
  mercedesVanStockUrl,
  mercedesVanObservation,
  mercedesVanStockPageSchema,
  mercedesVanArchiveUrl,
  mercedesVanArchive,
  mercedesVanReceiptSchema,
  validateMercedesVanStockSnapshot,
  mercedesVanStockNoRegression,
} from '../packages/car-catalog/src/mercedes-vans-import.ts';
import type { MercedesVanStockSnapshot } from '../packages/car-catalog/src/mercedes-vans-import.ts';
import { addMercedesVanStock } from '../packages/car-catalog/src/mercedes-vans.ts';

const folder = 'data/raw/mercedes',
  target = 'packages/car-catalog/data/manufacturers/mercedes-vans.json';
const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
const offline = process.argv.includes('--offline'),
  arg = process.argv.indexOf('--from-captures'),
  captured = offline || arg >= 0;
if (arg >= 0 && !process.argv[arg + 1]) throw new Error('--from-captures needs a manifest path.');
const manifestSchema = z.object({
  sources: z.array(mercedesVanReceiptSchema.extend({ finalUrl: z.url().optional() }).strip()),
});
const manifest = captured
  ? manifestSchema.parse(
      JSON.parse(
        await readFile(
          arg >= 0 ? process.argv[arg + 1]! : `${folder}/capture-vans-manifest.json`,
          'utf8',
        ),
      ),
    )
  : { sources: [] as z.infer<typeof manifestSchema>['sources'] };
await mkdir(folder, { recursive: true });
const used = new Map<string, z.infer<typeof mercedesVanReceiptSchema>>();
async function capture(url: string) {
  let source: z.infer<typeof mercedesVanReceiptSchema>, bytes: Buffer;
  if (captured) {
    const r = manifest.sources.findLast((r) => r.url === url);
    if (!r || (r.finalUrl && r.finalUrl !== url))
      throw new Error(`Missing or redirected Mercedes van source: ${url}`);
    source = mercedesVanReceiptSchema.parse({
      url: r.url,
      status: r.status,
      sha256: r.sha256,
      capturedAt: r.capturedAt,
    });
    bytes = await readFile(`${folder}/${source.sha256}`);
    if (hash(bytes) !== source.sha256) throw new Error('Mercedes van source checksum mismatch.');
  } else {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(45000) });
    bytes = Buffer.from(await response.arrayBuffer());
    source = mercedesVanReceiptSchema.parse({
      url,
      status: response.status,
      sha256: hash(bytes),
      capturedAt: new Date().toISOString(),
    });
    await writeFile(`${folder}/${source.sha256}`, bytes);
    manifest.sources.push(source);
    await writeFile(
      `${folder}/review-vans-capture-manifest.json`,
      JSON.stringify(manifest, null, 2) + '\n',
    );
  }
  if (source.status !== 200)
    throw new Error(`Mercedes van required source HTTP ${source.status}: ${url}`);
  used.set(url, source);
  return {
    source,
    text: bytes.toString('utf8'),
    json: () => JSON.parse(bytes.toString('utf8')) as unknown,
  };
}
const base = validateMercedesSnapshot(
  JSON.parse(await readFile('packages/car-catalog/data/manufacturers/mercedes.json', 'utf8')),
);
const context = await capture(mercedesVanInventoryUrl);
mercedesContext(context.text, true);
const clients: MercedesVanStockSnapshot['clients'] = [];
for (const c of mercedesVanClients) {
  const r = await capture(c.url);
  if (r.source.sha256 !== c.sha256)
    throw new Error('Mercedes native van inventory client changed; review before refresh.');
  clients.push(r.source);
}
const directory = await capture(mercedesVanDirectoryUrl),
  dealers = mercedesVanDirectory(directory.json());
const init = await capture(mercedesVanInitUrl),
  factory = await capture(mercedesVanModelsUrl);
const { references, modelCodes } = mercedesVanInventoryReferences(init.json(), factory.json());
const groups: MercedesVanStockSnapshot['groups'] = [],
  observations = new Map<string, MercedesVanStockSnapshot['observations'][number]>();
for (let i = 0; i < dealers.length; i += 3) {
  const selected = dealers.slice(i, i + 3),
    pages: MercedesVanStockSnapshot['groups'][number]['pages'] = [];
  let total = 0;
  for (let page = 0; page === 0 || page * 12 < total; page++) {
    const r = await capture(mercedesVanStockUrl(modelCodes, selected, page)),
      data = mercedesVanStockPageSchema.parse(r.json()).result;
    if (page === 0) total = data.paging.totalCount;
    if (
      data.paging.totalCount !== total ||
      data.paging.currentOffset !== page * 12 ||
      data.records.length !== Math.min(12, Math.max(0, total - page * 12))
    )
      throw new Error(
        'Mercedes van stock changed during pagination or page totals do not reconcile.',
      );
    const ids = data.records.map((raw) => {
      const vehicle = z.object({ vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/) }).parse(raw);
      const row = mercedesVanObservation(raw, hash(vehicle.vin)),
        prior = observations.get(row.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(row))
        throw new Error('Conflicting repeated Mercedes new-stock identity.');
      observations.set(row.id, row);
      return row.id;
    });
    pages.push({ source: r.source, page, offset: data.paging.currentOffset, count: 12, ids });
  }
  groups.push({ dealerIds: selected.map((d) => d.id), total, pages });
}
const known = new Set(base.vans.map((r) => r.key)),
  archives: MercedesVanStockSnapshot['archives'] = [];
for (const key of [
  ...new Set(
    [...observations.values()].filter((r) => r.available && !r.reserved).map((r) => r.key),
  ),
].sort()) {
  if (known.has(key)) continue;
  const reference = references.find((r) => r.key === key);
  if (!reference) throw new Error('Observed Mercedes van has no exact-year passenger reference.');
  const response = await capture(mercedesVanArchiveUrl(reference));
  archives.push({
    key,
    source: response.source,
    content: mercedesVanArchive(response.json(), reference),
  });
}
const retrievedAt = [...used.values()]
  .map((r) => r.capturedAt)
  .sort()
  .at(-1)!;
const snapshot = validateMercedesVanStockSnapshot(
  {
    schemaVersion: 1,
    market: 'CA',
    currency: 'CAD',
    retrievedAt,
    contextSource: context.source,
    directorySource: directory.source,
    initSource: init.source,
    factorySource: factory.source,
    clients,
    dealers,
    references,
    modelCodes,
    groups,
    observations: [...observations.values()],
    archives,
  },
  base,
);
let previous: MercedesVanStockSnapshot | undefined;
try {
  previous = validateMercedesVanStockSnapshot(JSON.parse(await readFile(target, 'utf8')), base);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
if (previous) mercedesVanStockNoRegression(previous, snapshot);
// Only the older additions are materialized here; current base profiles are
// enriched when this source is composed with the canonical catalog.
const additions = addMercedesVanStock(
  {
    schemaVersion: 1,
    reviewedAt: retrievedAt.slice(0, 10),
    scope: 'Mercedes new van stock import validation',
    pricingNote: 'Bare-model MSRP before optional stock equipment, fees and incentives.',
    cars: [],
    sources: [],
  },
  snapshot,
);
const serialized = await format(JSON.stringify(snapshot), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('Mercedes van offline reconstruction differs from reviewed snapshot.');
  console.log('Mercedes van source checksums and normalized offline reconstruction match.');
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  await writeFile(
    `${folder}/capture-vans-manifest.json`,
    JSON.stringify({ retrievedAt, sources: [...used.values()] }, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    dealers: dealers.length,
    groups: groups.length,
    pages: groups.reduce((n, g) => n + g.pages.length, 0),
    newVehicleIdentities: observations.size,
    observedModelYears: new Set([...observations.values()].map((r) => r.key)).size,
    olderBaseProfiles: additions.cars.length,
    fullMarketCoverageVerified: false,
  }),
);
