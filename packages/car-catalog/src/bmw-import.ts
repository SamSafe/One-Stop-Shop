import { z } from 'zod';

export const bmwOrigin = 'https://www.bmw.ca';
export const bmwApi = 'https://prod.ucp.bmw.cloud';
export const bmwLineupUrl = `${bmwOrigin}/en/all-models.html`;
export const bmwStockUrl = 'https://inventory.bmw.ca/en/NewInventorySearch?site=bmw.ca';
export function assertBmwSourceResponse(url: string, status: number, body: string) {
  if (status === 200) return;
  const source = new URL(url);
  let errorCode: unknown;
  try {
    errorCode = (JSON.parse(body) as { errorCode?: unknown }).errorCode;
  } catch {
    // Unexpected HTML/error bodies cannot establish a dated model gap.
  }
  if (source.origin === bmwApi) {
    const path = source.pathname;
    if (
      (path.startsWith('/localisations/overridden-vehicle-data/') &&
        path.includes('/sales-group-tree/models/') &&
        status === 404 &&
        errorCode === 'LOC_S_2003') ||
      (path.startsWith('/rulesolver/constructibility-check/') &&
        ((status === 404 && ['RUL_B_1006', 'RUL_B_1007'].includes(String(errorCode))) ||
          (status === 400 && errorCode === 'RUL_B_1018'))) ||
      (path.startsWith('/pricing/calculation/public-calculation/') &&
        status === 400 &&
        errorCode === 'PRI_B_1004')
    )
      return;
  }
  throw new Error(`Unexpected BMW source HTTP ${status}: ${url}`);
}
const text = z.string().min(1);
const receipt = z.strictObject({
  url: z.url().refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      ['www.bmw.ca', 'configure.bmw.ca', 'prod.ucp.bmw.cloud', 'inventory.bmw.ca'].includes(
        u.hostname,
      ) &&
      !u.username &&
      !u.password
    );
  }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.number().int().min(100).max(599).default(200),
  requestSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export type BmwReceipt = z.infer<typeof receipt>;
export const bmwStockReferenceSchema = z.strictObject({
  code: text,
  agCode: text,
  apiBrand: z.enum(['bmwCar', 'bmwi']),
  year: z.number().int().min(2020).max(2100),
  name: text,
  series: text,
  body: text,
  fuel: text,
  names: z.array(text).min(1),
  transmissions: z.array(text).min(1),
  baseMsrpValues: z.array(z.number().nonnegative()),
  observedStockReferences: z.number().int().positive(),
});
export type BmwStockReference = z.infer<typeof bmwStockReferenceSchema>;
export const bmwReferenceKey = (row: BmwStockReference) => `${row.year}/${row.code}/${row.agCode}`;
const modelSchema = z.object({
  code: text,
  agCode: text,
  apiBrand: z.enum(['bmwCar', 'bmwi']),
  name: text,
  range: text,
  drive: text,
  hybrid: z.string(),
  fuel: z.string(),
  body: z.string(),
  doors: z.string(),
  matrix: z.boolean(),
});
export type BmwModel = z.infer<typeof modelSchema>;
const classified = z.object({
  transmission: z.object({
    type: z.enum(['manual', 'automatic']),
    transmissionOption: text.optional(),
    transmissionOptionIsTypeContent: z.boolean().optional(),
  }),
  volt48: z.object({
    isVolt48Variant: z.boolean(),
    volt48Option: text.optional(),
    volt48OptionIsTypeContent: z.boolean().optional(),
  }),
});
export type BmwClassified = z.infer<typeof classified>;
export const bmwSolverSchema = z.object({
  constructible: z.boolean(),
  configuration: z.object({
    modelCode: text,
    elements: z.record(text, z.object({ code: text, type: text })),
  }),
  classifiedConfiguration: classified,
});
export const bmwSolverUrl = (code: string, date: string, gear: string | null, brand = 'bmwCar') => {
  const url = new URL(
    `${bmwApi}/rulesolver/constructibility-check/rule-sets/pcaso,con/brands/${brand}/countries/ca/effect-dates/${date}/order-dates/${date}/models/${code}`,
  );
  url.searchParams.set('application', 'connext');
  url.searchParams.set('add-rules-for-mandatory-element-classes', 'fabric,paint,rim');
  if (gear) url.searchParams.set('included-elements', gear);
  return url.href;
};
export const bmwGearUrl = (code: string, date: string, brand = 'bmwCar') =>
  `${bmwApi}/localisations/overridden-vehicle-data/sources/pcaso/brands/${brand}/countries/ca/effect-dates/${date}/order-dates/${date}/applications/connext/sales-group-tree/models/${code}/languages/en`;
export const bmwPriceUrl = (brand = 'bmwCar') =>
  `${bmwApi}/pricing/calculation/public-calculation/price-lists/pcaso,con/brands/${brand}/countries/ca`;
export const bmwPriceRequest = (
  code: string,
  date: string,
  options: string[],
  volt48: boolean,
) => ({
  settings: {
    priceTree: 'default-fsm-2',
    currency: 'CAD',
    ignoreInvalidOptionCodes: false,
    ignoreOptionsWithUndefinedPrices: false,
    roundingScale: 0,
    optimizedPriceDate: false,
  },
  validityDates: { taxDate: date, effectDate: date },
  configuration: { model: code, selectedOptions: [...options].sort(), availableOptions: [] },
  selectedAccessories: [],
  additionalParams: {
    isVolt48Variant: { key: 'isVolt48Variant', value: volt48 },
    Province: { key: 'Province', value: 'alberta' },
  },
});
export const bmwTechnicalUrl = (agCode: string, date: string, options: string[]) => {
  const url = new URL(
    `${bmwApi}/otd/country-groups/us/ag-models/${agCode}/validity-dates/${date}/otd-for-configuration`,
  );
  url.searchParams.set('included-options', [...options].sort().join(','));
  return url.href;
};
const decoded = (value: string) =>
  value.replace(
    /&#(x[0-9a-f]+|\d+);|&(quot|amp|lt|gt|apos);/gi,
    (match, numeric: string | undefined, named: string | undefined) =>
      numeric
        ? String.fromCodePoint(
            numeric.startsWith('x') ? parseInt(numeric.slice(1), 16) : Number(numeric),
          )
        : ({ quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" }[named!.toLowerCase()] ?? match),
  );
const overview = z.strictObject({
  id: text,
  label: text,
  code: text.nullable(),
  agCode: text.nullable(),
  range: text.nullable(),
  flag: z.string(),
  buildUrl: z.url().nullable(),
});
export function bmwOverview(html: string) {
  const sections = html.split(/(?=<div\b[^>]*class="cmp-allmodelscard js-card")/).slice(1);
  if (!sections.length) throw new Error('BMW Canadian model cards are missing.');
  return sections.map((section) => {
    const id = /<div\b[^>]*id="([^\"]+)"[^>]*class="cmp-allmodelscard js-card"/.exec(section)?.[1];
    const raw = /class="cmp-allmodelscarddetail"[^>]*data-tracking-attributes="([^\"]+)"/.exec(
      section,
    )?.[1];
    const data = raw
      ? z
          .object({ productID: text, codeAG: text, range: text, name: text })
          .parse(JSON.parse(decoded(raw)))
      : null;
    const filter = /data-card-filter-info="([^\"]+)"/.exec(section)?.[1];
    const label =
      data?.name ??
      /class="cmp-allmodelscarddetail__series"[^>]*>([\s\S]*?)<\//
        .exec(section)?.[1]
        ?.replace(/<[^>]*>/g, '')
        .trim() ??
      /title="([^\"]+)"/.exec(section)?.[1];
    if (!id || !label) throw new Error('Unidentified BMW Canadian overview card.');
    const build = /href="(https:\/\/configure\.bmw\.ca\/[^\"]+)"/.exec(section)?.[1] ?? null;
    return overview.parse({
      id,
      label,
      code: data?.productID ?? null,
      agCode: data?.codeAG ?? null,
      range: data?.range ?? null,
      flag: filter ? String(JSON.parse(decoded(filter)).offers ?? '') : '',
      buildUrl: build ? decoded(build) : null,
    });
  });
}
export function bmwModels(value: unknown, matrix: boolean): BmwModel[] {
  const rows: BmwModel[] = [];
  const parse = (raw: unknown) => {
    const r = z
      .object({
        modelCode: text,
        agModelCode: text,
        brand: z.enum(['BM', 'BI']),
        modelRange: z.union([text, z.array(text).min(1)]),
        phrases: z.object({
          en: z.object({ longDescription: text }).optional(),
          longDescription: text.optional(),
        }),
        driveType: z.string(),
        hybridCode: z.string(),
        fuelType: z.string(),
        bodyStyle: z.string(),
        doors: z.string().optional(),
      })
      .parse(raw);
    const name = r.phrases.en?.longDescription ?? r.phrases.longDescription;
    if (!name) throw new Error('BMW Canadian model name is missing.');
    return modelSchema.parse({
      code: r.modelCode,
      agCode: r.agModelCode,
      apiBrand: r.brand === 'BI' ? 'bmwi' : 'bmwCar',
      range: Array.isArray(r.modelRange) ? r.modelRange[0] : r.modelRange,
      name,
      drive: r.driveType,
      hybrid: r.hybridCode,
      fuel: r.fuelType,
      body: r.bodyStyle,
      doors: r.doors ?? '',
      matrix,
    });
  };
  if (matrix)
    for (const series of Object.values(
      z
        .record(
          text,
          z.object({
            modelRanges: z.record(text, z.object({ models: z.record(text, z.unknown()) })),
          }),
        )
        .parse(value),
    ))
      for (const range of Object.values(series.modelRanges))
        for (const raw of Object.values(range.models)) rows.push(parse(raw));
  else
    for (const raw of Object.values(z.record(text, z.unknown()).parse(value)))
      rows.push(parse(raw));
  return [...new Map(rows.map((row) => [row.code, row])).values()];
}
export function bmwGearCodes(value: unknown): string[] {
  const result: string[] = [];
  function walk(nodes: unknown[]) {
    for (const raw of nodes) {
      const node = z
        .object({
          nodeCode: text,
          options: z.array(text).optional(),
          nodes: z.array(z.unknown()).optional(),
        })
        .parse(raw);
      if (node.nodeCode === 'GEAR') result.push(...(node.options ?? []));
      walk(node.nodes ?? []);
    }
  }
  walk(z.array(z.unknown()).parse(value));
  return [...new Set(result)].sort();
}
const priceComponent = z.object({
  category: text,
  key: z.string().optional(),
  netListPrice: z.number().finite(),
  grossListPrice: z.number().finite(),
});
export function bmwPrices(value: unknown) {
  const problems = z.array(z.unknown());
  const data = z
    .object({
      priceTreeNode: z.unknown(),
      metadata: z.object({
        currency: z.literal('CAD'),
        modelPriceType: z.literal('RRP_NET'),
        optionPriceType: z.literal('RRP_NET'),
      }),
      invalidOptionCodes: problems,
      optionsWithUndefinedPrices: problems,
      invalidAccessoryIds: problems,
      accessoryWithUndefinedPrices: z.object({
        accessoryHardware: problems,
        accessoryPriceOnRequest: problems,
        accessoryInstallation: problems,
      }),
    })
    .parse(value);
  if (
    [
      data.invalidOptionCodes,
      data.optionsWithUndefinedPrices,
      data.invalidAccessoryIds,
      ...Object.values(data.accessoryWithUndefinedPrices),
    ].some((rows) => rows.length)
  )
    throw new Error('BMW price inputs have invalid or undefined prices.');
  const components: z.infer<typeof priceComponent>[] = [];
  function walk(raw: unknown) {
    const node = z
      .object({
        category: text,
        key: z.string().optional(),
        effectivePrice: z.object({
          netListPrice: z.number().finite(),
          grossListPrice: z.number().finite(),
        }),
        subNodes: z.array(z.unknown()).optional(),
      })
      .parse(raw);
    components.push({
      category: node.category,
      ...(node.key ? { key: node.key } : {}),
      ...node.effectivePrice,
    });
    for (const child of node.subNodes ?? []) walk(child);
  }
  walk(data.priceTreeNode);
  return components;
}
const technical = z.object({
  status: z.literal(1),
  values: z.record(
    text,
    z.object({
      referenceName: text,
      targetValue: z.union([z.number(), z.string()]).optional(),
      textValue: z.string().optional(),
    }),
  ),
});
const record = z.strictObject({
  referenceKey: text,
  requestedGear: text.nullable(),
  gearCodes: z.array(text),
  gearSource: receipt,
  model: modelSchema.nullable(),
  solverSource: receipt,
  configuration: bmwSolverSchema.nullable(),
  priceSource: receipt,
  prices: z.array(priceComponent).nullable(),
  modelBaseOnly: z.boolean(),
  technicalSource: receipt.nullable(),
  technical: technical.nullable(),
});
export type BmwRecord = z.infer<typeof record>;
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  date: z.iso.date(),
  context: z.strictObject({
    country: z.literal('ca'),
    currency: z.literal('CAD'),
    locale: z.literal('en-CA'),
    technicalCountryGroup: z.literal('us'),
  }),
  lineupSource: receipt,
  settingsSource: receipt,
  shellSource: receipt,
  matrixSources: z.array(receipt).length(2),
  localModelsSource: receipt,
  priceMetadataSource: receipt,
  overview: z.array(overview).min(1),
  matrixModels: z.array(modelSchema).min(1),
  inventory: z.strictObject({
    retrievedAt: z.iso.datetime(),
    total: z.number().int().positive(),
    returnedRows: z.number().int().positive(),
    distinctStockRecords: z.number().int().positive(),
    pageSize: z.literal(48),
    sources: z.array(receipt).min(1),
    modelReferences: z.array(bmwStockReferenceSchema).min(1),
  }),
  records: z.array(record).min(1),
});
export type BmwSnapshot = z.infer<typeof snapshotSchema>;
export const bmwRecordKey = (record: BmwRecord) =>
  `${record.referenceKey}/${record.configuration ? (record.configuration.classifiedConfiguration.transmission.transmissionOption ?? record.configuration.classifiedConfiguration.transmission.type) : 'base'}`;
export function validateBmwSnapshot(value: unknown): BmwSnapshot {
  const data = snapshotSchema.parse(value),
    references = new Map(data.inventory.modelReferences.map((row) => [bmwReferenceKey(row), row]));
  if (
    data.date !== data.retrievedAt.slice(0, 10) ||
    data.inventory.retrievedAt.slice(0, 10) !== data.date ||
    data.inventory.returnedRows !== data.inventory.total ||
    data.inventory.distinctStockRecords > data.inventory.returnedRows ||
    data.inventory.sources.length !== Math.ceil(data.inventory.total / data.inventory.pageSize) ||
    [...references.values()].reduce((sum, row) => sum + row.observedStockReferences, 0) !==
      data.inventory.distinctStockRecords ||
    references.size !== data.inventory.modelReferences.length
  )
    throw new Error('BMW inventory pages, date or model-year counts do not reconcile.');
  const keys = new Set<string>();
  for (const row of data.records) {
    const reference = references.get(row.referenceKey);
    if (
      !reference ||
      (row.model &&
        (row.model.code !== reference.code ||
          row.model.agCode !== reference.agCode ||
          row.model.apiBrand !== reference.apiBrand))
    )
      throw new Error('BMW stock/factory identity mismatch.');
    if (
      row.gearSource.url !== bmwGearUrl(reference.code, data.date, reference.apiBrand) ||
      row.priceSource.url !== bmwPriceUrl(reference.apiBrand) ||
      !row.priceSource.requestSha256 ||
      row.modelBaseOnly !== (row.configuration === null)
    )
      throw new Error('BMW pricing/transmission source context mismatch.');
    const key = bmwRecordKey(row);
    if (keys.has(key)) throw new Error('Duplicate BMW retail configuration.');
    keys.add(key);
    if (row.configuration) {
      if (
        !row.configuration.constructible ||
        row.configuration.configuration.modelCode !== reference.code ||
        Object.entries(row.configuration.configuration.elements).some(
          ([code, item]) => item.code !== code,
        )
      )
        throw new Error('BMW exact constructible model/options do not reconcile.');
      if (
        row.requestedGear &&
        row.configuration.classifiedConfiguration.transmission.transmissionOption !==
          row.requestedGear
      )
        throw new Error('BMW selected transmission does not reconcile.');
      if (
        row.solverSource.status !== 200 ||
        row.solverSource.url !==
          bmwSolverUrl(reference.code, data.date, row.requestedGear, reference.apiBrand)
      )
        throw new Error('BMW solver receipt mismatch.');
    }
    if (
      row.prices &&
      (row.priceSource.status !== 200 ||
        !row.prices.some((price) => price.category === 'MODEL' && price.key === reference.code))
    )
      throw new Error('BMW price model/source mismatch.');
    if (
      row.technical &&
      (!row.configuration ||
        row.technicalSource?.status !== 200 ||
        row.technicalSource.url !==
          bmwTechnicalUrl(
            reference.agCode,
            data.date,
            Object.keys(row.configuration.configuration.elements),
          ))
    )
      throw new Error('BMW configured technical source mismatch.');
  }
  for (const [key] of references)
    if (!data.records.some((row) => row.referenceKey === key))
      throw new Error('BMW inventory model-year reference was omitted.');
  return data;
}
export const bmwTechnical = (value: unknown) => technical.parse(value);
