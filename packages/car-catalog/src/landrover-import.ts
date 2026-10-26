import { z } from 'zod';

export const landroverRulesOrigin = 'https://rules.config.landrover.com';
export const landroverFamilies = ['l663', 'l462', 'l550', 'l460', 'l461', 'l560', 'l551'] as const;
export const landroverClientHash =
  '861ad3af418f09ed2d0b5453f755504f0bb3388bea40c7b7f38509421c2caee0';
export const landroverClientUrl =
  'https://modules.jaguarlandrover.com/modules/config-ipr-frontend/2.60.0/assets/normalisationMiddleware.js';
const text = z.string().min(1),
  code = z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .max(100);
export const landroverReceiptSchema = z.strictObject({
  url: z.url().refine((s) => {
    const u = new URL(s);
    return (
      [
        'https://www.landrover.ca',
        'https://www.rangerover.com',
        landroverRulesOrigin,
        'https://modules.jaguarlandrover.com',
      ].includes(u.origin) &&
      !u.username &&
      !u.password
    );
  }),
  status: z.literal(200),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.iso.datetime(),
});
export type LandroverReceipt = z.infer<typeof landroverReceiptSchema>;
const language = z.object({ en: z.string().optional() }).passthrough();
const amount = z.object({ currency: z.literal('CAD'), value: z.string().regex(/^-?\d+\.\d{2}$/) });
const prices = z
  .object({ GROSS: amount.optional(), NET: amount.optional(), TAX_ON_GROSS: amount.optional() })
  .passthrough();
export interface LrFeature {
  id: string;
  availability: string;
  description?: { en?: string };
  price?: z.infer<typeof prices>;
  property?: Record<string, unknown>;
  compatibility?: { 'definer-name': string; refs: string }[];
  query?: { type: string; href: string }[];
  'feature-list'?: LrList[];
}
export interface LrList {
  name: string;
  type: string;
  feature?: LrFeature[];
  'feature-list'?: LrList[];
}
const feature: z.ZodType<LrFeature> = z.lazy(() =>
  z.object({
    id: code,
    availability: text,
    description: language.optional(),
    price: prices.optional(),
    property: z.record(z.string(), z.unknown()).optional(),
    compatibility: z.array(z.object({ 'definer-name': text, refs: z.string() })).optional(),
    query: z.array(z.object({ type: text, href: text })).optional(),
    'feature-list': z.array(list).optional(),
  }),
);
const list: z.ZodType<LrList> = z.lazy(() =>
  z.object({
    name: code,
    type: text,
    feature: z.array(feature).max(5000).optional(),
    'feature-list': z.array(list).optional(),
  }),
);
const spec = z.object({
  table: z
    .array(
      z.object({
        labels: z.object({ label: z.array(z.object({ description: language })) }),
        datasets: z.array(
          z.object({
            refs: z.string().optional(),
            data: z.array(z.object({ description: language })),
          }),
        ),
      }),
    )
    .optional(),
});
const rawSchema = z.object({
  metadata: z.object({
    status: z.literal('200'),
    url: text,
    meta: z
      .object({
        Market: z.literal('ca'),
        SpecMarket: z.literal('CDA'),
        Environment: z.literal('LIVE'),
        'Hides.active': z.literal('true'),
      })
      .passthrough(),
  }),
  'feature-dictionary': z.object({
    vehicle: z.object({
      id: z.enum(landroverFamilies),
      modelyear: code,
      href: text,
      description: language,
      property: z.record(z.string(), z.unknown()),
    }),
    'feature-list': z.array(list).max(100),
  }),
  configuration: z.object({ summary: z.object({ price: prices }) }),
  specs: z.array(spec).optional(),
});
export type LrRaw = z.infer<typeof rawSchema>;
export function landroverJsonp(input: string): unknown {
  if (input.length > 5_000_000)
    throw new Error('Land Rover response exceeds the reviewed size bound.');
  const m = /^config_rcjson\((\{[\s\S]*\})\);?\s*$/.exec(input);
  if (!m) throw new Error('Unexpected Land Rover data wrapper; scripts are never executed.');
  return JSON.parse(m[1]!);
}
export function landroverRaw(input: unknown): LrRaw {
  return rawSchema.parse(input);
}
const label = (f: { description?: { en?: string } }) =>
  (f.description?.en ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export function landroverLists(raw: LrRaw) {
  return new Map(raw['feature-dictionary']['feature-list'].map((l) => [l.name, l]));
}
function refs(f: LrFeature, key: string) {
  const replacement = f.property?.[`HideRegisterCompatibility.${key}`];
  return replacement !== undefined
    ? z.string().parse(replacement).split(' ').filter(Boolean)
    : (f.compatibility
        ?.find((c) => c['definer-name'] === key)
        ?.refs.split(' ')
        .filter(Boolean) ?? []);
}
export function landroverVisibleProducts(raw: LrRaw) {
  const lists = landroverLists(raw),
    products = lists.get('PRODUCT')?.feature;
  if (!products?.length) throw new Error('Land Rover product catalog is empty.');
  const visible: { product: LrFeature; body: LrFeature; model: LrFeature; engine: LrFeature }[] =
      [],
    hidden: string[] = [];
  for (const product of products) {
    const definition = z.string().parse(product.property?.definition).split(' ');
    const core = ['BODYSTYLE', 'MODEL', 'ENGINE'].map((k) => {
      const matches = lists.get(k)?.feature?.filter((f) => definition.includes(f.id)) ?? [];
      if (matches.length !== 1)
        throw new Error(`Land Rover ${product.id}/${k} identity is ambiguous.`);
      return matches[0]!;
    });
    if (
      product.property?.HideRegister === 'hidden' ||
      core.some(
        (f) => f.property?.HideRegister === 'hidden' || !refs(f, 'PRODUCT').includes(product.id),
      )
    )
      hidden.push(product.id);
    else visible.push({ product, body: core[0]!, model: core[1]!, engine: core[2]! });
  }
  if (new Set(products.map((p) => p.id)).size !== products.length || !visible.length)
    throw new Error('Land Rover products are duplicated or entirely hidden.');
  return { visible, hidden };
}
export function landroverBasePrice(p: LrFeature) {
  if (!p.price?.GROSS && !p.price?.NET) return null;
  if (!p.price.GROSS || !p.price.NET || p.price.GROSS.value !== p.price.NET.value)
    throw new Error('Land Rover product price/tax basis changed.');
  const n = Number(p.price.NET.value);
  if (n === 0) return null;
  if (n < 10000 || n > 10000000)
    throw new Error('Land Rover base product amount is outside the reviewed bounds.');
  return n;
}
export function landroverYear(raw: LrRaw, overviewTitle?: string) {
  const native = /^\s*(20\d{2})\b/.exec(label(raw['feature-dictionary'].vehicle));
  if (native) return { year: Number(native[1]), basis: 'native-description' as const };
  if (
    raw['feature-dictionary'].vehicle.id === 'l460' &&
    /^Range Rover (20\d{2}) \|/.test(overviewTitle ?? '')
  )
    return {
      year: Number(/^Range Rover (20\d{2})/.exec(overviewTitle!)![1]),
      basis: 'canadian-overview-title' as const,
    };
  return { year: null, basis: 'unverified' as const };
}

export const landroverProfileSchema = z.strictObject({
  family: z.enum(landroverFamilies),
  id: code,
  body: text,
  model: text,
  engine: text,
  year: z.number().int().min(2020).max(2030).nullable(),
  yearBasis: z.enum(['native-description', 'canadian-overview-title', 'unverified']),
  price: z.number().min(10000).max(10000000).nullable(),
  fuel: z.enum(['Gasoline', 'Hybrid', 'Gasoline / hybrid', 'Electric', 'Plug-in hybrid']),
  drivetrain: z.enum(['AWD', 'Not verified']),
  transmission: text,
  source: landroverReceiptSchema,
});
export type LandroverProfile = z.infer<typeof landroverProfileSchema>;
export function landroverProfile(
  raw: LrRaw,
  id: string,
  source: LandroverReceipt,
  overviewTitle?: string,
): LandroverProfile {
  const selected =
    landroverLists(raw)
      .get('PRODUCT')
      ?.feature?.filter((f) => ['selected', 'default'].includes(f.availability)) ?? [];
  if (selected.length !== 1 || selected[0]!.id !== id)
    throw new Error('Land Rover resolved selection differs from requested derivative.');
  const v = landroverVisibleProducts(raw).visible.find((v) => v.product.id === id);
  if (!v) throw new Error('Land Rover selected product is hidden.');
  const description = [label(v.product), label(v.engine)].join(' '),
    fuel = v.engine.property?.FuelType;
  if (!['P', 'H', 'E'].includes(String(fuel)))
    throw new Error('Land Rover engine fuel mapping requires review.');
  return landroverProfileSchema.parse({
    family: raw['feature-dictionary'].vehicle.id,
    id,
    body: label(v.body),
    model: label(v.model),
    engine: label(v.engine),
    ...(() => {
      const y = landroverYear(raw, overviewTitle);
      return { year: y.year, yearBasis: y.basis };
    })(),
    price: landroverBasePrice(v.product),
    fuel:
      fuel === 'E'
        ? 'Electric'
        : fuel === 'H'
          ? 'Plug-in hybrid'
          : /MHEV|Mild Hybrid/i.test(description)
            ? 'Hybrid'
            : 'Gasoline / hybrid',
    drivetrain: /All[- ]Wheel Drive/i.test(description) ? 'AWD' : 'Not verified',
    transmission: /Automatic/i.test(description)
      ? 'Automatic'
      : fuel === 'E'
        ? 'Electric'
        : 'Not verified',
    source,
  });
}
const familySchema = z.strictObject({
  family: z.enum(landroverFamilies),
  source: landroverReceiptSchema,
  productIds: z.array(code).min(1),
  excluded: z.array(code),
});
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  market: z.literal('CA'),
  retrievedAt: z.iso.datetime(),
  normalizer: landroverReceiptSchema,
  lineup: landroverReceiptSchema,
  yearSource: landroverReceiptSchema,
  families: z.array(familySchema).length(7),
  profiles: z.array(landroverProfileSchema).min(7).max(500),
});
export type LandroverSnapshot = z.infer<typeof snapshotSchema>;
export function validateLandroverSnapshot(input: unknown): LandroverSnapshot {
  const s = snapshotSchema.parse(input);
  if (s.normalizer.sha256 !== landroverClientHash || s.normalizer.url !== landroverClientUrl)
    throw new Error('Land Rover client normalization requires renewed review.');
  if (new Set(s.families.map((f) => f.family)).size !== 7)
    throw new Error('Land Rover family coverage is incomplete.');
  const receipts = [
    s.normalizer,
    s.lineup,
    s.yearSource,
    ...s.families.map((f) => f.source),
    ...s.profiles.map((p) => p.source),
  ];
  const times = receipts.map((r) => Date.parse(r.capturedAt));
  if (
    Math.max(...times) - Math.min(...times) > 86400000 ||
    Date.parse(s.retrievedAt) !== Math.max(...times)
  )
    throw new Error('Land Rover capture cohort exceeds one day or retrieval time differs.');
  const ids = s.profiles.map((p) => `${p.family}/${p.id}`);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate Land Rover profile.');
  for (const f of s.families) {
    const actual = s.profiles
      .filter((p) => p.family === f.family)
      .map((p) => p.id)
      .sort();
    if (
      JSON.stringify(actual) !== JSON.stringify([...f.productIds].sort()) ||
      actual.some((id) => f.excluded.includes(id))
    )
      throw new Error('Land Rover visible derivative coverage differs.');
  }
  for (const p of s.profiles) {
    if ((p.year === null) !== (p.yearBasis === 'unverified'))
      throw new Error('Land Rover model year qualification differs.');
    if (p.yearBasis === 'canadian-overview-title' && p.family !== 'l460')
      throw new Error('Land Rover year source belongs to another family.');
    const u = new URL(p.source.url);
    if (u.origin !== landroverRulesOrigin || !u.pathname.startsWith(`/rc/lr/en_ca/${p.family}_`))
      throw new Error('Land Rover source belongs to another family/market.');
  }
  return s;
}
