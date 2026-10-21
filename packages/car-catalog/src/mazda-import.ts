import { z } from 'zod';

export const mazdaApiOrigin = 'https://n8xgyscaa3.execute-api.ca-central-1.amazonaws.com/prod';
export const mazdaBuildPage = 'https://www.mazda.ca/en/shopping/build-and-price/';
export const mazdaLineupUrl = `${mazdaApiOrigin}/api/ModelYears?prov_code=AB&lang_code=en`;
export function mazdaApiUrl(kind: 'Trims' | 'EngineModels' | 'Packages', ...parts: string[]) {
  return `${mazdaApiOrigin}/api/${kind}/${parts.map(encodeURIComponent).join('/')}/?prov_code=AB&lang_code=en`;
}
export const mazdaSpecsUrl = `${mazdaApiOrigin}/api/specs?lang_code=en`;
export function mazdaConfigurationUrl(
  record: Pick<MazdaRecord, 'year' | 'carline' | 'trimSlug' | 'modelCode' | 'optionCode'>,
) {
  return `${mazdaBuildPage}#/${record.year}/${encodeURIComponent(record.carline)}/${encodeURIComponent(record.trimSlug)}/${encodeURIComponent(record.modelCode)}/${encodeURIComponent(record.optionCode)}?prov_code=AB&lang_code=en`;
}
const identity = z.object({ id: z.string(), title: z.string(), url_slug: z.string() });
const modelYear = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  year: identity,
  carline: identity,
  show_bnp: z.boolean(),
  is_legacy: z.boolean(),
  previous_model: z.boolean(),
  is_coming_soon: z.boolean(),
  is_ev: z.boolean(),
});
const financial = z.object({
  msrp: z.number().nonnegative(),
  based_on: z.object({ model_code: z.string(), option_code: z.string() }),
});
const trim = z.object({
  id: z.string(),
  title: z.string(),
  trim_type: z.object({ id: z.string(), name: z.string(), url_slug: z.string() }),
});
const engineModel = z.object({
  model_code: z.string(),
  option_code: z.string(),
  is_package: z.boolean(),
  drivetrain: z.object({ label: z.string(), short_description: z.string() }),
  transmission: z.object({ label: z.string(), short_description: z.string() }),
  engine: z.object({ label: z.string(), short_description: z.string() }),
  financial,
});
const response = <T extends z.ZodType>(data: T) => z.object({ status: z.literal(200), data });
export const mazdaYearsResponse = response(z.object({ model_years: z.array(modelYear).min(1) }));
export const mazdaTrimsResponse = response(
  z.object({ model_year: modelYear, trims: z.array(trim).min(1) }),
);
export const mazdaEnginesResponse = response(
  z.object({ model_year: modelYear, trim, models: z.array(engineModel).min(1) }),
);
export const mazdaPackagesResponse = response(
  z.object({
    model_year: modelYear,
    trim: z.object({ trim_type: z.object({ url_slug: z.string() }) }),
    default_option: z.object({ model_id: z.string(), option_code: z.string(), financial }),
    packages: z.array(
      z.object({
        type: z.string(),
        name: z.string(),
        option_code: z.string().optional(),
        financial: z.object({
          msrp: z.number().nonnegative(),
          based_on: z.object({ model_code: z.string(), option_code: z.string() }).optional(),
        }),
      }),
    ),
  }),
);
export const mazdaSpecsResponse = response(
  z
    .array(
      z.object({
        model_code: z.string(),
        option_code: z.string(),
        model_year: z.object({ id: z.string(), title: z.string() }),
        year: identity,
        carline: identity,
        trim,
        specifications: z.record(
          z.string(),
          z.array(
            z.object({
              type: z.string(),
              Title: z.string(),
              Data: z.union([z.string(), z.number()]).nullable(),
            }),
          ),
        ),
      }),
    )
    .min(1),
);
export type MazdaYear = z.infer<typeof modelYear>;
export type MazdaEngine = z.infer<typeof engineModel>;
export function mazdaValidateYear(
  actual: MazdaYear,
  expected: Pick<MazdaYear, 'id' | 'year' | 'carline'>,
) {
  if (
    actual.id !== expected.id ||
    actual.year.url_slug !== expected.year.url_slug ||
    actual.carline.url_slug !== expected.carline.url_slug
  )
    throw new Error('Mazda model/year identity mismatch.');
}
export function mazdaEngineIdentities(models: MazdaEngine[]) {
  const identities = models.map((model) => `${model.model_code}/${model.option_code}`);
  if (new Set(identities).size !== identities.length)
    throw new Error('Duplicate Mazda engine configurations.');
  for (const model of models)
    if (
      model.financial.based_on.model_code !== model.model_code ||
      model.financial.based_on.option_code !== model.option_code
    )
      throw new Error('Mazda engine price identity mismatch.');
  return identities;
}
export function mazdaPackageChoices(
  input: unknown,
  year: MazdaYear,
  trimSlug: string,
  engine: MazdaEngine,
) {
  const data = mazdaPackagesResponse.parse(input).data;
  mazdaValidateYear(data.model_year, year);
  if (
    data.default_option.option_code !== engine.option_code ||
    data.default_option.financial.based_on.model_code !== engine.model_code ||
    data.default_option.financial.based_on.option_code !== engine.option_code ||
    data.default_option.financial.msrp !== engine.financial.msrp
  )
    throw new Error('Mazda package base identity/price mismatch.');
  const choices = [
    {
      modelCode: engine.model_code,
      optionCode: data.default_option.option_code,
      packageName: 'Standard equipment',
      msrpCad: data.default_option.financial.msrp,
      modelId: data.default_option.model_id,
    },
  ];
  for (const option of data.packages.filter((option) => option.type === 'model_option_package')) {
    if (
      !option.option_code ||
      !option.financial.based_on ||
      option.financial.based_on.model_code !== engine.model_code ||
      option.financial.based_on.option_code !== option.option_code
    )
      throw new Error('Mazda factory-package identity mismatch.');
    choices.push({
      modelCode: engine.model_code,
      optionCode: option.option_code,
      packageName: option.name,
      msrpCad: option.financial.msrp,
      modelId: data.default_option.model_id,
    });
  }
  if (
    new Set(choices.map((choice) => `${choice.modelCode}/${choice.optionCode}`)).size !==
    choices.length
  )
    throw new Error('Duplicate Mazda packages.');
  return {
    choices,
    sourceTrimSlug: data.trim.trim_type.url_slug,
    parentTrimAlias: data.trim.trim_type.url_slug !== trimSlug,
    excluded: data.packages
      .filter((option) => option.type !== 'model_option_package')
      .map((option) => ({
        name: option.name,
        type: option.type,
        reason:
          'Not a factory model/option SKU; optional add-ons and protection plans are outside this retail-trim pass.',
      })),
  };
}
const officialUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    ['www.mazda.ca', 'n8xgyscaa3.execute-api.ca-central-1.amazonaws.com'].includes(url.hostname) &&
    !url.username &&
    !url.password
  );
});
const receipt = z.strictObject({ url: officialUrl, sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const spec = z.strictObject({ section: z.string(), title: z.string(), value: z.string() });
export function mazdaSpecifications(
  input: unknown,
  expected: {
    year: MazdaYear;
    trimId: string;
    trimSlug: string;
    sourceTrimSlug: string;
    modelCode: string;
    optionCode: string;
  },
) {
  const values = mazdaSpecsResponse.parse(input).data;
  if (values.length !== 1) throw new Error('Mazda specification response count mismatch.');
  const value = values[0]!;
  if (
    value.model_year.id !== expected.year.id ||
    value.model_code !== expected.modelCode ||
    value.option_code !== expected.optionCode ||
    value.year.url_slug !== expected.year.year.url_slug ||
    value.carline.url_slug !== expected.year.carline.url_slug ||
    value.trim.id !== expected.trimId ||
    ![expected.trimSlug, expected.sourceTrimSlug].includes(value.trim.trim_type.url_slug)
  )
    throw new Error('Mazda specification configuration mismatch.');
  const specs: z.infer<typeof spec>[] = [];
  for (const [group, rows] of Object.entries(value.specifications)) {
    if (!/specification|capacit|electric|energy/i.test(group)) continue;
    let section = group;
    for (const row of rows) {
      const kind = row.type.toUpperCase();
      if (kind === 'HEADER') {
        section = `${group} / ${row.Title}`;
        continue;
      }
      if (!['DATA', 'FEATURE'].includes(kind))
        throw new Error(`Unsupported Mazda specification row type: ${row.type}`);
      if (row.Data !== null) specs.push({ section, title: row.Title, value: String(row.Data) });
    }
  }
  return { trimId: value.trim.id, rows: specs };
}
const normalizedYear = z.strictObject({
  id: z.string(),
  year: z.number().int(),
  carline: z.string(),
  name: z.string(),
  bodyDescription: z.string().nullable(),
  comingSoon: z.boolean(),
  electric: z.boolean(),
  source: receipt,
  expectedTrimIds: z.array(z.string()).min(1),
});
const normalizedTrim = z.strictObject({
  modelYearId: z.string(),
  trimId: z.string(),
  slug: z.string(),
  name: z.string(),
  source: receipt,
  enginesSource: receipt,
  expectedEngineKeys: z.array(z.string()).min(1),
});
const normalizedEngine = z.strictObject({
  modelYearId: z.string(),
  trimId: z.string(),
  modelCode: z.string(),
  baseOptionCode: z.string(),
  sourceTrimSlug: z.string(),
  source: receipt,
  expectedOptionKeys: z.array(z.string()).min(1),
  excludedOptions: z.array(
    z.strictObject({ name: z.string(), type: z.string(), reason: z.string() }),
  ),
});
const record = z.strictObject({
  year: z.number().int(),
  carline: z.string(),
  modelYearId: z.string(),
  modelName: z.string(),
  trimId: z.string(),
  trimSlug: z.string(),
  trimName: z.string(),
  sourceTrimSlug: z.string(),
  specificationsTrimId: z.string(),
  modelId: z.string(),
  modelCode: z.string(),
  baseOptionCode: z.string(),
  optionCode: z.string(),
  packageName: z.string(),
  engine: z.string(),
  transmission: z.string(),
  transmissionShort: z.string(),
  drivetrain: z.string(),
  msrpCad: z.number().min(10000).max(10000000),
  priceSource: receipt,
  specificationsSource: receipt,
  specifications: z.array(spec),
});
export type MazdaRecord = z.infer<typeof record>;
export const mazdaSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  lineup: receipt,
  client: receipt,
  expectedModelYearIds: z.array(z.string()).min(1),
  excludedModelYears: z.array(
    z.strictObject({
      id: z.string(),
      year: z.number().int(),
      carline: z.string(),
      reason: z.string(),
    }),
  ),
  modelYears: z.array(normalizedYear).min(1),
  trims: z.array(normalizedTrim).min(1),
  engines: z.array(normalizedEngine).min(1),
  records: z.array(record).min(1),
});
export type MazdaSnapshot = z.infer<typeof mazdaSnapshotSchema>;
function reconcile(expected: string[], actual: string[], label: string) {
  if (
    new Set(expected).size !== expected.length ||
    new Set(actual).size !== actual.length ||
    JSON.stringify([...expected].sort()) !== JSON.stringify([...actual].sort())
  )
    throw new Error(`Incomplete or duplicate Mazda ${label}.`);
}
export function validateMazdaSnapshot(input: unknown): MazdaSnapshot {
  const snapshot = mazdaSnapshotSchema.parse(input);
  if (
    snapshot.lineup.url !== mazdaLineupUrl ||
    !snapshot.client.url.startsWith(
      'https://www.mazda.ca/globalassets/mazda-canada/react/buildandprice/js/main.',
    )
  )
    throw new Error('Mazda lineup/client source mismatch.');
  reconcile(
    snapshot.expectedModelYearIds,
    snapshot.modelYears.map((model) => model.id),
    'model years',
  );
  for (const year of snapshot.modelYears) {
    if (year.source.url !== mazdaApiUrl('Trims', String(year.year), year.carline))
      throw new Error('Mazda trim source mismatch.');
    reconcile(
      year.expectedTrimIds,
      snapshot.trims.filter((trim) => trim.modelYearId === year.id).map((trim) => trim.trimId),
      'trims',
    );
  }
  for (const trim of snapshot.trims) {
    const year = snapshot.modelYears.find((year) => year.id === trim.modelYearId);
    if (
      !year ||
      trim.source.url !== year.source.url ||
      trim.enginesSource.url !==
        mazdaApiUrl('EngineModels', String(year.year), year.carline, trim.slug)
    )
      throw new Error('Unreferenced Mazda trim.');
    reconcile(
      trim.expectedEngineKeys,
      snapshot.engines
        .filter(
          (engine) => engine.modelYearId === trim.modelYearId && engine.trimId === trim.trimId,
        )
        .map((engine) => `${engine.modelCode}/${engine.baseOptionCode}`),
      'engine configurations',
    );
  }
  for (const engine of snapshot.engines) {
    if (
      !snapshot.trims.some(
        (trim) => trim.modelYearId === engine.modelYearId && trim.trimId === engine.trimId,
      ) ||
      engine.source.url !== mazdaApiUrl('Packages', engine.modelCode, engine.baseOptionCode)
    )
      throw new Error('Unreferenced Mazda engine.');
    reconcile(
      engine.expectedOptionKeys,
      snapshot.records
        .filter(
          (record) =>
            record.modelYearId === engine.modelYearId &&
            record.trimId === engine.trimId &&
            record.modelCode === engine.modelCode &&
            record.baseOptionCode === engine.baseOptionCode,
        )
        .map((record) => `${record.modelCode}/${record.optionCode}`),
      'factory packages',
    );
  }
  reconcile(
    snapshot.records.map((record) => `${record.modelCode}/${record.optionCode}`),
    snapshot.records.map((record) => `${record.modelCode}/${record.optionCode}`),
    'configuration identities',
  );
  for (const record of snapshot.records) {
    const year = snapshot.modelYears.find((year) => year.id === record.modelYearId),
      trim = snapshot.trims.find(
        (trim) => trim.modelYearId === record.modelYearId && trim.trimId === record.trimId,
      ),
      engine = snapshot.engines.find(
        (engine) =>
          engine.modelYearId === record.modelYearId &&
          engine.trimId === record.trimId &&
          engine.modelCode === record.modelCode &&
          engine.baseOptionCode === record.baseOptionCode,
      );
    if (
      !year ||
      !trim ||
      !engine ||
      year.year !== record.year ||
      year.carline !== record.carline ||
      year.name !== record.modelName ||
      trim.name !== record.trimName ||
      trim.slug !== record.trimSlug ||
      engine.sourceTrimSlug !== record.sourceTrimSlug ||
      record.specificationsTrimId !== record.trimId ||
      record.priceSource.url !== engine.source.url ||
      record.specificationsSource.url !== mazdaSpecsUrl
    )
      throw new Error('Mazda record identity/source mismatch.');
  }
  return snapshot;
}
