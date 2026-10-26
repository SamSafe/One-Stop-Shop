import { z } from 'zod';

export const astonOrigin = 'https://configurator.astonmartin.com';
export const astonUrls = {
  bootstrap: `${astonOrigin}/`,
  countries: `${astonOrigin}/data/api/country-list`,
  menu: `${astonOrigin}/models/products/CA`,
  translations: `${astonOrigin}/static/assets/translations/en.json`,
  client: `${astonOrigin}/chunk-BTNBP6WG.js`,
  entryClient: `${astonOrigin}/main-REOVSZF3.js`,
  valen:
    'https://www.astonmartin.com/en/our-world/news/2026/8/14/aston-martin-valen-the-most-powerful-front-engined-supercar',
  valhalla: 'https://www.astonmartin.com/en/models/valhalla',
} as const;
export const astonClientHashes = {
  client: '270d18e2da338dbe863cfd5a9ebac312345a582b2f059d82759c189a3bcf83ee',
  entryClient: '54221addd504ee01002b220b73eeeaac4be2a74155254025e35432d308b0fa44',
} as const;
export const astonStockOnly = ['AM617', 'AM647', 'AM546A', 'AM576A', 'AM890'];
const reviewedProducts: Record<string, { family: string; name: string }> = {
  AM003A: { family: 'M255', name: 'Valhalla' },
  AM374: { family: 'M222', name: 'Vanquish Coupe' },
  AM384: { family: 'M222', name: 'Vanquish Volante' },
  AM546A: { family: 'M200', name: 'DB12 Volante' },
  AM576A: { family: 'M200', name: 'DB12 Coupe' },
  AM617: { family: 'M210', name: 'Vantage Coupe' },
  AM647: { family: 'M210', name: 'Vantage Roadster' },
  AM810: { family: 'M230', name: 'DBX GT' },
  AM842: { family: 'M230', name: 'DBX S' },
  AM890: { family: 'M230', name: 'DBX707' },
  AM548: { family: 'M200', name: 'DB12 S Volante' },
  AM578: { family: 'M200', name: 'DB12 S Coupe' },
  AM662: { family: 'M210', name: 'Vantage S Coupe' },
  AM682: { family: 'M210', name: 'Vantage S Roadster' },
  AM390: { family: 'M224', name: 'Valen' },
};
export const astonConfigUrl = (id: string) =>
  `${astonOrigin}/rules/configuration/${id}?options=NoIgsgEgCgwg8gEQKIBkDiAVBAlFIC6QA&country=CA`;
export const astonPageUrl = (family: string, id: string) =>
  `${astonOrigin}/CA/model-select/${family}/${id}`;
export const astonReceiptSchema = z.strictObject({
  url: z.url(),
  status: z.literal(200),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.iso.datetime(),
});
const productSchema = z.strictObject({
  id: z.string().regex(/^AM\d+[A-Z]?$/),
  family: z.string().regex(/^M\d+$/),
  model: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  convertible: z.boolean(),
  role: z.enum(['menu-offer', 'stock-only', 'announced-only']),
  powerBhp: z.number().int().min(50).max(1500),
  seats: z.number().int().min(2).max(15).nullable(),
  transmission: z.enum([
    'Eight-speed automatic',
    'Eight-speed DCT',
    'Nine-speed automatic',
    'Not verified',
  ]),
  configuration: z
    .strictObject({
      source: astonReceiptSchema,
      selectedOptionCount: z.number().int().positive(),
      modelYearPublished: z.literal(false),
      pricePublished: z.literal(false),
    })
    .nullable(),
});
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  market: z.literal('CA'),
  retrievedAt: z.iso.datetime(),
  sources: z.strictObject(
    Object.fromEntries(Object.keys(astonUrls).map((k) => [k, astonReceiptSchema])) as Record<
      keyof typeof astonUrls,
      typeof astonReceiptSchema
    >,
  ),
  menuIds: z.array(z.string()).min(1).max(100),
  countries: z
    .array(z.string().regex(/^[A-Z]{2}$/))
    .min(1)
    .max(300),
  products: z.array(productSchema).min(1).max(100),
  valenFirstDeliveryQuarter: z.literal('2027-Q2'),
});
export type AstonSnapshot = z.infer<typeof snapshotSchema>;
export type AstonProduct = AstonSnapshot['products'][number];

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}
export function astonMenu(input: unknown) {
  const products = z
    .array(
      z
        .object({
          id: z.string(),
          modelCode: z.string(),
          isAuthorizedOnly: z.literal(false),
          pricing: z.unknown().optional(),
          meta: z.object({ isConvertible: z.boolean() }).passthrough(),
        })
        .passthrough(),
    )
    .min(1)
    .max(100)
    .parse(input);
  const ids = products.map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicated Aston Martin menu identity.');
  for (const p of products) {
    if (reviewedProducts[p.id]?.family !== p.modelCode)
      throw new Error(`Unreviewed Aston Martin model/family: ${p.id}/${p.modelCode}`);
    if (p.pricing != null)
      throw new Error('Aston Martin menu pricing changed; review currency and price basis.');
  }
  return products;
}
export function astonProduct(
  p: ReturnType<typeof astonMenu>[number],
  translationInput: unknown,
  configuration: AstonProduct['configuration'],
): AstonProduct {
  const translations = z.record(z.string(), z.unknown()).parse(translationInput);
  const labels = z.record(z.string(), z.unknown()).parse(translations.DERIVATIVE_SELECTION);
  const family = z.record(z.string(), z.unknown()).parse(labels[p.modelCode]);
  if (!family) throw new Error('Aston Martin model label missing.');
  const label = z
    .object({
      DERIVATIVE_NAME: z.string(),
      STATS: z.object({
        POWER: z.object({
          VALUE: z.record(z.string(), z.string()),
          UNIT: z.record(z.string(), z.string()),
        }),
      }),
    })
    .parse(family[p.id]);
  if (
    label.DERIVATIVE_NAME !== reviewedProducts[p.id]?.name ||
    label.STATS.POWER.UNIT['0'] !== 'bhp' ||
    !/^\d+$/.test(label.STATS.POWER.VALUE['0'] ?? '')
  )
    throw new Error('Aston Martin derivative label or power unit changed.');
  const standards = z.record(z.string(), z.unknown()).parse(translations.STANDARD_LIST);
  const standard = z.record(z.string(), z.unknown()).parse(standards[p.modelCode])[p.id];
  const sections = z.record(z.string(), z.unknown()).parse(standard);
  const body = strings(sections.BODY).join(' ');
  const seating = /\b(\d)(?:\+(\d))?\s+(?:seats|seating)\b/i.exec(body);
  const text = strings(standard).join(' ');
  const transmission = /(?:nine|9)[ -]speed/i.test(text)
    ? 'Nine-speed automatic'
    : /eight-speed DCT/i.test(text)
      ? 'Eight-speed DCT'
      : /eight-speed (?:automatic|transmission)/i.test(text)
        ? 'Eight-speed automatic'
        : 'Not verified';
  return productSchema.parse({
    id: p.id,
    family: p.modelCode,
    model: z.string().min(1).parse(family.MODEL_NAME),
    name: label.DERIVATIVE_NAME,
    convertible: p.meta.isConvertible,
    role: astonStockOnly.includes(p.id)
      ? 'stock-only'
      : p.id === 'AM390'
        ? 'announced-only'
        : 'menu-offer',
    powerBhp: Number(label.STATS.POWER.VALUE['0']),
    seats: seating ? Number(seating[1]) + Number(seating[2] ?? 0) : null,
    transmission,
    configuration,
  });
}
export function astonConfiguration(input: unknown, source: z.infer<typeof astonReceiptSchema>) {
  const data = z
    .object({
      config: z.array(z.unknown()).min(1),
      options: z.array(z.unknown()).min(1),
      projectReturn: z.object({}).passthrough(),
    })
    .parse(input);
  function inspect(value: unknown, depth = 0): void {
    if (depth > 25) throw new Error('Aston Martin configuration exceeds reviewed nesting.');
    if (Array.isArray(value)) value.forEach((v) => inspect(v, depth + 1));
    else if (value && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) {
        if (/price|pricing|currency|model.?year/i.test(k))
          throw new Error('Aston Martin price/year fields changed; review before importing.');
        inspect(v, depth + 1);
      }
  }
  inspect(data);
  return {
    source,
    selectedOptionCount: data.options.length,
    modelYearPublished: false as const,
    pricePublished: false as const,
  };
}
export function validateAstonSnapshot(input: unknown): AstonSnapshot {
  const s = snapshotSchema.parse(input);
  const receipts = [
    ...Object.values(s.sources),
    ...s.products.flatMap((p) => (p.configuration ? [p.configuration.source] : [])),
  ];
  const ids = s.products.map((p) => p.id).sort();
  if (!s.countries.includes('CA') || new Set(s.countries).size !== s.countries.length)
    throw new Error('Aston Martin Canada region is missing or duplicated.');
  if (
    new Set(ids).size !== ids.length ||
    JSON.stringify(ids) !== JSON.stringify([...s.menuIds].sort())
  )
    throw new Error('Aston Martin menu/product reconciliation failed.');
  for (const [key, url] of Object.entries(astonUrls))
    if (s.sources[key as keyof typeof astonUrls].url !== url)
      throw new Error('Aston Martin source URL changed.');
  for (const [key, hash] of Object.entries(astonClientHashes))
    if (s.sources[key as keyof typeof astonClientHashes].sha256 !== hash)
      throw new Error('Aston Martin public client changed; review rules.');
  for (const p of s.products) {
    const reviewed = reviewedProducts[p.id];
    if (!reviewed || reviewed.family !== p.family || reviewed.name !== p.name)
      throw new Error('Aston Martin identity requires review.');
    const expectedRole = astonStockOnly.includes(p.id)
      ? 'stock-only'
      : p.id === 'AM390'
        ? 'announced-only'
        : 'menu-offer';
    if (p.role !== expectedRole || (p.role === 'stock-only') !== (p.configuration === null))
      throw new Error('Aston Martin stock/announcement boundary changed.');
    if (
      p.configuration?.source.url !== undefined &&
      p.configuration.source.url !== astonConfigUrl(p.id)
    )
      throw new Error('Aston Martin configuration country/product join failed.');
    if (p.convertible !== /Volante|Roadster/.test(p.name))
      throw new Error('Aston Martin body style conflicts with derivative.');
  }
  const times = receipts.map((r) => Date.parse(r.capturedAt));
  if (
    s.retrievedAt !==
      receipts
        .map((r) => r.capturedAt)
        .sort()
        .at(-1) ||
    Math.max(...times) - Math.min(...times) > 86400000
  )
    throw new Error('Aston Martin capture dates do not reconcile.');
  return s;
}
export function astonNoRegression(before: AstonSnapshot, after: AstonSnapshot) {
  if (Date.parse(after.retrievedAt) < Date.parse(before.retrievedAt))
    throw new Error('Aston Martin refresh cannot move the review date backwards.');
  for (const p of before.products) {
    const next = after.products.find((x) => x.id === p.id);
    if (
      !next ||
      (p.seats !== null && next.seats === null) ||
      (p.configuration && !next.configuration) ||
      (p.transmission !== 'Not verified' && next.transmission === 'Not verified')
    )
      throw new Error(`Aston Martin refresh loses reviewed coverage: ${p.id}`);
  }
}
