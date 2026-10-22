import { z } from 'zod';

export const hyundaiBuildPage = 'https://www.hyundaicanada.com/en/shopping-tools/buildandprice';
export const hyundaiClientUrl =
  'https://www.hyundaicanada.com/blocks/build-and-price/buildAndPrice.bundle.js';
const api = 'https://www.hyundaicanada.com/api/backendservice';
export const hyundaiLineupUrl = `${api}/buildandprice/GetShowroomsModelJson?language=en&prov=AB`;
export const hyundaiTrimsUrl = (modelId: string) =>
  `${api}/buildandprice/getShowroomModelTrimsJson?modelId=${encodeURIComponent(modelId)}&prov=AB&language=en`;
export const hyundaiPriceUrl = (trimId: string) =>
  `${api}/buildandprice/trimallpurchaseOptions?trimId=${encodeURIComponent(trimId)}&prov=AB&lang=en`;
export const hyundaiFeaturesUrl = (trimId: string) =>
  `${api}/buildandprice/getAllTrimFeatures?trimId=${encodeURIComponent(trimId)}&isParentVehicle=false&language=en`;
export const hyundaiTableUrl = (modelId: string) =>
  `${api}/vlp/GetSpecifications?modelId=${encodeURIComponent(modelId)}&lang=en`;
export const hyundaiConfigurationUrl = (modelId: string, trimId: string) =>
  `${hyundaiBuildPage}?modelId=${encodeURIComponent(modelId)}&trimId=${encodeURIComponent(trimId)}&step=3`;

// New model records also use GUID-shaped source IDs that are not RFC UUIDs.
const uuid = z.string().regex(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
const selection = z.object({ key: z.union([z.string(), z.number()]), value: z.string() });
const option = z.object({ key: z.number().int(), productName: z.string(), price: z.number() });
const model = z.object({
  modelId: uuid,
  vehicleName: z.string().min(1),
  vehicleYear: z.string().regex(/^20\d\d$/),
  modelNameCMS: z.string().min(1),
});
export const hyundaiLineupResponse = z.object({
  data: z.object({ models: z.array(z.array(model).min(1)).min(1) }),
});
const trim = z.object({
  trimId: uuid,
  trimName: z.string(),
  modelId: uuid,
  modelNameCMS: z.string(),
  vehicleYear: z
    .union([z.string().regex(/^20\d\d$/), z.number().int().min(2000).max(2099)])
    .transform(String),
  soldOut: z.boolean(),
  basePrice: z.object({ baseTrimId: uuid, value: z.number().positive() }),
  baseTrimConfiguration: z.array(selection),
  optionTypes: z.array(z.object({ options: z.array(option) })),
  subTrims: z
    .array(
      z.object({
        trimID: uuid,
        trimName: z.string().min(1),
        trimNameCMS: z.string().min(1),
        trimConfiguration: z.array(selection),
      }),
    )
    .min(1),
});
export const hyundaiTrimsResponse = z.object({
  data: z.object({ trims: z.array(trim).min(1), linkedModel: z.array(z.unknown()) }),
});
export const hyundaiPriceResponse = z.object({
  trimId: uuid,
  trimName: z.string().min(1),
  provinceCode: z.literal('AB'),
  msrp: z.number().min(10000).max(10000000),
  delivery: z.number().nonnegative(),
  includeDestination: z.boolean(),
});
export const hyundaiFeaturesResponse = z.object({
  data: z
    .array(
      z.object({
        trimName: z.string().min(1),
        categories: z
          .array(
            z.object({
              name: z.string(),
              features: z.array(z.object({ name: z.string() })),
            }),
          )
          .min(1),
      }),
    )
    .length(1),
});
export type HyundaiModel = z.infer<typeof model>;
export type HyundaiTrim = z.infer<typeof trim>;
export function hyundaiModels(input: unknown) {
  const listed = hyundaiLineupResponse.parse(input).data.models.flat();
  const models = new Map<string, HyundaiModel>();
  for (const entry of listed) {
    const previous = models.get(entry.modelId);
    if (
      previous &&
      (previous.vehicleYear !== entry.vehicleYear || previous.modelNameCMS !== entry.modelNameCMS)
    )
      throw new Error('Hyundai repeated model/year identity mismatch.');
    // Gas, HEV and PHEV cards can reference the same complete trim list.
    if (!previous) models.set(entry.modelId, entry);
  }
  return [...models.values()];
}
export function hyundaiTrims(input: unknown, expected: HyundaiModel) {
  const data = hyundaiTrimsResponse.parse(input).data;
  if (data.linkedModel.length) throw new Error('Hyundai linked models require source review.');
  const ids: string[] = [];
  for (const parent of data.trims) {
    if (
      parent.modelId !== expected.modelId ||
      parent.vehicleYear !== expected.vehicleYear ||
      parent.modelNameCMS !== expected.modelNameCMS ||
      parent.basePrice.baseTrimId !== parent.trimId ||
      !parent.subTrims.some((sub) => sub.trimID === parent.trimId)
    )
      throw new Error('Hyundai trim/model/year identity mismatch.');
    const options = new Map<string, number>();
    for (const value of parent.optionTypes.flatMap((type) => type.options)) {
      const key = String(value.key);
      if (options.has(key) && options.get(key) !== value.price)
        throw new Error('Hyundai conflicting option prices.');
      options.set(key, value.price);
    }
    for (const choice of [
      ...parent.baseTrimConfiguration,
      ...parent.subTrims.flatMap((sub) => sub.trimConfiguration),
    ])
      if (!options.has(String(choice.key)))
        throw new Error('Hyundai selection is absent from the option ledger.');
    ids.push(...parent.subTrims.map((sub) => sub.trimID));
  }
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate Hyundai subtrim identities.');
  return data.trims;
}
export function hyundaiOptionEstimate(
  parent: HyundaiTrim,
  selected: HyundaiTrim['subTrims'][number],
) {
  const options = new Map(
    parent.optionTypes
      .flatMap((type) => type.options)
      .map((option) => [String(option.key), option.price]),
  );
  const base = new Set(parent.baseTrimConfiguration.map((choice) => String(choice.key))),
    chosen = new Set(selected.trimConfiguration.map((choice) => String(choice.key)));
  return (
    parent.basePrice.value +
    [...chosen].filter((key) => !base.has(key)).reduce((sum, key) => sum + options.get(key)!, 0) -
    [...base].filter((key) => !chosen.has(key)).reduce((sum, key) => sum + options.get(key)!, 0)
  );
}
export function hyundaiExactPrice(input: unknown, trimId: string) {
  const price = hyundaiPriceResponse.parse(input);
  if (price.trimId !== trimId || price.includeDestination)
    throw new Error('Hyundai exact-trim MSRP identity or destination basis changed.');
  return price;
}

const officialUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    url.hostname === 'www.hyundaicanada.com' &&
    !url.username &&
    !url.password
  );
});
const receipt = z.strictObject({ url: officialUrl, sha256: z.string().regex(/^[a-f0-9]{64}$/) });
export const hyundaiCaptureManifestSchema = z.strictObject({
  retrievedAt: z.iso.datetime(),
  sources: z.array(receipt.extend({ status: z.number().int().min(100).max(599) })).min(1),
});
const feature = z.strictObject({ section: z.string(), name: z.string() });
const record = z.strictObject({
  modelId: uuid,
  year: z.number().int(),
  modelSlug: z.string(),
  modelName: z.string(),
  parentTrimId: uuid,
  trimId: uuid,
  trimName: z.string(),
  trimSlug: z.string(),
  selectedOptions: z.array(z.strictObject({ key: z.string(), name: z.string() })),
  soldOut: z.boolean(),
  msrpCad: z.number().min(10000).max(10000000),
  optionEstimateCad: z.number(),
  priceTrimName: z.string(),
  featuresTrimName: z.string(),
  priceSource: receipt,
  featuresSource: receipt,
  features: z.array(feature).min(1),
});
const normalizedModel = z.strictObject({
  id: uuid,
  year: z.number().int(),
  slug: z.string(),
  name: z.string(),
  source: receipt,
  expectedParentTrimIds: z.array(uuid).min(1),
  expectedTrimIds: z.array(uuid).min(1),
  specificationsReview: z.strictObject({
    source: receipt,
    status: z.number().int(),
    reason: z.string(),
  }),
});
const normalizedTrim = z.strictObject({
  modelId: uuid,
  id: uuid,
  name: z.string(),
  expectedSubtrimIds: z.array(uuid).min(1),
});
export const hyundaiSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  lineup: receipt,
  client: receipt,
  expectedModelIds: z.array(uuid).min(1),
  models: z.array(normalizedModel).min(1),
  trims: z.array(normalizedTrim).min(1),
  records: z.array(record).min(1),
});
export type HyundaiRecord = z.infer<typeof record>;
export type HyundaiSnapshot = z.infer<typeof hyundaiSnapshotSchema>;
function reconcile(expected: string[], actual: string[], label: string) {
  if (
    new Set(expected).size !== expected.length ||
    new Set(actual).size !== actual.length ||
    JSON.stringify([...expected].sort()) !== JSON.stringify([...actual].sort())
  )
    throw new Error(`Incomplete or duplicate Hyundai ${label}.`);
}
export function validateHyundaiSnapshot(input: unknown): HyundaiSnapshot {
  const snapshot = hyundaiSnapshotSchema.parse(input);
  if (snapshot.lineup.url !== hyundaiLineupUrl || snapshot.client.url !== hyundaiClientUrl)
    throw new Error('Hyundai lineup/client source mismatch.');
  reconcile(
    snapshot.expectedModelIds,
    snapshot.models.map((model) => model.id),
    'model years',
  );
  reconcile(
    snapshot.models.flatMap((model) => model.expectedTrimIds),
    snapshot.records.map((record) => record.trimId),
    'configurations',
  );
  for (const model of snapshot.models) {
    if (
      model.source.url !== hyundaiTrimsUrl(model.id) ||
      model.specificationsReview.source.url !== hyundaiTableUrl(model.id)
    )
      throw new Error('Hyundai model source mismatch.');
    reconcile(
      model.expectedParentTrimIds,
      snapshot.trims.filter((trim) => trim.modelId === model.id).map((trim) => trim.id),
      'parent trims',
    );
  }
  for (const trim of snapshot.trims) {
    if (!snapshot.models.some((model) => model.id === trim.modelId))
      throw new Error('Unreferenced Hyundai parent trim.');
    reconcile(
      trim.expectedSubtrimIds,
      snapshot.records
        .filter((record) => record.modelId === trim.modelId && record.parentTrimId === trim.id)
        .map((record) => record.trimId),
      'subtrims',
    );
  }
  for (const record of snapshot.records) {
    const model = snapshot.models.find((model) => model.id === record.modelId);
    if (
      !model ||
      model.year !== record.year ||
      model.slug !== record.modelSlug ||
      model.name !== record.modelName ||
      !snapshot.trims.some(
        (trim) => trim.modelId === record.modelId && trim.id === record.parentTrimId,
      ) ||
      record.priceSource.url !== hyundaiPriceUrl(record.trimId) ||
      record.featuresSource.url !== hyundaiFeaturesUrl(record.trimId) ||
      record.featuresTrimName !== record.trimName
    )
      throw new Error('Hyundai configuration identity/source mismatch.');
    if (
      new Set(record.selectedOptions.map((choice) => choice.key)).size !==
      record.selectedOptions.length
    )
      throw new Error('Duplicate Hyundai selected options.');
  }
  return snapshot;
}
