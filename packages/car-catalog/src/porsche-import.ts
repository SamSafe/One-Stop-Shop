import { z } from 'zod';

export const porscheLineupUrl = 'https://www.porsche.com/canada/en/models/';
export const porscheBuilderOrigin = 'https://configurator.porsche.com';
export const porscheBuilderUrl = (code: string) =>
  `${porscheBuilderOrigin}/en-CA/mode/model/${code}`;
const text = z.string().min(1);
const code = z.string().regex(/^[A-Z0-9]{6}$/);
const year = z.number().int().min(1990).max(2100);
const money = z.number().finite().nonnegative().max(10000000);
const unsafe = new Set(['__proto__', 'constructor', 'prototype']);
export const porscheReceiptSchema = z.strictObject({
  url: z.url().refine((v) => {
    const u = new URL(v);
    return (
      !u.username &&
      !u.password &&
      (u.origin === porscheBuilderOrigin ||
        (u.origin === 'https://www.porsche.com' && u.pathname.startsWith('/canada/en/')))
    );
  }),
  status: z.number().int().min(100).max(599),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.iso.datetime(),
});
export function porscheText(s: string) {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
function astro(v: unknown, depth = 0): unknown {
  if (depth > 100 || !Array.isArray(v) || v.length > 2 || ![0, 1].includes(v[0]))
    throw new Error('Porsche model-menu serialization changed.');
  if (v.length === 1) {
    if (v[0] !== 0) throw new Error('Invalid Porsche model-menu undefined value.');
    return undefined;
  }
  if (v[0] === 1) {
    if (!Array.isArray(v[1])) throw new Error('Invalid Porsche model-menu array.');
    return v[1].map((x: unknown) => astro(x, depth + 1));
  }
  if (v[1] && typeof v[1] === 'object') {
    if (Array.isArray(v[1])) throw new Error('Invalid Porsche model-menu object.');
    return Object.fromEntries(
      Object.entries(v[1]).map(([k, x]) => {
        if (unsafe.has(k)) throw new Error('Unsafe Porsche model-menu field.');
        return [k, astro(x, depth + 1)];
      }),
    );
  }
  return v[1];
}
const menuCard = z.object({
  id: text,
  model: z.object({
    modelType: code,
    modelName: text,
    modelYear: z.string().regex(/^20\d{2}$/),
    bodyType: text,
    modelRangeId: z.enum(['911', '718', 'taycan', 'panamera', 'macan', 'cayenne']),
    modelRange: text,
    modelSeriesId: text,
    wheelDrive: z.enum(['Rear-wheel drive', 'All-wheel drive']),
    seats: z.enum(['2', '2+2', '4+1', '5']),
    fuelType: z.enum(['FUEL', 'ELECTRIC', 'HYBRID']),
    gearType: z.enum(['AUTOMATIC', 'MANUAL', 'AUTOMATIC_OR_MANUAL']),
    powerHp: z.object({ label: text, value: z.number().positive(), unit: z.literal('hp') }),
  }),
  props: z.object({
    actions: z
      .array(z.object({ href: z.url(), type: z.enum(['changeModel', 'configurator']) }))
      .min(1),
  }),
});
export const porscheModelSchema = z.strictObject({
  id: text,
  code,
  name: text,
  year,
  family: text,
  familyId: text,
  body: text,
  drive: z.enum(['RWD', 'AWD']),
  seatingLabel: z.enum(['2', '2+2', '4+1', '5']),
  fuel: z.enum(['FUEL', 'ELECTRIC', 'HYBRID']),
  transmissionChoice: z.enum(['AUTOMATIC', 'MANUAL', 'AUTOMATIC_OR_MANUAL']),
  power: z.strictObject({ value: z.number().positive(), label: text }),
  detailUrl: z.url(),
  builderUrl: z.url().nullable(),
});
export type PorscheModel = z.infer<typeof porscheModelSchema>;
export function porscheLineup(html: string): PorscheModel[] {
  if (html.length > 5000000) throw new Error('Porsche menu exceeds reviewed size bound.');
  const found: unknown[] = [];
  for (const island of html.matchAll(/<astro-island\b[^>]*>/g)) {
    const p = /(?:^|\s)props=(?:"([^"]*)"|'([^']*)')/.exec(island[0]);
    if (!p) continue;
    const raw = JSON.parse(porscheText(p[1] ?? p[2]!)) as Record<string, unknown>;
    if (!Object.hasOwn(raw, 'modelCards')) continue;
    if (astro(raw.locale) !== 'en-CA') throw new Error('Porsche model menu is not Canadian.');
    found.push(astro(raw.modelCards));
  }
  if (found.length !== 1) throw new Error('Porsche Canadian model menu is missing or duplicated.');
  const cards = z.array(menuCard).min(1).parse(found[0]);
  const models = cards.map((c) => {
    const m = c.model,
      detail = c.props.actions.filter((a) => a.type === 'changeModel'),
      builder = c.props.actions.filter((a) => a.type === 'configurator');
    if (
      c.id !== `${m.modelType}-${m.modelYear}` ||
      detail.length !== 1 ||
      builder.length > 1 ||
      !detail[0]!.href.startsWith('https://www.porsche.com/canada/en/models/') ||
      (builder.length && builder[0]!.href !== porscheBuilderUrl(m.modelType))
    )
      throw new Error('Porsche model/year/native-link identities do not reconcile.');
    return porscheModelSchema.parse({
      id: c.id,
      code: m.modelType,
      name: m.modelName,
      year: Number(m.modelYear),
      family: m.modelRange,
      familyId: m.modelRangeId,
      body: m.bodyType,
      drive: m.wheelDrive === 'Rear-wheel drive' ? 'RWD' : 'AWD',
      seatingLabel: m.seats,
      fuel: m.fuelType,
      transmissionChoice: m.gearType,
      power: { value: m.powerHp.value, label: m.powerHp.label },
      detailUrl: detail[0]!.href,
      builderUrl: builder[0]?.href ?? null,
    });
  });
  if (new Set(models.map((m) => m.id)).size !== models.length)
    throw new Error('Duplicate Porsche model/year.');
  return models;
}

// Decode data only, never downloaded JavaScript. Turbo Stream -5=null, -7=undefined.
export function porscheBuilderLoader(html: string): unknown {
  if (html.length > 10000000) throw new Error('Porsche builder exceeds reviewed size bound.');
  const chunks = [...html.matchAll(/streamController\.enqueue\(("(?:\\.|[^"\\])*")\)/g)];
  if (chunks.length !== 1) throw new Error('Porsche builder stream contract changed.');
  const table: unknown = JSON.parse(JSON.parse(chunks[0]![1]!));
  if (!Array.isArray(table) || !table.length || table.length > 100000)
    throw new Error('Invalid Porsche builder reference table.');
  const flat: unknown[] = table;
  function field(id: number, key: string): number {
    const obj: unknown = flat[id];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj))
      throw new Error('Porsche builder loader object missing.');
    const matches = Object.entries(obj).filter(
      ([k, v]) => /^_\d+$/.test(k) && flat[Number(k.slice(1))] === key && Number.isInteger(v),
    );
    if (matches.length !== 1)
      throw new Error(`Porsche loader field ${key} is missing or duplicated.`);
    return matches[0]![1] as number;
  }
  const loaders = field(0, 'loaderData'),
    root = field(loaders, 'root');
  if (flat[field(root, 'locale')] !== 'en-CA') throw new Error('Porsche builder is not Canadian.');
  const target = field(loaders, 'customer-configurator'),
    visiting = new Set<number>(),
    cache = new Map<number, unknown>();
  let budget = 250000;
  function decode(id: number, depth = 0): unknown {
    if (!Number.isInteger(id) || id >= flat.length || --budget < 0 || depth > 100)
      throw new Error('Invalid Porsche stream reference.');
    if (id === -5) return null;
    if (id === -7) return undefined;
    if (id < 0 || visiting.has(id)) throw new Error('Unsupported Porsche stream reference.');
    if (cache.has(id)) return cache.get(id);
    const raw: unknown = flat[id];
    if (raw === null || typeof raw !== 'object') return raw;
    visiting.add(id);
    let result: unknown;
    if (Array.isArray(raw)) {
      if (raw[0] === 'S') {
        if (raw.slice(1).some((x) => !Number.isInteger(x)))
          throw new Error('Invalid Porsche stream set.');
        result = new Set(raw.slice(1).map((x) => decode(x as number, depth + 1)));
      } else {
        if (raw.some((x) => !Number.isInteger(x)))
          throw new Error('Unsupported Porsche typed stream object.');
        result = raw.map((x) => decode(x as number, depth + 1));
      }
    } else {
      const pairs = Object.entries(raw).map(([k, v]) => {
        if (!/^_\d+$/.test(k) || !Number.isInteger(v))
          throw new Error('Invalid Porsche stream object.');
        const key = decode(Number(k.slice(1)), depth + 1);
        if (typeof key !== 'string' || unsafe.has(key))
          throw new Error('Unsafe Porsche stream field.');
        return [key, decode(v as number, depth + 1)] as const;
      });
      if (new Set(pairs.map(([k]) => k)).size !== pairs.length)
        throw new Error('Duplicate Porsche stream field.');
      result = Object.fromEntries(pairs);
    }
    visiting.delete(id);
    cache.set(id, result);
    return result;
  }
  return decode(target);
}

const amountSchema = z.object({ raw: money, gross: text }).superRefine((v, ctx) => {
  if (
    !/^\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?$/.test(v.gross) ||
    Math.abs(Number(v.gross.replace(/[$,]/g, '')) - v.raw) > (v.gross.includes('.') ? 0.005 : 0.5)
  )
    ctx.addIssue({ code: 'custom', message: 'Porsche numeric/formatted CAD amount conflicts.' });
});
const mainPricesSchema = z.strictObject({
  base: amountSchema,
  options: amountSchema,
  maxDealerFee: amountSchema,
  tireRecyclingFee: amountSchema,
  destinationCharge: amountSchema,
  airConditionTax: amountSchema,
  luxuryTax: amountSchema,
  greenLevyTax: amountSchema.optional(),
});
const itemSchema = z.object({
  id: text,
  title: text,
  priceNumeric: money,
  isSelected: z.boolean(),
  description: text.optional(),
});
export const porscheFactorySchema = z
  .strictObject({
    modelId: text,
    code,
    year,
    name: text,
    engineType: z.enum(['combustion', 'mild-hybrid', 'electric', 'hybrid']),
    prices: mainPricesSchema,
    transmission: z.strictObject({ id: text, title: text }).nullable(),
    selectedOptions: z.array(text).min(1),
    transmissionChoices: z.array(z.strictObject({ id: text, title: text, priceCad: money })).min(1),
    rearSeatOption: z
      .strictObject({
        id: z.literal('3UG'),
        title: z.literal('Rear Seats'),
        description: text,
        priceCad: money,
        selected: z.boolean(),
      })
      .nullable(),
    disclaimer: text.nullable(),
  })
  .superRefine((p, ctx) => {
    const t = p.transmission
      ? p.transmissionChoices.find((t) => t.id === p.transmission!.id)
      : null;
    if (
      p.modelId !== `${p.code}-${p.year}` ||
      p.prices.base.raw < 10000 ||
      new Set(p.selectedOptions).size !== p.selectedOptions.length ||
      new Set(p.transmissionChoices.map((t) => t.id)).size !== p.transmissionChoices.length ||
      (p.transmission
        ? !t || t.title !== p.transmission.title || !p.selectedOptions.includes(t.id)
        : p.transmissionChoices.some((t) => p.selectedOptions.includes(t.id))) ||
      (p.rearSeatOption && p.rearSeatOption.selected !== p.selectedOptions.includes('3UG')) ||
      p.prices.options.raw !==
        (t?.priceCad ?? 0) + (p.rearSeatOption?.selected ? p.rearSeatOption.priceCad : 0)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Porsche exact selected codes and base/option price components conflict.',
      });
  });
export type PorscheFactory = z.infer<typeof porscheFactorySchema>;
export function porscheFactory(html: string, model: PorscheModel): PorscheFactory {
  const d = z
    .object({
      market: z.object({ locale: z.literal('en-CA'), currency: z.literal('CAD') }),
      catalog: z.object({
        orderType: code,
        modelYear: year,
        modelName: text,
        engineType: z.enum(['combustion', 'mild-hybrid', 'electric', 'hybrid']),
        disclaimer: text.nullish(),
        isSoldOut: z.boolean().nullish(),
        isBlocked: z.boolean().nullish(),
      }),
      configuration: z.object({
        prices: z.object({ main: mainPricesSchema }),
        options: z.array(text).min(1),
        failedToAdd: z.array(text).nullish(),
        transmissionOption: z.object({ id: text, title: text }).optional(),
      }),
      views: z.object({
        optionsList: z.array(
          z.object({
            categories: z.array(
              z.object({
                groups: z.array(
                  z.object({
                    title: text.optional(),
                    selectedOptions: z.array(text),
                    items: z.array(z.object({ id: text }).passthrough()),
                  }),
                ),
              }),
            ),
          }),
        ),
      }),
    })
    .parse(porscheBuilderLoader(html));
  if (
    d.catalog.orderType !== model.code ||
    d.catalog.modelYear !== model.year ||
    d.catalog.modelName !== model.name ||
    d.catalog.isSoldOut ||
    d.catalog.isBlocked ||
    d.configuration.failedToAdd?.length ||
    d.configuration.prices.main.base.raw < 10000
  )
    throw new Error('Porsche exact model/year/build availability/price does not reconcile.');
  if (
    (d.catalog.engineType === 'electric') !== (model.fuel === 'ELECTRIC') ||
    (d.catalog.engineType === 'hybrid') !== (model.fuel === 'HYBRID')
  )
    throw new Error('Porsche powertrain context conflicts.');
  const groups = d.views.optionsList.flatMap((s) => s.categories).flatMap((c) => c.groups),
    transmissions = groups.filter((g) => g.title === 'Transmission'),
    rearSeats = groups.flatMap((g) => g.items).filter((i) => i.id === '3UG');
  if (transmissions.length !== 1 || rearSeats.length > 1)
    throw new Error('Porsche transmission/seating option coverage changed.');
  const transmission = d.configuration.transmissionOption,
    group = z
      .object({ selectedOptions: z.array(text), items: z.array(itemSchema) })
      .parse(transmissions[0]),
    selected = group.items.filter((i) => i.isSelected),
    options = d.configuration.options;
  if (
    new Set(options).size !== options.length ||
    (transmission
      ? selected.length !== 1 ||
        group.selectedOptions.length !== 1 ||
        selected[0]!.id !== transmission.id ||
        selected[0]!.title !== transmission.title ||
        group.selectedOptions[0] !== transmission.id ||
        !options.includes(transmission.id)
      : selected.length !== 0 ||
        group.selectedOptions.length !== 0 ||
        group.items.some((i) => options.includes(i.id))) ||
    new Set(group.items.map((i) => i.id)).size !== group.items.length
  )
    throw new Error('Porsche selected transmission does not reconcile.');
  const rear = rearSeats[0] ? itemSchema.parse(rearSeats[0]) : undefined;
  if (
    rear &&
    (rear.title !== 'Rear Seats' ||
      !rear.description ||
      !/2-seater rear seat arrangement/.test(porscheText(rear.description)) ||
      rear.isSelected !== options.includes('3UG'))
  )
    throw new Error('Porsche exact rear-seat arrangement changed.');
  const expectedOptionPrice =
    (selected[0]?.priceNumeric ?? 0) + (rear?.isSelected ? rear.priceNumeric : 0);
  if (d.configuration.prices.main.options.raw !== expectedOptionPrice)
    throw new Error(
      'Porsche configuration acquired unreviewed priced equipment; reconcile price components.',
    );
  return porscheFactorySchema.parse({
    modelId: model.id,
    code: model.code,
    year: model.year,
    name: model.name,
    engineType: d.catalog.engineType,
    prices: d.configuration.prices.main,
    transmission: transmission ?? null,
    selectedOptions: options,
    transmissionChoices: group.items.map((i) => ({
      id: i.id,
      title: i.title,
      priceCad: i.priceNumeric,
    })),
    rearSeatOption: rear
      ? {
          id: '3UG',
          title: rear.title,
          description: porscheText(rear.description!),
          priceCad: rear.priceNumeric,
          selected: rear.isSelected,
        }
      : null,
    disclaimer: d.catalog.disclaimer ? porscheText(d.catalog.disclaimer) : null,
  });
}
export function porscheSelectionUrl(parent: PorscheFactory, optionId: string, replacedId?: string) {
  if (
    (!parent.transmissionChoices.some((t) => t.id === optionId) &&
      !(optionId === '3UG' && parent.rearSeatOption)) ||
    (replacedId && replacedId !== parent.transmission?.id)
  )
    throw new Error('Unsupported Porsche native selection.');
  const options = parent.selectedOptions.filter((id) => id !== replacedId);
  if (!options.includes(optionId)) options.push(optionId);
  const url = new URL(porscheBuilderUrl(parent.code));
  url.searchParams.set('options', options.join('.'));
  url.searchParams.set('optionAdded', optionId);
  if (replacedId) url.searchParams.set('optionRemoved', replacedId);
  return String(url);
}
export const porscheProfileKey = (p: PorscheFactory) =>
  `${p.modelId}/${p.transmission?.id ?? 'unselected'}/${p.rearSeatOption?.selected ? 'rear' : 'base'}`;

export const porscheDetailSchema = z.strictObject({
  modelId: text,
  identityKind: z.enum(['country-model-footer', 'model-visualizer', 'menu-only']),
  rows: z.array(
    z.strictObject({
      category: text,
      id: text,
      label: text,
      value: z.string(),
      annotation: z.string().nullable(),
    }),
  ),
  equipment: z.array(z.object({ id: text, name: text })),
});
export type PorscheDetail = z.infer<typeof porscheDetailSchema>;
export function porscheDetail(html: string, model: PorscheModel): PorscheDetail {
  if (html.length > 5000000) throw new Error('Porsche detail exceeds reviewed size bound.');
  const identities: unknown[] = [],
    visualizers: unknown[] = [],
    details: unknown[] = [];
  for (const island of html.matchAll(/<astro-island\b[^>]*>/g)) {
    const p = /(?:^|\s)props=(?:"([^"]*)"|'([^']*)')/.exec(island[0]);
    if (!p) continue;
    const raw = JSON.parse(porscheText(p[1] ?? p[2]!)) as Record<string, unknown>;
    if (
      ['locale', 'modelYear', 'modelCode', 'countrySpecificationCode'].every((k) =>
        Object.hasOwn(raw, k),
      )
    )
      identities.push(
        Object.fromEntries(
          ['locale', 'modelYear', 'modelCode', 'countrySpecificationCode'].map((k) => [
            k,
            astro(raw[k]),
          ]),
        ),
      );
    if (['locale', 'modelYear', 'orderType'].every((k) => Object.hasOwn(raw, k)))
      visualizers.push({
        locale: astro(raw.locale),
        modelYear: astro(raw.modelYear),
        modelCode: astro(raw.orderType),
      });
    if (Object.hasOwn(raw, 'headingTechnicalData') && Object.hasOwn(raw, 'initial'))
      details.push(astro(raw.initial));
  }
  if (!model.builderUrl && (!details.length || (!identities.length && !visualizers.length)))
    return porscheDetailSchema.parse({
      modelId: model.id,
      identityKind: 'menu-only',
      rows: [],
      equipment: [],
    });
  if (
    identities.length > 1 ||
    (identities.length === 0 && visualizers.length !== 1) ||
    details.length !== 1
  )
    throw new Error('Porsche detail identity/technical data missing or duplicated.');
  const identity = z
    .object({
      locale: z.literal('en-CA'),
      modelYear: z.string().regex(/^20\d{2}$/),
      modelCode: code,
      countrySpecificationCode: z.literal('C36').optional(),
    })
    .parse(identities[0] ?? visualizers[0]);
  if (identities.length && identity.countrySpecificationCode !== 'C36')
    throw new Error('Porsche Canadian country code missing.');
  const row = z.object({
    id: text,
    label: text,
    value: z.string(),
    annotation: z.string().nullish(),
  });
  const d = z
    .object({
      modelVariantCode: code,
      technicalData: z.object({
        name: text,
        categories: z.array(z.object({ id: text, attributes: z.array(row) })),
      }),
      standardEquipment: z.object({
        name: text,
        categories: z.array(
          z.object({
            equipment: z.array(
              z.object({ id: text, name: text, description: z.string().optional() }),
            ),
          }),
        ),
      }),
    })
    .parse(details[0]);
  if (
    identity.modelCode !== model.code ||
    Number(identity.modelYear) !== model.year ||
    d.modelVariantCode !== model.code ||
    d.technicalData.name !== model.name ||
    d.standardEquipment.name !== model.name
  )
    throw new Error('Porsche detail exact model/year identity conflicts.');
  const result = porscheDetailSchema.parse({
    modelId: model.id,
    identityKind: identities.length ? 'country-model-footer' : 'model-visualizer',
    rows: d.technicalData.categories.flatMap((c) =>
      c.attributes.map((r) => ({
        category: c.id,
        id: r.id,
        label: porscheText(r.label),
        value: porscheText(r.value),
        annotation: r.annotation ?? null,
      })),
    ),
    equipment: d.standardEquipment.categories.flatMap((c) =>
      c.equipment.map((e) => ({
        id: e.id,
        name: porscheText(e.name),
      })),
    ),
  });
  if (
    model.fuel === 'HYBRID' &&
    !result.rows.some(
      (r) =>
        r.category === 'chargingCategory' &&
        /^chargingTimeAC/.test(r.id) &&
        /\d+(?:\.\d+)? h$/.test(r.value),
    )
  )
    throw new Error('Porsche plug-in charging evidence is missing.');
  return result;
}

export const porscheClients = [
  {
    file: 'customer-configurator.route-CYVjsHr4.js',
    sha256: '72a0348e70deab9004987fa22a515d9dc79a191a700df983fdac6e4e0edda945',
  },
  {
    file: 'app-search-params-DnJVjvQS.js',
    sha256: '93f696ad111fd7ce7dfc568f30ea9b7856cc58c2a89a269ad574bc8c5b7978dc',
  },
  {
    file: 'params-C2wJ5HMj.js',
    sha256: '484d662ab0a0a5b2e4bcd7658fbc90a714fd9bc0eca044ab431d2e0e743baebd',
  },
  {
    file: 'financial-services-Bc31xzmB.js',
    sha256: 'ced1dc0b12346fc7bc82d4d45fdc3ce2ad5b841428089a8e2197675fbee27027',
  },
].map((c) => ({ ...c, url: `${porscheBuilderOrigin}/public/${c.file}` }));
const profileSchema = z.strictObject({
  key: text,
  source: porscheReceiptSchema,
  data: porscheFactorySchema,
  selection: z
    .strictObject({ parentKey: text, optionId: text, replacedId: text.nullable() })
    .nullable(),
});
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  market: z.literal('CA'),
  currency: z.literal('CAD'),
  retrievedAt: z.iso.datetime(),
  overviewSource: porscheReceiptSchema,
  clients: z.array(porscheReceiptSchema),
  models: z
    .array(
      z.strictObject({
        reference: porscheModelSchema,
        detail: z.strictObject({ source: porscheReceiptSchema, data: porscheDetailSchema }),
        initial: z
          .strictObject({ source: porscheReceiptSchema, data: porscheFactorySchema })
          .nullable(),
        profiles: z.array(profileSchema),
      }),
    )
    .min(1),
});
export type PorscheSnapshot = z.infer<typeof snapshotSchema>;
export function validatePorscheSnapshot(input: unknown): PorscheSnapshot {
  const s = snapshotSchema.parse(input),
    receipts = [s.overviewSource, ...s.clients];
  function source(r: z.infer<typeof porscheReceiptSchema>, url: string) {
    if (r.status !== 200 || r.url !== url)
      throw new Error('Porsche required source HTTP/URL context changed.');
    receipts.push(r);
  }
  source(s.overviewSource, porscheLineupUrl);
  if (s.clients.length !== porscheClients.length)
    throw new Error('Porsche native selection clients incomplete.');
  for (const c of porscheClients) {
    const found = s.clients.filter((r) => r.url === c.url);
    if (found.length !== 1 || found[0]!.sha256 !== c.sha256)
      throw new Error('Porsche native selection client changed; review before refresh.');
    source(found[0]!, c.url);
  }
  if (new Set(s.models.map((m) => m.reference.id)).size !== s.models.length)
    throw new Error('Duplicate Porsche menu identity.');
  for (const row of s.models) {
    const m = row.reference,
      d = row.detail.data;
    if (m.id !== `${m.code}-${m.year}` || d.modelId !== m.id)
      throw new Error('Porsche model/detail identity conflict.');
    source(row.detail.source, m.detailUrl);
    if (d.identityKind === 'menu-only' && (m.builderUrl || d.rows.length || d.equipment.length))
      throw new Error('Porsche unqualified detail acquired unsupported facts.');
    if (!m.builderUrl) {
      if (row.initial || row.profiles.length)
        throw new Error('Porsche menu-only model acquired factory records.');
      continue;
    }
    if (m.builderUrl !== porscheBuilderUrl(m.code) || !row.initial)
      throw new Error('Porsche linked factory initializer missing.');
    source(row.initial.source, m.builderUrl);
    const initial = row.initial.data,
      byKey = new Map(row.profiles.map((p) => [p.key, p]));
    if (
      (initial.engineType === 'electric') !== (m.fuel === 'ELECTRIC') ||
      (initial.engineType === 'hybrid') !== (m.fuel === 'HYBRID') ||
      (m.fuel === 'HYBRID' &&
        !d.rows.some(
          (r) =>
            r.category === 'chargingCategory' &&
            /^chargingTimeAC/.test(r.id) &&
            /\d+(?:\.\d+)? h$/.test(r.value),
        ))
    )
      throw new Error('Porsche exact powertrain/plug-in source evidence conflicts.');
    if (
      initial.modelId !== m.id ||
      initial.name !== m.name ||
      initial.code !== m.code ||
      initial.year !== m.year
    )
      throw new Error('Porsche initial model/year context conflicts.');
    if (byKey.size !== row.profiles.length) throw new Error('Duplicate Porsche factory profile.');
    const expected = initial.transmissionChoices.flatMap((t) => [
      `${m.id}/${t.id}/base`,
      ...(initial.rearSeatOption ? [`${m.id}/${t.id}/rear`] : []),
    ]);
    if (expected.length !== row.profiles.length || expected.some((k) => !byKey.has(k)))
      throw new Error('Porsche complete transmission/rear-seat coverage does not reconcile.');
    for (const p of row.profiles) {
      if (
        !p.data.transmission ||
        p.key !== porscheProfileKey(p.data) ||
        p.data.modelId !== m.id ||
        p.data.code !== m.code ||
        p.data.year !== m.year ||
        p.data.name !== m.name ||
        p.data.engineType !== initial.engineType
      )
        throw new Error('Porsche selected profile model/year/transmission identity conflicts.');
      if (p.selection) {
        if (
          p.selection.optionId === '3UG'
            ? p.selection.parentKey !== `${m.id}/${p.data.transmission.id}/base` ||
              p.selection.replacedId !== null
            : p.selection.parentKey !== 'initial' ||
              p.selection.replacedId !== (initial.transmission?.id ?? null)
        )
          throw new Error('Porsche native selection topology changed.');
        const parent =
          p.selection.parentKey === 'initial' ? initial : byKey.get(p.selection.parentKey)?.data;
        if (!parent || parent === p.data || p.selection.parentKey === p.key)
          throw new Error('Porsche selection parent missing or cyclic.');
        source(
          p.source,
          porscheSelectionUrl(parent, p.selection.optionId, p.selection.replacedId ?? undefined),
        );
        if (
          !p.data.selectedOptions.includes(p.selection.optionId) ||
          (p.selection.optionId === '3UG'
            ? !p.data.rearSeatOption?.selected
            : p.data.transmission.id !== p.selection.optionId)
        )
          throw new Error('Porsche selected native option was not honored.');
      } else {
        source(p.source, m.builderUrl);
        if (JSON.stringify(p.data) !== JSON.stringify(initial))
          throw new Error('Porsche default profile differs from its initializer.');
      }
    }
  }
  const times = receipts.map((r) => r.capturedAt).sort();
  if (
    s.retrievedAt !== times.at(-1) ||
    Date.parse(times.at(-1)!) - Date.parse(times[0]!) > 86400000
  )
    throw new Error('Porsche source capture window/review date does not reconcile.');
  return s;
}
export function porscheNoRegression(previous: PorscheSnapshot, next: PorscheSnapshot) {
  if (Date.parse(next.retrievedAt) < Date.parse(previous.retrievedAt))
    throw new Error('Porsche refresh would use older evidence.');
  for (const p of previous.models) {
    const n = next.models.find((m) => m.reference.id === p.reference.id);
    if (!n || p.profiles.some((profile) => !n.profiles.some((v) => v.key === profile.key)))
      throw new Error(
        'Porsche refresh would lose an offering/model year/equipment profile; reconcile remaining new vehicles.',
      );
  }
}
