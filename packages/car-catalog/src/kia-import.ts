import { z } from 'zod';
import { embeddedJson } from './subaru-import';

export const kiaBuildPage = 'https://www.kia.ca/en/shopping-tools/build-and-price';
export const kiaLineupPage = 'https://www.kia.ca/en/vehicles';
export const kiaCommercialEvidence =
  'https://www.kia.ca/en/about-kia/news/Kia-Canada-announces-pricing-for-2027-PV5-Cargo-scheduled-to-arrive-in-Canada-later-this-year';
const path = z.string().startsWith('/content/dam/marketing/en/vehicles/models/');
const strings = z.record(z.string(), z.string());
const core = z.object({
  contentFragmentPath: path,
  trim: z.string().min(1),
  trimCode: z.string().regex(/^[A-Z0-9]+$/),
  fscCodes: z.array(z.string().min(1)).min(1),
  hasSibling: z.boolean(),
  isHev: z.boolean(),
  isPhev: z.boolean(),
  isPackageHev: z.boolean(),
  isPackagePhev: z.boolean(),
  engine: strings.optional(),
  evMotor: strings.optional(),
  dimensions: strings,
  performance: strings,
  transmission: strings,
  features: z.object({ powertrainFeatures: z.array(z.object({ enName: z.string() })) }),
  priceDetails: z.object({
    AB: z.object({ msrp: z.number().positive(), dnd: z.number().nonnegative() }),
  }),
});
const packageSchema = core.extend({ packageName: z.string().min(1), packageParentTrim: path });
const rawTrim = core.extend({ packages: z.array(packageSchema) });
export const kiaModelSchema = z.object({
  contentFragmentPath: path,
  year: z.string().regex(/^20\d\d$/),
  make: z.literal('Kia'),
  model: z.string().min(1),
  bodyType: z.enum(['SUV', 'Sedan', 'Hatchback', 'Minivan', 'Van']),
  engineType: z.enum(['Gas', 'HEV', 'PHEV', 'EV']),
  vmpUrl: z.string().startsWith('/content/marketing/ca/en/'),
  specsPageUrl: z.string().startsWith('/content/marketing/ca/en/'),
  defaultYear: z.boolean(),
  trims: z.array(rawTrim).min(1),
});
export type KiaModel = z.infer<typeof kiaModelSchema>;
const payload = z.object({
  vehicles: z.object({
    vehicleList: z.array(kiaModelSchema).min(1),
    vehicleFamiliesList: z
      .array(z.object({ name: z.string(), models: z.array(kiaModelSchema).min(1) }))
      .min(1),
  }),
});
function decodeAttribute(value: string) {
  return value.replace(
    /&(?:#(x[\da-f]+|\d+)|(amp|quot|apos|lt|gt|nbsp));/gi,
    (_, code: string | undefined, named: string | undefined) => {
      if (code)
        return String.fromCodePoint(
          code[0]!.toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code),
        );
      return (
        { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0' } as Record<
          string,
          string
        >
      )[named!.toLowerCase()]!;
    },
  );
}
export function kiaAttribute(html: string, attribute: 'vehicle-list' | 'vehicle') {
  const value = html.match(new RegExp(`\\s${attribute}="([^"]+)"`))?.[1];
  if (!value) throw new Error(`Kia ${attribute} JSON attribute is missing.`);
  return JSON.parse(decodeAttribute(value));
}
export function kiaCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(kiaCanonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${kiaCanonical(entry)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export function kiaModels(html: string) {
  const data = payload.parse(kiaAttribute(html, 'vehicle-list')).vehicles;
  const flat = new Map(data.vehicleList.map((model) => [model.contentFragmentPath, model]));
  if (flat.size !== data.vehicleList.length)
    throw new Error('Duplicate Kia flat model references.');
  const grouped = data.vehicleFamiliesList.flatMap((family) => family.models);
  if (new Set(grouped.map((model) => model.contentFragmentPath)).size !== grouped.length)
    throw new Error('Duplicate Kia grouped models.');
  for (const model of grouped) {
    const reference = flat.get(model.contentFragmentPath);
    if (!reference || kiaCanonical(model) !== kiaCanonical(reference))
      throw new Error('Kia grouped/flat model discrepancy requires source review.');
  }
  return {
    models: data.vehicleList,
    groupedModelPaths: grouped.map((model) => model.contentFragmentPath),
  };
}
export function kiaPublicPage(contentPath: string) {
  if (!contentPath.startsWith('/content/marketing/ca/en/') || /[?#\\]|\.\./.test(contentPath))
    throw new Error('Unreviewed Kia public page path.');
  return `https://www.kia.ca${contentPath.replace('/content/marketing/ca', '')}`;
}
export function kiaModelEvidence(html: string, expected: KiaModel) {
  const data = z
    .object({ vehiclePath: path, vehicle: kiaModelSchema })
    .parse(kiaAttribute(html, 'vehicle'));
  if (
    data.vehiclePath !== expected.contentFragmentPath ||
    kiaCanonical(data.vehicle) !== kiaCanonical(expected)
  )
    throw new Error('Kia additional model evidence mismatch.');
}
const unitFields = [
  'power',
  'horsepower',
  'combined-powertrain-output',
  'estimated-fuel-econ-city',
  'estimated-fuel-econ-hwy',
  'estimated-fuel-econ-combined',
  'electric-driving-range',
  'charging-level-two',
] as const;
export function kiaUnitLabels(html: string) {
  const dictionary = z
    .record(z.string(), z.string())
    .parse(embeddedJson(html, 'i18n-dictionary', 'script'));
  const labels = Object.fromEntries(
    unitFields.map((field) => [field, dictionary[`kca.trim.${field}`] ?? '']),
  );
  validateKiaUnits(labels);
  return labels;
}
function validateKiaUnits(labels: Record<string, string>) {
  if (
    labels.power !== 'Power - hp' ||
    labels.horsepower !== 'Horsepower' ||
    !unitFields
      .filter((field) => field.startsWith('estimated-'))
      .every((field) => labels[field]!.includes('(L/100km)')) ||
    !labels['electric-driving-range']!.includes('(km)') ||
    !labels['charging-level-two']!.includes('240V')
  )
    throw new Error('Kia published measurement units changed.');
}
const officialUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' && url.hostname === 'www.kia.ca' && !url.username && !url.password
  );
});
const receipt = z.strictObject({ url: officialUrl, sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const record = z.strictObject({
  year: z.number().int(),
  modelPath: path,
  modelName: z.string(),
  bodyType: kiaModelSchema.shape.bodyType,
  engineType: kiaModelSchema.shape.engineType,
  parentPath: path,
  path,
  trimCode: z.string(),
  trimName: z.string(),
  sourceTrimName: z.string(),
  parentTrimName: z.string(),
  packageName: z.string().nullable(),
  fscCodes: z.array(z.string()).min(1),
  isHev: z.boolean(),
  isPhev: z.boolean(),
  msrpCad: z.number().min(10000).max(10000000),
  engine: strings,
  motor: strings,
  dimensions: strings,
  performance: strings,
  transmission: strings,
  powertrainLabels: z.array(z.string()),
});
export type KiaRecord = z.infer<typeof record>;
const model = z.strictObject({
  path,
  year: z.number().int(),
  name: z.string(),
  bodyType: kiaModelSchema.shape.bodyType,
  engineType: kiaModelSchema.shape.engineType,
  defaultYear: z.boolean(),
  specsUrl: officialUrl,
  expectedKeys: z.array(z.string()).min(1),
});
export const kiaSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  lineup: receipt,
  build: receipt,
  units: z.record(z.string(), z.string()),
  expectedModelPaths: z.array(path).min(1),
  groupedModelPaths: z.array(path).min(1),
  additionalModelEvidence: z.array(z.strictObject({ modelPath: path, source: receipt })),
  excludedModels: z.array(
    z.strictObject({
      modelPath: path,
      year: z.number().int(),
      name: z.string(),
      expectedKeys: z.array(z.string()).min(1),
      reason: z.string(),
      source: receipt,
    }),
  ),
  models: z.array(model).min(1),
  records: z.array(record).min(1),
});
export type KiaSnapshot = z.infer<typeof kiaSnapshotSchema>;
export const kiaKey = (record: Pick<KiaRecord, 'year' | 'trimCode'>) =>
  `${record.year}/${record.trimCode}`;
export function kiaRecords(model: KiaModel): KiaRecord[] {
  return model.trims.flatMap((parent) =>
    [parent, ...parent.packages].map((trim) => {
      const pack = 'packageName' in trim;
      if (pack && trim.packageParentTrim !== parent.contentFragmentPath)
        throw new Error('Kia package parent mismatch.');
      if (new Set(trim.fscCodes).size !== trim.fscCodes.length)
        throw new Error('Duplicate Kia FSC aliases.');
      return {
        year: Number(model.year),
        modelPath: model.contentFragmentPath,
        modelName: model.model,
        bodyType: model.bodyType,
        engineType: model.engineType,
        parentPath: parent.contentFragmentPath,
        path: trim.contentFragmentPath,
        trimCode: trim.trimCode,
        trimName:
          pack && parent.hasSibling && /^(AWD|FWD|RWD|4WD)$/i.test(trim.packageName)
            ? parent.trim
            : trim.trim,
        sourceTrimName: trim.trim,
        parentTrimName: parent.trim,
        packageName: pack ? trim.packageName : null,
        fscCodes: trim.fscCodes,
        isHev: trim.isHev || trim.isPackageHev,
        isPhev: trim.isPhev || trim.isPackagePhev,
        msrpCad: trim.priceDetails.AB.msrp,
        engine: trim.engine ?? {},
        motor: trim.evMotor ?? {},
        dimensions: trim.dimensions,
        performance: trim.performance,
        transmission: trim.transmission,
        powertrainLabels: trim.features.powertrainFeatures.map((feature) => feature.enName),
      };
    }),
  );
}
function reconcile(expected: string[], actual: string[], label: string) {
  if (
    new Set(expected).size !== expected.length ||
    new Set(actual).size !== actual.length ||
    kiaCanonical([...expected].sort()) !== kiaCanonical([...actual].sort())
  )
    throw new Error(`Incomplete or duplicate Kia ${label}.`);
}
export function validateKiaSnapshot(input: unknown): KiaSnapshot {
  const snapshot = kiaSnapshotSchema.parse(input);
  validateKiaUnits(snapshot.units);
  if (snapshot.lineup.url !== kiaLineupPage || snapshot.build.url !== kiaBuildPage)
    throw new Error('Kia source-page mismatch.');
  reconcile(
    snapshot.expectedModelPaths,
    [
      ...snapshot.models.map((model) => model.path),
      ...snapshot.excludedModels.map((model) => model.modelPath),
    ],
    'model references',
  );
  if (
    new Set(snapshot.groupedModelPaths).size !== snapshot.groupedModelPaths.length ||
    snapshot.groupedModelPaths.some((path) => !snapshot.expectedModelPaths.includes(path))
  )
    throw new Error('Kia grouped reference mismatch.');
  reconcile(
    snapshot.expectedModelPaths.filter((path) => !snapshot.groupedModelPaths.includes(path)),
    snapshot.additionalModelEvidence.map((entry) => entry.modelPath),
    'additional model evidence',
  );
  for (const entry of snapshot.additionalModelEvidence)
    if (!snapshot.models.some((model) => model.path === entry.modelPath))
      throw new Error('Unreferenced Kia model evidence.');
  reconcile(
    snapshot.models.flatMap((model) => model.expectedKeys),
    snapshot.records.map(kiaKey),
    'factory configurations',
  );
  for (const model of snapshot.models) {
    reconcile(
      model.expectedKeys,
      snapshot.records.filter((record) => record.modelPath === model.path).map(kiaKey),
      'model configurations',
    );
    if (!model.specsUrl.startsWith('https://www.kia.ca/en/'))
      throw new Error('Kia specifications source mismatch.');
  }
  for (const record of snapshot.records) {
    const model = snapshot.models.find((model) => model.path === record.modelPath);
    if (
      !model ||
      model.year !== record.year ||
      model.name !== record.modelName ||
      model.bodyType !== record.bodyType ||
      model.engineType !== record.engineType ||
      (record.isHev && record.isPhev)
    )
      throw new Error('Kia configuration/model identity mismatch.');
    const parent = snapshot.records.find(
      (candidate) =>
        candidate.modelPath === record.modelPath &&
        candidate.path === record.parentPath &&
        candidate.packageName === null,
    );
    if (
      !parent ||
      record.parentTrimName !== parent.trimName ||
      (record.packageName === null && record.path !== record.parentPath)
    )
      throw new Error('Unreferenced Kia package parent.');
    if (new Set(record.fscCodes).size !== record.fscCodes.length)
      throw new Error('Duplicate Kia FSC aliases.');
  }
  for (const model of snapshot.excludedModels)
    if (model.name !== 'PV5' || model.year !== 2027 || model.source.url !== kiaCommercialEvidence)
      throw new Error('Unreviewed Kia commercial exclusion.');
  return snapshot;
}
