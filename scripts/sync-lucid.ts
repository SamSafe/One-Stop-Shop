import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  lucidModels,
  lucidBuilderUrl,
  lucidCpqUrl,
  lucidStockUrl,
  lucidDeliveryPoints,
  lucidSelectionClientUrl,
  lucidSelectionClientSha256,
  lucidReceiptSchema,
  lucidBuilderLoader,
  lucidLineup,
  lucidOptionsSchema,
  lucidTrimSchema,
  lucidStockResponseSchema,
  lucidStockSelection,
  lucidFactoryProfiles,
  lucidPower,
  lucidYearKey,
  lucidRequireNoRegression,
  validateLucidSnapshot,
  lucidSnapshotSchema,
} from '../packages/car-catalog/src/lucid-import.ts';
import type { LucidReceipt, LucidSnapshot } from '../packages/car-catalog/src/lucid-import.ts';
import { addLucidRetail } from '../packages/car-catalog/src/lucid.ts';

const folder = 'data/raw/lucid',
  target = 'packages/car-catalog/data/manufacturers/lucid.json';
const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
const manifestSchema = z.object({
  retrievedAt: z.iso.datetime(),
  sources: z.array(lucidReceiptSchema.strip()),
});
const offline = process.argv.includes('--offline'),
  arg = process.argv.indexOf('--from-captures');
const captured = offline || arg >= 0;
const manifest = captured
  ? manifestSchema.parse(
      JSON.parse(
        await readFile(
          arg >= 0 ? process.argv[arg + 1]! : `${folder}/capture-manifest.json`,
          'utf8',
        ),
      ),
    )
  : { retrievedAt: new Date().toISOString(), sources: [] as LucidReceipt[] };
await mkdir(folder, { recursive: true });
const usedUrls = new Set<string>();
async function capture(url: string) {
  usedUrls.add(url);
  let source: LucidReceipt, bytes: Buffer;
  if (captured) {
    const receipt = manifest.sources.find((s) => s.url === url);
    if (!receipt) throw new Error(`Missing Lucid source capture: ${url}`);
    source = receipt;
    bytes = await readFile(`${folder}/${source.sha256}`);
    if (hash(bytes) !== source.sha256) throw new Error('Lucid source checksum mismatch.');
  } else {
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    bytes = Buffer.from(await response.arrayBuffer());
    const receipt = { url, status: response.status, sha256: hash(bytes) };
    await writeFile(`${folder}/${receipt.sha256}`, bytes);
    if (!response.ok || response.url !== url)
      throw new Error(
        `Lucid required source HTTP ${response.status} or unexpected redirect: ${url}`,
      );
    source = lucidReceiptSchema.parse(receipt);
    manifest.sources.push(source);
    await writeFile(
      `${folder}/review-capture-manifest.json`,
      JSON.stringify(manifest, null, 2) + '\n',
    );
  }
  return {
    source,
    text: bytes.toString('utf8'),
    json: () => JSON.parse(bytes.toString('utf8')) as unknown,
  };
}
const home = await capture('https://lucidmotors.com/en-ca'),
  overview = { source: home.source, ...lucidLineup(home.text) };
const client = await capture(lucidSelectionClientUrl);
if (client.source.sha256 !== lucidSelectionClientSha256)
  throw new Error('Lucid visible selection client changed; review it before import.');
const current: LucidSnapshot['current'] = [];
const on = manifest.retrievedAt.slice(0, 10);
for (const model of overview.models) {
  const response = await capture(lucidBuilderUrl(model));
  if (!response.text.includes(new URL(lucidSelectionClientUrl).pathname))
    throw new Error('Lucid reviewed selector is no longer linked by the builder.');
  const builder = lucidBuilderLoader(response.text, model);
  const expanded = builder.data.trimData.map((t) => lucidFactoryProfiles(builder, t, on));
  const profiles = expanded.flatMap((r) => r.profiles).sort((a, b) => a.key.localeCompare(b.key));
  current.push({
    source: response.source,
    builder,
    profiles,
    expectedProfileKeys: profiles.map((p) => p.key),
    states: expanded.reduce((n, r) => n + r.states, 0),
    transitions: expanded.reduce((n, r) => n + r.transitions, 0),
  });
}
const searches: LucidSnapshot['searches'] = [],
  rawRows = new Map<
    string,
    { row: z.infer<typeof lucidStockResponseSchema>['data'][number]; searches: string[] }
  >();
const queries = Object.keys(lucidDeliveryPoints).flatMap((p) =>
  lucidModels.map((model) => ({
    model,
    province: p as keyof typeof lucidDeliveryPoints,
    variant: null as string | null,
  })),
);
for (const c of current)
  for (const t of c.builder.data.trimData)
    queries.push({ model: c.builder.model, province: 'AB', variant: t.variant[0]! });
for (const q of queries) {
  const key = `${q.province}/${q.model}/${q.variant ?? 'all'}`,
    response = await capture(lucidStockUrl(q.model, q.province, q.variant ?? undefined));
  const rows = lucidStockResponseSchema.parse(response.json()).data;
  if (rows.length >= 200)
    throw new Error(
      'Lucid inventory reached its unpaged cap; partition and reconcile before import.',
    );
  const identities: string[] = [];
  for (const row of rows) {
    if (
      row.model.sapCode.toLowerCase() !== q.model ||
      (q.variant && row.modelVariant.sapCode !== q.variant)
    )
      throw new Error('Lucid inventory query identity mismatch.');
    const id = hash(row.VIN);
    identities.push(id);
    const previous = rawRows.get(id);
    // Delivery estimates, ordering and discounts may differ by region. Exact
    // model-year/equipment and the pre-discount published total must agree.
    if (
      previous &&
      [
        previous.row.modelYear,
        previous.row.bundle.sapCode,
        previous.row.zlList,
        previous.row.price.value,
      ].join('|') !== [row.modelYear, row.bundle.sapCode, row.zlList, row.price.value].join('|')
    )
      throw new Error('Lucid regional vehicle identity/equipment/price conflict.');
    if (previous) previous.searches.push(key);
    else rawRows.set(id, { row, searches: [key] });
  }
  searches.push({ ...q, key, source: response.source, identities: identities.sort() });
}
const keys = new Set([
  ...current.map((c) => lucidYearKey(c.builder.model, c.builder.modelYear)),
  ...[...rawRows.values()].map(({ row }) =>
    lucidYearKey(row.model.sapCode.toLowerCase(), row.modelYear),
  ),
]);
const years: LucidSnapshot['years'] = [];
for (const key of [...keys].sort()) {
  const [rawModel, rawYear] = key.split('/'),
    model = z.enum(lucidModels).parse(rawModel),
    year = Number(rawYear);
  const prices = await capture(lucidCpqUrl(model, year, 'prCodes')),
    trims = await capture(lucidCpqUrl(model, year, 'trimsDetails')),
    specs = await capture(lucidCpqUrl(model, year, 'specs'));
  const trimData = z.array(lucidTrimSchema).min(1).parse(trims.json());
  years.push({
    model,
    year,
    options: lucidOptionsSchema.parse(prices.json()),
    trims: trimData,
    priceSource: prices.source,
    trimsSource: trims.source,
    specsSource: specs.source,
    power: trimData.map((t) => lucidPower(specs.json(), model, t)),
  });
}
const stock: LucidSnapshot['stock'] = [...rawRows.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([identityHash, { row, searches }]) => {
    const model = z.enum(lucidModels).parse(row.model.sapCode.toLowerCase()),
      y = years.find((y) => y.model === model && y.year === row.modelYear)!;
    const selection = lucidStockSelection(row, y.options, on);
    return {
      identityHash,
      model,
      year: row.modelYear,
      trim: row.bundle.sapCode,
      variant: row.modelVariant.sapCode,
      selected: selection.selected,
      removedCodes: selection.removed,
      listedTotalCad: row.price.value,
      afterDiscountPriceCad: row.price.afterDiscountPrice,
      subCategory: row.subCategory,
      availability: row.availability,
      searchKeys: searches.sort(),
    };
  });
const snapshot = validateLucidSnapshot(
  {
    version: 1,
    market: 'CA',
    currency: 'CAD',
    retrievedAt: manifest.retrievedAt,
    overview,
    selectionClient: client.source,
    current,
    years,
    searches,
    stock,
  },
  true,
);
const catalog = addLucidRetail(
  {
    schemaVersion: 1,
    reviewedAt: on,
    scope: 'Canadian Lucid import validation',
    pricingNote: 'Factory MSRP before paint, destination, taxes, fees and incentives.',
    cars: [],
    sources: [],
  },
  snapshot,
);
if (!captured) {
  let previous: LucidSnapshot | undefined;
  try {
    // The baseline was reviewed against the client pinned at its own date, so only
    // its shape is checked before comparing offerings.
    previous = lucidSnapshotSchema.parse(JSON.parse(await readFile(target, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (previous) lucidRequireNoRegression(previous, snapshot);
}
const serialized = await format(JSON.stringify(snapshot), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('Lucid offline reconstruction differs from the reviewed snapshot.');
  console.log('Lucid source checksums and normalized offline reconstruction match.');
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  await writeFile(
    `${folder}/capture-manifest.json`,
    JSON.stringify(
      { ...manifest, sources: manifest.sources.filter((s) => usedUrls.has(s.url)) },
      null,
      2,
    ) + '\n',
  );
}
console.log(
  JSON.stringify({
    currentProfiles: current.reduce((n, c) => n + c.profiles.length, 0),
    observedNewVehicles: stock.length,
    searches: searches.length,
    retailProfiles: catalog.cars.length,
  }),
);
