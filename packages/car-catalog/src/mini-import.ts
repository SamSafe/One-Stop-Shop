import { z } from 'zod';

export const miniOrigin = 'https://www.mini.ca';
export const miniApi = 'https://api.minicdn.ca';
export const miniBuilderUrl = `${miniOrigin}/en/shopping/buildandprice`;
export const miniStockUrl = `${miniOrigin}/en/shopping/inventory/`;
export const miniCarouselUrl = `${miniApi}/v1/config/carousel?lang=en&province=AB`;
export const miniLineUrl = (code: string) =>
  `${miniApi}/v1/config/selectline?lang=en&cacode=${code}`;
export const miniStyleUrl = (code: string, line: number) =>
  `${miniApi}/v1/config/selectstyle?lang=en&cacode=${code}&lineid=${line}`;
export const miniNavUrl = (code: string, line: number, style: number | null) =>
  `${miniApi}/v1/config/navdata?lang=en&cacode=${code}&lineid=${line}${style === null ? '' : `&styleid=${style}`}`;
export const miniSpecUrl = (code: string) => `${miniApi}/v1/config/techspec?CACode=${code}&lang=en`;
export const miniRulesUrl = `${miniOrigin}/Public/js/configurator/rules.json`;
const text = z.string().min(1),
  amount = z.number().finite().nonnegative();
export const miniReceiptSchema = z.strictObject({
  url: z.url().refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      [miniOrigin, miniApi].includes(u.origin) &&
      !u.username &&
      !u.password
    );
  }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.number().int(),
  requestSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export type MiniReceipt = z.infer<typeof miniReceiptSchema>;
export const miniReviewedLineFailure = (source: MiniReceipt, code: string) =>
  code === '27YQ' &&
  source.url === miniLineUrl(code) &&
  source.status === 500 &&
  source.sha256 === '149eaa4336ccd232538de8dacd6bc12c73fb341afae12d14352dbd2db60097ea';
const currentModel = z.strictObject({
  year: z.number().int(),
  code: text,
  agCode: text,
  name: text,
  families: z.array(text).min(1),
  active: z.boolean(),
  electric: z.boolean(),
  awd: z.boolean(),
  basePrice: amount,
  allInclusivePrice: amount,
  fees: amount,
});
export function miniCarousel(value: unknown) {
  const data = z
    .object({
      ModelYearList: z.array(z.number().int()).min(1),
      ModelList: z.array(
        z.object({
          Ecode: text,
          Vehicles: z.array(
            z.object({
              Year: z.number().int(),
              CACode: text,
              AGCode: text,
              Name: text,
              IsActive: z.boolean(),
              IsElectric: z.boolean(),
              IsAllFour: z.boolean(),
              Price: amount,
              AllInclusivePrice: amount,
              TotalFees: amount,
            }),
          ),
        }),
      ),
    })
    .parse(value);
  const models = new Map<string, z.infer<typeof currentModel>>();
  for (const family of data.ModelList)
    for (const row of family.Vehicles) {
      if (!data.ModelYearList.includes(row.Year) || !row.Name.startsWith(`${row.Year} MINI `))
        throw new Error('MINI explicit model year does not reconcile.');
      const model = currentModel.parse({
        year: row.Year,
        code: row.CACode,
        agCode: row.AGCode,
        name: row.Name,
        families: [family.Ecode],
        active: row.IsActive,
        electric: row.IsElectric,
        awd: row.IsAllFour,
        basePrice: row.Price,
        allInclusivePrice: row.AllInclusivePrice,
        fees: row.TotalFees,
      });
      const previous = models.get(row.CACode);
      if (previous) {
        if (
          JSON.stringify({ ...previous, families: [] }) !==
          JSON.stringify({ ...model, families: [] })
        )
          throw new Error('Conflicting MINI carousel aliases.');
        previous.families.push(family.Ecode);
      } else models.set(row.CACode, { ...model, families: [family.Ecode] });
    }
  return { years: data.ModelYearList, models: [...models.values()] };
}
const feature = z.object({
  Code: z.string().nullable(),
  Name: text,
  SelectionGroup: z.string().optional(),
});
const line = z.object({
  lineid: z.number().int().positive(),
  Name: text,
  Price: amount,
  HasStyle: z.boolean(),
  IncludedFeatureList: z.array(feature),
});
const style = z.object({
  StyleID: z.number().int().positive(),
  Name: text,
  Code: text,
  Path: text,
  Price: amount,
  StyleItemViewModelList: z.array(feature),
});
export const miniLinesSchema = z.object({ Vehicle: text, Price: amount, LineList: z.array(line) });
export const miniStylesSchema = z.object({ Vehicle: text, Price: amount, Styles: z.array(style) });
export const miniTechnicalSchema = z.object({
  SpecData: z.array(
    z.object({
      category: text,
      properties: z.array(z.object({ Name: text, Value: z.string() })),
    }),
  ),
});
export function miniTechnical(value: unknown, code: string) {
  if (
    code === '27YQ' &&
    z.strictObject({ Error: z.literal('Invalid cacode') }).safeParse(value).success
  )
    return { SpecData: [] };
  return miniTechnicalSchema.parse(value);
}
const packageOption = z.strictObject({ code: text, name: text, price: amount });
const nav = z.strictObject({
  packages: z.array(packageOption),
  minimumSelectionPrices: z.record(text, amount),
  transmissions: z.array(z.strictObject({ code: text, name: text, price: amount })),
});
export function miniNav(value: unknown) {
  const data = z
    .object({
      NavData: z.array(
        z.object({
          CategoryList: z.array(
            z.object({
              Category: text,
              ProductList: z.array(
                z.object({
                  Code: text,
                  Name: text,
                  Price: amount,
                  SelectionGroup: z.string(),
                  IsAccessory: z.boolean(),
                }),
              ),
            }),
          ),
        }),
      ),
    })
    .parse(value);
  const packages: z.infer<typeof packageOption>[] = [],
    transmissions: z.infer<typeof packageOption>[] = [];
  const minimumSelectionPrices: Record<string, number> = {};
  for (const parent of data.NavData)
    for (const group of parent.CategoryList)
      for (const product of group.ProductList) {
        const item = { code: product.Code, name: product.Name, price: product.Price };
        if (group.Category === 'Packages' && !product.IsAccessory) packages.push(item);
        if (group.Category === 'Transmission') transmissions.push(item);
        if (['Colour', 'Upholstery', 'Alloy Wheel'].includes(product.SelectionGroup))
          minimumSelectionPrices[product.SelectionGroup] = Math.min(
            minimumSelectionPrices[product.SelectionGroup] ?? Infinity,
            product.Price,
          );
      }
  if (new Set(packages.map((p) => p.code)).size !== packages.length)
    throw new Error('Duplicate MINI package choices.');
  return nav.parse({ packages, minimumSelectionPrices, transmissions });
}
const rule = z.strictObject({
  code: text,
  excludes: z.array(text).optional(),
  requires: z.array(text).optional(),
  requiresOneOf: z.array(text).optional(),
});
export const miniRulesSchema = z.record(text, z.array(rule));
const stockReference = z.strictObject({
  year: z.number().int(),
  code: text,
  agCodes: z.array(text).min(1),
  names: z.array(text).min(1),
  transmissions: z.array(text).min(1),
  fuels: z.array(text).min(1),
  drives: z.array(text).min(1),
  lines: z.array(z.string().nullable()).min(1),
  supplierBasePrices: z.array(amount).min(1),
  observedVehicles: z.number().int().positive(),
});
export type MiniStockReference = z.infer<typeof stockReference>;
export const miniModelKey = (row: { year: number; code: string }) => `${row.year}/${row.code}`;
const model = z.strictObject({
  key: text,
  year: z.number().int().min(2020).max(2100),
  code: text,
  current: currentModel.nullable(),
  stockKey: text.nullable(),
  lineSource: miniReceiptSchema,
  lines: miniLinesSchema.nullable(),
  technicalSource: miniReceiptSchema,
  technical: miniTechnicalSchema,
});
const record = z.strictObject({
  modelKey: text,
  lineId: z.number().int().nullable(),
  style: style.nullable(),
  styleSource: miniReceiptSchema.nullable(),
  expectedStyleIds: z.array(z.number().int()),
  navSource: miniReceiptSchema.nullable(),
  nav: nav.nullable(),
  stockBaseOnly: z.boolean(),
});
export type MiniRecord = z.infer<typeof record>;
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  context: z.strictObject({
    country: z.literal('CA'),
    currency: z.literal('CAD'),
    language: z.literal('en'),
  }),
  homeSource: miniReceiptSchema,
  builderSource: miniReceiptSchema,
  clientSource: miniReceiptSchema,
  carouselSource: miniReceiptSchema,
  rulesSource: miniReceiptSchema,
  rules: miniRulesSchema,
  years: z.array(z.number().int()).min(1),
  currentModelKeys: z.array(text).min(1),
  selectorReferenceCount: z.number().int().positive(),
  overviewFamilies: z.array(text).min(1),
  overviewCodes: z.array(text),
  inventory: z.strictObject({
    retrievedAt: z.iso.datetime(),
    total: z.number().int().positive(),
    returnedRows: z.number().int().positive(),
    distinctVehicles: z.number().int().positive(),
    sources: z.array(miniReceiptSchema).min(1),
    references: z.array(stockReference).min(1),
  }),
  models: z.array(model).min(1),
  records: z.array(record).min(1),
});
export type MiniSnapshot = z.infer<typeof snapshotSchema>;
export type MiniModel = MiniSnapshot['models'][number];
export const miniRecordKey = (r: MiniRecord) =>
  `${r.modelKey}/${r.lineId ?? 'stock'}/${r.style?.StyleID ?? 'base'}`;
export function miniPackageSelections(
  row: MiniRecord,
  rules: z.infer<typeof miniRulesSchema>[string],
) {
  const packages = row.nav?.packages ?? [];
  if (packages.length > 10) throw new Error('MINI package expansion requires review.');
  let selections: (typeof packages)[] = [[]];
  for (const item of packages)
    selections = selections.flatMap((selected) => [selected, [...selected, item]]);
  return selections.filter((selected) => {
    const codes = new Set(selected.map((p) => p.code));
    return rules
      .filter((r) => codes.has(r.code))
      .every(
        (r) =>
          !r.excludes?.some((code) => codes.has(code)) &&
          (!r.requires || r.requires.every((code) => codes.has(code))) &&
          (!r.requiresOneOf || r.requiresOneOf.some((code) => codes.has(code))),
      );
  });
}
export function miniTechnicalGaps(model: MiniModel, stock: MiniStockReference | undefined) {
  const props = Object.fromEntries(
    model.technical.SpecData.flatMap((group) => group.properties.map((p) => [p.Name, p.Value])),
  );
  const result: string[] = [];
  if (model.current && stock && stock.agCodes.some((code) => code !== model.current!.agCode))
    result.push(
      `Carousel AG ${model.current.agCode} conflicts with stock AG ${stock.agCodes.join(', ')}. Technical joining requires review.`,
    );
  if (
    props.Transmission &&
    stock &&
    stock.transmissions.some(
      (label) => /manual/i.test(label) !== /manual/i.test(props.Transmission!),
    )
  )
    result.push(
      `Technical transmission ${props.Transmission} conflicts with stock ${stock.transmissions.join(', ')}. The older table is not assigned to this stock profile.`,
    );
  if (!model.technical.SpecData.length)
    result.push('No technical table is published for this exact Canadian model code.');
  return result;
}
export function validateMiniSnapshot(input: unknown): MiniSnapshot {
  const data = snapshotSchema.parse(input),
    date = data.retrievedAt.slice(0, 10);
  const models = new Map(data.models.map((m) => [m.key, m])),
    refs = new Map(data.inventory.references.map((r) => [miniModelKey(r), r]));
  if (
    data.homeSource.url !== `${miniOrigin}/en` ||
    data.builderSource.url !== miniBuilderUrl ||
    data.carouselSource.url !== miniCarouselUrl ||
    data.rulesSource.url !== miniRulesUrl ||
    !data.clientSource.url.startsWith(`${miniOrigin}/bundles/js/auto/config?`) ||
    data.inventory.sources.some(
      (s) =>
        s.url !== `${miniOrigin}/en/shopping/inventory/InventorySearch_API` || !s.requestSha256,
    )
  )
    throw new Error('MINI Canadian source context mismatch.');
  if (
    data.inventory.retrievedAt.slice(0, 10) !== date ||
    data.inventory.total !== data.inventory.returnedRows ||
    data.inventory.total !== data.inventory.distinctVehicles ||
    data.inventory.sources.length !== Math.ceil(data.inventory.total / 36) ||
    data.inventory.references.reduce((n, r) => n + r.observedVehicles, 0) !==
      data.inventory.total ||
    models.size !== data.models.length ||
    refs.size !== data.inventory.references.length
  )
    throw new Error('MINI inventory, dates or identities do not reconcile.');
  for (const source of [
    data.homeSource,
    data.builderSource,
    data.clientSource,
    data.carouselSource,
    data.rulesSource,
    ...data.inventory.sources,
  ])
    if (source.status !== 200) throw new Error('Required MINI source failed.');
  for (const family of data.overviewFamilies)
    if (!data.models.some((m) => m.current?.families.includes(family)))
      throw new Error('MINI overview family is absent from the current selector.');
  if (
    new Set(data.currentModelKeys).size !== data.currentModelKeys.length ||
    JSON.stringify([...data.currentModelKeys].sort()) !==
      JSON.stringify(
        data.models
          .filter((m) => m.current)
          .map((m) => m.key)
          .sort(),
      ) ||
    data.models.reduce((n, m) => n + (m.current?.families.length ?? 0), 0) !==
      data.selectorReferenceCount
  )
    throw new Error('MINI current selector references were omitted or changed.');
  const keys = new Set<string>();
  for (const m of data.models) {
    if (
      m.key !== miniModelKey(m) ||
      (!m.current && !m.stockKey) ||
      (m.stockKey && m.stockKey !== m.key) ||
      (m.stockKey && !refs.has(m.key)) ||
      (m.current &&
        (m.current.code !== m.code || m.current.year !== m.year || !data.years.includes(m.year))) ||
      m.lineSource.url !== miniLineUrl(m.code) ||
      m.technicalSource.url !== miniSpecUrl(m.code) ||
      m.technicalSource.status !== 200
    )
      throw new Error('MINI exact model/source/year identity mismatch.');
    if (
      m.lines &&
      (m.lineSource.status !== 200 ||
        (m.current &&
          (m.lines.Price !== m.current.basePrice || m.lines.Vehicle !== m.current.name)))
    )
      throw new Error('MINI factory price/name identity mismatch.');
    if (!m.lines && !miniReviewedLineFailure(m.lineSource, m.code))
      throw new Error('Unreviewed MINI source failure.');
    if (m.current && (!m.lines || !m.lines.LineList.length || !m.current.active))
      throw new Error('MINI current model ordering is unavailable.');
    if (!data.records.some((r) => r.modelKey === m.key)) throw new Error('MINI model was omitted.');
    if (m.current)
      for (const line of m.lines!.LineList)
        if (!data.records.some((r) => r.modelKey === m.key && r.lineId === line.lineid))
          throw new Error('MINI equipment line was omitted.');
  }
  for (const r of data.records) {
    const m = models.get(r.modelKey),
      key = miniRecordKey(r);
    if (!m || keys.has(key)) throw new Error('Unknown or duplicate MINI configuration.');
    keys.add(key);
    if (r.stockBaseOnly) {
      if (
        m.current ||
        !m.stockKey ||
        r.lineId !== null ||
        r.style ||
        r.nav ||
        r.navSource ||
        r.styleSource ||
        r.expectedStyleIds.length
      )
        throw new Error('MINI stock-base profile implies unverified ordering.');
      continue;
    }
    const line = m.lines?.LineList.find((l) => l.lineid === r.lineId);
    if (
      !m.current ||
      !line ||
      !r.nav ||
      r.navSource?.status !== 200 ||
      r.styleSource?.status !== 200 ||
      r.styleSource.url !== miniStyleUrl(m.code, line.lineid) ||
      r.navSource.url !== miniNavUrl(m.code, line.lineid, r.style?.StyleID ?? null) ||
      (r.style ? !r.expectedStyleIds.includes(r.style.StyleID) : r.expectedStyleIds.length !== 0)
    )
      throw new Error('MINI line/style/selection source mismatch.');
    const represented = data.records.filter(
      (other) => other.modelKey === r.modelKey && other.lineId === r.lineId,
    );
    if (
      JSON.stringify(represented.map((s) => s.style?.StyleID).sort()) !==
      JSON.stringify((r.expectedStyleIds.length ? r.expectedStyleIds : [undefined]).sort())
    )
      throw new Error('MINI style choices were omitted or changed.');
    if (Object.values(r.nav.minimumSelectionPrices).some((price) => price !== 0))
      throw new Error('MINI mandatory selection pricing requires review.');
    if (['Colour', 'Upholstery'].some((group) => r.nav!.minimumSelectionPrices[group] !== 0))
      throw new Error('MINI required selection choices are missing.');
    if (r.style && r.style.Price > 0 && r.style.Path !== 'Favoured')
      throw new Error('MINI style price basis requires review.');
    if (r.nav.transmissions.length > 1 || r.nav.transmissions.some((t) => t.price !== 0))
      throw new Error('Additional MINI transmission choices require expansion.');
    if (!miniPackageSelections(r, data.rules[m.code] ?? []).length)
      throw new Error('MINI packages have no compatible selection.');
  }
  for (const ref of refs.values())
    if (!models.has(miniModelKey(ref))) throw new Error('MINI new-stock model/year was omitted.');
    else if (
      ref.agCodes.length !== 1 ||
      ref.transmissions.length !== 1 ||
      ref.fuels.length !== 1 ||
      ref.drives.length !== 1
    )
      throw new Error('Additional MINI stock variants require expansion.');
  return data;
}
