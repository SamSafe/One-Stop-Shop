import { z } from 'zod';

export const polestarOrigin = 'https://www.polestar.com';
export const polestarLineupUrl = `${polestarOrigin}/en-ca/`;
export const polestarSelectorUrl = `${polestarOrigin}/en-ca/configure/`;
export const polestarStockUrl = 'https://pc-api.polestar.com/eu-north-1/preconfigured-cars/';
const text = z.string().min(1);
const receipt = z.strictObject({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      ['www.polestar.com', 'pc-api.polestar.com'].includes(url.hostname) &&
      !url.username &&
      !url.password
    );
  }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  requestSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export type PolestarReceipt = z.infer<typeof receipt>;
const field = z.object({ label: text, value: z.string() });
const feature = z.object({
  code: text,
  name: text,
  type: text,
  selectedState: z.enum(['Included', 'Selected', 'Available', 'Excluded']),
  transitionState: text.optional(),
  unformattedPrice: z.number().optional(),
  modelEngine: z.object({ unformattedPrice: z.number().positive() }).optional(),
  specList: z.array(field).optional(),
});
const amount = z.object({ value: z.number().finite() });
export const polestarConfigurationSchema = z.object({
  model: z.object({
    modelName: text,
    modelYear: z.string().regex(/^20\d{2}$/),
    structureWeek: z.string().regex(/^20\d{4}$/),
    pno3: text,
    change: text,
    displayName: text,
  }),
  pno34: text,
  engineName: text,
  features: z.array(
    z.object({
      data: z.object({ featureGroups: z.array(z.object({ features: z.array(feature) })) }),
    }),
  ),
  cpsPriceBreakdown: z.object({
    car: z.object({ carTotalBasicPrice: amount, carTotalPrice: amount }),
    delivery: z.object({ deliveryChargeBasicPrice: amount }),
    grandTotal: z.object({
      grandTotalCarExtrasDelivery: z.object({ grandTotalCarExtrasDeliveryBasicPrice: amount }),
    }),
  }),
  techData: z.object({ data: z.array(field) }),
  delivery: z.object({
    data: z.object({ value: text, startDate: text.optional(), endDate: text.optional() }),
  }),
  disclaimer: z.object({
    disclaimers: z.array(z.object({ label: z.string(), value: z.string() })),
  }),
});
export type PolestarConfiguration = z.infer<typeof polestarConfigurationSchema>;
const initSchema = z.object({
  staticData: z.object({
    market: z.object({
      country: z.literal('CA'),
      currency: z.literal('CAD'),
      language: z.literal('en'),
      locale: z.literal('en-CA'),
    }),
    availableModels: z.object({
      models: z.array(z.object({ modelName: text, displayName: text })).min(1),
    }),
  }),
  configuration: polestarConfigurationSchema,
});
export const polestarFeatures = (configuration: PolestarConfiguration) =>
  configuration.features.flatMap((section) =>
    section.data.featureGroups.flatMap((group) => group.features),
  );
export const polestarSelected = (configuration: PolestarConfiguration) =>
  polestarFeatures(configuration).filter((item) =>
    ['Included', 'Selected'].includes(item.selectedState),
  );
export const polestarChoiceTypes = ['Engine', 'Packages', 'SingleOptions'];
export const polestarConfigurationKey = (configuration: PolestarConfiguration) =>
  [
    configuration.model.modelName,
    configuration.model.modelYear,
    ...polestarSelected(configuration)
      .filter((item) => polestarChoiceTypes.includes(item.type))
      .map((item) => `${item.type}/${item.code}`)
      .sort(),
  ].join('|');
export const polestarIdentity = (year: string, week: string, pno: string) =>
  `${year}/${week}/${pno}`;
export const polestarInitUrl = (slug: string) =>
  `${polestarOrigin}/en-ca/${slug}/configurator/api/v2/initconfig?productType=Cash&customerType=B2C&customerSubtype=None&markdown=true&excludePrice=false`;
export const polestarTransitionUrl = (configuration: PolestarConfiguration, state: string) => {
  const url = new URL(
    `${polestarOrigin}/en-ca/${configuration.model.modelName}/configurator/api/v2/configuration`,
  );
  url.searchParams.set('change', configuration.model.change);
  url.searchParams.set('state', state);
  return url.href;
};
export function polestarInit(value: unknown, slug: string) {
  const parsed = initSchema.parse(value);
  if (
    parsed.configuration.model.modelName !== slug ||
    !parsed.staticData.availableModels.models.some((model) => model.modelName === slug)
  )
    throw new Error('Polestar Canadian model identity mismatch.');
  polestarConfiguration(parsed.configuration, parsed.configuration.model);
  return parsed;
}
export function polestarConfiguration(
  value: unknown,
  expected: Pick<
    PolestarConfiguration['model'],
    'modelName' | 'modelYear' | 'structureWeek' | 'pno3'
  >,
) {
  const parsed = polestarConfigurationSchema.parse(value);
  if (
    (['modelName', 'modelYear', 'structureWeek', 'pno3'] as const).some(
      (key) => parsed.model[key] !== expected[key],
    ) ||
    !parsed.pno34.startsWith(parsed.model.pno3)
  )
    throw new Error('Polestar factory model/year/structure identity mismatch.');
  const engines = polestarSelected(parsed).filter((feature) => feature.type === 'Engine');
  if (
    engines.length !== 1 ||
    engines[0]!.name !== parsed.engineName ||
    parsed.pno34.slice(3, 5) !== engines[0]!.code
  )
    throw new Error('Polestar selected engine does not reconcile.');
  const choices = polestarFeatures(parsed).map((item) => `${item.type}/${item.code}`);
  if (new Set(choices).size !== choices.length)
    throw new Error('Duplicate Polestar factory feature.');
  return parsed;
}
export function polestarLineup(html: string) {
  const models = [
    ...new Set(
      [
        ...html.matchAll(
          /href=["'](?:https:\/\/www\.polestar\.com)?\/en-ca\/configure\/(polestar-[a-z0-9-]+)\/?["']/g,
        ),
      ].map((match) => match[1]!),
    ),
  ].sort();
  if (!models.length) throw new Error('Polestar Canadian configure links are missing.');
  return models;
}
export const polestarRetailersQuery = `query FetchAllDealers($market: String!, $source: SourceType = Preconfigured) {
  getAllRetailersFunction(marketMappingCode: $market, source: $source) { code partnerId name }
}`;
export const polestarInventoryQuery = `query LoadResultsQuery($market: String!, $filters: [FilterValueGroupInput]!, $pagination: PaginationInput, $partnerId: String, $sort: FilterSortInput) {
  vehicles: filteredStockCars(market: $market, includeValidFilters: false, filters: $filters, pagination: $pagination, partnerId: $partnerId, source: Preconfigured, includeLocationStock: false, customerType: "B2C", sort: $sort) {
    market pagination { pageSize pageNo totalRecords }
    filterResults {
      id pno34 modelYear startStructureWeek earliestDeliveryDateLabel
      cashPriceData { listPrice { totals { car { carTotalBasicPrice { value } carTotalPrice { value } } grandTotal { paymentTotal { paymentTotalBasicPrice { value } } } } } }
      content { name featureCode featureType }
      packages { code name }
      techData { engineBev_TotalHp drive engineBev_ElectricRange engineBev_ElectricRangeEpaMiles }
      wltpNedcSummary { items { name description value unit } }
    }
  }
}`;
export const polestarRetailersRequest = () => ({
  operationName: 'FetchAllDealers',
  variables: { market: 'en-ca', source: 'Preconfigured' },
  query: polestarRetailersQuery,
});
export const polestarInventoryRequest = (partnerId: string, modelCode: string, pageNo: number) => ({
  operationName: 'LoadResultsQuery',
  variables: {
    market: 'en-ca',
    filters: [{ filterTypeId: '4', filterValues: [{ value: modelCode, featureCode: modelCode }] }],
    pagination: { pageNo, pageSize: 10 },
    partnerId,
    sort: { attribute: 'DeliveryDate', direction: 'Asc' },
  },
  query: polestarInventoryQuery,
});
const retailer = z.object({ code: text, partnerId: text, name: text });
export function polestarRetailers(value: unknown) {
  const parsed = z
    .object({
      errors: z.array(z.unknown()).optional(),
      data: z.object({ getAllRetailersFunction: z.array(retailer).min(1) }).nullable(),
    })
    .parse(value);
  if (parsed.errors?.length || !parsed.data)
    throw new Error('Polestar retailer query returned GraphQL errors.');
  const rows = parsed.data.getAllRetailersFunction;
  if (new Set(rows.map((row) => row.partnerId)).size !== rows.length)
    throw new Error('Duplicate Polestar retailer.');
  return rows;
}
const stockVehicle = z.object({
  id: text,
  pno34: text,
  modelYear: z.string().regex(/^20\d{2}$/),
  startStructureWeek: z.string().regex(/^20\d{4}$/),
  earliestDeliveryDateLabel: z.string().nullable(),
  cashPriceData: z
    .object({
      listPrice: z
        .object({
          totals: z.object({
            car: z.object({ carTotalBasicPrice: amount, carTotalPrice: amount }),
            grandTotal: z.object({ paymentTotal: z.object({ paymentTotalBasicPrice: amount }) }),
          }),
        })
        .nullable(),
    })
    .nullable(),
  content: z.array(z.object({ name: z.string().nullable(), featureCode: text, featureType: text })),
  packages: z.array(z.object({ code: text, name: text })).nullable(),
  techData: z
    .object({
      engineBev_TotalHp: z.string().nullable(),
      drive: z.string().nullable(),
      engineBev_ElectricRange: z.string().nullable(),
      engineBev_ElectricRangeEpaMiles: z.string().nullable(),
    })
    .nullable(),
  wltpNedcSummary: z
    .object({
      items: z.array(
        z.object({
          name: z.string().nullable(),
          description: z.string().nullable(),
          value: z.string().nullable(),
          unit: z.string().nullable(),
        }),
      ),
    })
    .nullable(),
});
export type PolestarStockVehicle = z.infer<typeof stockVehicle>;
export const polestarStockIdentity = (vehicle: PolestarStockVehicle) =>
  polestarIdentity(vehicle.modelYear, vehicle.startStructureWeek, vehicle.pno34);
export function polestarInventory(value: unknown, expected: { modelCode: string; pageNo: number }) {
  const parsed = z
    .object({
      errors: z.array(z.unknown()).optional(),
      data: z
        .object({
          vehicles: z.object({
            market: z.literal('CA'),
            pagination: z.object({
              pageNo: z.number().int().positive(),
              pageSize: z.number().int().positive(),
              totalRecords: z.number().int().nonnegative(),
            }),
            filterResults: z.array(stockVehicle),
          }),
        })
        .nullable(),
    })
    .parse(value);
  if (parsed.errors?.length || !parsed.data)
    throw new Error('Polestar new-stock query returned GraphQL errors.');
  const result = parsed.data.vehicles;
  if (
    result.pagination.pageNo !== expected.pageNo ||
    result.filterResults.some(
      (row) =>
        !row.pno34.startsWith(expected.modelCode) ||
        !row.content.some(
          (field) => field.featureType === 'Model' && field.featureCode === expected.modelCode,
        ) ||
        !row.content.some(
          (field) => field.featureType === 'ModelYear' && field.featureCode === row.modelYear,
        ),
    )
  )
    throw new Error('Polestar stock page/model/year identity mismatch.');
  return result;
}
const factoryRecord = z.strictObject({
  modelSlug: text,
  source: receipt,
  configuration: polestarConfigurationSchema,
});
export type PolestarFactoryRecord = z.infer<typeof factoryRecord>;
const stockRecord = z.strictObject({ vehicle: stockVehicle, source: receipt });
export type PolestarStockRecord = z.infer<typeof stockRecord>;
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  lineupSources: z.array(receipt).length(2),
  currentModelSlugs: z.array(text).min(1),
  models: z.array(z.strictObject({ slug: text, source: receipt, initial: initSchema })).min(1),
  factoryRecords: z.array(factoryRecord).min(1),
  transitions: z.array(
    z.strictObject({ modelSlug: text, from: text, feature: text, to: text, source: receipt }),
  ),
  retailersSource: receipt,
  retailers: z.array(retailer).min(1),
  inventories: z.array(
    z.strictObject({
      retailerId: text,
      modelCode: text,
      total: z.number().int().nonnegative(),
      sources: z.array(receipt).min(1),
      records: z.array(stockRecord),
    }),
  ),
});
export type PolestarSnapshot = z.infer<typeof snapshotSchema>;
const same = (a: string[], b: string[]) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
export function validatePolestarSnapshot(value: unknown): PolestarSnapshot {
  const data = snapshotSchema.parse(value);
  if (
    !same(
      data.currentModelSlugs,
      data.models.map((model) => model.slug),
    ) ||
    new Set(data.currentModelSlugs).size !== data.models.length
  )
    throw new Error('Polestar current model set does not reconcile.');
  const keys = new Set<string>();
  for (const model of data.models) {
    polestarInit(model.initial, model.slug);
    if (
      !same(
        model.initial.staticData.availableModels.models.map((row) => row.modelName),
        data.currentModelSlugs,
      )
    )
      throw new Error('Polestar available model lists disagree.');
    const rows = data.factoryRecords.filter((record) => record.modelSlug === model.slug);
    if (
      !rows.some(
        (record) =>
          polestarConfigurationKey(record.configuration) ===
          polestarConfigurationKey(model.initial.configuration),
      )
    )
      throw new Error('Missing Polestar initial configuration.');
    for (const row of rows) {
      polestarConfiguration(row.configuration, model.initial.configuration.model);
      const key = polestarConfigurationKey(row.configuration);
      if (keys.has(key)) throw new Error('Duplicate Polestar factory configuration.');
      keys.add(key);
    }
  }
  if (data.factoryRecords.some((row) => !data.currentModelSlugs.includes(row.modelSlug)))
    throw new Error('Unlisted Polestar factory model.');
  for (const row of data.factoryRecords) {
    const key = polestarConfigurationKey(row.configuration);
    for (const choice of polestarFeatures(row.configuration).filter(
      (item) => polestarChoiceTypes.includes(item.type) && item.transitionState,
    )) {
      const edges = data.transitions.filter(
        (edge) =>
          edge.from === key &&
          edge.feature === `${choice.type}/${choice.code}` &&
          edge.modelSlug === row.modelSlug,
      );
      if (
        edges.length !== 1 ||
        !keys.has(edges[0]!.to) ||
        edges[0]!.source.url !== polestarTransitionUrl(row.configuration, choice.transitionState!)
      )
        throw new Error('Polestar selectable configuration transition is missing or mismatched.');
    }
  }
  if (data.transitions.some((edge) => !keys.has(edge.from) || !keys.has(edge.to)))
    throw new Error('Orphan Polestar transition.');
  if (new Set(data.retailers.map((retailer) => retailer.partnerId)).size !== data.retailers.length)
    throw new Error('Duplicate Polestar inventory retailer.');
  const expected = data.retailers.flatMap((retailer) =>
    data.models.map((model) => `${retailer.partnerId}/${model.initial.configuration.model.pno3}`),
  );
  if (
    !same(
      expected,
      data.inventories.map((inventory) => `${inventory.retailerId}/${inventory.modelCode}`),
    )
  )
    throw new Error('Polestar retailer/model inventory coverage is incomplete.');
  for (const inventory of data.inventories) {
    if (inventory.total !== inventory.records.length)
      throw new Error('Polestar inventory count mismatch.');
    for (const record of inventory.records) {
      const vehicle = record.vehicle;
      if (
        !inventory.sources.some((source) => source.sha256 === record.source.sha256) ||
        !vehicle.pno34.startsWith(inventory.modelCode) ||
        !vehicle.content.some(
          (item) => item.featureType === 'Model' && item.featureCode === inventory.modelCode,
        ) ||
        !vehicle.content.some(
          (item) => item.featureType === 'ModelYear' && item.featureCode === vehicle.modelYear,
        )
      )
        throw new Error('Polestar stock source/model/year mismatch.');
    }
  }
  return data;
}
