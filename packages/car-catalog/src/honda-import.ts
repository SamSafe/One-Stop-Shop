import { z } from 'zod';
import { embeddedJson } from './subaru-import';

export const hondaBrandSchema = z.enum(['honda', 'acura']);
export type HondaBrand = z.infer<typeof hondaBrandSchema>;
const text = z.object({ value: z.union([z.string(), z.boolean()]) });
const fieldText = (field: z.infer<typeof text>) => String(field.value);
const provinces = z.object({ items: z.array(z.object({ name: z.string() })) });
const transmission = z.object({
  detIdentifier: text,
  detKey: text,
  transmissionName: text,
  modelCode: text,
  isBuildable: text,
});
const trim = z.object({
  detIdentifier: text,
  detKey: text,
  trimName: text,
  comingSoon: text,
  bodyType: z.object({ item: z.array(z.object({ name: z.string() })) }),
  transmissions: z.array(z.object({ items: z.array(transmission) })),
  provincesExcludedForBap: provinces,
});
const model = z.object({
  detKey: text,
  modelName: text,
  modelYears: z.array(
    z.object({
      year: text,
      comingSoon: text,
      provincesExcludedForBap: provinces,
      trims: z.array(trim),
    }),
  ),
});
export function hondaLineupUrl(brand: HondaBrand) {
  return `https://www.${brand}.ca/en/vehicles`;
}
export function hondaPricingApiUrl(brand: HondaBrand) {
  return `https://api.honda.ca/financials-worksheets/${brand === 'honda' ? 'H' : 'A'}/Live/website/price-calculator/ON`;
}
export function hondaSpecificationsUrl(brand: HondaBrand, trimId: string) {
  return `https://api.honda.ca/models/${brand === 'honda' ? 'H' : 'A'}/Live/trims/specs/withcategories?trimIds=${encodeURIComponent(trimId)}&AcceptLanguage=en`;
}
export function hondaConfigurationUrl(
  record: Pick<HondaRecord, 'brand' | 'modelKey' | 'year' | 'trimKey' | 'transmissionKey'>,
) {
  const query = new URLSearchParams({
    model_key: record.modelKey,
    model_year: String(record.year),
    trim_key: record.trimKey,
    transmission_key: record.transmissionKey,
    include_fees: 'false',
    include_taxes: 'false',
  });
  return `https://www.${record.brand}.ca/en/buildyour${record.brand}/trims?${query}`;
}
export function hondaPlainText(value: string) {
  return value
    .replace(/<sup\b[^>]*>.*?<\/sup>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(
      /&(?:nbsp|amp|lt|gt|quot);/g,
      (value) => ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' })[value]!,
    )
    .replace(/\s+/g, ' ')
    .trim();
}
const enabled = (field: z.infer<typeof text>) => field.value === true || field.value === '1';

export function hondaModels(html: string, brand: HondaBrand) {
  const state = embeddedJson(html, '__JSS_STATE__', 'script');
  const cards: unknown[] = [];
  function walk(value: unknown) {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      if (object.componentName === 'ModelCardWithTrims') cards.push(object);
      else Object.values(object).forEach(walk);
    }
  }
  walk(state);
  if (!cards.length) throw new Error(`Missing ${brand} model cards.`);
  return cards.map((card) => {
    const parsed = z
      .object({
        fields: z.object({
          data: z.object({ value: z.object({ model: z.object({ fields: model }) }) }),
        }),
      })
      .parse(card).fields.data.value.model.fields;
    const key = fieldText(parsed.detKey);
    return {
      brand,
      key,
      name: hondaPlainText(fieldText(parsed.modelName)),
      years: parsed.modelYears.map((year) => ({
        year: Number(fieldText(year.year)),
        announced: enabled(year.comingSoon),
        excludedProvinces: year.provincesExcludedForBap.items.map((province) => province.name),
        trims: year.trims.map((trim) => ({
          id: fieldText(trim.detIdentifier),
          key: fieldText(trim.detKey),
          name: hondaPlainText(fieldText(trim.trimName)),
          announced: enabled(trim.comingSoon),
          excludedProvinces: trim.provincesExcludedForBap.items.map((province) => province.name),
          bodyTags: trim.bodyType.item.map((tag) => tag.name),
          transmissions: trim.transmissions.flatMap((group) =>
            group.items.map((transmission) => ({
              id: fieldText(transmission.detIdentifier),
              key: fieldText(transmission.detKey),
              name: fieldText(transmission.transmissionName),
              code: fieldText(transmission.modelCode),
              buildable: enabled(transmission.isBuildable),
            })),
          ),
        })),
      })),
    };
  });
}

export const hondaPriceResponseSchema = z.object({
  ProvinceKey: z.literal('ON'),
  Models: z.array(
    z.object({
      ModelKey: z.string(),
      ModelId: z.number().int().positive(),
      Trims: z.array(
        z.object({
          Id: z.number().int(),
          Key: z.string(),
          Transmissions: z.array(
            z.object({ Id: z.number().int(), Key: z.string(), Msrp: z.number().nonnegative() }),
          ),
        }),
      ),
    }),
  ),
});
export function hondaPriceEntries(
  input: unknown,
  modelKey: string,
  expected: { trimId: string; trimKey: string; transmissionId: string }[],
) {
  const response = hondaPriceResponseSchema.parse(input);
  if (response.Models.length !== 1 || response.Models[0]!.ModelKey !== modelKey)
    throw new Error('Honda pricing model/year identity mismatch.');
  const trims = response.Models[0]!.Trims;
  const ids = trims.flatMap((trim) => trim.Transmissions.map((transmission) => transmission.Id));
  if (
    new Set(ids).size !== ids.length ||
    new Set(trims.map((trim) => trim.Id)).size !== trims.length
  )
    throw new Error('Duplicate Honda pricing identities.');
  if (
    trims.some(
      (trim) =>
        !trim.Key.endsWith(`_${trim.Id}`) ||
        trim.Transmissions.some(
          (transmission) => !transmission.Key.startsWith(`${transmission.Id}-`),
        ),
    )
  )
    throw new Error('Honda pricing key/ID mismatch.');
  for (const record of expected) {
    if (
      !trims
        .find((trim) => trim.Id === Number(record.trimId) && trim.Key === record.trimKey)
        ?.Transmissions.some((transmission) => transmission.Id === Number(record.transmissionId))
    )
      throw new Error('Honda pricing model/year configuration mismatch.');
  }
  return trims;
}
export const hondaSpecsResponseSchema = z.array(
  z.object({
    TrimId: z.number().int(),
    Label: z.string(),
    Name: z.string(),
    Specs: z.array(z.object({ Label: z.string(), Name: z.string(), Value: z.string().nullable() })),
  }),
);
export function hondaSelectedSpecifications(input: unknown) {
  return hondaSpecsResponseSchema
    .parse(input)
    .map((group) => ({
      ...group,
      Specs: group.Specs.filter((spec) =>
        /^(?:drivetrain\b|dual-motor all-wheel|engine type\b|two-motor hybrid|horsepower\b|combined total horsepower\b|(?:max )?seating capacity\b|cargo volume\b|headroom\b|legroom\b|length \(mm\)|width \(mm\)|height \(mm\)|.*city.*hwy.*combined|range \(km\))/i.test(
          hondaPlainText(spec.Label),
        ),
      ),
    }))
    .filter((group) => group.Specs.length);
}
const officialUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    ['www.honda.ca', 'www.acura.ca', 'api.honda.ca'].includes(url.hostname) &&
    !url.username &&
    !url.password
  );
});
const receipt = z.strictObject({ url: officialUrl, sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const record = z.strictObject({
  brand: hondaBrandSchema,
  modelKey: z.string().min(1),
  modelName: z.string().min(1),
  year: z.number().int().min(2020).max(2100),
  trimId: z.string().regex(/^\d+$/),
  trimKey: z.string().min(1),
  trimName: z.string().min(1),
  transmissionId: z.string().regex(/^\d+$/),
  transmissionKey: z.string().min(1),
  transmissionName: z.string().min(1),
  modelCode: z.string().min(1),
  buildable: z.boolean(),
  announced: z.boolean(),
  excludedProvinces: z.array(z.string()),
  bodyTags: z.array(z.string()),
  msrpCad: z.number().min(10000).max(10000000).nullable(),
  pricingTransmissionKey: z.string().nullable(),
  pricingSource: receipt,
  specificationsSource: receipt,
  specifications: hondaSpecsResponseSchema,
});
export type HondaRecord = z.infer<typeof record>;
export const hondaSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  brands: z
    .array(
      z.strictObject({
        brand: hondaBrandSchema,
        source: receipt,
        expectedModels: z.array(z.string()).min(1),
      }),
    )
    .length(2),
  models: z.array(
    z.strictObject({
      brand: hondaBrandSchema,
      key: z.string().min(1),
      name: z.string().min(1),
      years: z.array(
        z.strictObject({
          year: z.number().int().min(2020).max(2100),
          announced: z.boolean(),
          excludedProvinces: z.array(z.string()),
          expectedTrimIds: z.array(z.string()).min(1),
          expectedConfigurationKeys: z.array(z.string()).min(1),
          pricingOnlyConfigurationKeys: z.array(z.string()),
        }),
      ),
    }),
  ),
  records: z.array(record).min(1),
});
export type HondaSnapshot = z.infer<typeof hondaSnapshotSchema>;
export const hondaConfigurationKey = (record: Pick<HondaRecord, 'trimKey' | 'transmissionKey'>) =>
  `${record.trimKey}/${record.transmissionKey}`;
function reconcile(expected: string[], found: string[], label: string) {
  if (
    new Set(expected).size !== expected.length ||
    new Set(found).size !== found.length ||
    JSON.stringify([...expected].sort()) !== JSON.stringify([...found].sort())
  )
    throw new Error(`Incomplete or duplicate Honda/Acura ${label}.`);
}
export function validateHondaSnapshot(input: unknown): HondaSnapshot {
  const snapshot = hondaSnapshotSchema.parse(input);
  reconcile(
    ['honda', 'acura'],
    snapshot.brands.map((brand) => brand.brand),
    'brands',
  );
  for (const brand of snapshot.brands) {
    if (brand.source.url !== hondaLineupUrl(brand.brand))
      throw new Error('Honda lineup source identity mismatch.');
    reconcile(
      brand.expectedModels,
      snapshot.models.filter((model) => model.brand === brand.brand).map((model) => model.key),
      'models',
    );
  }
  for (const model of snapshot.models) {
    if (!snapshot.brands.some((brand) => brand.brand === model.brand))
      throw new Error('Unreferenced Honda brand.');
    if (new Set(model.years.map((year) => year.year)).size !== model.years.length)
      throw new Error('Duplicate Honda model years.');
    for (const year of model.years) {
      const found = snapshot.records.filter(
        (record) =>
          record.brand === model.brand &&
          record.modelKey === model.key &&
          record.year === year.year,
      );
      reconcile(year.expectedTrimIds, [...new Set(found.map((record) => record.trimId))], 'trims');
      reconcile(year.expectedConfigurationKeys, found.map(hondaConfigurationKey), 'transmissions');
    }
  }
  for (const record of snapshot.records) {
    const model = snapshot.models.find(
      (model) =>
        model.brand === record.brand &&
        model.key === record.modelKey &&
        model.name === record.modelName,
    );
    if (
      !model?.years.some(
        (year) =>
          year.year === record.year &&
          year.expectedConfigurationKeys.includes(hondaConfigurationKey(record)),
      )
    )
      throw new Error('Unreferenced Honda configuration.');
    if (
      record.pricingSource.url !== hondaPricingApiUrl(record.brand) ||
      record.specificationsSource.url !== hondaSpecificationsUrl(record.brand, record.trimId)
    )
      throw new Error('Honda source identity mismatch.');
    if (record.specifications.some((group) => group.TrimId !== Number(record.trimId)))
      throw new Error('Honda specification trim mismatch.');
    if (
      !record.trimKey.endsWith(`_${record.trimId}`) ||
      !record.transmissionKey.startsWith(`${record.transmissionId}-`) ||
      (record.pricingTransmissionKey !== null &&
        !record.pricingTransmissionKey.startsWith(`${record.transmissionId}-`))
    )
      throw new Error('Honda configuration key/ID mismatch.');
  }
  return snapshot;
}
