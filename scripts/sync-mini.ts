import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  miniOrigin,
  miniStockSortModes,
  miniBuilderUrl,
  miniCarouselUrl,
  miniLineUrl,
  miniStyleUrl,
  miniNavUrl,
  miniSpecUrl,
  miniRulesUrl,
  miniCarousel,
  miniLinesSchema,
  miniStylesSchema,
  miniTechnical,
  miniRulesSchema,
  miniNav,
  miniReceiptSchema,
  miniReviewedLineFailure,
  miniModelKey,
  validateMiniSnapshot,
} from '../packages/car-catalog/src/mini-import.ts';
import type {
  MiniReceipt,
  MiniSnapshot,
  MiniStockReference,
} from '../packages/car-catalog/src/mini-import.ts';
import { addMiniRetail } from '../packages/car-catalog/src/mini.ts';

const directory = 'data/raw/mini',
  stockDirectory = `${directory}/stock`,
  target = 'packages/car-catalog/data/manufacturers/mini.json';
const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const manifestSchema = z.object({
  retrievedAt: z.iso.datetime(),
  sources: z.array(miniReceiptSchema.strip()),
});
const offline = process.argv.includes('--offline'),
  argument = process.argv.indexOf('--from-captures'),
  captured = offline || argument >= 0;
const manifest = captured
  ? manifestSchema.parse(
      JSON.parse(
        await readFile(
          argument >= 0 ? process.argv[argument + 1]! : `${directory}/capture-manifest.json`,
          'utf8',
        ),
      ),
    )
  : { retrievedAt: new Date().toISOString(), sources: [] as MiniReceipt[] };
const stockManifest = manifestSchema.parse(
  JSON.parse(await readFile(`${stockDirectory}/capture-manifest.json`, 'utf8')),
);
if (manifest.retrievedAt.slice(0, 10) !== stockManifest.retrievedAt.slice(0, 10))
  throw new Error('MINI stock and factory captures must have the same source date.');
await mkdir(directory, { recursive: true });
async function verifiedBytes(source: MiniReceipt, folder: string) {
  const bytes = await readFile(`${folder}/${source.sha256}`);
  if (hash(bytes) !== source.sha256) throw new Error('MINI source checksum mismatch.');
  return bytes;
}
const cache = new Map<string, { source: MiniReceipt; text: string; json: () => unknown }>();
async function capture(url: string, reviewedCode?: string) {
  if (cache.has(url)) return cache.get(url)!;
  let source: MiniReceipt, bytes: Buffer;
  if (captured) {
    const saved = manifest.sources.find((s) => s.url === url);
    if (!saved) throw new Error(`Missing MINI source capture: ${url}`);
    source = saved;
    bytes = await verifiedBytes(source, directory);
  } else {
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    bytes = Buffer.from(await response.arrayBuffer());
    source = { url, status: response.status, sha256: hash(bytes) };
    await writeFile(`${directory}/${source.sha256}`, bytes);
    manifest.sources.push(source);
    await writeFile(
      `${directory}/review-capture-manifest.json`,
      JSON.stringify(manifest, null, 2) + '\n',
    );
  }
  // A failure is accepted only when its body matches the reviewed response byte for byte.
  if (source.status !== 200 && !(reviewedCode && miniReviewedLineFailure(source, reviewedCode)))
    throw new Error(`MINI refresh aborted on HTTP ${source.status}: ${url}`);
  const text = bytes.toString('utf8'),
    result = { source, text, json: () => JSON.parse(text) as unknown };
  cache.set(url, result);
  return result;
}
const stockRow = z.object({
  VIN: z.string().length(17),
  BrandCode: z.literal('M'),
  VehicleType: z.literal('C'),
  Status: z.literal('N'),
  IsNewInventory: z.literal(true),
  IsDemo: z.literal(false),
  VGCode: z.string().regex(/^[A-Z0-9]+$/),
  AGCode: z.string().min(1),
  ModelYear: z.number().int(),
  ModelDesc: z.string().min(1),
  FuelTypeCode: z.string().min(1),
  DriveTrain: z.string().min(1),
  Transmission: z.string().min(1),
  LineName: z.string().nullable(),
  MotorradBaseModelMSRP: z.number().nonnegative(),
});
const stockPage = z.object({
  Page: z.number().int(),
  ResultsPerPage: z.literal(36),
  TotalCount: z.number().int().positive(),
  VehiclesForThisPageList: z.array(stockRow),
});
const unique = new Set<string>(),
  refs = new Map<string, MiniStockReference>();
let total: number | null = null,
  returnedRows = 0;
for (const [index, source] of stockManifest.sources.entries()) {
  if (
    source.url !== `${miniOrigin}/en/shopping/inventory/InventorySearch_API` ||
    source.status !== 200 ||
    !source.requestSha256
  )
    throw new Error('Unexpected MINI stock source.');
  const bytes = await readFile(`${stockDirectory}/${source.requestSha256}`);
  if (hash(bytes) !== source.requestSha256)
    throw new Error('MINI inventory request checksum mismatch.');
  const request = JSON.parse(bytes.toString('utf8'));
  if (
    request.Brand !== 'MINI' ||
    request.Status !== 'N' ||
    request.OnlyDemoVehicles !== false ||
    request.IncludeVehiclesWithoutOffer !== true ||
    request.WithPhotosOnly !== false ||
    request.ResultsPerPage !== '36'
  )
    throw new Error('MINI inventory is not the national unfiltered new-stock search.');
  for (const field of [
    'ProvinceCode',
    'DealerID',
    'InternalRetailerIDs',
    'SeriesID',
    'ModelID',
    'ExteriorColorID',
    'InteriorColorID',
    'FuelType',
    'Transmission',
    'Vehicle_Line',
    'ModelYear_Minimum',
    'ModelYear_Maximum',
    'Price_Minimum',
    'Price_Maximum',
    'Kilometers_Minimum',
    'Kilometers_Maximum',
    'UserLatitude',
    'UserLongitude',
    'SearchDistanceFromUserLocationInKilometers',
    'FeaturedStockNumberList',
  ]) {
    const value = request[field];
    if (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0)
    )
      throw new Error(`Unexpected MINI stock filter: ${field}`);
  }
  const page = stockPage.parse(
    JSON.parse((await verifiedBytes(source, stockDirectory)).toString('utf8')),
  );
  // Each complete pass pages through every vehicle in one sort order.
  const pages = Math.ceil(page.TotalCount / 36),
    pass = Math.floor(index / pages);
  if (
    page.Page !== (index % pages) + 1 ||
    request.page !== page.Page ||
    request.SortMode !== miniStockSortModes[pass] ||
    (total !== null && page.TotalCount !== total)
  )
    throw new Error('MINI stock pagination changed.');
  total = page.TotalCount;
  returnedRows += page.VehiclesForThisPageList.length;
  for (const raw of page.VehiclesForThisPageList) {
    // Sort ties can repeat a vehicle across pages; each one is counted once.
    if (unique.has(raw.VIN)) continue;
    unique.add(raw.VIN);
    const key = miniModelKey({ year: raw.ModelYear, code: raw.VGCode });
    const row: MiniStockReference = refs.get(key) ?? {
      year: raw.ModelYear,
      code: raw.VGCode,
      agCodes: [],
      names: [],
      transmissions: [],
      fuels: [],
      drives: [],
      lines: [],
      supplierBasePrices: [],
      observedVehicles: 0,
    };
    for (const [field, value] of [
      ['agCodes', raw.AGCode],
      ['names', raw.ModelDesc],
      ['transmissions', raw.Transmission],
      ['fuels', raw.FuelTypeCode],
      ['drives', raw.DriveTrain],
    ] as const)
      if (!row[field].includes(value)) row[field].push(value);
    if (!row.lines.includes(raw.LineName)) row.lines.push(raw.LineName);
    if (!row.supplierBasePrices.includes(raw.MotorradBaseModelMSRP))
      row.supplierBasePrices.push(raw.MotorradBaseModelMSRP);
    row.observedVehicles++;
    refs.set(key, row);
  }
}
if (
  total === null ||
  unique.size !== total ||
  stockManifest.sources.length % Math.ceil(total / 36) !== 0 ||
  returnedRows !== total * (stockManifest.sources.length / Math.ceil(total / 36))
)
  throw new Error('MINI stock totals do not reconcile.');
const home = await capture(`${miniOrigin}/en`),
  builder = await capture(miniBuilderUrl);
if (!builder.text.includes('Canadian dollars') || !builder.text.includes('Base MSRP'))
  throw new Error('MINI Canadian MSRP context is missing.');
const clientPath = /src="(\/bundles\/js\/auto\/config[^\"]*)"/
  .exec(builder.text)?.[1]
  ?.replaceAll('&amp;', '&');
if (!clientPath) throw new Error('MINI published configurator client is missing.');
const client = await capture(`${miniOrigin}${clientPath}`);
if (!client.text.includes('.minicdn.ca') || !client.text.includes('/v1/config/carousel'))
  throw new Error('MINI public API link is missing from the official client.');
const carousel = await capture(miniCarouselUrl),
  parsed = miniCarousel(carousel.json()),
  rules = await capture(miniRulesUrl);
const overviewFamilies = [
  ...new Set([...home.text.matchAll(/buildandprice(?:#)?\?model=([A-Z0-9-]+)/g)].map((m) => m[1]!)),
];
const overviewCodes = [
  ...new Set(
    [...home.text.matchAll(/\/nav\/models\/([A-Z0-9]+)(?:-main)?\.png/g)].map((m) => m[1]!),
  ),
];
const snapshot: MiniSnapshot = {
  schemaVersion: 1,
  retrievedAt: manifest.retrievedAt,
  context: { country: 'CA', currency: 'CAD', language: 'en' },
  homeSource: home.source,
  builderSource: builder.source,
  clientSource: client.source,
  carouselSource: carousel.source,
  rulesSource: rules.source,
  rules: miniRulesSchema.parse(rules.json()),
  years: parsed.years,
  currentModelKeys: parsed.models.map(miniModelKey),
  selectorReferenceCount: parsed.models.reduce((n, m) => n + m.families.length, 0),
  overviewFamilies,
  overviewCodes,
  inventory: {
    retrievedAt: stockManifest.retrievedAt,
    total,
    returnedRows,
    distinctVehicles: unique.size,
    sources: stockManifest.sources,
    references: [...refs.values()],
  },
  models: [],
  records: [],
};
const current = new Map(parsed.models.map((m) => [miniModelKey(m), m]));
const keys = [...new Set([...current.keys(), ...refs.keys()])].sort();
for (const key of keys) {
  const c = current.get(key) ?? null,
    stock = refs.get(key),
    code = c?.code ?? stock!.code,
    year = c?.year ?? stock!.year;
  const lineSource = await capture(miniLineUrl(code), code),
    spec = await capture(miniSpecUrl(code));
  const lines = lineSource.source.status === 200 ? miniLinesSchema.parse(lineSource.json()) : null;
  const model: MiniSnapshot['models'][number] = {
    key,
    year,
    code,
    current: c,
    stockKey: stock ? key : null,
    lineSource: lineSource.source,
    lines,
    technicalSource: spec.source,
    technical: miniTechnical(spec.json(), code),
  };
  snapshot.models.push(model);
  if (!c) {
    snapshot.records.push({
      modelKey: key,
      lineId: null,
      style: null,
      styleSource: null,
      expectedStyleIds: [],
      navSource: null,
      nav: null,
      stockBaseOnly: true,
    });
    continue;
  }
  if (!lines?.LineList.length) throw new Error(`Missing active MINI equipment lines: ${key}`);
  for (const line of lines.LineList) {
    const styleCapture = await capture(miniStyleUrl(code, line.lineid)),
      styles = miniStylesSchema.parse(styleCapture.json());
    if (styles.Price !== lines.Price || styles.Vehicle !== lines.Vehicle)
      throw new Error(`MINI style/model price identity mismatch: ${key}`);
    for (const style of styles.Styles.length ? styles.Styles : [null]) {
      const nav = await capture(miniNavUrl(code, line.lineid, style?.StyleID ?? null));
      snapshot.records.push({
        modelKey: key,
        lineId: line.lineid,
        style,
        styleSource: styleCapture.source,
        expectedStyleIds: styles.Styles.map((s) => s.StyleID),
        navSource: nav.source,
        nav: miniNav(nav.json()),
        stockBaseOnly: false,
      });
    }
  }
}
const valid = validateMiniSnapshot(snapshot);
const catalog = addMiniRetail(
  {
    schemaVersion: 1,
    reviewedAt: valid.retrievedAt.slice(0, 10),
    scope: 'MINI source validation',
    pricingNote: 'CAD factory MSRP before fees and taxes.',
    sources: [],
    cars: [],
  },
  valid,
);
const serialized = await format(JSON.stringify(valid), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('MINI offline reconstruction differs.');
  console.log(`Verified MINI offline reconstruction: ${catalog.cars.length} retail profiles.`);
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  await writeFile(`${directory}/capture-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `Wrote ${catalog.cars.length} MINI retail profiles from ${valid.models.length} exact model/year codes.`,
  );
}
