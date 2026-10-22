import { z } from 'zod';
import { publishedJson } from './published-json';

export const mitsubishiOrigin = 'https://www.mitsubishi-motors.ca';
export const mitsubishiSelectorUrl = `${mitsubishiOrigin}/en/buy/configure-your-mitsubishi/configurator`;
export const mitsubishiStartUrl = `${mitsubishiOrigin}/en/buy/configure-your-mitsubishi`;
export const mitsubishiGraphqlUrl = 'https://www-graphql.prod.mipulse.co/prod/graphql';
export const mitsubishiInventoryUrl =
  'https://clickshop.mitsubishi-motors.ca/api/quickshop/inventory/models/?condition=New&page=1&sort=availability';
const text = z.string().min(1),
  year = z.number().int().min(2020).max(2100);
const officialUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    [
      'www.mitsubishi-motors.ca',
      'clickshop.mitsubishi-motors.ca',
      'www-graphql.prod.mipulse.co',
    ].includes(url.hostname) &&
    !url.username &&
    !url.password
  );
});
const receipt = z.strictObject({
  url: officialUrl,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  requestSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
});
export type MitsubishiReceipt = z.infer<typeof receipt>;
const familySchema = z.object({
  vehicleCode: text,
  vehicleGuid: text,
  yearList: z.array(year).min(1),
  vehicleInfo: z
    .array(z.object({ vehicleCode: text, year, activeModelCodes: z.array(text).min(1) }))
    .min(1),
});
const fee = z.object({ label: z.string(), value: z.number() });
const price = z.object({
  label: z.string().nullable(),
  value: z.number().nonnegative(),
  baseValue: z.number().nonnegative(),
  displayValue: z.string(),
  fees: z.array(fee),
});
const modelSchema = z.object({
  id: text,
  code: text,
  name: text,
  year,
  trimLine: text,
  sortOrder: z.string(),
  price,
  allInPrice: z
    .object({ label: z.string().nullable(), value: z.number(), displayValue: z.string() })
    .nullable(),
  description: z.string().nullable(),
  descriptionList: z.array(z.string()),
  engineCode: z.string(),
  engineSize: z.string(),
  engineType: z.string(),
  fuelType: z.string(),
  transmissionType: z.string(),
  transmissionCode: z.string(),
  transmissionDescription: z.string(),
  drivetrain: z.string(),
  seats: z.number().int().min(2).max(15),
  doors: z.number().int(),
});
export type MitsubishiModel = z.infer<typeof modelSchema>;
const specification = z.object({
  category: z.string(),
  label: z.string(),
  value: z.string(),
  unitOfMeasurement: z.string().nullable(),
});
const specModel = z.object({
  id: text,
  code: text,
  name: text,
  price: z.object({ value: z.number() }),
  specifications: z.array(specification),
});
const specsSchema = z.strictObject({
  source: receipt,
  name: text,
  priceCad: z.number(),
  fields: z.array(specification),
});
const inventoryReference = z.object({
  year,
  model: text,
  num_items: z.number().int().nonnegative(),
  make: z.literal('Mitsubishi'),
  vehicle_condition: z.literal('New'),
  is_used: z.literal(false),
  is_cpo: z.literal(false),
});
export type MitsubishiInventoryReference = z.infer<typeof inventoryReference>;
const modelYear = z.strictObject({
  key: text,
  vehicleCode: text,
  vehicleGuid: text,
  name: text,
  year,
  currentBuildListing: z.boolean(),
  expectedCodes: z.array(text).min(1),
  priceSource: receipt,
  specificationsSource: receipt.nullable(),
  inventoryReference: inventoryReference.nullable(),
});
const record = z.strictObject({
  modelKey: text,
  model: modelSchema,
  specification: specsSchema.nullable(),
  specificationGap: z.string().nullable(),
});
export type MitsubishiRecord = z.infer<typeof record>;
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  selectorSource: receipt,
  startSource: receipt,
  inventorySources: z.array(receipt).min(1),
  inventoryReferences: z.array(inventoryReference).min(1),
  currentModelKeys: z.array(text).min(1),
  models: z.array(modelYear).min(1),
  records: z.array(record).min(1),
  inventoryGaps: z.array(
    z.strictObject({ reference: inventoryReference, source: receipt, reason: text }),
  ),
});
export type MitsubishiSnapshot = z.infer<typeof snapshotSchema>;
export const mitsubishiModelKey = (code: string, year: number) => `${code}/${year}`;
export const mitsubishiKey = (record: MitsubishiRecord) =>
  `${record.modelKey}/${record.model.code}`;
export function mitsubishiApollo(html: string) {
  const config = z
    .object({
      appRegion: z.literal('ca'),
      appMode: z.literal('liveapp'),
      GQLParams: z.object({
        endpoint: z.literal(mitsubishiGraphqlUrl),
        appRegion: z.literal('ca'),
        appLang: z.literal('en'),
      }),
      Config: z.object({
        market: z.literal('ca'),
        currencyFormat: z.literal('CAD'),
        measurementSystem: z.literal('metric'),
      }),
    })
    .parse(publishedJson(html, 'window.__PRELOADED_STATE__', 'Mitsubishi'));
  const rows = z
    .record(z.string(), z.unknown())
    .parse(publishedJson(html, 'window.__APOLLO_STATE__', 'Mitsubishi'));
  function resolve(value: unknown, depth = 0): unknown {
    if (depth > 80) throw new Error('Cyclic Mitsubishi public data reference.');
    if (Array.isArray(value)) return value.map((item) => resolve(item, depth + 1));
    if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      if (object.type === 'id' && typeof object.id === 'string') {
        if (!(object.id in rows)) throw new Error('Missing Mitsubishi public data reference.');
        return resolve(rows[object.id], depth + 1);
      }
      if (object.type === 'json' && 'json' in object) return object.json;
      return Object.fromEntries(
        Object.entries(object).map(([key, value]) => [key, resolve(value, depth + 1)]),
      );
    }
    return value;
  }
  return {
    config,
    byType: (type: string) =>
      Object.values(rows)
        .filter(
          (value) =>
            value &&
            typeof value === 'object' &&
            (value as Record<string, unknown>).__typename === type,
        )
        .map((value) => resolve(value)),
  };
}
function sameSet(actual: string[], expected: string[], label: string) {
  if (
    new Set(actual).size !== actual.length ||
    new Set(expected).size !== expected.length ||
    actual.length !== expected.length ||
    actual.some((value) => !expected.includes(value))
  )
    throw new Error(`Mitsubishi ${label} do not reconcile.`);
}
export function mitsubishiLineup(html: string, startHtml: string) {
  const data = mitsubishiApollo(html),
    configs = data.byType('VehicleConfigurator');
  if (configs.length !== 1) throw new Error('Mitsubishi configurator source is not unique.');
  const raw = z
    .object({
      enableAllInPrice: z.literal(false),
      retiredVehicleInfo: z.object({ latestVehicleInfo: z.array(familySchema).min(1) }),
    })
    .parse(configs[0]);
  const families = raw.retiredVehicleInfo.latestVehicleInfo;
  for (const family of families) {
    sameSet(
      family.yearList.map(String),
      family.vehicleInfo.map((info) => String(info.year)),
      'family year references',
    );
    for (const info of family.vehicleInfo)
      if (
        info.vehicleCode !== family.vehicleCode ||
        new Set(info.activeModelCodes).size !== info.activeModelCodes.length
      )
        throw new Error('Mitsubishi active model identity mismatch.');
  }
  const expected = families.flatMap((family) =>
    family.yearList.map((year) => `${family.vehicleGuid}/${year}`),
  );
  const references = [...startHtml.matchAll(/href="([^"<>]*\/configurator\?[^"<>]*)"/g)]
    .map((match) => new URL(match[1]!.replace(/&amp;/g, '&'), mitsubishiOrigin))
    .filter((url) => url.origin === mitsubishiOrigin)
    .map((url) => `${url.searchParams.get('vehicle')}/${url.searchParams.get('year')}`);
  sameSet([...new Set(references)], expected, 'start-page model years');
  return families;
}
export function mitsubishiModels(
  input: unknown,
  reference: { vehicleCode: string; year: number; expectedCodes?: string[] },
) {
  const result = z
    .object({
      errors: z.array(z.object({ message: z.string() })).optional(),
      data: z
        .object({
          getModelsSelector: z
            .object({
              msrpLabel: z.literal('MSRP'),
              vehicleInfo: z.object({ id: text, code: text, name: text, year }),
              models: z.array(modelSchema).min(1),
            })
            .nullable(),
        })
        .nullable(),
    })
    .parse(input);
  if (result.errors?.length || !result.data?.getModelsSelector)
    throw new Error(
      `Mitsubishi model query failed: ${result.errors?.map((error) => error.message).join('; ') ?? 'No model data'}`,
    );
  const data = result.data.getModelsSelector;
  if (
    data.vehicleInfo.code !== reference.vehicleCode ||
    data.vehicleInfo.year !== reference.year ||
    data.models.some((model) => model.year !== reference.year)
  )
    throw new Error('Mitsubishi returned vehicle/year identity differs from the request.');
  sameSet(
    data.models.map((model) => model.code),
    reference.expectedCodes ?? data.models.map((model) => model.code),
    'factory trim codes',
  );
  return data;
}
export function mitsubishiSpecifications(
  html: string,
  expected: { name: string; year: number; models: MitsubishiModel[] },
) {
  const roots = mitsubishiApollo(html).byType('Specifications');
  const root = z
    .object({ vehicle: z.object({ name: text }), models: z.array(specModel).min(1) })
    .parse(roots.length === 1 ? roots[0] : null);
  if (root.vehicle.name.toLowerCase() !== `${expected.year} ${expected.name}`.toLowerCase())
    throw new Error('Mitsubishi specification page model/year mismatch.');
  sameSet(
    root.models.map((model) => model.code),
    expected.models.map((model) => model.code),
    'specification model codes',
  );
  for (const model of root.models) {
    const exact = expected.models.find((expected) => expected.code === model.code)!;
    if (model.id !== exact.id || model.name !== exact.name)
      throw new Error('Mitsubishi specification trim identity mismatch.');
  }
  return root.models;
}
export function mitsubishiInventory(input: unknown) {
  return z
    .object({
      count: z.number().int().nonnegative(),
      current: z.number().int().positive(),
      last: z.number().int().positive(),
      results: z.array(inventoryReference),
    })
    .parse(input);
}
export function validateMitsubishiSnapshot(input: unknown): MitsubishiSnapshot {
  const snapshot = snapshotSchema.parse(input);
  sameSet(
    snapshot.inventoryReferences.map(
      (reference) => `${reference.model.toLowerCase()}/${reference.year}`,
    ),
    [
      ...snapshot.models
        .filter((model) => model.inventoryReference)
        .map(
          (model) =>
            `${model.inventoryReference!.model.toLowerCase()}/${model.inventoryReference!.year}`,
        ),
      ...snapshot.inventoryGaps.map(
        (gap) => `${gap.reference.model.toLowerCase()}/${gap.reference.year}`,
      ),
    ],
    'inventory model years',
  );
  if (
    snapshot.selectorSource.url !== mitsubishiSelectorUrl ||
    snapshot.startSource.url !== mitsubishiStartUrl
  )
    throw new Error('Mitsubishi lineup source mismatch.');
  sameSet(
    snapshot.currentModelKeys,
    snapshot.models.filter((model) => model.currentBuildListing).map((model) => model.key),
    'current model years',
  );
  sameSet(
    snapshot.models.flatMap((model) => model.expectedCodes.map((code) => `${model.key}/${code}`)),
    snapshot.records.map(mitsubishiKey),
    'factory configurations',
  );
  sameSet(
    snapshot.models.map((model) => model.key),
    [...new Set(snapshot.records.map((record) => record.modelKey))],
    'model years',
  );
  for (const model of snapshot.models) {
    if (
      model.key !== mitsubishiModelKey(model.vehicleCode, model.year) ||
      model.priceSource.url !== mitsubishiGraphqlUrl ||
      !model.priceSource.requestSha256 ||
      (!model.currentBuildListing && !model.inventoryReference)
    )
      throw new Error('Mitsubishi model source identity mismatch.');
    if (
      model.inventoryReference &&
      (model.inventoryReference.year !== model.year ||
        model.inventoryReference.model.toLowerCase() !== model.name.toLowerCase())
    )
      throw new Error('Mitsubishi inventory family identity mismatch.');
  }
  for (const record of snapshot.records) {
    const model = snapshot.models.find((model) => model.key === record.modelKey);
    if (!model || record.model.year !== model.year)
      throw new Error('Mitsubishi record model/year mismatch.');
    if (!record.specification && !record.specificationGap)
      throw new Error('Mitsubishi missing specification gap.');
    if (
      record.specification &&
      (!model.specificationsSource ||
        record.specification.source.sha256 !== model.specificationsSource.sha256 ||
        record.specification.source.url !== model.specificationsSource.url ||
        record.specification.name !== record.model.name)
    )
      throw new Error('Mitsubishi exact specification source mismatch.');
  }
  return snapshot;
}

export const mitsubishiModelsQuery =
  'query getModelSelector($market:String!, $language:String!, $path:String!, $selection:SelectionInput!) {\n getModelsSelector(market:$market,language:$language,path:$path,selection:$selection) {\n  resourceType label disclaimer msrpLabel\n  vehicleInfo { id code name year }\n  models { id code name year trimLine sortOrder price {label value baseValue displayValue fees {label value}} allInPrice {label value displayValue} description descriptionList engineCode engineSize engineType fuelType transmissionType transmissionCode transmissionDescription drivetrain seats doors }\n }\n}';
export function mitsubishiRequest(guid: string, year: number) {
  return {
    operationName: 'getModelSelector',
    query: mitsubishiModelsQuery,
    variables: {
      market: 'ca',
      language: 'en',
      path: '/ca/en/buy/configure-your-mitsubishi/configurator',
      selection: {
        vehicle: guid,
        year,
        fuelType: '',
        model: '',
        color: '',
        fabric: '',
        packages: [],
        accessories: [],
        url: `/en/buy/configure-your-mitsubishi/configurator?vehicle=${guid}&year=${year}&step=ModelSelector`,
      },
    },
  };
}
export const mitsubishiPriceUrl = (model: { vehicleGuid: string; year: number }) =>
  `${mitsubishiGraphqlUrl}?${new URLSearchParams({ operationName: 'getModelSelector', query: mitsubishiModelsQuery, variables: JSON.stringify(mitsubishiRequest(model.vehicleGuid, model.year).variables) })}`;
