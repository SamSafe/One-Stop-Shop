import { z } from 'zod';

export const genesisOrigin = 'https://www.genesis.com';
export const genesisShop = 'https://acquisition.genesis.ca';
export const genesisHomeUrl = `${genesisOrigin}/ca/en/main.html`;
export const genesisBuilderUrl = `${genesisShop}/en/build-and-order`;
export const genesisClientUrl = `${genesisShop}/blocks/genesis-build-and-order/genesis-build-and-order.bundle.js`;
export const genesisModelsUrl = `${genesisShop}/api/genesisbackend/GenesisShowroom/GetLatestYearModelsJson?language=en&province=AB`;
export const genesisTrimsUrl = (name: string, year: number) =>
  `${genesisShop}/api/genesisbackend/GenesisShowroom/GetTrimsJson?${new URLSearchParams({ language: 'en', province: 'AB', modelName: name, year: String(year) })}`;
export const genesisColoursUrl = (id: number) =>
  `${genesisShop}/api/genesisbackend/GenesisShowroom/GetTrimColorsJson?language=en&trimExtId=${id}&province=AB`;
export const genesisSpecSelectorUrl = `${genesisOrigin}/wsvc/ca/api/v2/specVehicle/data`;
export const genesisSpecUrl = `${genesisOrigin}/wsvc/ca/api/v2/spec/data`;
export const genesisSpecsPage = `${genesisOrigin}/ca/en/models/luxury-sedan-genesis/g70/specs.html`;
const text = z.string().min(1),
  money = z.number().finite().nonnegative(),
  year = z.number().int().min(2020).max(2100);
export const genesisReceiptSchema = z.strictObject({
  url: z.url().refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      [genesisOrigin, genesisShop].includes(u.origin) &&
      !u.username &&
      !u.password
    );
  }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.literal(200),
  requestSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export type GenesisReceipt = z.infer<typeof genesisReceiptSchema>;
const tax = z.object({
  trimId: text,
  provinceCode: z.literal('AB'),
  amount: money.nullable(),
  name: text,
  type: z.enum(['AIRCONTAX', 'EHF', 'FEE', 'TIRELEVY']),
  extTrimId: text,
});
const legal = z.object({ legalDescription: text });
export const genesisModelsSchema = z.object({
  models: z
    .array(
      z.object({
        modelGuid: text,
        extModelId: z.number().int(),
        modelYear: year,
        modelNameEn: text,
        bodyTypeEn: text,
        msrp: money,
        isEv: z.boolean(),
        isPreorder: z.boolean(),
      }),
    )
    .min(1),
});
export const genesisTrimSchema = z.object({
  guid: text,
  extModelId: z.number().int(),
  extTrimId: z.number().int(),
  bodyTypeEn: text,
  modelYear: year,
  modelNameEn: text,
  trimNameEn: text,
  msrp: money,
  isEv: z.boolean(),
  isPreOrder: z.boolean(),
  defaultHSC: z.string(),
  defaultSapCodeExterior: z.string(),
  defaultSapCodeInterior: z.string(),
  defaultExteriorPrice: money,
  defaultInteriorPrice: money,
  trimTaxes: z.array(tax),
  trimKeyFeatures: z
    .array(z.object({ extTrimId: z.number().int(), trimGuid: text, enDescription: z.string() }))
    .nullable()
    .transform((value) => value ?? []),
  vehiclePricingLegal: legal,
});
export const genesisTrimsSchema = z.object({
  modelYears: z.array(z.object({ id: year, year })).min(1),
  trims: z.record(z.string(), z.array(genesisTrimSchema)),
});
export type GenesisTrim = z.infer<typeof genesisTrimSchema>;
const colour = z.strictObject({
  hsc: text,
  exteriorCode: text,
  exteriorName: text,
  exteriorPrice: money,
  interiorCode: text,
  interiorName: text,
  interiorPrice: money,
});
export type GenesisColour = z.infer<typeof colour>;
export function genesisColours(input: unknown) {
  const data = z
    .object({
      exteriorInteriors: z.array(
        z.object({
          sapColorCode: text,
          colorNameEn: text,
          price: money,
          interiors: z.array(
            z.object({ sapColorCode: text, colorNameEn: text, price: money, mappedHSC: text }),
          ),
        }),
      ),
    })
    .parse(input);
  const groups = new Map<string, GenesisColour>();
  for (const e of data.exteriorInteriors)
    for (const i of e.interiors) {
      const row = {
        hsc: i.mappedHSC,
        exteriorCode: e.sapColorCode,
        exteriorName: e.colorNameEn,
        exteriorPrice: e.price,
        interiorCode: i.sapColorCode,
        interiorName: i.colorNameEn,
        interiorPrice: i.price,
      };
      const previous = groups.get(row.hsc);
      if (
        !previous ||
        row.exteriorPrice + row.interiorPrice < previous.exteriorPrice + previous.interiorPrice
      )
        groups.set(row.hsc, row);
    }
  return [...groups.values()];
}
export const genesisSpecSelectorSchema = z.object({
  statusCode: z.literal(200),
  data: z.object({
    vehiclesList: z.array(z.object({ viewName: text, carnNm: text, dtlCd: text, mdelCd: text })),
  }),
});
export const genesisSpecDataSchema = z.object({
  statusCode: z.literal(200),
  data: z.object({
    specList: z.array(
      z.object({
        modelTrim: text,
        prdnMyer: text,
        mdelCd: text,
        tmplTitlName: text,
        itemNm: text,
        itemTxt: z.string(),
      }),
    ),
  }),
});
export const genesisSpecRequest = (
  modelCd: string,
  modelName: string,
  trimCode: string,
  trimName: string,
) =>
  new URLSearchParams({
    modelCd,
    modelName,
    modelTrim: modelCd + trimCode,
    trimName,
    selIndex: '0',
    langCd: 'en-CA',
    frontPubYn: 'N',
  }).toString();
export const genesisSelectorRequest = (code: string, name: string) =>
  new URLSearchParams({
    mdelCd: code,
    modelName: name,
    langCd: 'en-CA',
    init: 'true',
    frontPubYn: 'N',
  }).toString();
const spec = z.strictObject({
  source: genesisReceiptSchema,
  modelCode: text,
  modelTrim: text,
  label: text,
  year,
  rows: genesisSpecDataSchema.shape.data.shape.specList,
});
export type GenesisSpecification = z.infer<typeof spec>;
const family = z.strictObject({
  model: genesisModelsSchema.shape.models.element,
  source: genesisReceiptSchema,
  years: z.array(year).min(1),
  expectedTrimGuids: z.array(text).min(1),
});
const record = z.strictObject({
  familyKey: text,
  trim: genesisTrimSchema,
  colourSource: genesisReceiptSchema,
  expectedHscs: z.array(text),
  colour: colour.nullable(),
  specification: spec.nullable(),
  specificationGap: text.nullable(),
});
export type GenesisRecord = z.infer<typeof record>;
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  context: z.strictObject({
    country: z.literal('CA'),
    currency: z.literal('CAD'),
    province: z.literal('AB'),
    language: z.literal('en'),
  }),
  homeSource: genesisReceiptSchema,
  builderSource: genesisReceiptSchema,
  clientSource: genesisReceiptSchema,
  modelsSource: genesisReceiptSchema,
  specsPageSource: genesisReceiptSchema,
  overviewReferences: z.array(z.strictObject({ modelName: text, year })).min(1),
  selectorModelGuids: z.array(text).min(1),
  families: z.array(family).min(1),
  specificationSelectors: z.array(
    z.strictObject({
      source: genesisReceiptSchema,
      modelCode: text,
      modelName: text,
      labels: z.array(text),
    }),
  ),
  rejectedSpecifications: z.array(
    z.strictObject({
      source: genesisReceiptSchema,
      modelCode: text,
      label: text,
      requestedYear: year,
      publishedYears: z.array(year),
      reason: text,
    }),
  ),
  records: z.array(record).min(1),
});
export type GenesisSnapshot = z.infer<typeof snapshotSchema>;
export const genesisRecordKey = (row: GenesisRecord) =>
  `${row.trim.modelYear}/${row.trim.extTrimId}/${row.colour?.hsc || 'preorder'}`;
export const genesisModelCodes: Record<string, string> = {
  G70: 'IK',
  'G70 Graphite': 'IK1',
  G80: 'RG3',
  'G80 Prestige Black': 'RG',
  G90: 'HI',
  'G90 Prestige Black': 'RS',
  GV60: 'JW',
  'Electrified GV70': 'SS',
  GV70: 'JK',
  GV80: 'JX',
  'GV80 Prestige Black': 'JX1',
  'GV80 Coupe': 'JJ',
  'GV80 Coupe Prestige Black': 'JJ1',
};
const baseName = (name: string) => name.replace(/ Prestige Black| Graphite/g, '');
const gradeTokens = (value: string, modelName: string) =>
  value
    .toLowerCase()
    .replace(/^20\d{2}\s+/, '')
    .replace(baseName(modelName).toLowerCase(), '')
    .replace(/\badv\b/g, 'advanced')
    .replace(/technology/g, 'tech')
    .replace(/\b(with|package|awd|7p)\b/g, '')
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim()
    .split(/\s+/)
    .sort()
    .join(' ');
export function genesisMatchSpecification(trim: GenesisTrim, available: GenesisSpecification[]) {
  const code = genesisModelCodes[trim.modelNameEn];
  let candidates = available.filter((s) => s.modelCode === code && s.year === trim.modelYear);
  if (!trim.modelNameEn.includes('Black'))
    candidates = candidates.filter((s) => !s.label.includes('Black'));
  const exact = candidates.filter(
    (s) =>
      gradeTokens(s.label, trim.modelNameEn) === gradeTokens(trim.trimNameEn, trim.modelNameEn),
  );
  const chosen =
    exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : undefined;
  if (!chosen) return null;
  const engine = /(2\.5|3\.3|3\.5)/.exec(trim.trimNameEn)?.[1];
  const published = chosen.rows.find((r) => r.itemNm.trim() === 'Engine / Battery Type')?.itemTxt;
  if (engine && published && !published.includes(engine))
    throw new Error('Genesis exact trim engine identity conflicts.');
  return chosen;
}
export function genesisPublishedPrice(row: GenesisRecord) {
  if (
    row.trim.isPreOrder ||
    !row.trim.msrp ||
    !row.colour ||
    row.trim.trimTaxes.some((t) => t.amount === null)
  )
    return null;
  return (
    Math.round(
      (row.trim.msrp +
        row.colour.exteriorPrice +
        row.colour.interiorPrice +
        row.trim.trimTaxes.reduce((n, t) => n + (t.amount ?? 0), 0)) *
        100,
    ) / 100
  );
}
export function genesisRequireNoRegression(previous: GenesisSnapshot, next: GenesisSnapshot) {
  const rows = new Map(next.records.map((r) => [genesisRecordKey(r), r]));
  for (const old of previous.records) {
    const current = rows.get(genesisRecordKey(old));
    if (!current)
      throw new Error(
        'Genesis previous offering needs current ordering/stock reconciliation before removal.',
      );
    if (old.specification && !current.specification)
      throw new Error(
        'Genesis refresh would erase previously verified technical data; review the new source first.',
      );
    if (genesisPublishedPrice(old) !== null && genesisPublishedPrice(current) === null)
      throw new Error(
        'Genesis refresh would erase a verified regional price; previous snapshot retained.',
      );
  }
}
export function validateGenesisSnapshot(input: unknown): GenesisSnapshot {
  const data = snapshotSchema.parse(input),
    families = new Map(data.families.map((f) => [f.model.modelGuid, f]));
  if (
    data.homeSource.url !== genesisHomeUrl ||
    data.builderSource.url !== genesisBuilderUrl ||
    data.clientSource.url !== genesisClientUrl ||
    data.modelsSource.url !== genesisModelsUrl ||
    data.specsPageSource.url !== genesisSpecsPage
  )
    throw new Error('Genesis Canadian source context mismatch.');
  if (
    families.size !== data.families.length ||
    JSON.stringify([...data.selectorModelGuids].sort()) !==
      JSON.stringify([...families.keys()].sort())
  )
    throw new Error('Genesis selector families were omitted.');
  for (const reference of data.overviewReferences)
    if (
      !data.records.some(
        (r) => r.trim.modelNameEn === reference.modelName && r.trim.modelYear === reference.year,
      )
    )
      throw new Error('Genesis overview model/year is not represented.');
  const seen = new Set<string>();
  for (const f of data.families) {
    if (
      f.source.url !== genesisTrimsUrl(f.model.modelNameEn, f.model.modelYear) ||
      !f.years.includes(f.model.modelYear) ||
      new Set(f.expectedTrimGuids).size !== f.expectedTrimGuids.length
    )
      throw new Error('Genesis model/year selector identity mismatch.');
    const represented = [
      ...new Set(
        data.records.filter((r) => r.familyKey === f.model.modelGuid).map((r) => r.trim.guid),
      ),
    ].sort();
    if (
      JSON.stringify(represented) !== JSON.stringify([...f.expectedTrimGuids].sort()) ||
      f.years.some(
        (y) =>
          !data.records.some((r) => r.familyKey === f.model.modelGuid && r.trim.modelYear === y),
      )
    )
      throw new Error('Genesis trim or older model year was omitted.');
  }
  for (const row of data.records) {
    const key = genesisRecordKey(row),
      f = families.get(row.familyKey),
      t = row.trim;
    if (
      seen.has(key) ||
      !f ||
      !f.expectedTrimGuids.includes(t.guid) ||
      t.modelNameEn !== f.model.modelNameEn ||
      !f.years.includes(t.modelYear)
    )
      throw new Error('Unknown or duplicate Genesis retail identity.');
    seen.add(key);
    if (
      row.colourSource.url !== genesisColoursUrl(t.extTrimId) ||
      !t.vehiclePricingLegal.legalDescription.toLowerCase().includes('all-inclusive') ||
      t.trimTaxes.some(
        (tax) =>
          tax.trimId.toLowerCase() !== t.guid.toLowerCase() ||
          Number(tax.extTrimId) !== t.extTrimId,
      ) ||
      t.trimKeyFeatures.some(
        (feature) =>
          feature.trimGuid.toLowerCase() !== t.guid.toLowerCase() ||
          feature.extTrimId !== t.extTrimId,
      )
    )
      throw new Error('Genesis price, regional fee or feature identity mismatch.');
    if (!t.isPreOrder && (!row.colour || !row.expectedHscs.includes(row.colour.hsc) || t.msrp <= 0))
      throw new Error('Genesis saleable configuration lacks a valid published quote context.');
    const siblings = data.records.filter((r) => r.trim.guid === t.guid);
    if (
      JSON.stringify(siblings.map((r) => r.colour?.hsc).sort()) !==
      JSON.stringify((row.expectedHscs.length ? [...row.expectedHscs] : [undefined]).sort())
    )
      throw new Error('Genesis factory HSC variants were omitted.');
    if (row.specification) {
      const s = row.specification;
      if (
        s.source.url !== genesisSpecUrl ||
        !s.source.requestSha256 ||
        s.year !== t.modelYear ||
        s.modelCode !== genesisModelCodes[t.modelNameEn] ||
        !s.rows.length ||
        s.rows.some(
          (r) =>
            r.modelTrim !== s.modelTrim ||
            r.mdelCd !== s.modelCode ||
            Number(r.prdnMyer) !== t.modelYear,
        )
      )
        throw new Error('Genesis exact specification model/year/trim does not reconcile.');
    } else if (!row.specificationGap)
      throw new Error('Missing Genesis specifications need an explicit gap.');
  }
  return data;
}
