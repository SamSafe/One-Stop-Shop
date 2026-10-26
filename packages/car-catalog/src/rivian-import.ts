import { z } from 'zod';

const text = z.string().min(1);
const money = z.number().finite().nonnegative();
const flag = z.boolean().nullish();
const condition = z.discriminatedUnion('is', [
  z.strictObject({ is: z.enum(['set', 'unset']), option: text }),
  z.strictObject({
    is: z.literal('quantity'),
    option: text,
    quantity: z.number().int().positive(),
  }),
]);
const update = z.strictObject({
  option: text,
  price: money.optional(),
  disabled: z.boolean().optional(),
  hidden: z.boolean().optional(),
  required: z.boolean().optional(),
});
const ruleSchema = z
  .strictObject({
    when: condition.optional(),
    whenAll: z.array(condition).min(1).optional(),
    then: z.strictObject({
      update: z.array(update).optional(),
      select: z.array(text).optional(),
      unselect: z.array(text).optional(),
    }),
  })
  .refine((r) => Boolean(r.when) !== Boolean(r.whenAll), 'Exactly one condition kind is required.');
export const rivianRulesSchema = z.object({
  meta: z.object({
    rulesetId: text,
    country: z.literal('CA'),
    currency: z.literal('CAD'),
    locale: z.literal('en-CA'),
    vehicle: z.enum(['R1S', 'R1T']),
    version: text,
    effectiveDate: text,
  }),
  defaults: z.object({ basePrice: money.positive(), initialSelection: z.array(text).min(1) }),
  groups: z.record(
    text,
    z.object({
      fullName: z.object({ 'en-CA': text }),
      multiselect: z.boolean(),
      required: z.boolean(),
      options: z.array(text).min(1),
    }),
  ),
  options: z.record(
    text,
    z.object({
      fullName: z.object({ 'en-CA': text }),
      price: money,
      disabled: flag,
      hidden: flag,
      required: flag,
      tempUnavailable: flag,
      availableInFuture: flag,
      orderItem: flag,
      availability: z.array(text).nullish(),
    }),
  ),
  rules: z.array(ruleSchema),
});
export type RivianRules = z.infer<typeof rivianRulesSchema>;
type Rule = RivianRules['rules'][number];
type Condition = z.infer<typeof condition>;
type Flag = 'disabled' | 'hidden' | 'required' | 'tempUnavailable' | 'availableInFuture';
const conditions = (rule: Rule) => rule.whenAll ?? [rule.when!];
// These vehicle profiles contain each selected code once, matching the client's
// empty optionsQuantity map. Multi-quantity accessory orders are outside scope.
const matches = (c: Condition, selection: readonly string[]) =>
  c.is === 'quantity'
    ? selection.includes(c.option) && c.quantity <= 1
    : selection.includes(c.option) === (c.is === 'set');
const active = (r: Rule, selection: readonly string[]) =>
  conditions(r).every((c) => matches(c, selection));

export function validateRivianRules(input: unknown): RivianRules {
  const r = rivianRulesSchema.parse(input);
  const members = Object.values(r.groups).flatMap((g) => g.options);
  if (
    new Set(members).size !== members.length ||
    members.length !== Object.keys(r.options).length ||
    members.some((code) => !r.options[code]) ||
    r.defaults.initialSelection.some((code) => !r.options[code])
  )
    throw new Error('Rivian option/group identities do not reconcile.');
  if (
    !r.groups.MODEL_YEAR ||
    r.groups.MODEL_YEAR.options.some((y) => !/^20\d{2}$/.test(y)) ||
    !r.groups.RGN?.options.includes('RGN-CAN')
  )
    throw new Error('Rivian explicit Canadian model-year identity is missing.');
  for (const rule of r.rules) {
    const references = [
      ...conditions(rule).map((c) => c.option),
      ...(rule.then.update ?? []).map((u) => u.option),
      ...(rule.then.select ?? []),
      ...(rule.then.unselect ?? []),
    ];
    if (references.some((code) => !r.options[code]))
      throw new Error('Rivian rule references an unknown option.');
  }
  return r;
}

export function rivianFlag(r: RivianRules, selection: readonly string[], code: string, key: Flag) {
  if (!r.options[code]) throw new Error(`Unknown Rivian option ${code}.`);
  return Boolean(
    r.options[code][key] ||
    r.rules.some(
      (rule) =>
        active(rule, selection) &&
        rule.then.update?.some((u) => u.option === code && u[key as keyof typeof u] === true),
    ),
  );
}
export function rivianOptionPrice(r: RivianRules, selection: readonly string[], code: string) {
  const option = r.options[code];
  if (!option) throw new Error(`Unknown Rivian priced option ${code}.`);
  const changes = r.rules
    .filter((rule) => active(rule, selection))
    .flatMap((rule) => rule.then.update ?? [])
    .filter((u) => u.option === code && u.price !== undefined)
    .map((u) => u.price!);
  return changes.length ? Math.min(...changes) : option.price;
}
export function rivianFactoryPrice(r: RivianRules, selection: readonly string[]) {
  if (new Set(selection).size !== selection.length)
    throw new Error('Duplicate Rivian selected price component.');
  return (
    r.defaults.basePrice +
    selection.reduce((n, code) => n + rivianOptionPrice(r, selection, code), 0)
  );
}

// Selection effects run on the changed option's event, not repeatedly for every
// currently true condition. Reapplying all rules would erase deliberate upgrades.
export function rivianChange(
  rules: RivianRules,
  initial: readonly string[],
  option: string,
  select = true,
) {
  let remaining = 10000;
  function change(selection: string[], code: string, set: boolean): string[] {
    if (--remaining <= 0) throw new Error('Rivian selection rules did not terminate.');
    if (!rules.options[code]) throw new Error(`Unknown Rivian selection ${code}.`);
    if (selection.includes(code) === set) return selection;
    let next = [...selection];
    if (set) {
      const group = Object.values(rules.groups).find((g) => g.options.includes(code));
      if (!group) throw new Error('Rivian selection has no group.');
      if (!group.multiselect)
        for (const sibling of group.options)
          if (sibling !== code) next = change(next, sibling, false);
      next.push(code);
    } else next = next.filter((c) => c !== code);
    const triggered = rules.rules.filter(
      (rule) =>
        conditions(rule).some(
          (c) =>
            c.option === code && (c.is === (set ? 'set' : 'unset') || (set && c.is === 'quantity')),
        ) && active(rule, next),
    );
    for (const rule of triggered) {
      if (!active(rule, next)) continue;
      for (const removed of rule.then.unselect ?? []) next = change(next, removed, false);
      for (const added of rule.then.select ?? []) next = change(next, added, true);
    }
    return next;
  }
  return change([...initial], option, select);
}
function selectionValid(r: RivianRules, selection: readonly string[], omitted = new Set<string>()) {
  return (
    new Set(selection).size === selection.length &&
    selection.every((code) => r.options[code] && !rivianFlag(r, selection, code, 'disabled')) &&
    Object.values(r.groups).every((g) => {
      const count = g.options.filter((c) => selection.includes(c)).length;
      return (!g.required || count > 0) && (g.multiselect || count <= 1);
    }) &&
    Object.keys(r.options).every(
      (code) =>
        selection.includes(code) ||
        omitted.has(code) ||
        !rivianFlag(r, selection, code, 'required'),
    )
  );
}
export function rivianSelectionValid(r: RivianRules, selection: readonly string[]) {
  return selectionValid(r, selection);
}
export function rivianStockSelectionValid(r: RivianRules, selection: readonly string[]) {
  // Stock marketing rows omit these separately serialized adapters. Accept only
  // the reviewed codes when their exact active rules make them free. This does
  // not add an accessory or claim that it is included with a stock vehicle.
  const omitted = new Set(
    ['PROC40WJ94', 'PROC7DQTIG'].filter(
      (code) =>
        r.groups.ACCESSORIES?.options.includes(code) && rivianOptionPrice(r, selection, code) === 0,
    ),
  );
  return selectionValid(r, selection, omitted);
}

export const rivianExpandedGroups = ['BLD', 'DTN', 'SWUP', 'BUND', 'SEAT', 'WHL', 'INT'] as const;
export const rivianIdentityGroups = ['BLD', 'DTN', 'SWUP', 'BUND', 'SEAT', 'ATP', 'WHLPKG', 'UND'];
export const rivianSelectionKey = (selection: readonly string[]) => [...selection].sort().join('_');
export function rivianProfileKey(r: RivianRules, selection: readonly string[]) {
  return rivianIdentityGroups
    .flatMap((group) => r.groups[group]?.options.filter((c) => selection.includes(c)) ?? [])
    .sort()
    .join('/');
}
export function rivianFactoryProfiles(r: RivianRules, initial: string[]) {
  if (!rivianSelectionValid(r, initial))
    throw new Error('Invalid Rivian initial factory selection.');
  const reviewedGroups = new Set<string>([
    ...rivianExpandedGroups,
    'ATP',
    'WHLPKG',
    'UND',
    'CHRG',
    'UTL',
    'AUD',
    'ACTBDG',
    'MODEL_YEAR',
    'SWH',
    'PKG',
    'V_GEN',
    'AUTO',
    'ROOF',
    'MOT',
    'CONN',
    'BAT',
    'RGN',
    'ACCESSORIES',
    'EXP',
    'TON',
  ]);
  if (Object.keys(r.groups).some((group) => !reviewedGroups.has(group)))
    throw new Error('Rivian factory group needs scope review before expansion.');
  const codes = rivianExpandedGroups.flatMap((g) => r.groups[g]?.options ?? []);
  const states = [initial],
    seen = new Set([rivianSelectionKey(initial)]);
  const profiles = new Map<string, { key: string; selection: string[]; msrpCad: number }>();
  let transitions = 0;
  for (let index = 0; index < states.length; index++) {
    if (states.length > 50000)
      throw new Error('Rivian factory expansion exceeds the reviewed bound.');
    const selection = states[index]!,
      key = rivianProfileKey(r, selection);
    const price = rivianFactoryPrice(r, selection),
      previous = profiles.get(key);
    if (
      !previous ||
      price < previous.msrpCad ||
      (price === previous.msrpCad &&
        rivianSelectionKey(selection) < rivianSelectionKey(previous.selection))
    )
      profiles.set(key, { key, selection, msrpCad: price });
    for (const code of codes) {
      const selected = selection.includes(code);
      const group = Object.values(r.groups).find((g) => g.options.includes(code))!;
      if (selected && (group.required || rivianFlag(r, selection, code, 'required'))) continue;
      if (
        !selected &&
        (['disabled', 'hidden', 'tempUnavailable', 'availableInFuture'] as const).some((key) =>
          rivianFlag(r, selection, code, key),
        )
      )
        continue;
      const next = rivianChange(r, selection, code, !selected);
      transitions++;
      if (!rivianSelectionValid(r, next)) continue;
      const stateKey = rivianSelectionKey(next);
      if (seen.has(stateKey)) continue;
      seen.add(stateKey);
      states.push(next);
    }
  }
  return {
    profiles: [...profiles.values()].sort((a, b) => a.key.localeCompare(b.key)),
    states: states.length,
    transitions,
  };
}

export const rivianOrigin = 'https://rivian.com';
export const rivianHomeUrl = `${rivianOrigin}/en-CA`;
export const rivianBuilderUrl = (model: string) =>
  `${rivianOrigin}/en-CA/configurations/builder?MODEL=${model}`;
export const rivianStockUrl = `${rivianOrigin}/configurations/api/v1/shop/search`;
export const rivianRulesUrl = `${rivianOrigin}/configurations/api/v1/vehicle-ruleset`;
export const rivianSeatingCopyUrl = `${rivianOrigin}/configurations/locales/en-CA/common.json`;
export const rivianWheelClientUrl = `${rivianOrigin}/configurations/assets/DK3-89Ks.js`;
export const rivianWheelClientSha256 =
  '46230755f1aa97748ff748df1ab4a406e9e2d2ca6ed078ff9cba111ad861e7cd';
export const rivianReceiptSchema = z.strictObject({
  url: z.url().refine((url) => new URL(url).origin === rivianOrigin),
  status: z.union([z.literal(200), z.literal(400)]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  requestSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export type RivianReceipt = z.infer<typeof rivianReceiptSchema>;
export const rivianDeliveryPoints = {
  AB: 'T5J0N3',
  BC: 'V5K0A1',
  SK: 'S7K0J5',
  MB: 'R3B1B9',
  ON: 'M5H2N2',
  QC: 'H2Y1C6',
  NB: 'E3B1B5',
  NS: 'B3J3A5',
  PE: 'C1A7N8',
  NL: 'A1C5M2',
  YT: 'Y1A2C6',
  NT: 'X1A2P5',
  NU: 'X0A0H0',
};
export const rivianStockBody = (model: string, postalCode: string) =>
  JSON.stringify({
    input: {
      filters: [],
      models: [model],
      postalCode,
      shopType: 'NEW_VEHICLE_CONFIG',
      options: { transferFeesFilter: 'ALL_MATCHES', hasVehicleDiscount: false },
    },
  });
export const rivianRulesBody = (model: string, version: string) =>
  JSON.stringify({ country: 'CA', sku: model, version });
export const rivianStockResponseSchema = z.object({
  shopSearch: z.object({
    postalCode: text,
    cursor: z.string().nullish(),
    results: z.array(
      z.object({
        region: z.literal('CA'),
        configId: text,
        model: z.enum(['R1S', 'R1T']),
        modelYear: z.number().int().min(2020).max(2100),
        ruleset: text,
        shopType: z.literal('NEW_VEHICLE_CONFIG'),
        listingPrice: money,
        finalPrice: money,
        vehicleDiscountAmount: money.nullish(),
        marketingOptions: z.array(z.object({ groupId: text, optionId: text })).min(1),
        fees: z.array(z.object({ amount: money, currency: z.literal('CAD'), code: text })),
      }),
    ),
    similarResults: z.array(z.unknown()),
  }),
});
export const rivianBuilderSchema = z.object({
  sku: z.enum(['R1S', 'R1T']),
  locale: z.literal('en-CA'),
  ruleset: rivianRulesSchema,
  selection: z.array(text).min(1),
  isSoldOut: z.boolean(),
  buildPricing: z.record(text, z.object({ msrp: money, finalPrice: money, totalFee: money })),
  canadaFees: z.object({
    destinationFee: money,
    docFee: money,
    airConditionerFee: money,
    recoveryFee: money,
  }),
  totalCanadaFees: money,
});
const ruleEntry = z.strictObject({
  key: text,
  source: rivianReceiptSchema,
  rules: rivianRulesSchema,
});
const stockRecord = rivianStockResponseSchema.shape.shopSearch.shape.results.element
  .omit({ configId: true, region: true, shopType: true })
  .extend({ identityHash: z.string().regex(/^[a-f0-9]{64}$/), searchKeys: z.array(text).min(1) });
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  homeSource: rivianReceiptSchema,
  wheelSelectorSource: rivianReceiptSchema,
  listedOrderModels: z.array(z.enum(['R1S', 'R1T'])).min(1),
  deferredModels: z.array(
    z.strictObject({ model: text, source: rivianReceiptSchema, reason: text }),
  ),
  seating: z.strictObject({
    standardSource: rivianReceiptSchema,
    captainsSource: rivianReceiptSchema,
    standard: z.strictObject({ R1S: z.literal(7), R1T: z.literal(5) }),
    captains: z.literal(6),
  }),
  current: z
    .array(
      z.strictObject({
        source: rivianReceiptSchema,
        builder: rivianBuilderSchema,
        expectedProfileKeys: z.array(text).min(1),
      }),
    )
    .min(1),
  stockRules: z.array(ruleEntry).min(1),
  searches: z.array(
    z.strictObject({
      key: text,
      model: z.enum(['R1S', 'R1T']),
      province: text,
      postalCode: text,
      source: rivianReceiptSchema,
      error: z.literal('NO_DC').nullable(),
      identities: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
      reportedRows: z.number().int().nonnegative(),
    }),
  ),
  stock: z.array(stockRecord),
});
export type RivianSnapshot = z.infer<typeof snapshotSchema>;
export const rivianRulesKey = (model: string, version: string) => `${model}/${version}`;
export function rivianRequireNoRegression(previous: RivianSnapshot, next: RivianSnapshot) {
  if (
    previous.stock.some((r) => !next.stock.some((v) => v.identityHash === r.identityHash)) ||
    previous.current.some(
      (c) =>
        !next.current.some(
          (n) =>
            n.builder.sku === c.builder.sku &&
            c.builder.ruleset.groups.MODEL_YEAR!.options.every((y) =>
              n.builder.ruleset.groups.MODEL_YEAR!.options.includes(y),
            ) &&
            c.expectedProfileKeys.every((key) => n.expectedProfileKeys.includes(key)),
        ),
    ) ||
    previous.searches.some((q) => !q.error && next.searches.find((n) => n.key === q.key)?.error)
  )
    throw new Error(
      'Rivian lost offerings or stock/delivery coverage needs reviewed reconciliation before replacement.',
    );
}
export function validateRivianSnapshot(input: unknown): RivianSnapshot {
  const s = snapshotSchema.parse(input);
  if (s.homeSource.url !== rivianHomeUrl || s.homeSource.status !== 200)
    throw new Error('Rivian Canadian overview source mismatch.');
  if (
    s.wheelSelectorSource.url !== rivianWheelClientUrl ||
    s.wheelSelectorSource.status !== 200 ||
    s.wheelSelectorSource.sha256 !== rivianWheelClientSha256
  )
    throw new Error('Rivian visible wheel/package selector contract needs review.');
  for (const d of s.deferredModels)
    if (
      d.source.status !== 200 ||
      d.source.url !== `${rivianOrigin}/en-CA/${d.model.toLowerCase()}`
    )
      throw new Error('Rivian deferred-model evidence mismatch.');
  if (
    s.seating.standardSource.url !== `${rivianOrigin}/en-CA/r2` ||
    s.seating.captainsSource.url !== rivianSeatingCopyUrl ||
    s.seating.standardSource.status !== 200 ||
    s.seating.captainsSource.status !== 200
  )
    throw new Error('Rivian Canadian seating evidence mismatch.');
  const models = s.current.map((c) => c.builder.sku).sort();
  if (
    new Set(models).size !== models.length ||
    models.join('/') !== [...s.listedOrderModels].sort().join('/')
  )
    throw new Error('Rivian current ordering models were omitted.');
  for (const c of s.current) {
    const b = c.builder,
      r = validateRivianRules(b.ruleset);
    if (
      c.source.status !== 200 ||
      c.source.url !== rivianBuilderUrl(b.sku) ||
      r.meta.vehicle !== b.sku ||
      b.isSoldOut ||
      !rivianSelectionValid(r, b.selection) ||
      Object.values(b.canadaFees).reduce((n, v) => n + v, 0) !== b.totalCanadaFees
    )
      throw new Error('Rivian current Canadian price/selection context mismatch.');
    const expanded = rivianFactoryProfiles(r, b.selection);
    if (
      expanded.profiles.some((p) =>
        p.selection.some(
          (code) =>
            (r.groups.EXP?.options.includes(code) ||
              r.groups.ACCESSORIES?.options.includes(code)) &&
            rivianOptionPrice(r, p.selection, code) !== 0,
        ),
      )
    )
      throw new Error('Rivian current factory baseline needs paint/accessory price review.');
    if (
      expanded.profiles.map((p) => p.key).join('|') !== [...c.expectedProfileKeys].sort().join('|')
    )
      throw new Error('Rivian factory package profiles were omitted.');
    for (const [code, p] of Object.entries(b.buildPricing)) {
      const selected = rivianChange(r, b.selection, code);
      if (
        !rivianSelectionValid(r, selected) ||
        rivianFactoryPrice(r, selected) !== p.msrp ||
        p.finalPrice !== p.msrp + p.totalFee ||
        p.totalFee !== b.totalCanadaFees
      )
        throw new Error('Rivian native factory MSRP and fee components do not reconcile.');
    }
  }
  const rules = new Map(s.stockRules.map((r) => [r.key, r]));
  if (rules.size !== s.stockRules.length) throw new Error('Duplicate Rivian stock rules.');
  for (const entry of rules.values()) {
    const r = validateRivianRules(entry.rules);
    if (
      entry.source.url !== rivianRulesUrl ||
      entry.source.status !== 200 ||
      !entry.source.requestSha256 ||
      entry.key !== rivianRulesKey(r.meta.vehicle, r.meta.version)
    )
      throw new Error('Rivian stock ruleset identity mismatch.');
  }
  const records = new Map(s.stock.map((r) => [r.identityHash, r]));
  if (records.size !== s.stock.length) throw new Error('Duplicate Rivian observed stock identity.');
  for (const row of s.stock) {
    const r = rules.get(rivianRulesKey(row.model, row.ruleset))?.rules;
    const selected = row.marketingOptions.map((o) => o.optionId);
    if (
      !r ||
      !r.groups.MODEL_YEAR?.options.includes(String(row.modelYear)) ||
      !selected.includes(String(row.modelYear)) ||
      !selected.includes('RGN-CAN') ||
      !rivianStockSelectionValid(r, selected) ||
      row.marketingOptions.some((o) => !r.groups[o.groupId]?.options.includes(o.optionId))
    )
      throw new Error('Rivian observed stock year/option/Canadian ruleset mismatch.');
  }
  const expectedSearches = Object.keys(rivianDeliveryPoints)
    .flatMap((p) => models.map((m) => `${p}/${m}`))
    .sort();
  if (
    s.searches
      .map((q) => q.key)
      .sort()
      .join('|') !== expectedSearches.join('|')
  )
    throw new Error('Rivian delivery-point source coverage was omitted.');
  for (const q of s.searches) {
    if (
      q.key !== `${q.province}/${q.model}` ||
      q.postalCode !== rivianDeliveryPoints[q.province as keyof typeof rivianDeliveryPoints] ||
      q.source.url !== rivianStockUrl ||
      !q.source.requestSha256 ||
      q.source.status !== (q.error ? 400 : 200) ||
      q.reportedRows !== q.identities.length ||
      new Set(q.identities).size !== q.identities.length ||
      (q.error && q.identities.length > 0) ||
      q.identities.some(
        (id) => !records.get(id)?.searchKeys.includes(q.key) || records.get(id)?.model !== q.model,
      )
    )
      throw new Error('Rivian stock search identities or delivery context do not reconcile.');
  }
  for (const row of s.stock)
    if (
      row.searchKeys.some(
        (key) => !s.searches.find((q) => q.key === key)?.identities.includes(row.identityHash),
      )
    )
      throw new Error('Rivian stock reference has no matching source search.');
  return s;
}

// The public builder embeds a JSON reference table in its React Router stream.
// Decode the required anonymous loader only; no downloaded JavaScript is run.
export function rivianBuilderLoader(html: string): unknown {
  const chunks = [...html.matchAll(/streamController\.enqueue\(("(?:\\.|[^"\\])*")\)/g)];
  if (chunks.length !== 1) throw new Error('Rivian builder stream contract changed.');
  const decoded: unknown = JSON.parse(JSON.parse(chunks[0]![1]!) as string);
  if (!Array.isArray(decoded) || decoded.length > 100000)
    throw new Error('Invalid Rivian builder reference table.');
  const flat: unknown[] = decoded;
  const field = (id: number, key: string): number => {
    const value = flat[id];
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Rivian builder loader object is missing.');
    for (const [k, v] of Object.entries(value))
      if (/^_\d+$/.test(k) && flat[Number(k.slice(1))] === key && Number.isInteger(v))
        return v as number;
    throw new Error(`Rivian builder loader field ${key} is missing.`);
  };
  const loaders = field(0, 'loaderData');
  const root = field(loaders, 'root');
  if (flat[field(root, 'IS_AUTHENTICATED')] !== false)
    throw new Error('Rivian source must be an anonymous public builder.');
  const target = field(loaders, 'routes/builder/vehicleProduct');
  const visiting = new Set<number>();
  const cache = new Map<number, unknown>();
  let budget = 100000;
  function decode(id: number): unknown {
    if (!Number.isInteger(id) || id >= flat.length || id < -7 || --budget < 0)
      throw new Error('Invalid Rivian stream reference.');
    if (id === -5) return null;
    if (id === -7) return undefined;
    if (id < 0 || visiting.has(id)) throw new Error('Unsupported Rivian stream reference.');
    if (cache.has(id)) return cache.get(id);
    const raw = flat[id];
    if (raw === null || typeof raw !== 'object') return raw;
    visiting.add(id);
    let result: unknown;
    if (Array.isArray(raw)) {
      if (raw.some((x) => !Number.isInteger(x)))
        throw new Error('Unsupported Rivian typed stream object.');
      result = raw.map((i) => decode(i as number));
    } else {
      const pairs = Object.entries(raw).map(([k, v]) => {
        if (!/^_\d+$/.test(k) || !Number.isInteger(v))
          throw new Error('Invalid Rivian stream object entry.');
        const key = decode(Number(k.slice(1)));
        if (typeof key !== 'string') throw new Error('Invalid Rivian stream object key.');
        return [key, decode(v as number)] as const;
      });
      result = Object.fromEntries(pairs);
    }
    visiting.delete(id);
    cache.set(id, result);
    return result;
  }
  return decode(target);
}
