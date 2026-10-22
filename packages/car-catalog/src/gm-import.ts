import { z } from 'zod';

export const gmBrands = {
  chevrolet: { make: 'Chevrolet', host: 'www.chevrolet.ca' },
  gmc: { make: 'GMC', host: 'www.gmccanada.ca' },
  buick: { make: 'Buick', host: 'www.buick.ca' },
  cadillac: { make: 'Cadillac', host: 'www.cadillaccanada.ca' },
} as const;
export type GmBrand = keyof typeof gmBrands;
export const gmPostalCode = 'T2P1J9';
export const gmBrandSchema = z.enum(['chevrolet', 'gmc', 'buick', 'cadillac']);
const nullableCode = z.string().nullable();
const nestedCode = z.union([
  nullableCode,
  z.object({ code: nullableCode }).transform((value) => value.code),
]);
export const gmReferenceSchema = z.strictObject({
  brand: gmBrandSchema,
  carline: z.string(),
  year: z.number().int(),
  bodyStyle: z.string(),
});
export type GmReference = z.infer<typeof gmReferenceSchema>;
export const gmReferenceKey = (model: GmReference) =>
  `${model.brand}/${model.carline}/${model.year}/${model.bodyStyle}`;
export const gmOrigin = (brand: GmBrand) => `https://${gmBrands[brand].host}`;
export const gmSelectorUrl = (brand: GmBrand) => `${gmOrigin(brand)}/en/build-and-price`;
export const gmMatrixUrl = (model: GmReference) =>
  `${gmOrigin(model.brand)}/byo-vc/api/v3/trim-matrix/en/CA/${gmReferenceKey(model)}?postalCode=${gmPostalCode}`;
export const gmClientUrl = (model: GmReference) =>
  `${gmOrigin(model.brand)}/byo-vc/client/en/CA/${gmReferenceKey(model)}/trims`;
export const gmSpecsUrl = (model: GmReference) =>
  `${gmOrigin(model.brand)}/byo-vc/api/v3/features-specs/comparison/en/CA/${gmReferenceKey(model)}`;
export const gmDefaultUrl = (model: GmReference, styleId: number) =>
  `${gmOrigin(model.brand)}/byo-vc/api/v3/fully-configured/en/CA/${gmReferenceKey(model)}/${gmPostalCode}?styleId=${styleId}`;
export const gmRetrieveUrl = (brand: GmBrand) =>
  `${gmOrigin(brand)}/byo-vc/api/v3/retrieve-configuration`;
const identityShape = {
  styleId: z.number().int(),
  engine: nullableCode,
  transmission: nullableCode,
  axleRatio: nullableCode,
  battery: nullableCode,
  propulsion: nullableCode,
};
export const gmOptionSchema = z.object({
  ...identityShape,
  bodyTypeId: z.number().int(),
  driveType: z.string(),
  mmcPeg: z.string(),
  trimName: z.string(),
  ss: z.string().min(1),
});
export type GmOption = z.infer<typeof gmOptionSchema>;
export const gmOptionKey = (option: Pick<GmOption, keyof typeof identityShape>) =>
  [
    option.styleId,
    option.engine,
    option.transmission,
    option.axleRatio,
    option.battery,
    option.propulsion,
  ]
    .map((value) => value ?? 'none')
    .join('/');
const feature = z.object({ id: z.string(), description: z.string().nullable() });
export const gmMatrixSchema = z.object({
  options: z.array(gmOptionSchema).min(1),
  engines: z.array(feature),
  transmissions: z.array(feature),
  batteries: z.array(feature),
  propulsions: z.array(feature),
  axleRatios: z.array(feature),
  bodyTypes: z
    .array(
      z.object({
        id: z.number().int(),
        description: z.string().nullable(),
        cabSize: z.string().nullable(),
      }),
    )
    .min(1),
  trims: z
    .array(
      z.object({
        styleId: z.number().int(),
        bodyTypeId: z.number().int(),
        mmcPeg: z.string(),
        trimName: z.string(),
        driveType: z.object({ id: z.string() }),
        lateAvailabilityDisclaimer: z.string().nullable(),
        configurations: z
          .array(
            z.object({
              styleId: z.number().int(),
              engine: z.object({ code: nullableCode }),
              transmission: z.object({ code: nullableCode }),
              axleRatio: nullableCode,
              battery: nestedCode,
              propulsion: nestedCode,
              ss: z.string(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});
export function gmMatrix(input: unknown) {
  const matrix = gmMatrixSchema.parse(input);
  const keys = matrix.options.map(gmOptionKey);
  const fromTrims = matrix.trims.flatMap((trim) =>
    trim.configurations.map((configuration) => {
      const key = gmOptionKey({
        ...configuration,
        engine: configuration.engine.code,
        transmission: configuration.transmission.code,
      });
      const option = matrix.options.find((option) => gmOptionKey(option) === key);
      if (
        !option ||
        option.styleId !== trim.styleId ||
        option.bodyTypeId !== trim.bodyTypeId ||
        option.mmcPeg !== trim.mmcPeg ||
        option.driveType !== trim.driveType.id ||
        option.trimName !== trim.trimName ||
        option.ss !== configuration.ss
      )
        throw new Error('GM trim/configuration identity mismatch.');
      return key;
    }),
  );
  reconcile(keys, fromTrims, 'trim-matrix configurations');
  for (const option of matrix.options)
    if (!matrix.bodyTypes.some((body) => body.id === option.bodyTypeId))
      throw new Error('GM body reference is missing.');
  return matrix;
}
function unescapeAttribute(value: string) {
  return value.replace(
    /&(?:#(x[\da-f]+|\d+)|(amp|quot|apos|lt|gt|nbsp));/gi,
    (_, code: string | undefined, named: string | undefined) =>
      code
        ? String.fromCodePoint(
            code[0]!.toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code),
          )
        : (
            { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' } as Record<
              string,
              string
            >
          )[named!.toLowerCase()]!,
  );
}
export function gmReferences(html: string, brand: GmBrand) {
  const stack: { tag: string; hidden: boolean }[] = [],
    found = new Map<string, GmReference>(),
    hidden = new Map<string, GmReference>();
  const tokens =
    /<!--[\s\S]*?-->|<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?[a-z][^>]*>/gi;
  for (const match of html.matchAll(tokens)) {
    const token = match[0];
    if (token.startsWith('<!--') || match[1]) continue;
    const closing = /^<\//.test(token),
      tag = /^<\/?([\w-]+)/.exec(token)![1]!.toLowerCase();
    if (closing) {
      const index = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (index >= 0) stack.splice(index);
      continue;
    }
    const attributes = Object.fromEntries(
      [...token.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((attribute) => [
        attribute[1]!.toLowerCase(),
        unescapeAttribute(attribute[2]!),
      ]),
    );
    const classes = (attributes.class ?? '').split(/\s+/),
      allHidden = ['small', 'medium', 'large', 'xlarge', 'xxlarge'].every((size) =>
        classes.includes(`hide-for-${size}`),
      );
    const isHidden = allHidden || stack.some((entry) => entry.hidden);
    if (tag === 'a' && attributes.href) {
      const url = new URL(attributes.href, gmOrigin(brand));
      const parts = /^\/byo-vc\/client\/en\/CA\/([^/]+)\/([^/]+)\/(20\d\d)\/([^/?#]+)\//.exec(
        url.pathname,
      );
      if (parts && parts[1] === brand && url.hostname === gmBrands[brand].host) {
        const reference = {
          brand,
          carline: parts[2]!,
          year: Number(parts[3]),
          bodyStyle: parts[4]!,
        };
        (isHidden ? hidden : found).set(gmReferenceKey(reference), reference);
      }
    }
    if (
      !/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) &&
      !/\/>$/.test(token)
    )
      stack.push({ tag, hidden: isHidden });
  }
  return {
    models: [...found.values()],
    hidden: [...hidden.values()].filter((reference) => !found.has(gmReferenceKey(reference))),
  };
}
export function gmAssignedJson(html: string, name: 'appResources') {
  const marker = `window.${name}`,
    start = html.indexOf(marker);
  if (start < 0) throw new Error('GM model identity JSON is missing.');
  const equal = html.indexOf('=', start),
    begin = html.indexOf('{', equal);
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = begin; i < html.length; i++) {
    const char = html[i]!;
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return JSON.parse(html.slice(begin, i + 1));
  }
  throw new Error('Unterminated GM model identity JSON.');
}
export function gmModelIdentity(html: string, expected: GmReference) {
  const identity = z
    .object({
      brand: gmBrandSchema,
      country: z.literal('CA'),
      language: z.literal('en'),
      carline: z.string(),
      bodyStyle: z.string(),
      year: z.number().int(),
      bodyStyleTitle: z.string(),
      evMode: z.boolean(),
    })
    .parse(gmAssignedJson(html, 'appResources'));
  if (gmReferenceKey(identity) !== gmReferenceKey(expected))
    throw new Error('GM client model/year/country mismatch.');
  return identity;
}
const money = z.object({ value: z.number().finite() });
const pricedOption = z.object({
  code: z.string(),
  selected: z.boolean(),
  description: z.string(),
  dealerInstalled: z.boolean(),
  priceState: z.string().nullable(),
  msrpDisplay: z.object({ amount: money.nullable(), display: z.string().nullable() }),
  hierarchy: z.object({ step: z.string(), category: z.string().nullable() }),
  appliedPackageCash: z.boolean(),
  discountedPriceTotal: z.unknown(),
  opdMsrp: z.unknown(),
  rpoCash: z.unknown(),
});
export const gmConfigurationSchema = z.object({
  config: z.object({
    styleId: z.number().int(),
    selected: z.array(z.string()),
    ss: z.string(),
    summary: z.object({
      keyAttributes: z.array(
        z.object({ key: z.string(), name: z.string(), value: z.string().nullable() }),
      ),
      options: z.array(z.object({ key: z.string(), options: z.array(pricedOption) })),
      prices: z.object({
        standardVehiclePrice: money.nullable(),
        vehicleOptionsTotal: money.nullable(),
        totalVehiclePrice: money.nullable(),
      }),
    }),
  }),
  modelMatrix: z.object({
    styles: z
      .array(
        z.object({
          styleId: z.number().int(),
          selected: z.boolean(),
          styleConfig: z.object(identityShape).nullable(),
          vehicleInfo: z.object({
            bodyTypeId: z.number().int(),
            mmcPeg: z.string(),
            bodyStyleTitle: z.string(),
            orderAvailabilityType: z.string().nullable(),
          }),
        }),
      )
      .min(1),
  }),
});
export function gmConfiguration(input: unknown, expected: GmOption) {
  const data = gmConfigurationSchema.parse(input),
    selected = data.modelMatrix.styles.find(
      (style) => style.styleId === data.config.styleId && style.selected,
    );
  if (
    !selected ||
    !selected.styleConfig ||
    data.config.styleId !== expected.styleId ||
    gmOptionKey(selected.styleConfig) !== gmOptionKey(expected) ||
    selected.vehicleInfo.bodyTypeId !== expected.bodyTypeId ||
    selected.vehicleInfo.mmcPeg !== expected.mmcPeg
  )
    throw new Error(
      'GM returned configuration differs from the requested factory matrix identity.',
    );
  return { data, selected };
}
export function gmMsrp(input: unknown, expected: GmOption) {
  const { data } = gmConfiguration(input, expected),
    prices = data.config.summary.prices,
    base = prices.standardVehiclePrice?.value,
    subtotal = prices.vehicleOptionsTotal?.value;
  const components = data.config.summary.options
    .flatMap((group) => group.options)
    .filter((option) => option.selected);
  if (base === undefined || subtotal === undefined || base < 10000)
    return {
      value: null,
      reason: 'A complete standard-vehicle and options subtotal was not published.',
    };
  let all = base,
    removed = 0;
  for (const option of components) {
    if (
      option.appliedPackageCash ||
      option.discountedPriceTotal ||
      option.opdMsrp ||
      option.rpoCash
    )
      return {
        value: null,
        reason: 'Package/option discount fields require independent MSRP-basis reconciliation.',
      };
    const amount = option.msrpDisplay.amount?.value;
    if (amount !== undefined && amount < 0)
      return {
        value: null,
        reason: 'A negative selected-component price requires factory-credit/MSRP reconciliation.',
      };
    if (
      amount === undefined &&
      !/^(?:\$0(?:\.00)?|Standard|Included)$/i.test(option.msrpDisplay.display ?? '')
    )
      return {
        value: null,
        reason: `Selected factory component ${option.code} has an unresolved price.`,
      };
    if (option.priceState !== null && option.priceState !== 'Actual')
      return {
        value: null,
        reason: `Selected factory component ${option.code} does not have an Actual price state.`,
      };
    all += amount ?? 0;
    if (
      option.dealerInstalled ||
      /(?:^|\.)color$|accessor/i.test(option.hierarchy.category ?? '') ||
      /accessor/i.test(option.hierarchy.step)
    )
      removed += amount ?? 0;
  }
  if (Math.abs(all - subtotal) > 0.01)
    return {
      value: null,
      reason:
        'Factory component prices do not reconcile with the published configuration subtotal.',
    };
  return {
    value: Math.round((all - removed) * 100) / 100,
    reason:
      'Standard vehicle price plus selected factory equipment, excluding paid colours, dealer-installed products, accessories, freight, fees, taxes and incentives.',
  };
}
function reconcile(expected: string[], actual: string[], label: string) {
  if (
    new Set(expected).size !== expected.length ||
    new Set(actual).size !== actual.length ||
    JSON.stringify([...expected].sort()) !== JSON.stringify([...actual].sort())
  )
    throw new Error(`Incomplete or duplicate GM ${label}.`);
}

const officialUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    Object.values(gmBrands).some((brand) => brand.host === url.hostname) &&
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
export const gmCaptureManifestSchema = z.strictObject({
  retrievedAt: z.iso.datetime(),
  sources: z.array(receipt).min(1),
  lineupPages: z.array(z.strictObject({ brand: gmBrandSchema, url: officialUrl })).min(4),
  calculationFailures: z.array(z.strictObject({ requestSha256: z.string(), reason: z.string() })),
});
const modelSnapshot = z.strictObject({
  reference: gmReferenceSchema,
  key: z.string(),
  displayName: z.string(),
  electric: z.boolean(),
  expectedKeys: z.array(z.string()).min(1),
  source: receipt,
  excludedReason: z.string().nullable(),
  specificationsSource: receipt.nullable(),
  identitySource: receipt.nullable(),
});
const recordSnapshot = z.strictObject({
  modelKey: z.string(),
  option: gmOptionSchema.omit({ ss: true }),
  engineDescription: z.string().nullable(),
  transmissionDescription: z.string().nullable(),
  axleDescription: z.string().nullable(),
  batteryDescription: z.string().nullable(),
  propulsionDescription: z.string().nullable(),
  bodyDescription: z.string().nullable(),
  lateAvailabilityNote: z.string().nullable(),
  configuration: z
    .strictObject({
      source: receipt,
      ss: z.string(),
      selectedCodes: z.array(z.string()),
      msrpCad: z.number().min(10000).max(10000000).nullable(),
      priceNote: z.string(),
      bodyStyleTitle: z.string(),
      orderAvailabilityType: z.string().nullable(),
      attributes: z.array(
        z.strictObject({ key: z.string(), name: z.string(), value: z.string().nullable() }),
      ),
    })
    .nullable(),
  configurationGap: z.string().nullable(),
});
export const gmSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  postalCode: z.literal(gmPostalCode),
  lineupSources: z.array(receipt).min(4),
  expectedModelKeys: z.array(z.string()).min(1),
  hiddenReferencesNeedingReview: z.array(gmReferenceSchema),
  models: z.array(modelSnapshot).min(1),
  records: z.array(recordSnapshot).min(1),
});
export type GmSnapshot = z.infer<typeof gmSnapshotSchema>;
export type GmRecord = z.infer<typeof recordSnapshot>;
export function validateGmSnapshot(input: unknown): GmSnapshot {
  const snapshot = gmSnapshotSchema.parse(input);
  for (const brand of Object.keys(gmBrands) as GmBrand[])
    if (!snapshot.lineupSources.some((source) => source.url === gmSelectorUrl(brand)))
      throw new Error('A required GM brand lineup source is missing.');
  reconcile(
    snapshot.expectedModelKeys,
    snapshot.models.map((model) => model.key),
    'model references',
  );
  reconcile(
    snapshot.models
      .filter((model) => !model.excludedReason)
      .flatMap((model) => model.expectedKeys.map((key) => `${model.key}/${key}`)),
    snapshot.records.map((record) => `${record.modelKey}/${gmOptionKey(record.option)}`),
    'passenger configurations',
  );
  for (const model of snapshot.models) {
    if (
      model.key !== gmReferenceKey(model.reference) ||
      model.source.url !== gmMatrixUrl(model.reference)
    )
      throw new Error('GM model source identity mismatch.');
    if (model.excludedReason && !/^(express|savana)-cargo$/.test(model.reference.bodyStyle))
      throw new Error('Unreviewed GM commercial exclusion.');
    if (
      model.specificationsSource &&
      model.specificationsSource.url !== gmSpecsUrl(model.reference)
    )
      throw new Error('GM specification source mismatch.');
  }
  for (const record of snapshot.records) {
    const model = snapshot.models.find((model) => model.key === record.modelKey);
    if (!model || model.excludedReason || !model.expectedKeys.includes(gmOptionKey(record.option)))
      throw new Error('Unreferenced GM factory configuration.');
    if (!record.configuration && !record.configurationGap)
      throw new Error('Missing GM configuration evidence requires a gap explanation.');
    if (record.configuration) {
      const source = record.configuration.source;
      if (
        source.url !== gmRetrieveUrl(model.reference.brand) &&
        source.url !== gmDefaultUrl(model.reference, record.option.styleId)
      )
        throw new Error('GM configuration source mismatch.');
      if ((source.url === gmRetrieveUrl(model.reference.brand)) !== (source.requestSha256 !== null))
        throw new Error('GM POST calculation requires an exact request checksum.');
    }
  }
  return snapshot;
}
