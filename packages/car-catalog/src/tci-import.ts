import { z } from 'zod';

export const tciBrandSchema = z.enum(['toyota', 'lexus']);
export type TciBrand = z.infer<typeof tciBrandSchema>;
const text = z.object({ plaintext: z.string().nullable() }).nullable();
const receipt = z.strictObject({ url: z.url(), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const reference = z.object({
  _path: z.string(),
  modelStatus: z.string(),
  modelCode: z.string(),
  modelYear: z.string(),
});
const configuration = z.object({
  seriesCode: z.string(),
  websiteDisplayYears: z.array(z.string()).nullable(),
  powertrains: z.array(z.string()).nullish(),
  hideLevel1: z.array(z.string()).nullish(),
  hideLevel2: z.array(z.string()).nullish(),
  isSecondarySibling: z.boolean().optional(),
});
export const tciSeriesResponseSchema = z.object({
  data: z.object({
    brandV2ByPath: z.object({
      item: z.object({
        brandName: z.string(),
        seriesFragmentPath: z.array(
          z.object({ seriesCode: z.string(), tciSeriesDescriptionEn: text }),
        ),
      }),
    }),
    breSeriesConfigurationModelByPath: z.object({
      item: z.object({ series: z.array(configuration) }),
    }),
  }),
});
export const tciYearsResponseSchema = z.object({
  data: z.object({
    seriesV2ByPath: z.object({
      item: z.object({ seriesCode: z.string(), modelsFragmentPath: z.array(reference) }).nullable(),
    }),
  }),
});
export const tciModelResponseSchema = z.object({
  data: z.object({
    modelV2ByPath: z.object({
      item: z
        .object({
          _path: z.string(),
          modelStatus: z.string(),
          modelCode: z.string(),
          modelYear: z.string(),
          bodyType: z.string().nullable(),
          engine: z.string().nullable(),
          transmission: z.string().nullable(),
          modelDescriptionEn: text,
          tciModelDescriptionEn: text,
          packagesFragmentPath: z
            .array(
              z.object({
                _path: z.string(),
                websitedisplay: z.boolean().nullable(),
                packageSuffixCode: z.string(),
              }),
            )
            .nullable(),
        })
        .nullable(),
    }),
  }),
});
export const tciPackageResponseSchema = z.object({
  data: z.object({
    packageV2ByPath: z.object({
      item: z
        .object({
          _path: z.string(),
          websitedisplay: z.boolean().nullable(),
          isBasePackage: z.boolean().nullable(),
          originalModelCode: z.string().nullable(),
          packageSuffixCode: z.string(),
          packageSuffixDescriptionEn: text,
          hidePackagePrice: z.boolean().nullable(),
          packagePriceFragmentPath: z
            .object({
              vehiclePrice: z.number().nullable(),
              vehiclePackagePrice: z.number().nullable(),
              vehicleBasePackagePrice: z.number().nullable(),
            })
            .nullable(),
          dimensionsFragmentPath: z.record(z.string(), z.unknown()).nullable(),
        })
        .nullable(),
    }),
  }),
});

export const tciDimensionKeys = [
  'engineHorsePower',
  'motivePowerNVIS',
  'engineDisplacement',
  'transmission',
  'drivetrain',
  'lengthMm',
  'widthMm',
  'heightMm',
  'seatingCapacity',
  'cargoCapacityBehindFrontSeatL',
  'cargoCapacityBehindSecondRowL',
  'cargoCapacityBehindThirdRowL',
  'cargoCapacityL',
  'headroomFrontMm',
  'headroomSecondRowMm',
  'legroomFrontMm',
  'legroomSecondRowMm',
  'fuelConsumptionRatingCityL100Km',
  'fuelConsumptionRatingHighwayL100Km',
  'fuelConsumptionRatingCombL100Km',
  'fuelConsumptionLe',
  'fuelType',
  'rangeKm',
  'totalDrivingRangeKM',
  'energyConsumptionRatingCombinedKWhPer100km',
  'acL2ChargeTime0to100Pct',
  'acL2ChargeTime10to100Pct',
  'numberCylinders',
] as const;

const ruleValue = z.union([z.string(), z.boolean(), z.number()]).nullable();
export const tciRulesResponseSchema = z.object({
  data: z.object({
    breDimensionsList: z.object({ items: z.array(z.record(z.string(), ruleValue)) }),
  }),
});
const scalar = z.union([z.string(), z.number()]).nullable();
const tciSeriesSnapshotSchema = z.strictObject({
  brand: tciBrandSchema,
  code: z.string(),
  name: z.string(),
  years: z.array(z.number().int()).min(1),
  powertrains: z.array(z.string()),
  hiddenInProvinces: z.array(z.string()),
  source: receipt,
  rulesSource: receipt,
  rules: z.array(z.record(z.string(), ruleValue)),
  expectedModelPaths: z.array(z.string()),
  historicalReferencesExcluded: z.number().int().nonnegative(),
  inactiveReferencesExcluded: z.number().int().nonnegative(),
});
export const tciRecordSchema = z.strictObject({
  brand: tciBrandSchema,
  seriesCode: z.string(),
  seriesName: z.string(),
  year: z.number().int(),
  modelCode: z.string(),
  modelDescription: z.string(),
  bodyType: z.string().nullable(),
  engine: z.string().nullable(),
  transmission: z.string().nullable(),
  packageCode: z.string(),
  packageDescription: z.string(),
  isBasePackage: z.boolean(),
  originalModelCode: z.string().nullable(),
  priceHidden: z.boolean(),
  vehiclePrice: z.number().nullable(),
  basePrice: z.number().nullable(),
  packagePrice: z.number().nullable(),
  dimensions: z.record(z.string(), scalar),
  dimensionsVisible: z.boolean(),
  source: receipt,
  modelSource: receipt,
});
export const tciSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  brands: z
    .array(
      z.strictObject({
        brand: tciBrandSchema,
        source: receipt,
        expectedSeries: z.array(z.string()),
      }),
    )
    .min(1),
  series: z.array(tciSeriesSnapshotSchema),
  models: z.array(
    z.strictObject({
      brand: tciBrandSchema,
      path: z.string(),
      source: receipt,
      expectedPackagePaths: z.array(z.string()),
      unavailable: z.boolean(),
      definition: z
        .strictObject({
          code: z.string(),
          year: z.number().int(),
          seriesCode: z.string(),
          description: z.string(),
          bodyType: z.string().nullable(),
          engine: z.string().nullable(),
          transmission: z.string().nullable(),
        })
        .nullable(),
    }),
  ),
  records: z.array(tciRecordSchema),
  gaps: z.array(
    z.strictObject({
      brand: tciBrandSchema,
      seriesCode: z.string(),
      path: z.string(),
      reason: z.string(),
    }),
  ),
});
export type TciSnapshot = z.infer<typeof tciSnapshotSchema>;
export type TciRecord = z.infer<typeof tciRecordSchema>;
export function tciModelDefinition(
  model: NonNullable<z.infer<typeof tciModelResponseSchema>['data']['modelV2ByPath']['item']>,
  seriesCode: string,
) {
  return {
    code: model.modelCode.trim(),
    year: Number(model.modelYear),
    seriesCode,
    description: model.modelDescriptionEn?.plaintext?.trim() || model.modelCode.trim(),
    bodyType: model.bodyType,
    engine: model.engine,
    transmission: model.transmission,
  };
}
export function tciAliasPackages(model: TciSnapshot['models'][number], records: TciRecord[]) {
  return model.definition
    ? records.filter(
        (record) =>
          record.brand === model.brand &&
          record.seriesCode === model.definition!.seriesCode &&
          record.year === model.definition!.year &&
          record.originalModelCode === model.definition!.code,
      )
    : [];
}

export function tciUrl(brand: TciBrand, query: string, parameters: Record<string, string> = {}) {
  const encoded = encodeURIComponent(
    Object.entries(parameters)
      .map(([key, value]) => `;${key}=${value}`)
      .join(''),
  );
  return `https://www.${brand}.ca/graphql/execute.json/tcidigital/${query}${encoded}%3b.json`;
}
export function tciSeriesUrl(brand: TciBrand) {
  return tciUrl(brand, `BnP-get-series-${brand}`);
}
export function tciYearsUrl(brand: TciBrand, code: string) {
  return tciUrl(brand, 'BnP-get-models-years', {
    seriesPath: `/content/dam/tcidigital/vehicle-fragments/${brand.toUpperCase()}/series-${code.toLowerCase()}`,
    seriesConfigPath: `/content/dam/tcidigital/business-rules-engine/configurations/${brand}/series-configuration-and-ordering/series-configuration-model`,
    limitedAvailabilityPath: `/content/dam/tcidigital/business-rules-engine/configurations/${brand}/notification/`,
  });
}
export function tciListedSeries(input: unknown, brand: TciBrand) {
  const data = tciSeriesResponseSchema.parse(input).data;
  if (data.brandV2ByPath.item.brandName.toLowerCase() !== brand)
    throw new Error('TCI brand mismatch.');
  const names = new Map(
    data.brandV2ByPath.item.seriesFragmentPath.map((item) => [
      item.seriesCode,
      item.tciSeriesDescriptionEn?.plaintext,
    ]),
  );
  return data.breSeriesConfigurationModelByPath.item.series
    .filter((series) => series.websiteDisplayYears?.length)
    .map((series) => {
      const name = names.get(series.seriesCode);
      if (!name || series.websiteDisplayYears!.some((year) => !/^20\d{2}$/.test(year)))
        throw new Error(`Invalid TCI series/year: ${series.seriesCode}`);
      return {
        code: series.seriesCode,
        name,
        years: series.websiteDisplayYears!.map(Number),
        powertrains: series.powertrains ?? [],
        hiddenInProvinces: [...(series.hideLevel1 ?? []), ...(series.hideLevel2 ?? [])].filter(
          (value) => value && value !== '{"province":"","year":""}',
        ),
      };
    });
}
export function tciModelReferences(
  input: unknown,
  brand: TciBrand,
  series: { code: string; years: number[] },
) {
  const item = tciYearsResponseSchema.parse(input).data.seriesV2ByPath.item;
  if (!item) return { selected: [], historical: 0, inactive: 0, unavailable: true };
  if (item.seriesCode !== series.code) throw new Error('TCI series mismatch.');
  let historical = 0,
    inactive = 0;
  const selected = item.modelsFragmentPath.filter((reference) => {
    if (
      !reference._path.startsWith(
        `/content/dam/tcidigital/vehicle-fragments/${brand.toUpperCase()}/${series.code}/`,
      )
    )
      throw new Error('TCI model reference crosses brand or series.');
    if (!series.years.includes(Number(reference.modelYear))) {
      historical++;
      return false;
    }
    if (reference.modelStatus !== 'active') {
      inactive++;
      return false;
    }
    return true;
  });
  if (new Set(selected.map((ref) => ref._path)).size !== selected.length)
    throw new Error('Duplicate TCI model references.');
  return { selected, historical, inactive, unavailable: false };
}
export function pickTciDimensions(
  input: Record<string, unknown> | null,
): Record<string, string | number | null> {
  return Object.fromEntries(
    tciDimensionKeys.map((key) => {
      const value = input?.[key] ?? null;
      if (value !== null && typeof value !== 'string' && typeof value !== 'number')
        throw new Error(`Invalid TCI dimension: ${key}`);
      return [key, value];
    }),
  );
}

export function validateTciSnapshot(input: unknown): TciSnapshot {
  const data = tciSnapshotSchema.parse(input);
  const distinct = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) throw new Error(`Duplicate TCI ${label}.`);
  };
  distinct(
    data.brands.map((brand) => brand.brand),
    'brands',
  );
  distinct(
    data.series.map((series) => `${series.brand}/${series.code}`),
    'series',
  );
  distinct(
    data.models.map((model) => model.path),
    'models',
  );
  distinct(
    data.records.map((record) => record.source.url),
    'packages',
  );
  for (const brand of data.brands) {
    const expected = [...brand.expectedSeries].sort();
    const found = data.series
      .filter((series) => series.brand === brand.brand)
      .map((series) => series.code)
      .sort();
    if (JSON.stringify(expected) !== JSON.stringify(found))
      throw new Error(`Incomplete TCI ${brand.brand} series.`);
  }
  for (const series of data.series) {
    if (
      !series.expectedModelPaths.length &&
      !data.gaps.some((gap) => gap.brand === series.brand && gap.seriesCode === series.code)
    )
      throw new Error('Unreported TCI series gap.');
    for (const path of series.expectedModelPaths) {
      if (!data.models.some((model) => model.brand === series.brand && model.path === path))
        throw new Error(`Incomplete TCI model: ${path}`);
    }
  }
  for (const model of data.models) {
    if (
      !model.expectedPackagePaths.length &&
      !tciAliasPackages(model, data.records).length &&
      !data.gaps.some((gap) => gap.brand === model.brand && gap.path === model.path)
    )
      throw new Error('Unreported TCI factory model gap.');
    if (
      !data.series.some(
        (series) => series.brand === model.brand && series.expectedModelPaths.includes(model.path),
      )
    )
      throw new Error(`Unreferenced TCI model: ${model.path}`);
    for (const path of model.expectedPackagePaths) {
      if (
        !data.records.some(
          (record) =>
            record.modelSource.url === model.source.url &&
            decodeURIComponent(record.source.url).includes(`;packagePath=${path};.json`),
        )
      )
        throw new Error(`Incomplete TCI package: ${path}`);
    }
  }
  for (const record of data.records) {
    const series = data.series.find(
      (series) => series.brand === record.brand && series.code === record.seriesCode,
    );
    if (!series || !series.years.includes(record.year))
      throw new Error('TCI record is outside current display years.');
    if (!data.models.some((model) => model.source.url === record.modelSource.url))
      throw new Error('Unreferenced TCI package model.');
    const path = decodeURIComponent(new URL(record.source.url).pathname)
      .split(';packagePath=')[1]
      ?.split(';')[0];
    const model = data.models.find((model) => model.source.url === record.modelSource.url);
    const actualCode = record.originalModelCode ?? record.modelCode;
    const expectedPrefix = `/content/dam/tcidigital/vehicle-fragments/${record.brand}/${record.seriesCode}/${actualCode}/${record.year}/`;
    if (
      !path ||
      !model?.expectedPackagePaths.includes(path) ||
      !path.toLowerCase().startsWith(expectedPrefix.toLowerCase())
    )
      throw new Error('TCI factory package identity mismatch.');
    if (!record.source.url.startsWith(`https://www.${record.brand}.ca/`))
      throw new Error('TCI source crosses manufacturer domain.');
  }
  return data;
}
