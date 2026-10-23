import { z } from 'zod';
import { mercedesReceiptSchema } from './mercedes-import';
import type { MercedesSnapshot } from './mercedes-import';

const text = z.string().min(1),
  year = z.coerce.number().int().min(1990).max(2100);
const code = z.string().regex(/^[A-Z0-9]+$/),
  hash = z.string().regex(/^[a-f0-9]{64}$/);
export const mercedesVanInventoryUrl = 'https://www.mercedes-benz-vans.ca/en/vehicles/inventory';
export const mercedesVanDirectoryUrl =
  'https://nafta-service.mbvans.com/api/dl/ca/dealers?radius=all&brand=mb';
export const mercedesVanInitUrl =
  'https://nafta-service.mbvans.com/api/inv/en_ca/new/initdata?brand=mb';
export const mercedesVanModelsUrl =
  'https://nafta-service.mbvans.com/api/inv/en_ca/new/fp/config?brand=mb';
export const mercedesVanClients = [
  {
    url: 'https://www.mercedes-benz-vans.ca/etc/designs/mb-vans/js/apps/inventory.js',
    sha256: '373e784aa7b8423526106890ab4b4cd7e530441015894249ff0263a9da8d9b09',
  },
  {
    url: 'https://www.mercedes-benz-vans.ca/etc/designs/mb-vans/js/platform/common.js',
    sha256: '7cdecfd681cd458c60448eccecb36ded0bef1f60f0feb0b752357eab6e77365f',
  },
] as const;
const families = z.enum(['SPRINTER', 'SPRINTER 4X4', 'METRIS']);
const referenceSchema = z.strictObject({
  key: text,
  model: code,
  year,
  family: families,
  body: z.enum(['PV', 'CV']),
});
export type MercedesVanReference = z.infer<typeof referenceSchema>;
const dealerSchema = z.strictObject({
  id: z.string().regex(/^\d{4}$/),
  postalCode: z.string().regex(/^[A-Z]\d[A-Z]\d[A-Z]\d$/),
});
export function mercedesVanDirectory(input: unknown) {
  const data = z
    .object({
      requestParameters: z.object({
        country: z.literal('ca'),
        brand: z.literal('mb'),
        radius: z.literal('all'),
        us: z.literal(false),
      }),
      status: z.object({ code: z.literal(200) }),
      dealers: z
        .array(
          z.object({
            id: dealerSchema.shape.id,
            address: z.array(z.object({ country: text, zip: text })).min(1),
          }),
        )
        .min(1),
    })
    .parse(input);
  const dealers = data.dealers.map((d) => {
    const address = d.address.find((a) => a.country.toUpperCase() === 'CA');
    if (!address) throw new Error('Mercedes van dealer has no explicit Canadian address.');
    return dealerSchema.parse({
      id: d.id,
      postalCode: address.zip.toUpperCase().replaceAll(' ', ''),
    });
  });
  if (new Set(dealers.map((d) => d.id)).size !== dealers.length)
    throw new Error('Duplicate Mercedes van dealer directory identity.');
  return dealers;
}
const factorySchema = z.object({
  invType: z.literal('NEW'),
  supportedVehicles: z
    .array(
      z.object({
        year,
        modelId: code,
        classId: text,
        bodyStyleId: text,
      }),
    )
    .min(1),
});
const object = (input: unknown) => z.record(z.string(), z.unknown()).parse(input);
export function mercedesVanInventoryReferences(initInput: unknown, factoryInput: unknown) {
  const init = z
    .object({
      status: z.object({ code: z.literal(200) }),
      result: z.object({
        filters: z.object({ bodystyles: z.object({ options: z.record(z.string(), z.unknown()) }) }),
      }),
    })
    .parse(initInput);
  const initial: MercedesVanReference[] = [];
  for (const body of ['PV', 'CV'] as const) {
    const classes = object(
      object(object(init.result.filters.bodystyles.options[body]).options).classes,
    ).options;
    for (const [family, value] of Object.entries(object(classes))) {
      const years = object(object(object(value).options).years).options;
      for (const [y, row] of Object.entries(object(years))) {
        const models = object(object(object(row).options).models).options;
        for (const model of Object.keys(object(models)))
          initial.push(
            referenceSchema.parse({ key: `${y}/${model}`, model, year: Number(y), family, body }),
          );
      }
    }
  }
  const factory = factorySchema
    .parse(factoryInput)
    .supportedVehicles.filter((r) => ['PV', 'CV'].includes(r.bodyStyleId))
    .map((r) =>
      referenceSchema.parse({
        key: `${r.year}/${r.modelId}`,
        year: r.year,
        model: r.modelId,
        family: r.classId,
        body: r.bodyStyleId,
      }),
    );
  if (!initial.length || !factory.length)
    throw new Error('Mercedes passenger/crew inventory references are empty.');
  const references = new Map<string, MercedesVanReference>();
  for (const r of [...initial, ...factory]) {
    const previous = references.get(r.key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(r))
      throw new Error('Mercedes van model/year/body references conflict.');
    references.set(r.key, r);
  }
  return {
    references: [...references.values()],
    modelCodes: [...new Set([...initial, ...factory].map((r) => r.model))],
  };
}
export function mercedesVanStockUrl(
  models: readonly string[],
  dealers: readonly z.infer<typeof dealerSchema>[],
  page: number,
) {
  if (
    !models.length ||
    models.some((m) => !code.safeParse(m).success) ||
    dealers.length < 1 ||
    dealers.length > 3 ||
    !Number.isInteger(page) ||
    page < 0
  )
    throw new Error('Invalid Mercedes new-van search context.');
  const params = {
    brand: 'mb',
    model: models.join(','),
    dealerId: dealers.map((d) => dealerSchema.parse(d).id).join(','),
    currentDealerOnly: true,
    shared: true,
    zip: dealers[0]!.postalCode,
    start: page,
    count: 12,
  };
  // The reviewed native serializeObject retains commas and uses a zero-based
  // page index; response currentOffset is a row offset. Empty fields are omitted.
  return `https://nafta-service.mbvans.com/api/inv/en_ca/new/vehicles/search/v2?${Object.entries(
    params,
  )
    .map(([key, value]) => `${key}=${value}`)
    .join('&')}`;
}
export function mercedesVanArchiveUrl(r: MercedesVanReference) {
  return `https://nafta-service.mbvans.com/api/byo/publish/en_ca/build/content/byo?brand=mb&year=${r.year}&class=${encodeURIComponent(r.family)}&model=${r.model}`;
}
const observationSchema = z.strictObject({
  id: hash,
  key: text,
  model: code,
  year,
  family: families,
  body: z.enum(['PV', 'CV']),
  dealerId: dealerSchema.shape.id,
  name: text,
  powertrain: text,
  roof: text,
  wheelbase: text,
  optionCodes: z.array(text),
  publishedMsrp: z.number().finite().positive(),
  available: z.boolean(),
  demo: z.boolean(),
  reserved: z.boolean(),
});
export function mercedesVanObservation(input: unknown, id: string) {
  const row = z
    .object({
      type: z.literal('NEW'),
      year,
      modelId: code,
      classId: families,
      bodyStyleId: text,
      dealerId: dealerSchema.shape.id,
      modelName: text,
      msrp: z.number().finite().positive(),
      available: z.boolean(),
      isVehicleCurrentlyReserved: z.boolean(),
      roofHeight: z.object({ value: text }),
      powertrain: z.object({ value: text }),
      wheelbase: z.object({ value: text }),
      vehicleAttributes: z.object({
        demoVehicle: z.boolean(),
        dealer: z.object({
          id: dealerSchema.shape.id,
          address: z.array(z.object({ country: text })).min(1),
        }),
      }),
      options: z.array(z.object({ id: text })),
      packages: z.array(z.object({ id: text })),
    })
    .parse(input);
  const bodies: Record<string, 'PV' | 'CV'> = { Passenger: 'PV', Crew: 'CV', PV: 'PV', CV: 'CV' };
  const body = bodies[row.bodyStyleId];
  if (
    !body ||
    row.vehicleAttributes.dealer.id !== row.dealerId ||
    !row.vehicleAttributes.dealer.address.some((a) => a.country.toUpperCase() === 'CA')
  )
    throw new Error('Mercedes new-stock passenger body or Canadian dealer identity is unverified.');
  return observationSchema.parse({
    id,
    key: `${row.year}/${row.modelId}`,
    model: row.modelId,
    year: row.year,
    family: row.classId,
    body,
    dealerId: row.dealerId,
    name: row.modelName,
    powertrain: row.powertrain.value,
    roof: row.roofHeight.value,
    wheelbase: row.wheelbase.value,
    optionCodes: [...new Set([...row.options, ...row.packages].map((o) => o.id))].sort(),
    publishedMsrp: row.msrp,
    available: row.available,
    demo: row.vehicleAttributes.demoVehicle,
    reserved: row.isVehicleCurrentlyReserved,
  });
}
export const mercedesVanStockPageSchema = z.object({
  status: z.object({ code: z.literal(200) }),
  result: z.object({
    paging: z.object({
      currentOffset: z.number().int().nonnegative(),
      currentCount: z.literal(12),
      totalCount: z.number().int().nonnegative(),
    }),
    records: z.array(z.unknown()),
  }),
});
const archiveContentSchema = z.object({
  valid: z.literal(true),
  brand: z.literal('mb'),
  year,
  model: code,
  class: families,
  bodyStyle: z.enum(['PV', 'CV']),
  vehicleName: text,
  cylinder: text,
  defaultVariant: text,
  msrp: z.number().finite().min(10000).max(10000000),
});
export function mercedesVanArchive(input: unknown, reference: MercedesVanReference) {
  const c = archiveContentSchema.parse(input);
  if (
    reference.key !== `${reference.year}/${reference.model}` ||
    `${c.year}/${c.model}` !== reference.key ||
    c.class !== reference.family ||
    c.bodyStyle !== reference.body
  )
    throw new Error('Mercedes archived factory model/year/body does not reconcile.');
  return c;
}
export const mercedesVanReceiptSchema = mercedesReceiptSchema.extend({
  capturedAt: z.iso.datetime(),
});
const receipt = mercedesVanReceiptSchema;
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  market: z.literal('CA'),
  currency: z.literal('CAD'),
  retrievedAt: z.iso.datetime(),
  contextSource: receipt,
  directorySource: receipt,
  initSource: receipt,
  factorySource: receipt,
  clients: z.array(receipt),
  dealers: z.array(dealerSchema).min(1),
  references: z.array(referenceSchema).min(1),
  modelCodes: z.array(code).min(1),
  groups: z
    .array(
      z.strictObject({
        dealerIds: z.array(dealerSchema.shape.id).min(1).max(3),
        total: z.number().int().nonnegative(),
        pages: z
          .array(
            z.strictObject({
              source: receipt,
              page: z.number().int().nonnegative(),
              offset: z.number().int().nonnegative(),
              count: z.literal(12),
              ids: z.array(hash),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  observations: z.array(observationSchema),
  archives: z.array(z.strictObject({ key: text, source: receipt, content: archiveContentSchema })),
});
export type MercedesVanStockSnapshot = z.infer<typeof snapshotSchema>;
const same = (a: readonly string[], b: readonly string[]) =>
  new Set(a).size === a.length &&
  new Set(b).size === b.length &&
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
export function mercedesEligibleVanKeys(snapshot: MercedesVanStockSnapshot) {
  return [
    ...new Set(snapshot.observations.filter((r) => r.available && !r.reserved).map((r) => r.key)),
  ].sort();
}
export function validateMercedesVanStockSnapshot(input: unknown, base: MercedesSnapshot) {
  const s = snapshotSchema.parse(input);
  const captures = [
    s.contextSource,
    s.directorySource,
    s.initSource,
    s.factorySource,
    ...s.clients,
    ...s.groups.flatMap((g) => g.pages.map((p) => p.source)),
    ...s.archives.map((a) => a.source),
  ];
  const dates = captures.map((r) => r.capturedAt).sort();
  if (
    s.retrievedAt !== dates.at(-1) ||
    Date.parse(dates.at(-1)!) - Date.parse(dates[0]!) > 86400000
  )
    throw new Error('Mercedes van stock review date or capture window does not reconcile.');
  function source(r: z.infer<typeof receipt>, url: string) {
    if (r.status !== 200 || r.url !== url)
      throw new Error('Mercedes van stock source HTTP/URL context changed.');
  }
  source(s.contextSource, mercedesVanInventoryUrl);
  source(s.directorySource, mercedesVanDirectoryUrl);
  source(s.initSource, mercedesVanInitUrl);
  source(s.factorySource, mercedesVanModelsUrl);
  if (s.clients.length !== mercedesVanClients.length)
    throw new Error('Mercedes van native client contract is missing.');
  for (const c of mercedesVanClients) {
    const r = s.clients.find((r) => r.url === c.url);
    if (!r || r.sha256 !== c.sha256)
      throw new Error('Mercedes van native client changed; review before refresh.');
    source(r, c.url);
  }
  if (
    !same(
      s.dealers.map((d) => d.id),
      s.groups.flatMap((g) => g.dealerIds),
    ) ||
    s.groups.length !== Math.ceil(s.dealers.length / 3)
  )
    throw new Error('Mercedes Canadian dealer search coverage is missing or duplicated.');
  if (
    !same(s.modelCodes, [...new Set(s.references.map((r) => r.model))]) ||
    !same(
      s.references.map((r) => r.key),
      [...new Set(s.references.map((r) => r.key))],
    )
  )
    throw new Error('Mercedes passenger model-code search coverage is missing or duplicated.');
  const observations = new Map(s.observations.map((r) => [r.id, r]));
  if (observations.size !== s.observations.length)
    throw new Error('Duplicate normalized Mercedes stock identity.');
  const allIds = new Set<string>();
  for (const [index, group] of s.groups.entries()) {
    const dealers = s.dealers.slice(index * 3, index * 3 + 3);
    if (
      JSON.stringify(group.dealerIds) !== JSON.stringify(dealers.map((d) => d.id)) ||
      group.pages.length !== Math.max(1, Math.ceil(group.total / 12))
    )
      throw new Error('Mercedes dealer grouping or page count does not reconcile.');
    const groupIds: string[] = [];
    for (const [page, p] of group.pages.entries()) {
      source(p.source, mercedesVanStockUrl(s.modelCodes, dealers, page));
      if (
        p.page !== page ||
        p.offset !== page * 12 ||
        p.ids.length !== Math.min(12, Math.max(0, group.total - page * 12))
      )
        throw new Error('Mercedes van page index, offset or row count does not reconcile.');
      for (const id of p.ids) {
        const r = observations.get(id);
        if (!r || !group.dealerIds.includes(r.dealerId))
          throw new Error('Mercedes van observation/dealer context is missing.');
        groupIds.push(id);
        allIds.add(id);
      }
    }
    if (new Set(groupIds).size !== group.total)
      throw new Error('Mercedes distinct stock identity totals do not reconcile.');
  }
  if (
    !same(
      [...allIds],
      s.observations.map((r) => r.id),
    )
  )
    throw new Error('Mercedes stock page/observation coverage is missing.');
  if (s.references.some((r) => r.key !== `${r.year}/${r.model}`))
    throw new Error('Mercedes van reference model/year identity does not reconcile.');
  for (const r of s.observations) {
    const ref = s.references.find((f) => f.key === r.key);
    if (r.key !== `${r.year}/${r.model}` || !ref || ref.family !== r.family || ref.body !== r.body)
      throw new Error('Mercedes observed new-stock model/year/body join changed.');
  }
  const known = new Set(base.vans.map((r) => r.key)),
    required = mercedesEligibleVanKeys(s).filter((key) => !known.has(key));
  if (
    !same(
      required,
      s.archives.map((r) => r.key),
    )
  )
    throw new Error(
      'Mercedes older new-stock factory reference coverage is missing or duplicated.',
    );
  for (const a of s.archives) {
    const ref = s.references.find((r) => r.key === a.key)!;
    source(a.source, mercedesVanArchiveUrl(ref));
    mercedesVanArchive(a.content, ref);
    if (s.observations.some((o) => o.key === a.key && o.powertrain !== a.content.cylinder))
      throw new Error('Mercedes archived engine and observed stock powertrain conflict.');
  }
  return s;
}
export function mercedesVanStockNoRegression(
  previous: MercedesVanStockSnapshot,
  next: MercedesVanStockSnapshot,
) {
  const current = new Set(mercedesEligibleVanKeys(next));
  if (mercedesEligibleVanKeys(previous).some((key) => !current.has(key)))
    throw new Error(
      'Mercedes stock refresh would lose an observed new model-year profile; review availability before replacement.',
    );
  if (previous.dealers.some((d) => !next.dealers.some((n) => n.id === d.id)))
    throw new Error('Mercedes stock refresh would lose a Canadian dealer search context.');
}
