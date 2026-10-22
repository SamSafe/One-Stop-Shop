import { z } from 'zod';
import { reactFlight } from './react-flight';
import { publishedJson } from './published-json';

export const nissanBrands = ['Nissan', 'Infiniti'] as const;
const brandSchema = z.enum(nissanBrands);
export type NissanBrand = z.infer<typeof brandSchema>;
export const nissanOrigin = (brand: NissanBrand) => `https://www.${brand.toLowerCase()}.ca`;
export const nissanBuildUrl = (brand: NissanBrand) =>
  `${nissanOrigin(brand)}/shopping-tools/build-price`;
const code = z.string().min(1).max(100);
const officialUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    ['www.nissan.ca', 'www.infiniti.ca'].includes(url.hostname) &&
    !url.username &&
    !url.password
  );
});
const receipt = z.strictObject({ url: officialUrl, sha256: z.string().regex(/^[a-f0-9]{64}$/) });
export type NissanReceipt = z.infer<typeof receipt>;
const year = z.number().int().min(2020).max(2100);
const priceSchema = z.object({ value: z.number().positive(), disclaimer: z.string() });
const labelledValue = z.object({ value: z.string(), label: z.string() });
const fuelValues = z.object({
  city: labelledValue.nullable(),
  highway: labelledValue.nullable(),
  combined: labelledValue.nullable(),
});
const versionSchema = z.object({
  id: code,
  versionCode: code,
  eimCode: code,
  packageCode: z.string(),
  year: z.string().regex(/^20\d{2}$/),
  modelCode: code,
  modelName: code,
  displayName: code,
  gradeCode: code,
  gradeName: z.string(),
  versionName: z.string(),
  filterTags: z.array(z.string()),
  keyFeatures: z.array(z.string()),
  seatingCapacity: z.number().int().min(2).max(15).nullable(),
  nstConfigCode: code,
  buildPath: z.string().startsWith('/'),
  priceList: z.object({ retail: priceSchema }),
});
const modelSchema = z.object({
  id: code,
  modelCode: code,
  modelName: code,
  year: z.string().regex(/^20\d{2}$/),
  slug: code,
  isEV: z.boolean(),
  vehicleTypes: z.array(z.object({ slug: code })).min(1),
  versions: z.array(versionSchema).min(1),
  otherModelYears: z.array(
    z.object({ modelCode: code, modelName: code, year: z.string().regex(/^20\d{2}$/) }),
  ),
  grades: z.array(
    z.object({ gradeCode: code, specification: z.object({ fuelConsumption: fuelValues }) }),
  ),
});
const technicalField = z.object({
  customKey: code,
  value: z.string(),
  unit: z.string(),
  type: z.string(),
  specType: z.string(),
  hidden: z.boolean(),
});
const packageSchema = z.object({
  key: code,
  name: code,
  type: z.string(),
  price: z.string(),
  hidden: z.boolean(),
  features: z.array(z.string()),
});
const specsVersion = z.object({
  versionKey: code,
  path: code,
  name: z.string(),
  engineName: z.string(),
  driveTrainValue: z.string(),
  specifications: z.array(z.object({ specs: z.array(technicalField) })),
  packs: z.object({ packs: z.array(packageSchema) }),
});
const specificationSchema = z.strictObject({
  source: receipt,
  versionKey: code,
  gradeCode: code,
  path: code,
  name: z.string(),
  engineName: z.string(),
  driveTrainValue: z.string(),
  fields: z.array(technicalField),
  packages: z.array(packageSchema),
});
export type NissanSpecification = z.infer<typeof specificationSchema>;
const recordSchema = z.strictObject({
  brand: brandSchema,
  year,
  modelCode: code,
  modelName: code,
  modelSlug: code,
  versionCode: code,
  eimCode: code,
  packageCode: z.string(),
  nstConfigCode: code,
  displayName: code,
  gradeCode: code,
  gradeName: z.string(),
  versionName: z.string(),
  filterTags: z.array(z.string()),
  keyFeatures: z.array(z.string()),
  seatingCapacity: z.number().int().min(2).max(15).nullable(),
  buildPath: z.string().startsWith('/'),
  retailPrice: priceSchema,
  gradeFuelConsumption: fuelValues.nullable(),
  optionPackage: packageSchema.nullable(),
  specification: specificationSchema.nullable(),
  specificationGap: z.string().nullable(),
});
export type NissanRecord = z.infer<typeof recordSchema>;
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  brands: z
    .array(
      z.strictObject({
        brand: brandSchema,
        source: receipt,
        expectedModelKeys: z.array(code).min(1),
        inventorySource: receipt,
        inventoryOnlyModels: z.array(
          z.strictObject({ name: code, code, year, reason: z.string().min(1) }),
        ),
      }),
    )
    .length(2),
  models: z
    .array(
      z.strictObject({
        brand: brandSchema,
        code,
        name: code,
        year,
        slug: code,
        vehicleTypes: z.array(code).min(1),
        electric: z.boolean(),
        expectedKeys: z.array(code).min(1),
        specificationsReview: z.strictObject({
          source: receipt,
          status: z.number().int(),
          returnedModelCodes: z.array(code),
          reason: z.string().min(1),
        }),
      }),
    )
    .min(1),
  records: z.array(recordSchema).min(1),
});
export type NissanSnapshot = z.infer<typeof snapshotSchema>;
export const nissanModelKey = (record: { brand: NissanBrand; modelCode: string }) =>
  `${record.brand}/${record.modelCode}`;
export const nissanKey = (record: {
  brand: NissanBrand;
  modelCode: string;
  versionCode: string;
  optionPackage?: { key: string } | null;
}) =>
  `${nissanModelKey(record)}/${record.versionCode}${record.optionPackage ? `/${record.optionPackage.key}` : ''}`;
export const nissanEquipmentPackages = (spec: NissanSpecification) =>
  spec.packages.filter(
    (pack) =>
      !pack.hidden &&
      pack.type === 'OPTION' &&
      /^\d+(?:\.\d+)?$/.test(pack.price) &&
      Number(pack.price) > 0,
  );

export function nissanSelection(html: string, brand: NissanBrand) {
  const data = z
    .object({
      market: z.object({
        region: z.literal('ca'),
        brand: z.string(),
        application: z.literal('configurator'),
        lang: z.literal('en'),
      }),
      brand: z.string(),
      vehicleData: z.array(modelSchema).min(1),
      vehicles: z
        .array(z.object({ id: code, versions: z.array(z.object({ versionCode: code })).min(1) }))
        .min(1),
    })
    .parse(reactFlight(html, 'Nissan/Infiniti').property('selectPageProps'));
  if (data.market.brand !== brand.toLowerCase() || data.brand !== brand.toLowerCase())
    throw new Error('Nissan/Infiniti Canadian brand identity mismatch.');
  sameSet(
    data.vehicles.map((model) => model.id),
    data.vehicleData.map((model) => model.id),
    'selector model references',
  );
  for (const model of data.vehicleData) {
    if (model.id !== model.modelCode) throw new Error('Nissan/Infiniti model code mismatch.');
    for (const other of model.otherModelYears)
      if (
        !data.vehicleData.some(
          (candidate) =>
            candidate.modelCode === other.modelCode &&
            candidate.year === other.year &&
            candidate.modelName === other.modelName,
        )
      )
        throw new Error('Nissan/Infiniti other-year reference is missing.');
    for (const version of model.versions) {
      if (
        version.id !== version.versionCode ||
        version.modelCode !== model.id ||
        version.modelName !== model.modelName ||
        version.year !== model.year ||
        !model.grades.some((grade) => grade.gradeCode === version.gradeCode) ||
        !version.nstConfigCode.startsWith(`${model.id}:`)
      )
        throw new Error('Nissan/Infiniti factory version identity mismatch.');
      const url = new URL(`${nissanBuildUrl(brand)}${version.buildPath}`);
      if (
        url.origin !== nissanOrigin(brand) ||
        !url.pathname.startsWith(`/shopping-tools/build-price/`) ||
        !url.pathname.includes(`/${model.year}/`) ||
        !url.pathname.endsWith(`/${version.nstConfigCode}`)
      )
        throw new Error('Nissan/Infiniti build path identity mismatch.');
    }
    sameSet(
      model.versions.map((version) => version.versionCode),
      data.vehicles
        .find((vehicle) => vehicle.id === model.id)!
        .versions.map((version) => version.versionCode),
      'factory versions',
    );
  }
  return data.vehicleData;
}

export const nissanAssignedJson = (html: string, assignment: string) =>
  publishedJson(html, assignment, 'Nissan/Infiniti');
export function nissanSpecifications(html: string, source: NissanReceipt) {
  const data = z
    .object({ grades: z.record(code, z.object({ versions: z.record(code, specsVersion) })) })
    .parse(nissanAssignedJson(html, 'HELIOS.components.c059E'));
  return Object.entries(data.grades).flatMap(([gradeCode, grade]) =>
    Object.entries(grade.versions).map(([key, version]) => {
      if (key !== version.versionKey)
        throw new Error('Nissan/Infiniti specifications version key mismatch.');
      return specificationSchema.parse({
        source,
        versionKey: version.versionKey,
        gradeCode,
        path: version.path,
        name: version.name,
        engineName: version.engineName,
        driveTrainValue: version.driveTrainValue,
        fields: version.specifications
          .flatMap((group) => group.specs)
          .filter(
            (field) =>
              !field.hidden &&
              (field.specType === 'technical' ||
                /Mechanical|Engine|Powertrain|Transmission/i.test(field.unit)),
          ),
        packages: version.packs.packs,
      });
    }),
  );
}
export function nissanInventoryReferences(html: string) {
  const state = z
    .record(z.string(), z.unknown())
    .parse(nissanAssignedJson(html, 'window.__APOLLO_STATE__'));
  const references: { name: string; code: string; year: number; reason: string }[] = [];
  for (const [key, raw] of Object.entries(state)) {
    if (!key.startsWith('ModelDetail:')) continue;
    const model = z
      .object({ modelName: code, modelCodes: z.array(z.object({ id: code })) })
      .parse(raw);
    for (const reference of model.modelCodes) {
      const detail = z
        .object({ modelCode: code, modelYear: z.string().regex(/^20\d{2}$/) })
        .parse(state[reference.id]);
      references.push({
        name: model.modelName,
        code: detail.modelCode,
        year: Number(detail.modelYear),
        reason:
          'Present in the national new-inventory selector metadata, absent from the current build selector. Dealer stock and retail configuration completeness need review; metadata alone does not prove vehicles are currently in stock.',
      });
    }
  }
  if (!references.length) throw new Error('Nissan/Infiniti inventory references missing.');
  return references;
}
function sameSet(actual: string[], expected: string[], label: string) {
  if (
    new Set(actual).size !== actual.length ||
    new Set(expected).size !== expected.length ||
    actual.length !== expected.length ||
    actual.some((key) => !expected.includes(key))
  )
    throw new Error(`Nissan/Infiniti ${label} do not reconcile.`);
}
export function validateNissanSnapshot(input: unknown): NissanSnapshot {
  const snapshot = snapshotSchema.parse(input);
  sameSet(
    snapshot.brands.map((brand) => brand.brand),
    [...nissanBrands],
    'brands',
  );
  sameSet(
    snapshot.models.map((model) => `${model.brand}/${model.code}`),
    snapshot.brands.flatMap((brand) => brand.expectedModelKeys),
    'model years',
  );
  sameSet(
    snapshot.records.map(nissanKey),
    snapshot.models.flatMap((model) => model.expectedKeys),
    'configurations',
  );
  for (const brand of snapshot.brands) {
    if (
      brand.source.url !== nissanBuildUrl(brand.brand) ||
      brand.inventorySource.url !== `${nissanOrigin(brand.brand)}/shopping-tools/search-inventory`
    )
      throw new Error('Nissan/Infiniti lineup source identity mismatch.');
    if (
      brand.inventoryOnlyModels.some((model) =>
        snapshot.models.some(
          (current) => current.brand === brand.brand && current.code === model.code,
        ),
      )
    )
      throw new Error('Nissan/Infiniti inventory-only model is in the build selector.');
  }
  for (const model of snapshot.models) {
    if (model.expectedKeys.some((key) => !key.startsWith(`${model.brand}/${model.code}/`)))
      throw new Error('Nissan/Infiniti model version references have the wrong prefix.');
  }
  for (const record of snapshot.records) {
    const model = snapshot.models.find(
      (model) => model.brand === record.brand && model.code === record.modelCode,
    );
    if (
      !model ||
      model.year !== record.year ||
      model.name !== record.modelName ||
      model.slug !== record.modelSlug ||
      !record.nstConfigCode.startsWith(`${record.modelCode}:`) ||
      !record.gradeCode.startsWith(`${record.modelCode}-`)
    )
      throw new Error('Nissan/Infiniti record model identity mismatch.');
    if (!record.specification && !record.specificationGap)
      throw new Error('Nissan/Infiniti missing specification gap.');
    if (record.specification) {
      const spec = record.specification;
      if (
        spec.versionKey !== record.versionCode ||
        spec.gradeCode !== record.gradeCode ||
        !spec.path.includes(`/en_CA/cars/${record.year}-${record.modelSlug}/`) ||
        !model.specificationsReview.returnedModelCodes.includes(record.modelCode) ||
        spec.source.url !== model.specificationsReview.source.url
      )
        throw new Error('Nissan/Infiniti exact specification identity mismatch.');
      if (
        record.optionPackage &&
        !nissanEquipmentPackages(spec).some(
          (pack) => JSON.stringify(pack) === JSON.stringify(record.optionPackage),
        )
      )
        throw new Error('Nissan/Infiniti package applicability mismatch.');
    }
    if (record.optionPackage && !record.specification)
      throw new Error('Nissan/Infiniti package lacks exact source evidence.');
    if (!record.optionPackage && record.specification)
      sameSet(
        snapshot.records
          .filter(
            (candidate) =>
              candidate.brand === record.brand &&
              candidate.modelCode === record.modelCode &&
              candidate.versionCode === record.versionCode &&
              candidate.optionPackage,
          )
          .map((candidate) => candidate.optionPackage!.key),
        nissanEquipmentPackages(record.specification).map((pack) => pack.key),
        'equipment packages',
      );
  }
  return snapshot;
}
