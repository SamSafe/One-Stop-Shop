import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  bmwApi,
  assertBmwSourceResponse,
  bmwLineupUrl,
  bmwOverview,
  bmwModels,
  bmwGearCodes,
  bmwGearUrl,
  bmwSolverUrl,
  bmwSolverSchema,
  bmwPriceUrl,
  bmwPriceRequest,
  bmwPrices,
  bmwTechnicalUrl,
  bmwTechnical,
  bmwReferenceKey,
  bmwRecordKey,
  validateBmwSnapshot,
} from '../packages/car-catalog/src/bmw-import.ts';
import type {
  BmwReceipt,
  BmwSnapshot,
  BmwStockReference,
} from '../packages/car-catalog/src/bmw-import.ts';

import { addBmwRetail } from '../packages/car-catalog/src/bmw.ts';

const directory = 'data/raw/bmw',
  target = 'packages/car-catalog/data/manufacturers/bmw.json',
  stockDirectory = `${directory}/stock`;
const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const sourceSchema = z.object({
  url: z.url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.number().int().default(200),
  requestSha256: z.string().optional(),
});
const manifestSchema = z.object({ retrievedAt: z.iso.datetime(), sources: z.array(sourceSchema) });
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
  : { retrievedAt: new Date().toISOString(), sources: [] as BmwReceipt[] };
await mkdir(directory, { recursive: true });
const date = manifest.retrievedAt.slice(0, 10);
const stockManifest = manifestSchema.parse(
  JSON.parse(await readFile(`${stockDirectory}/capture-manifest.json`, 'utf8')),
);
if (stockManifest.retrievedAt.slice(0, 10) !== date)
  throw new Error(
    'BMW inventory capture must have the same source date. Refresh the public stock capture before refreshing factory data.',
  );
async function bytesFor(source: z.infer<typeof sourceSchema>, path: string) {
  const bytes = await readFile(`${path}/${source.sha256}`);
  if (hash(bytes) !== source.sha256) throw new Error('BMW source checksum mismatch.');
  return bytes;
}
async function capture(url: string, headers: Record<string, string> = {}, request?: unknown) {
  const body = request ? JSON.stringify(request) : undefined,
    requestSha256 = body ? hash(body) : undefined;
  let bytes: Buffer, source: BmwReceipt;
  if (captured) {
    const saved = manifest.sources.find(
      (source) => source.url === url && source.requestSha256 === requestSha256,
    );
    if (!saved) throw new Error(`Missing BMW source capture: ${url} (${requestSha256 ?? 'GET'})`);
    source = saved;
    bytes = await bytesFor(saved, directory);
    if (body) {
      const original = await readFile(`${directory}/${requestSha256}`);
      if (hash(original) !== requestSha256 || original.toString('utf8') !== body)
        throw new Error('BMW request checksum mismatch.');
    }
  } else {
    const response = await fetch(url, {
      headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { method: 'POST', body } : {}),
      signal: AbortSignal.timeout(45000),
    });
    bytes = Buffer.from(await response.arrayBuffer());
    source = {
      url,
      sha256: hash(bytes),
      status: response.status,
      ...(requestSha256 ? { requestSha256 } : {}),
    };
    await writeFile(`${directory}/${source.sha256}`, bytes);
    if (body) await writeFile(`${directory}/${requestSha256}`, body);
    manifest.sources.push(source);
    await writeFile(
      `${directory}/review-capture-manifest.json`,
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }
  assertBmwSourceResponse(url, source.status ?? 200, bytes.toString('utf8'));
  return {
    source,
    text: bytes.toString('utf8'),
    json: () => JSON.parse(bytes.toString('utf8')) as unknown,
  };
}
const stockVehicles = new Map<string, Record<string, unknown>>();
let total: number | null = null,
  returnedRows = 0;
const pageSchema = z.object({
  Page: z.number().int().positive(),
  ResultsPerPage: z.literal(48),
  TotalCount: z.number().int().positive(),
  VehiclesForThisPageList: z.array(
    z.object({
      VIN: z.string().length(17),
      BrandCode: z.enum(['B', 'I']),
      VehicleType: z.literal('C'),
      VGCode: z.string().min(1),
      AGCode: z.string().min(1),
      ModelYear: z.number().int(),
      ModelDesc: z.string().min(1),
      BMWSeriesID: z.string().min(1).nullable(),
      BMWBodyStyleID: z.string().min(1),
      FuelTypeCode: z.string().min(1),
      Transmission: z.string().min(1),
      BasePrice: z.number(),
      MotorradBaseModelMSRP: z.number(),
    }),
  ),
});
for (let index = 0; index < stockManifest.sources.length; index++) {
  const source = stockManifest.sources[index]!;
  if (source.url !== 'https://inventory.bmw.ca/InventorySearch_API' || !source.requestSha256)
    throw new Error('Unexpected BMW stock source.');
  const requestBytes = await readFile(`${stockDirectory}/${source.requestSha256}`);
  if (hash(requestBytes) !== source.requestSha256)
    throw new Error('BMW inventory request checksum mismatch.');
  const request = JSON.parse(requestBytes.toString('utf8'));
  if (
    request.Brand !== 'BMW' ||
    request.Status !== 'N' ||
    request.OnlyDemoVehicles !== false ||
    request.IncludeVehiclesWithoutOffer !== true ||
    request.page !== index + 1 ||
    request.ResultsPerPage !== '48' ||
    request.SeriesList.length ||
    request.EngineList.length ||
    request.ProvinceCode ||
    request.ModelYear_Minimum ||
    request.ModelYear_Maximum ||
    request.Price_Minimum ||
    request.Price_Maximum
  )
    throw new Error('BMW inventory source is not the unfiltered Canadian new-vehicle search.');
  const data = pageSchema.parse(
    JSON.parse((await bytesFor(source, stockDirectory)).toString('utf8')),
  );
  if (data.Page !== index + 1 || (total !== null && total !== data.TotalCount))
    throw new Error('BMW stock pagination total changed.');
  total = data.TotalCount;
  returnedRows += data.VehiclesForThisPageList.length;
  for (const row of data.VehiclesForThisPageList)
    if (!stockVehicles.has(row.VIN)) stockVehicles.set(row.VIN, row);
}
if (returnedRows !== total || stockManifest.sources.length !== Math.ceil(total! / 48))
  throw new Error('BMW stock pages do not reconcile.');
const references = new Map<string, BmwStockReference>();
for (const raw of stockVehicles.values()) {
  const row = raw as z.infer<typeof pageSchema>['VehiclesForThisPageList'][number];
  const key = `${row.ModelYear}/${row.VGCode}/${row.AGCode}`;
  let reference = references.get(key);
  if (!reference) {
    reference = {
      code: row.VGCode,
      agCode: row.AGCode,
      apiBrand: row.BrandCode === 'I' ? 'bmwi' : 'bmwCar',
      year: row.ModelYear,
      name: row.ModelDesc,
      series: row.BMWSeriesID ?? row.ModelDesc,
      body: row.BMWBodyStyleID,
      fuel: row.FuelTypeCode,
      names: [],
      transmissions: [],
      baseMsrpValues: [],
      observedStockReferences: 0,
    };
    references.set(key, reference);
  }
  if (reference.body !== row.BMWBodyStyleID || reference.fuel !== row.FuelTypeCode)
    throw new Error('BMW same-identity stock evidence conflicts.');
  reference.observedStockReferences++;
  if (!reference.names.includes(row.ModelDesc)) reference.names.push(row.ModelDesc);
  if (!reference.transmissions.includes(row.Transmission))
    reference.transmissions.push(row.Transmission);
  if (!reference.baseMsrpValues.includes(row.MotorradBaseModelMSRP))
    reference.baseMsrpValues.push(row.MotorradBaseModelMSRP);
}
const lineup = await capture(bmwLineupUrl),
  shellUrl = 'https://configure.bmw.ca/en_CA/configure/F74/272A',
  shell = await capture(shellUrl);
if (lineup.source.status !== 200 || shell.source.status !== 200)
  throw new Error('BMW Canadian source page failed.');
const settingsFile = /\/en_CA\/(settings\.[a-f0-9]+\.json)/.exec(shell.text)?.[1];
if (!settingsFile) throw new Error('BMW public Canadian settings link is missing.');
const settingsResponse = await capture(`https://configure.bmw.ca/en_CA/${settingsFile}`);
const settings = z
  .object({
    APP: z.object({
      country: z.literal('ca'),
      market: z.literal('ca'),
      backend: z.record(
        z.string(),
        z
          .object({
            baseUrl: z.string().optional(),
            headers: z.record(z.string(), z.string()).optional(),
          })
          .passthrough(),
      ),
    }),
    LOCALE: z.object({
      iso: z.literal('en-CA'),
      country: z.literal('ca'),
      currency: z.object({ currency: z.literal('CAD') }),
    }),
  })
  .parse(settingsResponse.json());
const headers = (service: string) => settings.APP.backend[service]?.headers ?? {};
const matrixSources: BmwReceipt[] = [],
  matrixModels = new Map<string, BmwSnapshot['matrixModels'][number]>();
for (const brand of ['bmwCar', 'bmwi']) {
  const response = await capture(
    `${bmwApi}/model-matrices/vehicle-trees/connext-bmw/sources/pcaso/brands/${brand}/countries/ca/effect-dates/${date}/order-dates/${date}?gfs-policy=none&cluster=default&future-models=true&closest-fallback=true`,
    headers('settingsVehicleTree'),
  );
  if (response.source.status !== 200) throw new Error('BMW current model tree failed.');
  matrixSources.push(response.source);
  for (const model of bmwModels(response.json(), true)) matrixModels.set(model.code, model);
}
const local = await capture(
  `${bmwApi}/localisations/overridden-vehicle-data/sources/pcaso/brands/bmwCar/countries/ca/effect-dates/${date}/order-dates/${date}/applications/connext/models/languages/en`,
  headers('settingsLocalisation'),
);
if (local.source.status !== 200) throw new Error('BMW Canadian model localisation failed.');
const localModels = new Map(bmwModels(local.json(), false).map((model) => [model.code, model]));
const priceMetadata = await capture(
  `${bmwApi}/pricing/metadata/price-lists/pcaso,con/brands/bmwCar/countries/ca`,
  headers('settingsPricing'),
);
z.object({ availableCurrencies: z.object({ defaultCurrency: z.literal('CAD') }) }).parse(
  priceMetadata.json(),
);
const snapshot: BmwSnapshot = {
  schemaVersion: 1,
  retrievedAt: manifest.retrievedAt,
  date,
  context: { country: 'ca', currency: 'CAD', locale: 'en-CA', technicalCountryGroup: 'us' },
  lineupSource: lineup.source,
  shellSource: shell.source,
  settingsSource: settingsResponse.source,
  matrixSources,
  localModelsSource: local.source,
  priceMetadataSource: priceMetadata.source,
  overview: bmwOverview(lineup.text),
  matrixModels: [...matrixModels.values()],
  inventory: {
    retrievedAt: stockManifest.retrievedAt,
    total: total!,
    returnedRows,
    distinctStockRecords: stockVehicles.size,
    pageSize: 48,
    sources: stockManifest.sources,
    modelReferences: [...references.values()],
  },
  records: [],
};
for (const reference of references.values()) {
  const candidate = matrixModels.get(reference.code) ?? localModels.get(reference.code),
    model = candidate?.agCode === reference.agCode ? candidate : null;
  const gear = await capture(
    bmwGearUrl(reference.code, date, reference.apiBrand),
    headers('settingsLocalisation'),
  );
  const gearCodes = gear.source.status === 200 ? bmwGearCodes(gear.json()) : [];
  const seen = new Set<string>();
  for (const requestedGear of [null, ...gearCodes]) {
    const solver = await capture(
      bmwSolverUrl(reference.code, date, requestedGear, reference.apiBrand),
      headers('settingsRuleSolver'),
    );
    const raw = solver.source.status === 200 ? (solver.json() as Record<string, unknown>) : null;
    const configuration = raw?.constructible === true ? bmwSolverSchema.parse(raw) : null;
    if (requestedGear && !configuration) continue;
    const options = configuration ? Object.keys(configuration.configuration.elements).sort() : [];
    const key =
      configuration?.classifiedConfiguration.transmission.transmissionOption ??
      configuration?.classifiedConfiguration.transmission.type ??
      'base';
    if (seen.has(key)) continue;
    seen.add(key);
    const price = await capture(
      bmwPriceUrl(reference.apiBrand),
      headers('settingsPricing'),
      bmwPriceRequest(
        reference.code,
        date,
        options,
        configuration?.classifiedConfiguration.volt48.isVolt48Variant ?? false,
      ),
    );
    const tech = configuration
      ? await capture(bmwTechnicalUrl(reference.agCode, date, options), headers('settingsOtd'))
      : null;
    const row: BmwSnapshot['records'][number] = {
      referenceKey: bmwReferenceKey(reference),
      requestedGear,
      gearCodes,
      gearSource: gear.source,
      model,
      solverSource: solver.source,
      configuration,
      priceSource: price.source,
      prices: price.source.status === 200 ? bmwPrices(price.json()) : null,
      modelBaseOnly: configuration === null,
      technicalSource: tech?.source ?? null,
      technical: tech?.source.status === 200 ? bmwTechnical(tech.json()) : null,
    };
    snapshot.records.push(row);
  }
  console.log(
    `${reference.year} BMW ${reference.code}: ${snapshot.records.filter((row) => row.referenceKey === bmwReferenceKey(reference)).length} verified/stock-base profiles`,
  );
}
const valid = validateBmwSnapshot(snapshot);
addBmwRetail(
  {
    schemaVersion: 1,
    reviewedAt: valid.date,
    scope: 'Canadian BMW source validation',
    pricingNote: 'Factory MSRP before delivery, fees, taxes and incentives.',
    sources: [],
    cars: [],
  },
  valid,
);
if (new Set(valid.records.map(bmwRecordKey)).size !== valid.records.length)
  throw new Error('BMW configuration identities do not reconcile.');
const serialized = await format(JSON.stringify(valid), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('Offline BMW snapshot differs.');
  console.log('Verified BMW offline reconstruction.');
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  if (!captured)
    await writeFile(`${directory}/capture-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${valid.records.length} BMW retail profiles.`);
}
