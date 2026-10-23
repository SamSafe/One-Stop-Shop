import { z } from 'zod';

const text = z.string().min(1),
  money = z.number().finite();
const year = z.coerce.number().int().min(1990).max(2100);
export const mercedesCarOrigin = 'https://www.mercedes-benz.ca';
export const mercedesVanOrigin = 'https://www.mercedes-benz-vans.ca';
export const mercedesReceiptSchema = z.strictObject({
  url: z.url().refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      [
        'www.mercedes-benz.ca',
        'www.mercedes-benz-vans.ca',
        'nafta-service.mbusa.com',
        'nafta-service.mbvans.com',
      ].includes(u.hostname)
    );
  }),
  status: z.number().int().min(100).max(599),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type MercedesReceipt = z.infer<typeof mercedesReceiptSchema>;

// Extract a JSON literal from its published assignment. Only JSON.parse sees
// the data; the surrounding application JavaScript is never evaluated.
export function mercedesJson(html: string, marker: RegExp): unknown {
  if (html.length > 10_000_000) throw new Error('Mercedes source exceeds the reviewed size bound.');
  const match = marker.exec(html);
  if (!match) throw new Error('Mercedes required source assignment is missing.');
  let offset = match.index + match[0].length;
  while (/\s/.test(html[offset] ?? '') && offset < html.length) offset++;
  const start = offset,
    stack: string[] = [];
  let quoted = false,
    escaped = false;
  if (!['{', '['].includes(html[start] ?? ''))
    throw new Error('Mercedes assignment is not a JSON container.');
  for (; offset < html.length; offset++) {
    const c = html[offset]!;
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') {
      if (stack.pop() !== c) throw new Error('Mercedes JSON delimiters do not reconcile.');
      if (!stack.length) return JSON.parse(html.slice(start, offset + 1)) as unknown;
    }
  }
  throw new Error('Truncated Mercedes source JSON.');
}
export function mercedesContext(html: string, van: boolean) {
  const namespace = van ? 'mbVans' : 'mbNafta';
  for (const [field, expected] of [
    ['country', 'ca'],
    ['currency', 'CAD'],
  ]) {
    const pattern = new RegExp(
      `${namespace}\\.ns\\(['"]pageData['"]\\)\\.${field}\\s*=\\s*['"]([^'"]+)['"]`,
      'g',
    );
    const values = [...html.matchAll(pattern)].map((m) => m[1]);
    if (!values.length || values.some((v) => v !== expected))
      throw new Error(`Mercedes explicit Canadian ${field} context is missing or conflicting.`);
  }
}
const navModelSchema = z.object({
  modelPath: text,
  modelPage: text,
  modelBuildPage: text.optional(),
  year,
  isInactive: z.boolean(),
  isComingSoon: z.boolean(),
  modelName: text,
  model: z.object({
    code: text,
    year,
    name: text,
    fuelType: text.optional(),
    isEQ: z.boolean(),
    vehicleClass: z.object({ code: text, name: text }),
    vehicleBodystyle: z.object({ code: text, name: text }),
  }),
});
export type MercedesReference = {
  key: string;
  model: string;
  year: number;
  name: string;
  family: string;
  group: string;
  classCode: string;
  bodyCode: string;
  modelPath: string;
  page: string;
  builder: string | null;
  inactive: boolean;
  comingSoon: boolean;
  fuelType: string | null;
  electric: boolean;
};
export function mercedesLineup(html: string): MercedesReference[] {
  mercedesContext(html, false);
  const groups = z
    .array(
      z.object({
        bodyGroup: text,
        jellyBeanList: z
          .array(
            z.object({
              displayName: text.optional(),
              activeVehicleModelList: z.array(navModelSchema).optional(),
            }),
          )
          .optional(),
      }),
    )
    .parse(
      mercedesJson(html, /mbNafta\.ns\('pageData', 'globalVehicleNavHierarchy'\)\.content\s*=\s*/),
    );
  const models = new Map<string, MercedesReference>();
  for (const group of groups)
    for (const family of group.jellyBeanList ?? [])
      for (const row of family.activeVehicleModelList ?? []) {
        if (
          row.year !== row.model.year ||
          row.modelName !== row.model.name ||
          !row.modelPath.includes(`/en_ca/models/${row.year}/`) ||
          !row.modelPath.toLowerCase().endsWith('/' + row.model.code.toLowerCase())
        )
          throw new Error('Mercedes menu model/year identity does not reconcile.');
        const key = `${row.year}/${row.model.code}`,
          prior = models.get(key);
        const reference: MercedesReference = {
          key,
          model: row.model.code,
          year: row.year,
          name: row.modelName,
          family:
            family.displayName ??
            `${row.model.vehicleClass.name} ${row.model.vehicleBodystyle.name}`,
          group: group.bodyGroup,
          classCode: row.model.vehicleClass.code,
          bodyCode: row.model.vehicleBodystyle.code,
          modelPath: row.modelPath,
          fuelType: row.model.fuelType ?? null,
          electric: row.model.isEQ,
          page: new URL(row.modelPage, mercedesCarOrigin).href,
          builder: row.modelBuildPage ? new URL(row.modelBuildPage, mercedesCarOrigin).href : null,
          inactive: row.isInactive,
          comingSoon: row.isComingSoon,
        };
        if (
          ![reference.page, ...(reference.builder ? [reference.builder] : [])].every(
            (u) => new URL(u).origin === mercedesCarOrigin,
          )
        )
          throw new Error('Mercedes menu links leave the reviewed Canadian origin.');
        if (prior) {
          const { family: _family, group: _group, ...identity } = reference;
          const { family: _oldFamily, group: _oldGroup, ...oldIdentity } = prior;
          if (JSON.stringify(identity) !== JSON.stringify(oldIdentity))
            throw new Error('Conflicting Mercedes menu duplicates.');
        } else models.set(key, reference);
      }
  if (!models.size) throw new Error('Mercedes Canadian model menu is empty.');
  return [...models.values()].sort((a, b) => a.key.localeCompare(b.key));
}
export function mercedesMenuPlaceholders(html: string) {
  mercedesContext(html, false);
  const groups = z
    .array(
      z.object({
        jellyBeanList: z
          .array(
            z.object({
              displayName: text.optional(),
              classPageUrl: text.optional(),
              activeVehicleModelList: z.array(z.unknown()).optional(),
            }),
          )
          .optional(),
      }),
    )
    .parse(
      mercedesJson(html, /mbNafta\.ns\('pageData', 'globalVehicleNavHierarchy'\)\.content\s*=\s*/),
    );
  return [
    ...new Set(
      groups.flatMap((g) =>
        (g.jellyBeanList ?? [])
          .filter((c) => !c.activeVehicleModelList?.length)
          .map((c) => {
            if (!c.classPageUrl)
              throw new Error('Mercedes menu placeholder has no reviewable class link.');
            const url = new URL(c.classPageUrl, mercedesCarOrigin);
            if (url.origin !== mercedesCarOrigin)
              throw new Error('Mercedes menu placeholder leaves Canadian origin.');
            return url.href;
          }),
      ),
    ),
  ].sort();
}
const priceSchema = z.object({
  'ns2:amount': z.union([
    z.number().finite(),
    z
      .string()
      .regex(/^-?\d+(?:\.\d+)?$/)
      .transform(Number),
  ]),
  'ns2:type': text,
});
type MercedesOption = {
  id: string;
  type: 'BOOLEAN' | 'PACKAGE' | 'PICK_LIST';
  price: number | null;
  implied: string[];
};
type RawOption = {
  'ns2:id': string;
  'ns2:type': MercedesOption['type'];
  'ns2:price'?: z.infer<typeof priceSchema> | z.infer<typeof priceSchema>[];
  'ns2:implied'?: RawOption | RawOption[];
};
const rawOptionSchema: z.ZodType<RawOption> = z.lazy(() =>
  z.object({
    'ns2:id': text,
    'ns2:type': z.enum(['BOOLEAN', 'PACKAGE', 'PICK_LIST']),
    'ns2:price': z.union([priceSchema, z.array(priceSchema)]).optional(),
    'ns2:implied': z.union([rawOptionSchema, z.array(rawOptionSchema)]).optional(),
  }),
);
export const mercedesTreeSchema = z.object({
  Response: z.object({
    value: z.object({
      'ns2:model': z.object({
        'ns2:id': text,
        'ns2:type': z.literal('MODEL'),
        'ns2:price': z.union([priceSchema, z.array(priceSchema)]),
      }),
      'ns2:options': z.array(rawOptionSchema),
    }),
  }),
});
const normalizedPrice = (amount: number) =>
  amount < 0 || [4444, 5555, 7777, 9999, 444444, 555555, 777777, 999999].includes(amount)
    ? null
    : amount;
const ofType = (
  p: z.infer<typeof priceSchema> | z.infer<typeof priceSchema>[] | undefined,
  type: string,
) => {
  const rows = (p ? (Array.isArray(p) ? p : [p]) : []).filter((p) => p['ns2:type'] === type);
  if (rows.length > 1) throw new Error('Ambiguous Mercedes price components.');
  return rows.length ? normalizedPrice(rows[0]!['ns2:amount']) : null;
};
export function mercedesOptionTree(input: unknown, model: string, modelYear: number) {
  const value = mercedesTreeSchema.parse(input).Response.value,
    root = value['ns2:model'];
  if (root['ns2:id'] !== `${modelYear}-${model}`)
    throw new Error('Mercedes option tree model-year mismatch.');
  const options = new Map<string, MercedesOption>();
  function visit(row: RawOption) {
    const children = row['ns2:implied']
      ? Array.isArray(row['ns2:implied'])
        ? row['ns2:implied']
        : [row['ns2:implied']]
      : [];
    const option: MercedesOption = {
      id: row['ns2:id'],
      type: row['ns2:type'],
      price: ofType(row['ns2:price'], 'ITEM'),
      implied: children.map((r) => r['ns2:id']),
    };
    const prior = options.get(option.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(option))
      throw new Error('Conflicting Mercedes option definitions.');
    options.set(option.id, option);
    for (const child of children) visit(child);
  }
  for (const option of value['ns2:options']) visit(option);
  return { baseMsrpCad: ofType(root['ns2:price'], 'MSRP'), options: [...options.values()] };
}
export function mercedesPrice(
  tree: ReturnType<typeof mercedesOptionTree>,
  selected: readonly string[],
) {
  const options = new Map(tree.options.map((o) => [o.id, o]));
  if (new Set(selected).size !== selected.length || selected.some((c) => !options.has(c)))
    throw new Error('Mercedes selected price components are missing or duplicated.');
  if (selected.some((c) => options.get(c)!.type === 'PICK_LIST'))
    throw new Error(
      'Mercedes selection must identify a concrete option, not an abstract choice group.',
    );
  const expanded = new Set<string>(),
    included = new Set<string>(),
    visiting = new Set<string>();
  function expand(code: string, parent: boolean) {
    if (visiting.has(code)) throw new Error('Cyclic Mercedes package inclusion.');
    const option = options.get(code);
    if (!option) throw new Error('Unknown Mercedes package component.');
    if (parent) included.add(code);
    expanded.add(code);
    visiting.add(code);
    for (const child of option.implied) expand(child, option.type !== 'PICK_LIST');
    visiting.delete(code);
  }
  for (const code of selected) expand(code, false);
  if (tree.baseMsrpCad === null) return null;
  let total = tree.baseMsrpCad;
  for (const code of expanded) {
    const option = options.get(code)!;
    if (included.has(code) || option.type === 'PICK_LIST') continue;
    if (option.price === null) return null;
    total += option.price;
  }
  return total;
}
const builderContentSchema = z.object({
  valid: z.literal(true),
  model: text,
  year,
  vehicleName: text,
  class: text,
  bodyStyle: text,
  msrp: money,
  useCCS: z.boolean(),
  useCCSPrice: z.boolean().optional(),
  country: z.literal('ca').optional(),
  fuelType: text.optional(),
  cylinder: text.optional(),
  defaultVariant: text.optional(),
  lineId: z.union([z.string(), z.number().finite()]).optional(),
});
export function mercedesBuilder(
  html: string,
  expectedModel: string,
  expectedYear: number,
  van: boolean,
) {
  mercedesContext(html, van);
  const content = builderContentSchema.parse(mercedesJson(html, /^\s*MODEL_BYO_CONTENT:\s*/m));
  if (
    content.model !== expectedModel ||
    content.year !== expectedYear ||
    (!van && content.country !== 'ca')
  )
    throw new Error('Mercedes factory builder model/year/country mismatch.');
  if ((!van && content.useCCSPrice !== false) || (van && content.useCCS))
    throw new Error('Mercedes active price mode needs renewed review.');
  if (content.useCCS) {
    const ccs = builderContentSchema.parse(mercedesJson(html, /^\s*MODEL_BYO_CONTENT_CCS:\s*/m));
    if (
      ccs.model !== content.model ||
      ccs.year !== content.year ||
      ccs.msrp !== content.msrp ||
      ccs.country !== 'ca' ||
      ccs.useCCSPrice !== false
    )
      throw new Error('Mercedes active CCS content and legacy price basis disagree.');
    if (
      !/enableCCSPricing:\s*mbNafta\.pageData\.byo\.config\.MODEL_BYO_CONTENT_CCS\.useCCSPrice\s*,/.test(
        html,
      )
    )
      throw new Error('Mercedes active price selector changed; review before importing.');
  }
  const tree = mercedesOptionTree(
    mercedesJson(html, /^\s*MODEL_BUILD_OPTIONTREE:\s*/m),
    expectedModel,
    expectedYear,
  );
  if (normalizedPrice(content.msrp) !== tree.baseMsrpCad)
    throw new Error('Mercedes published base MSRP and active price tree disagree.');
  let defaults = mercedesJson(html, /^\s*MODEL_BUILD_DEF_OPTIONS:\s*/m);
  if (content.useCCS && !content.lineId) {
    const ccs = z
      .record(z.string(), z.unknown())
      .parse(mercedesJson(html, /^\s*MODEL_BUILD_DEF_OPTIONS_CCS:\s*/m));
    if (Object.keys(ccs).length) defaults = ccs;
  }
  const rawDefaults = mercedesTreeSchema.parse(defaults).Response.value;
  if (rawDefaults['ns2:model']['ns2:id'] !== `${expectedYear}-${expectedModel}`)
    throw new Error('Mercedes default model year mismatch.');
  const selected = rawDefaults['ns2:options'].map((o) => o['ns2:id']);
  const msrpCad = mercedesPrice(tree, selected);
  return { content, tree, selected, msrpCad };
}

const vehicleSchema = z.strictObject({
  model: text,
  name: text,
  class: text,
  year,
  bodyStyle: text,
  msrp: z.coerce.number().finite().min(10000).max(10000000),
});
const specificationSchema = z.strictObject({ name: text, value: text });
export function mercedesText(input: string) {
  const named: Record<string, string> = {
    amp: '&',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    lt: '<',
    gt: '>',
    ndash: '–',
    mdash: '—',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
    deg: '°',
    times: '×',
    reg: '®',
    trade: '™',
    sup2: '²',
  };
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (!code.startsWith('#')) return named[code.toLowerCase()] ?? entity;
      const number =
        code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}
export function mercedesModelPage(html: string, model: string, modelYear: number) {
  mercedesContext(html, false);
  // Only the six leading quoted fields of this bare JavaScript object are read.
  // Images, embedded objects and all executable JavaScript are left untouched.
  const string = '("(?:[^"\\\\]|\\\\.)*")';
  const fields = ['model', 'name', 'class', 'year', 'bodyStyle', 'msrp'];
  const match = new RegExp(
    `mbNafta\\.ns\\(['"]pageData['"]\\)\\.vehicle\\s*=\\s*\\{\\s*${fields.map((f) => `${f}:\\s*${string}\\s*,\\s*`).join('')}`,
  ).exec(html);
  if (!match) throw new Error('Mercedes explicit model-page metadata is missing or changed.');
  const vehicle = vehicleSchema.parse(
    Object.fromEntries(fields.map((field, i) => [field, JSON.parse(match[i + 1]!) as unknown])),
  );
  if (vehicle.model !== model || vehicle.year !== modelYear)
    throw new Error('Mercedes model-page year/model mismatch.');
  const rows: z.infer<typeof specificationSchema>[] = [];
  for (const block of html.matchAll(
    /<(div|li)\b[^>]*class="model-specs-list__item"[^>]*>([\s\S]*?)<\/\1>/g,
  )) {
    const name = /<span\b[^>]*class="model-specs-list__item-name"[^>]*>([\s\S]*?)<\/span>/.exec(
      block[2]!,
    );
    const value = /<span\b[^>]*class="model-specs-list__item-value"[^>]*>([\s\S]*?)<\/span>/.exec(
      block[2]!,
    );
    if (name && value && mercedesText(name[1]!) && mercedesText(value[1]!))
      rows.push({ name: mercedesText(name[1]!), value: mercedesText(value[1]!) });
  }
  if (!rows.length) throw new Error('Mercedes model-page specifications are empty.');
  return { vehicle, specifications: rows };
}
export const mercedesVanKinds = ['passenger-van', 'crew-van'] as const;
const vanReferenceSchema = z.strictObject({
  key: text,
  model: text,
  year,
  name: text,
  bodyCode: z.enum(['PV', 'CV']),
  variant: text,
  powertrain: text,
  powertrainLabel: text,
  wheelbase: text,
  seatingLabel: text,
  msrpCad: z.number().min(10000).max(10000000),
  builder: z.url(),
});
export function mercedesVanSelector(html: string, kind: (typeof mercedesVanKinds)[number]) {
  mercedesContext(html, true);
  const body = kind === 'passenger-van' ? 'PV' : 'CV';
  if (
    !html.includes(`vehicleBodystyleCode: "${body}"`) ||
    !html.includes('byoBuildPageUri: "/en/vehicles/build/{classCode}/{trimCode}/{modelCode}"')
  )
    throw new Error('Mercedes van selector body or builder template changed.');
  const data = z
    .object({
      activeModels: z.record(
        z.string(),
        z.object({
          modelCode: text,
          year,
          vehicleName: text,
          bodyStyle: z.enum(['PV', 'CV']),
          class: z.literal('SPRINTER'),
          filterAttributes: z.object({ powertrain: text, wheelbase: text }),
          model: z.object({ msrp: z.number().min(10000), defaultVariant: text }),
        }),
      ),
      filters: z.array(
        z.object({
          code: text,
          specifications: z.array(
            z.object({ value: text, title: text, variantType: text.optional() }),
          ),
        }),
      ),
    })
    .parse(
      mercedesJson(html, /mbVans\.ns\('pageData'\)\.byoTrimPage\s*=\s*\{[\s\S]{0,2400}?\bdata:\s*/),
    );
  const models = Object.entries(data.activeModels).map(([code, row]) => {
    if (code !== row.modelCode || row.bodyStyle !== body)
      throw new Error('Mercedes van selector identity mismatch.');
    const power = data.filters
      .find((f) => f.code === 'POWERTRAIN')
      ?.specifications.filter((s) => s.value === row.filterAttributes.powertrain);
    const size = data.filters
      .find((f) => f.code === 'WHEELBASE')
      ?.specifications.filter(
        (s) =>
          s.value === row.filterAttributes.wheelbase && s.variantType === row.model.defaultVariant,
      );
    if (power?.length !== 1 || size?.length !== 1)
      throw new Error('Mercedes van selector filters do not establish exact powertrain/roof.');
    return vanReferenceSchema.parse({
      key: `${row.year}/${code}`,
      model: code,
      year: row.year,
      name: row.vehicleName,
      bodyCode: body,
      variant: row.model.defaultVariant,
      powertrain: row.filterAttributes.powertrain,
      powertrainLabel: power[0]!.title,
      wheelbase: row.filterAttributes.wheelbase,
      seatingLabel: size[0]!.title,
      msrpCad: row.model.msrp,
      builder: `${mercedesVanOrigin}/en/vehicles/build/sprinter/${kind}/${code.toLowerCase()}`,
    });
  });
  if (!models.length) throw new Error('Mercedes van selector is empty.');
  return models.sort((a, b) => a.key.localeCompare(b.key));
}
const referenceSchema: z.ZodType<MercedesReference> = z.strictObject({
  key: text,
  model: text,
  year,
  name: text,
  family: text,
  group: text,
  classCode: text,
  bodyCode: text,
  modelPath: text,
  page: z.url(),
  builder: z.url().nullable(),
  inactive: z.boolean(),
  comingSoon: z.boolean(),
  fuelType: text.nullable(),
  electric: z.boolean(),
});
const normalizedBuilderSchema = z.strictObject({
  content: builderContentSchema,
  tree: z.strictObject({
    baseMsrpCad: money.nullable(),
    options: z
      .array(
        z.strictObject({
          id: text,
          type: z.enum(['BOOLEAN', 'PACKAGE', 'PICK_LIST']),
          price: money.nullable(),
          implied: z.array(text),
        }),
      )
      .min(1),
  }),
  selected: z.array(text).min(1),
  msrpCad: money.nullable(),
});
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  market: z.literal('CA'),
  currency: z.literal('CAD'),
  retrievedAt: z.iso.datetime(),
  overviewSource: mercedesReceiptSchema,
  menu: z.array(referenceSchema).min(1),
  expectedCarKeys: z.array(text).min(1),
  placeholders: z.array(z.url()),
  selectors: z.array(
    z.strictObject({
      kind: z.enum(mercedesVanKinds),
      source: mercedesReceiptSchema,
      models: z.array(vanReferenceSchema).min(1),
    }),
  ),
  cars: z.array(
    z.strictObject({
      key: text,
      source: mercedesReceiptSchema,
      vehicle: vehicleSchema,
      specifications: z.array(specificationSchema).min(1),
      builder: z
        .strictObject({ source: mercedesReceiptSchema, data: normalizedBuilderSchema })
        .nullable(),
    }),
  ),
  vans: z.array(
    z.strictObject({ key: text, source: mercedesReceiptSchema, data: normalizedBuilderSchema }),
  ),
});
export type MercedesSnapshot = z.infer<typeof snapshotSchema>;
const equalKeys = (a: readonly string[], b: readonly string[]) =>
  new Set(a).size === a.length &&
  new Set(b).size === b.length &&
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
export function validateMercedesSnapshot(input: unknown): MercedesSnapshot {
  const s = snapshotSchema.parse(input);
  function source(receipt: MercedesReceipt, url: string) {
    if (receipt.status !== 200 || receipt.url !== url)
      throw new Error('Mercedes required source URL or HTTP context changed.');
  }
  source(s.overviewSource, `${mercedesCarOrigin}/en/home`);
  if (
    !equalKeys(
      s.menu.map((m) => m.key),
      s.expectedCarKeys,
    ) ||
    !equalKeys(
      s.cars.map((m) => m.key),
      s.expectedCarKeys,
    )
  )
    throw new Error('Mercedes current menu model-year coverage is missing or duplicated.');
  function builder(
    data: z.infer<typeof normalizedBuilderSchema>,
    model: string,
    modelYear: number,
    van: boolean,
  ) {
    const c = data.content;
    if (
      c.model !== model ||
      c.year !== modelYear ||
      (!van && c.country !== 'ca') ||
      (!van && c.useCCSPrice !== false) ||
      (van && c.useCCS) ||
      c.msrp !== data.tree.baseMsrpCad ||
      new Set(data.tree.options.map((o) => o.id)).size !== data.tree.options.length ||
      mercedesPrice(data.tree, data.selected) !== data.msrpCad ||
      data.msrpCad !== c.msrp
    )
      throw new Error(
        'Mercedes default configuration identity or explicit base MSRP does not reconcile.',
      );
  }
  for (const m of s.menu) {
    if (
      m.key !== `${m.year}/${m.model}` ||
      !m.modelPath.includes(`/en_ca/models/${m.year}/`) ||
      !m.modelPath.toLowerCase().endsWith('/' + m.model.toLowerCase()) ||
      new URL(m.page).origin !== mercedesCarOrigin ||
      (m.builder && new URL(m.builder).origin !== mercedesCarOrigin)
    )
      throw new Error('Mercedes current menu identity or Canadian links changed.');
    const row = s.cars.find((c) => c.key === m.key)!;
    source(row.source, m.page);
    if (
      row.vehicle.model !== m.model ||
      row.vehicle.year !== m.year ||
      row.vehicle.class !== m.classCode ||
      row.vehicle.bodyStyle !== m.bodyCode
    )
      throw new Error('Mercedes exact model-page year/body identity changed.');
    if (m.builder) {
      if (!row.builder) throw new Error('Mercedes current builder coverage is missing.');
      source(row.builder.source, m.builder);
      builder(row.builder.data, m.model, m.year, false);
      if (
        row.builder.data.content.class !== m.classCode ||
        row.builder.data.content.bodyStyle !== m.bodyCode
      )
        throw new Error('Mercedes exact builder class/body identity changed.');
      if (
        row.builder.data.msrpCad !== row.vehicle.msrp &&
        !(
          row.key === '2026/C300W4' &&
          row.vehicle.msrp === 51650 &&
          row.builder.data.msrpCad === 62250
        )
      )
        throw new Error('Unreviewed Mercedes exact model-page and factory price conflict.');
    } else if (row.builder)
      throw new Error('Unlisted Mercedes factory builder cannot imply orderability.');
  }
  if (
    !equalKeys(
      s.selectors.map((v) => v.kind),
      mercedesVanKinds,
    )
  )
    throw new Error('Mercedes passenger/crew selector coverage is missing or duplicated.');
  const vanKeys: string[] = [];
  for (const selector of s.selectors) {
    source(selector.source, `${mercedesVanOrigin}/en/vehicles/build/sprinter/${selector.kind}`);
    for (const m of selector.models) {
      vanKeys.push(m.key);
      if (
        m.key !== `${m.year}/${m.model}` ||
        m.bodyCode !== (selector.kind === 'passenger-van' ? 'PV' : 'CV') ||
        m.builder !==
          `${mercedesVanOrigin}/en/vehicles/build/sprinter/${selector.kind}/${m.model.toLowerCase()}`
      )
        throw new Error('Mercedes van selector model/year/body context changed.');
      const row = s.vans.find((v) => v.key === m.key);
      if (!row) throw new Error('Mercedes van builder coverage is missing.');
      source(row.source, m.builder);
      builder(row.data, m.model, m.year, true);
      if (
        row.data.msrpCad !== m.msrpCad ||
        row.data.content.bodyStyle !== m.bodyCode ||
        row.data.content.defaultVariant !== m.variant
      )
        throw new Error('Mercedes van selector and exact builder disagree.');
    }
  }
  if (
    !equalKeys(
      vanKeys,
      s.vans.map((v) => v.key),
    )
  )
    throw new Error('Mercedes van coverage is missing or duplicated.');
  return s;
}
export function mercedesRequireNoRegression(previous: MercedesSnapshot, next: MercedesSnapshot) {
  const keys = new Set([...next.cars, ...next.vans].map((r) => r.key));
  if ([...previous.cars, ...previous.vans].some((r) => !keys.has(r.key)))
    throw new Error(
      'Mercedes refresh would remove a previously represented model year. Reconcile new stock or record a reviewed removal before replacing the snapshot.',
    );
}
