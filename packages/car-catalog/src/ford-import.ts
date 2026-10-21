import { z } from 'zod';

export const fordBrandSchema = z.enum(['Ford', 'Lincoln']);
export type FordBrand = z.infer<typeof fordBrandSchema>;
export function fordShop(brand: FordBrand) {
  return brand === 'Ford' ? 'https://shop.ford.ca' : 'https://shop.lincolncanada.com';
}
export function fordOrigin(brand: FordBrand) {
  return brand === 'Ford' ? 'https://www.ford.ca' : 'https://www.lincolncanada.com';
}
export function fordSelectionUrl(brand: FordBrand, key: string, year: number) {
  return `${fordOrigin(brand)}/build-price/${encodeURIComponent(key)}/${year}/choose-model`;
}

// Read the public React Flight data as JSON/text. Remote JavaScript is never evaluated.
export function fordFlight(input: string) {
  const chunks: string[] = [];
  for (const match of input.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    const value: unknown = JSON.parse(match[1]!);
    if (Array.isArray(value) && value[0] === 1 && typeof value[1] === 'string')
      chunks.push(value[1]);
  }
  if (input.includes('<html') && !chunks.length) throw new Error('Ford embedded data is missing.');
  const bytes = new TextEncoder().encode(chunks.length ? chunks.join('') : input);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const rows = new Map<string, unknown>();
  let offset = 0;
  while (offset < bytes.length) {
    if (bytes[offset] === 10) {
      offset++;
      continue;
    }
    const colon = bytes.indexOf(58, offset);
    if (colon < 0) throw new Error('Truncated Ford data row.');
    const key = decoder.decode(bytes.slice(offset, colon));
    if (!/^[0-9a-f]*$/.test(key)) throw new Error('Invalid Ford data row ID.');
    offset = colon + 1;
    if (bytes[offset] === 84) {
      const comma = bytes.indexOf(44, offset);
      const lengthText = decoder.decode(bytes.slice(offset + 1, comma));
      if (comma < 0 || !/^[0-9a-f]+$/.test(lengthText))
        throw new Error('Invalid Ford text length.');
      const length = parseInt(lengthText, 16),
        end = comma + 1 + length;
      if (end > bytes.length) throw new Error('Truncated Ford text.');
      rows.set(key, decoder.decode(bytes.slice(comma + 1, end)));
      offset = end;
    } else {
      const newline = bytes.indexOf(10, offset),
        end = newline < 0 ? bytes.length : newline;
      const value = decoder.decode(bytes.slice(offset, end));
      offset = end + 1;
      // Import, hint and debug rows are protocol metadata, not vehicle data.
      if (/^[A-Z]/.test(value)) continue;
      rows.set(key, JSON.parse(value));
    }
  }
  function resolve(value: unknown, depth = 0): unknown {
    if (depth > 80) throw new Error('Cyclic Ford data reference.');
    if (value === '$undefined') return undefined;
    if (typeof value === 'string') {
      const reference = /^\$([0-9a-f]+)(?::(.+))?$/.exec(value);
      if (reference) {
        if (!rows.has(reference[1]!)) throw new Error('Missing Ford data reference.');
        let target = rows.get(reference[1]!);
        for (const part of reference[2]?.split(':') ?? []) {
          if (Array.isArray(target) && part === 'props' && target[0] === '$') target = target[3];
          else if (target && typeof target === 'object')
            target = (target as Record<string, unknown>)[part];
          else throw new Error('Invalid Ford data reference path.');
        }
        return resolve(target, depth + 1);
      }
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => resolve(item, depth + 1));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, resolve(item, depth + 1)]),
      );
    return value;
  }
  function property(key: string): unknown {
    const found: unknown[] = [];
    function walk(value: unknown) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        const object = value as Record<string, unknown>;
        if (key in object) found.push(object[key]);
        Object.values(object).forEach(walk);
      }
    }
    [...rows.values()].forEach(walk);
    if (!found.length) throw new Error(`Ford data property missing: ${key}`);
    return resolve(found[0]);
  }
  return { rows, resolve, property };
}
const officialUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    ['www.ford.ca', 'shop.ford.ca', 'www.lincolncanada.com', 'shop.lincolncanada.com'].includes(
      url.hostname,
    ) &&
    !url.username &&
    !url.password
  );
});
const receipt = z.strictObject({ url: officialUrl, sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const showroomVehicle = z.object({
  id: z.string(),
  urlKey: z.string(),
  desc: z.string(),
  year: z.union([z.number(), z.string()]).nullable(),
  segment: z.string(),
  market: z.array(z.string()),
  currency: z.string(),
  bnpUrl: z.string().nullable(),
});
export function fordShowroom(html: string, brand: FordBrand) {
  const vehicles = z.array(showroomVehicle).min(1).parse(fordFlight(html).property('vehicles'));
  const selected = vehicles.filter(
    (vehicle) => vehicle.market.includes('Retail') && vehicle.year !== null,
  );
  const models = selected.map((vehicle) => {
    if (vehicle.currency !== 'CAD' || !vehicle.id.startsWith(`${brand}-`) || !vehicle.bnpUrl)
      throw new Error('Ford showroom country/identity mismatch.');
    const path = /^\/(?:configure|build)\/([^/]+)\/(\d{4})\/?$/.exec(vehicle.bnpUrl);
    if (!path || Number(path[2]) !== Number(vehicle.year))
      throw new Error('Ford showroom model/year mismatch.');
    return {
      brand,
      key: path[1]!,
      year: Number(vehicle.year),
      name: vehicle.desc,
      showroomId: vehicle.id,
      segment: vehicle.segment,
    };
  });
  const keys = models.map((model) => `${model.key}/${model.year}`);
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate Ford retail model years.');
  return {
    models,
    excluded: vehicles
      .filter((vehicle) => !selected.includes(vehicle))
      .map((vehicle) => ({
        id: vehicle.id,
        market: vehicle.market,
        reason: vehicle.market.includes('Future')
          ? 'Future-only showroom entry; current offering is not established.'
          : 'Commercial-only showroom entry outside the passenger-vehicle scope.',
      })),
  };
}
const modelMetadata = z.object({
  id: z.string(),
  country: z.literal('CAN'),
  make: fordBrandSchema,
  model: z.string(),
  year: z.string(),
  catalogId: z.string(),
  urlKey: z.string(),
  urlKeyAliases: z.array(z.string()).default([]),
  segment: z.string(),
  electric: z.boolean(),
  active: z.literal(true),
});
const tag = z.object({ name: z.string(), key: z.string() });
const rawVariant = z.object({
  trimId: z.string(),
  variantName: z.string(),
  trimVariantWersCodes: z.array(z.string()).default([]),
  configTokenHash: z.string(),
  seriesWersCode: z.string(),
  tags: z.record(z.string(), tag).optional(),
});
const trimResponse = z.object({
  holderType: z.literal('TRIM_RESP'),
  configModelId: z.string(),
  year: z.string(),
  brand: fordBrandSchema,
  trimModels: z
    .array(
      z.object({
        name: z.string(),
        wersCodes: z.array(z.string()),
        configId: z.string(),
        catalogId: z.string(),
        year: z.string(),
        trimVariants: z.array(rawVariant).min(1),
      }),
    )
    .min(1),
});
const variant = z.strictObject({
  key: z.string(),
  configId: z.string(),
  catalogId: z.string(),
  trimId: z.string(),
  trimName: z.string(),
  variantName: z.string(),
  configHash: z.string(),
  seriesCodes: z.array(z.string()),
  variantCodes: z.array(z.string()),
  tags: z.record(z.string(), tag),
  excludedReason: z.string().nullable(),
});
export type FordVariant = z.infer<typeof variant>;
export const fordVariantKey = (configId: string, trimId: string, hash: string) =>
  `${configId}/${trimId}/${hash}`;
export function fordSelection(
  html: string,
  expected: { brand: FordBrand; key: string; year: number },
) {
  const data = fordFlight(html),
    metadata = modelMetadata.parse(data.property('configModel')),
    trims = trimResponse.parse(data.property('trimConfig'));
  if (
    metadata.make !== expected.brand ||
    Number(metadata.year) !== expected.year ||
    ![metadata.urlKey, ...metadata.urlKeyAliases].includes(expected.key) ||
    trims.brand !== expected.brand ||
    Number(trims.year) !== expected.year ||
    trims.configModelId !== metadata.id
  )
    throw new Error('Ford model-selection identity mismatch.');
  const variants = trims.trimModels.flatMap((trim) => {
    if (Number(trim.year) !== expected.year) throw new Error('Ford trim year mismatch.');
    return trim.trimVariants.map((entry) => ({
      key: fordVariantKey(trim.configId, entry.trimId, entry.configTokenHash),
      configId: trim.configId,
      catalogId: trim.catalogId,
      trimId: entry.trimId,
      trimName: trim.name,
      variantName: entry.variantName,
      configHash: entry.configTokenHash,
      seriesCodes: trim.wersCodes,
      variantCodes: entry.trimVariantWersCodes,
      tags: entry.tags ?? {},
      excludedReason: /^(?:E-Transit )?Cargo Van$/i.test(trim.name)
        ? 'Cargo-only van configuration; passenger vans are imported separately.'
        : null,
    }));
  });
  if (new Set(variants.map((variant) => variant.key)).size !== variants.length)
    throw new Error('Duplicate Ford selection variants.');
  return { metadata, variants };
}
export function fordBuildUrl(brand: FordBrand, key: string, year: number, variant: FordVariant) {
  return `${fordSelectionUrl(brand, key, year)}/build?${new URLSearchParams({ configId: variant.configId, config: variant.configHash, trimConfig: variant.configHash, complex: 'true', vehicleTrim: variant.trimId })}`;
}
const feature = z.object({
  featureCategory: z.string(),
  werscode: z.string(),
  description: z.string().optional(),
});
const rawBuild = z.object({
  configModelId: z.string(),
  catalogId: z.string(),
  year: z.string(),
  brand: fordBrandSchema,
  model: z.string(),
  trimId: z.string(),
  configHash: z.string(),
  keyFeatureMap: z.record(z.string(), feature),
  selectedWersCodes: z.array(z.string()),
  priceSummaryMap: z.object({ MSRP: z.record(z.string(), z.number()) }),
  modelBuildGroups: z.array(
    z.object({
      groupName: z.string(),
      modelBuildSubGroups: z.array(
        z.object({
          wersId: z.string(),
          name: z.string(),
          category: z.string().optional(),
          bpClass: z.string().optional(),
          featureStatus: z.string(),
          price: z.number().optional(),
        }),
      ),
    }),
  ),
});
const build = z.strictObject({
  configId: z.string(),
  catalogId: z.string(),
  brand: fordBrandSchema,
  year: z.number().int(),
  model: z.string(),
  trimId: z.string(),
  configHash: z.string(),
  features: z.record(z.string(), feature),
  selectedCodes: z.array(z.string()),
  prices: z.record(z.string(), z.number()),
  pricingAdjustments: z.array(
    z.strictObject({ code: z.string(), category: z.string(), price: z.number().nullable() }),
  ),
  powertrainOptions: z.array(
    z.strictObject({
      code: z.string(),
      name: z.string(),
      category: z.string(),
      status: z.string(),
      price: z.number().nullable(),
    }),
  ),
});
export type FordBuild = z.infer<typeof build>;
export function fordConfigurationCodes(selected: string[], features: FordBuild['features']) {
  return new Set(
    [...selected, ...Object.values(features).map((feature) => feature.werscode)].flatMap((code) => [
      code,
      ...code.split('_'),
    ]),
  );
}
export function fordBuild(
  html: string,
  expected: { brand: FordBrand; year: number },
  variant: FordVariant,
): FordBuild {
  const parsed = rawBuild.parse(fordFlight(html).property('initialConfig'));
  if (
    parsed.brand !== expected.brand ||
    Number(parsed.year) !== expected.year ||
    parsed.configModelId !== variant.configId ||
    parsed.catalogId !== variant.catalogId ||
    parsed.trimId !== variant.trimId ||
    parsed.configHash !== variant.configHash
  )
    throw new Error('Ford build identity mismatch.');
  const codes = fordConfigurationCodes(parsed.selectedWersCodes, parsed.keyFeatureMap);
  const missingCodes = [...variant.seriesCodes, ...variant.variantCodes].filter(
    (code) => !codes.has(code),
  );
  if (missingCodes.length)
    throw new Error(
      `Ford build changed the requested variant ${variant.key}: ${missingCodes.join(', ')}.`,
    );
  return {
    configId: parsed.configModelId,
    catalogId: parsed.catalogId,
    brand: parsed.brand,
    year: Number(parsed.year),
    model: parsed.model,
    trimId: parsed.trimId,
    configHash: parsed.configHash,
    features: parsed.keyFeatureMap,
    selectedCodes: parsed.selectedWersCodes,
    prices: parsed.priceSummaryMap.MSRP,
    pricingAdjustments: parsed.modelBuildGroups
      .flatMap((group) => group.modelBuildSubGroups)
      .filter(
        (option) =>
          ['DISCOUNT_PACK', 'COLOR', 'SECONDARY_COLOR', 'SEATING_COLOR'].includes(
            option.bpClass ?? '',
          ) && ['DEFAULT', 'SELECTED', 'INCLUDED', 'STANDARD'].includes(option.featureStatus),
      )
      .map((option) => ({
        code: option.wersId,
        category: option.bpClass!,
        price: option.price ?? null,
      })),
    powertrainOptions: parsed.modelBuildGroups
      .filter((group) => /powertrain/i.test(group.groupName))
      .flatMap((group) =>
        group.modelBuildSubGroups.map((option) => ({
          code: option.wersId,
          name: option.name,
          category: option.bpClass ?? option.category ?? '',
          status: option.featureStatus,
          price: option.price ?? null,
        })),
      ),
  };
}
const model = z.strictObject({
  brand: fordBrandSchema,
  key: z.string(),
  year: z.number().int().min(2020).max(2100),
  name: z.string(),
  showroomId: z.string(),
  segment: z.string(),
  electric: z.boolean(),
  selectionSource: receipt,
  variants: z.array(variant).min(1),
});
const record = z.strictObject({
  brand: fordBrandSchema,
  key: z.string(),
  year: z.number().int(),
  variantKey: z.string(),
  source: receipt,
  build,
});
export const fordSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  brands: z
    .array(
      z.strictObject({
        brand: fordBrandSchema,
        source: receipt,
        expectedModelKeys: z.array(z.string()).min(1),
        excludedShowroomEntries: z.array(
          z.strictObject({ id: z.string(), market: z.array(z.string()), reason: z.string() }),
        ),
      }),
    )
    .length(2),
  models: z.array(model).min(1),
  records: z.array(record).min(1),
});
export type FordSnapshot = z.infer<typeof fordSnapshotSchema>;
function reconcile(expected: string[], found: string[], label: string) {
  if (
    new Set(expected).size !== expected.length ||
    new Set(found).size !== found.length ||
    JSON.stringify([...expected].sort()) !== JSON.stringify([...found].sort())
  )
    throw new Error(`Incomplete or duplicate Ford/Lincoln ${label}.`);
}
export function validateFordSnapshot(input: unknown): FordSnapshot {
  const snapshot = fordSnapshotSchema.parse(input);
  reconcile(
    ['Ford', 'Lincoln'],
    snapshot.brands.map((brand) => brand.brand),
    'brands',
  );
  for (const brand of snapshot.brands) {
    if (brand.source.url !== `${fordShop(brand.brand)}/showroom/`)
      throw new Error('Ford showroom source mismatch.');
    reconcile(
      brand.expectedModelKeys,
      snapshot.models
        .filter((model) => model.brand === brand.brand)
        .map((model) => `${model.key}/${model.year}`),
      'model years',
    );
  }
  for (const model of snapshot.models) {
    if (model.selectionSource.url !== fordSelectionUrl(model.brand, model.key, model.year))
      throw new Error('Ford selection source mismatch.');
    const found = snapshot.records.filter(
      (record) =>
        record.brand === model.brand && record.key === model.key && record.year === model.year,
    );
    reconcile(
      model.variants
        .filter((variant) => variant.excludedReason === null)
        .map((variant) => variant.key),
      found.map((record) => record.variantKey),
      'configurations',
    );
    for (const variant of model.variants)
      if (variant.key !== fordVariantKey(variant.configId, variant.trimId, variant.configHash))
        throw new Error('Ford variant identity mismatch.');
  }
  for (const record of snapshot.records) {
    const model = snapshot.models.find(
        (model) =>
          model.brand === record.brand && model.key === record.key && model.year === record.year,
      ),
      variant = model?.variants.find((variant) => variant.key === record.variantKey);
    if (
      !variant ||
      variant.excludedReason !== null ||
      record.source.url !== fordBuildUrl(record.brand, record.key, record.year, variant)
    )
      throw new Error('Unreferenced Ford build.');
    if (
      record.build.brand !== record.brand ||
      record.build.year !== record.year ||
      record.build.configId !== variant.configId ||
      record.build.catalogId !== variant.catalogId ||
      record.build.trimId !== variant.trimId ||
      record.build.configHash !== variant.configHash
    )
      throw new Error('Ford snapshot build identity mismatch.');
    const codes = fordConfigurationCodes(record.build.selectedCodes, record.build.features);
    if ([...variant.seriesCodes, ...variant.variantCodes].some((code) => !codes.has(code)))
      throw new Error('Ford snapshot variant codes mismatch.');
  }
  return snapshot;
}
