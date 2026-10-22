import { z } from 'zod';

export const vwOrigin = 'https://www.vw.ca';
export const vwSelectorUrl = `${vwOrigin}/en/configurator.html`;
export const vwOverviewUrl = `${vwOrigin}/en/models/new-vehicles.html`;
export const vwGlobalUrl = `${vwOrigin}/en.global-config.json`;
const text = z.string().min(1);
const officialUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    ['www.vw.ca', 'oneapi.volkswagen.com'].includes(url.hostname) &&
    !url.username &&
    !url.password
  );
});
const receipt = z.strictObject({ url: officialUrl, sha256: z.string().regex(/^[a-f0-9]{64}$/) });
export type VwReceipt = z.infer<typeof receipt>;
const category = z.enum(['private', 'commercial']);
const keySchema = z.object({
  carlineId: text,
  salesgroupId: text,
  trimId: text,
  modelId: text,
  modelYear: z.string().regex(/^20\d{2}$/),
  modelVersion: text,
});
export type VwKey = z.infer<typeof keySchema>;
export const vwKey = (key: VwKey) =>
  `${key.carlineId}/${key.salesgroupId}/${key.modelYear}/${key.modelVersion}/${key.modelId}`;
export const vwPriceKey = (key: VwKey) =>
  `${key.carlineId}_${key.salesgroupId}_${key.trimId}_${key.modelId}`;
const engine = z.object({
  category,
  virtual: z.literal(false),
  key: keySchema,
  modelName: text,
  engineTypes: z.array(z.string()),
  gearTypes: z.array(z.string()),
  bodyTypes: z.array(z.string()),
  driveType: z.string(),
  allWheelDrive: z.boolean(),
});
const trim = z.object({
  type: z.literal('trim'),
  nodeId: text,
  parentNodeId: text,
  category,
  data: z.object({
    name: text,
    key: keySchema.pick({ carlineId: true, salesgroupId: true, trimId: true }),
    engines: z.array(engine).min(1),
  }),
});
const group = z.object({
  type: z.literal('salesgroup'),
  nodeId: text,
  parentNodeId: text,
  children: z.array(trim),
});
const carline = z.object({
  type: z.literal('carline'),
  nodeId: text,
  category,
  data: z.object({
    name: text,
    referenceModel: z.object({ virtual: z.boolean() }),
    isElectric: z.boolean(),
  }),
  children: z.array(group),
});
const structureNode: z.ZodType<{
  type: string;
  nodeId: string;
  children?: { type: string; nodeId: string; children?: unknown[] }[];
}> = z.object({
  type: text,
  nodeId: text,
  children: z
    .array(z.object({ type: text, nodeId: text, children: z.array(z.unknown()).optional() }))
    .optional(),
});
const price = z.object({
  currency: z.literal('CAD'),
  price: z.number().positive(),
  type: z.string(),
  vatIncluded: z.literal(false),
});
const technicalField = z.object({
  description: z.string(),
  value: z.string(),
  raw_values: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        number_value: z.number().optional(),
        string_value: z.string().optional(),
        unit: z.string().optional(),
      }),
    )
    .nullable(),
});
const technicalGroup = z.object({ name: text, values: z.array(technicalField) });
const factoryModel = z.object({
  carlineName: text,
  carlineRef: text,
  salesgroupRef: text,
  equipmentLine: text,
  code: text,
  year: text,
  version: text,
  name: text,
  longName: text,
  prices: z.array(price),
  technicalData: z.array(technicalGroup),
  modelMetaData: z.record(z.string(), z.union([z.string(), z.boolean()])),
  modelFilters: z.array(z.object({ type: text, text: z.string() })),
});
export type VwFactoryModel = z.infer<typeof factoryModel>;
const modelYearSchema = z.strictObject({
  nodeId: text,
  name: text,
  year: z.number().int(),
  expectedKeys: z.array(text).min(1),
  configureEnabled: z.boolean(),
});
const recordSchema = z.strictObject({
  modelNode: text,
  trimNode: text,
  category,
  key: keySchema,
  trimName: text,
  modelName: text,
  engineTypes: z.array(z.string()),
  bodyTypes: z.array(z.string()),
  gearTypes: z.array(z.string()),
  driveType: z.string(),
  allWheelDrive: z.boolean(),
  source: receipt,
  factory: factoryModel,
});
export type VwRecord = z.infer<typeof recordSchema>;
const gap = z.strictObject({
  nodeId: text,
  name: text,
  year: z.number().int().nullable(),
  reason: text,
});
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  lineupSources: z.array(receipt).length(2),
  globalSource: receipt,
  msrpDefinitionVerified: z.literal(true),
  models: z.array(modelYearSchema).min(1),
  records: z.array(recordSchema).min(1),
  virtualVehicleReferences: z.array(gap),
  nonVehicleReferences: z.array(gap),
});
export type VwSnapshot = z.infer<typeof snapshotSchema>;

export function vwState(html: string) {
  const match =
    /<script\b[^>]*type="x-feature-hub\/serialized-states"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error('VW published serialized state is missing.');
  const values = z.record(z.string(), z.string()).parse(JSON.parse(decodeURIComponent(match[1]!)));
  const found = Object.values(values).flatMap((value) => {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && 'modelOverviewResult' in parsed
      ? [(parsed as { modelOverviewResult: unknown }).modelOverviewResult]
      : [];
  });
  if (found.length !== 1) throw new Error('VW model overview state is not unique.');
  return z
    .object({
      status: z.literal('loaded'),
      url: z.url(),
      modelOverview: z.object({
        models: z.array(carline).min(1),
        modelStructure: z.object({ modelElements: z.array(structureNode).min(1) }),
      }),
    })
    .parse(found[0]);
}
function sameSet(actual: string[], expected: string[], label: string) {
  if (
    new Set(actual).size !== actual.length ||
    new Set(expected).size !== expected.length ||
    actual.length !== expected.length ||
    actual.some((value) => !expected.includes(value))
  )
    throw new Error(`VW ${label} do not reconcile.`);
}
export function vwLineup(html: string) {
  const state = vwState(html),
    url = new URL(state.url);
  if (
    !/^v\d+-\d+-\d+\.mofa\.feature-app\.io$/.test(url.hostname) ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/bff/model-overview' ||
    url.searchParams.get('countryCode') !== 'CA' ||
    url.searchParams.get('currency') !== 'CAD' ||
    url.searchParams.get('language') !== 'en'
  )
    throw new Error('VW Canadian overview identity mismatch.');
  const models = state.modelOverview.models,
    structure = state.modelOverview.modelStructure.modelElements;
  sameSet(
    models.map((model) => model.nodeId),
    structure.map((node) => node.nodeId),
    'model references',
  );
  const declaredTrims = structure.flatMap(
    (node) =>
      node.children?.flatMap(
        (group) =>
          group.children?.map((trim) => z.object({ nodeId: text }).parse(trim).nodeId) ?? [],
      ) ?? [],
  );
  sameSet(
    models.flatMap((model) =>
      model.children.flatMap((group) => group.children.map((trim) => trim.nodeId)),
    ),
    declaredTrims,
    'trim references',
  );
  for (const model of models)
    for (const group of model.children) {
      if (group.parentNodeId !== model.nodeId) throw new Error('VW salesgroup hierarchy mismatch.');
      for (const trim of group.children) {
        if (trim.parentNodeId !== group.nodeId || trim.category !== model.category)
          throw new Error('VW trim hierarchy mismatch.');
        for (const engine of trim.data.engines) {
          const key = engine.key;
          if (
            engine.category !== trim.category ||
            key.carlineId !== trim.data.key.carlineId ||
            key.salesgroupId !== trim.data.key.salesgroupId ||
            key.trimId !== trim.data.key.trimId ||
            !model.nodeId.startsWith(`/${key.modelYear}-`)
          )
            throw new Error('VW exact engine/model-year identity mismatch.');
        }
        sameSet(
          trim.data.engines.map((engine) => vwKey(engine.key)),
          trim.data.engines.map((engine) => vwKey(engine.key)),
          'engine references',
        );
      }
    }
  return models;
}
export function vwCatalogueUrl(
  categoryValue: VwRecord['category'],
  key: Pick<VwKey, 'carlineId' | 'salesgroupId' | 'trimId'>,
) {
  const query = new URLSearchParams({
    tenant: categoryValue === 'commercial' ? 'ihdcc-vwn-ca-en' : 'ihdcc-vw-ca-en',
    carlineKey: key.carlineId,
    salesgroupKey: key.salesgroupId,
    modelFilters: `EquipmentLine:${key.trimId}`,
    fetchPrices: 'true',
    fetchTechnical: 'true',
    fetchWltp: 'true',
    fetchMandatory: 'true',
  });
  return `https://oneapi.volkswagen.com/viso/catalogue/models?${query}`;
}
export function vwCatalogue(input: unknown, engines: z.infer<typeof engine>[]) {
  const models = z.object({ models: z.array(factoryModel).min(1) }).parse(input).models;
  const keys = models.map((model) =>
    vwKey({
      carlineId: model.carlineRef,
      salesgroupId: model.salesgroupRef,
      trimId: model.equipmentLine,
      modelId: model.code,
      modelYear: model.year,
      modelVersion: model.version,
    }),
  );
  sameSet(
    keys,
    engines.map((engine) => vwKey(engine.key)),
    'catalogue engine identities',
  );
  for (const model of models) {
    const expected = engines.find(
      (engine) =>
        engine.key.modelId === model.code &&
        engine.key.modelYear === model.year &&
        engine.key.modelVersion === model.version,
    )!;
    if (model.equipmentLine !== expected.key.trimId)
      throw new Error('VW catalogue equipment identity mismatch.');
  }
  return models;
}
export function vwConfigureUrl(record: { category: VwRecord['category']; key: VwKey }) {
  const key = record.key,
    query = new URLSearchParams({
      'carlineId-app': key.carlineId,
      'category-app': record.category,
      'modelId-app': key.modelId,
      'modelVersion-app': key.modelVersion,
      'modelYear-app': key.modelYear,
      'salesGroupId-app': key.salesgroupId,
      'trimName-app': key.trimId,
    });
  return `${vwSelectorUrl}/__app/route%3Aconfigure.app?${query}`;
}
export function vwMsrpDefinition(html: string) {
  if (
    !/MSRP is the Manufacturer[’']s Suggested Retail Price and excludes taxes, freight and PDI/.test(
      html,
    )
  )
    throw new Error('VW Canadian base MSRP definition is missing.');
  return true as const;
}
export function validateVwSnapshot(input: unknown): VwSnapshot {
  const snapshot = snapshotSchema.parse(input);
  sameSet(
    snapshot.lineupSources.map((source) => source.url),
    [vwSelectorUrl, vwOverviewUrl],
    'lineup sources',
  );
  if (snapshot.globalSource.url !== vwGlobalUrl)
    throw new Error('VW public service configuration source mismatch.');
  sameSet(
    snapshot.models.flatMap((model) => model.expectedKeys),
    snapshot.records.map((record) => vwKey(record.key)),
    'factory configurations',
  );
  sameSet(
    snapshot.models.map((model) => model.nodeId),
    [...new Set(snapshot.records.map((record) => record.modelNode))],
    'model years',
  );
  for (const record of snapshot.records) {
    const key = record.key,
      factory = record.factory,
      model = snapshot.models.find((model) => model.nodeId === record.modelNode);
    if (
      !model ||
      model.year !== Number(key.modelYear) ||
      model.name !== record.modelName ||
      !record.trimNode.startsWith(`${record.modelNode}/`) ||
      record.trimName !== key.trimId ||
      factory.carlineRef !== key.carlineId ||
      factory.salesgroupRef !== key.salesgroupId ||
      factory.equipmentLine !== key.trimId ||
      factory.code !== key.modelId ||
      factory.year !== key.modelYear ||
      factory.version !== key.modelVersion ||
      record.source.url !== vwCatalogueUrl(record.category, key)
    )
      throw new Error('VW factory record identity mismatch.');
  }
  return snapshot;
}
