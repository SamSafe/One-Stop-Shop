import { z } from 'zod';

const text = z.string().min(1);
const codes = z.array(text);
const money = z.number().finite().nonnegative();
const date = z.iso.date();
export const lucidModels = ['air', 'gravity'] as const;
export type LucidModel = (typeof lucidModels)[number];
export const lucidBuilderUrl = (model: LucidModel) =>
  `https://lucidmotors.com/en-ca/configure${model === 'gravity' ? '/gravity' : ''}`;
export const lucidCpqUrl = (
  model: LucidModel,
  year: number,
  kind: 'prCodes' | 'trimsDetails' | 'specs',
) =>
  `https://ext.cpq.lucidmotors.com/cpq/configurator/${model === 'air' ? 'v2' : 'v1'}/en-ca/${model}/${year}/${kind}`;
export const lucidSelectionClientUrl =
  'https://lucidmotors.com/configurator/_next/static/chunks/4184-2d364a1ebec51a1e.js';
export const lucidSelectionClientSha256 =
  'e07257d12d40b774355c165e90b8db0c54f28543a24a825e6e36e5847a3a406c';
export const lucidReceiptSchema = z.strictObject({
  url: z.url().refine((s) => {
    const u = new URL(s);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      ['lucidmotors.com', 'ext.cpq.lucidmotors.com', 'buynow.lucidmotors.com'].includes(u.hostname)
    );
  }),
  status: z.literal(200),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type LucidReceipt = z.infer<typeof lucidReceiptSchema>;
const amountSchema = z.object({
  countryCode: text,
  availableFrom: date,
  selectableFrom: date,
  validFrom: date,
  validTo: date,
  showPrice: z.boolean(),
  orderConfirmation: z.boolean(),
  basePrice: money,
  manufacturePrice: money,
  value: money,
  quantity: z.literal(1),
  taxAmount: z.literal(0),
  taxPercentage: z.literal(0),
});
export const lucidOptionsSchema = z.record(
  text,
  z.object({
    name: z.string(),
    technicalName: z.string(),
    technicalDescription: z.string(),
    productType: text,
    typeId: text,
    typeName: text,
    prices: z.array(
      z.object({
        currency: text,
        trim: text,
        bundle: text,
        manufacturingTrim: text,
        amountsByCountry: z.array(amountSchema),
      }),
    ),
  }),
);
export type LucidOptions = z.infer<typeof lucidOptionsSchema>;
export const lucidGroupNames = [
  'trim',
  'variant',
  'edition',
  'drivetrain',
  'look',
  'color',
  'roof',
  'wheels',
  'interior',
  'seating',
  'frontSeating',
  'rearSeating',
  'adas',
  'ux',
  'soundsystem',
  'charging',
  'packages',
  'trimPackage',
  'dynamicPackage',
  'techPackage',
  'towPackage',
  'fees',
  'extfeatures',
  'suspension',
  'modelyear',
  'includedFeatures',
] as const;
const groupFields = Object.fromEntries(lucidGroupNames.map((g) => [g, codes])) as Record<
  (typeof lucidGroupNames)[number],
  typeof codes
>;
export const lucidTrimSchema = z.strictObject({
  ...groupFields,
  name: text,
  default: z.strictObject({ configuration: z.record(text, codes) }),
  addedItems: z.array(z.strictObject({ prCode: text, addedItemPRCode: text })),
  removedItems: z.record(text, codes),
});
export type LucidTrim = z.infer<typeof lucidTrimSchema>;
const ruleSchema = z.strictObject({
  forced: z.record(text, codes).optional(),
  default: z.record(text, text).optional(),
  packagedItems: z
    .record(text, z.union([text, codes, z.strictObject({ selectableCodes: codes })]))
    .optional(),
});
export const lucidBuilderSchema = z.object({
  model: z.enum(lucidModels),
  modelPrCode: z.enum(['AIR', 'GRAVITY']),
  modelYear: z
    .union([
      z.number(),
      z
        .string()
        .regex(/^20\d{2}$/)
        .transform(Number),
    ])
    .pipe(z.number().int().min(2025).max(2100)),
  configuratorParameters: z.object({
    hidePrice: z.literal(false),
    salesMode: z.literal(false),
    kioskMode: z.literal(false),
  }),
  data: z.object({
    optionData: lucidOptionsSchema,
    trimData: z.array(lucidTrimSchema).min(1),
    sectionData: z.array(
      z.object({
        type: z.enum(lucidGroupNames).or(z.literal('options')),
        id: text.nullable(),
        button: z.record(text, z.enum(['radio', 'checkbox'])).optional(),
      }),
    ),
    rules: z.record(text, ruleSchema),
  }),
});
export type LucidBuilder = z.infer<typeof lucidBuilderSchema>;

// Decode the published JSON/UTF-8 Flight frames without executing website code.
// T frames have a byte length and need not end at a newline. Splitting on lines
// loses the Canadian config object following a rich-text frame.
export function lucidFlightNodes(html: string): unknown[] {
  const packets = [...html.matchAll(/self\.__next_f\.push\((\[1,"(?:\\.|[^"\\])*"\])\)/g)];
  if (!packets.length) throw new Error('Lucid Flight stream is missing.');
  const bytes = new TextEncoder().encode(
    packets.map((p) => (JSON.parse(p[1]!) as [number, string])[1]).join(''),
  );
  if (bytes.length > 5_000_000) throw new Error('Lucid Flight stream exceeds the reviewed bound.');
  const decoder = new TextDecoder('utf-8', { fatal: true }),
    nodes: unknown[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (bytes[offset] === 10) {
      offset++;
      continue;
    }
    const start = offset;
    while (offset < bytes.length && bytes[offset] !== 58) offset++;
    if (offset - start > 12 || !/^[a-f0-9]*$/.test(decoder.decode(bytes.subarray(start, offset))))
      throw new Error('Invalid Lucid Flight frame identity.');
    offset++;
    if (bytes[offset] === 84) {
      const lengthStart = ++offset;
      while (offset < bytes.length && bytes[offset] !== 44) offset++;
      const literal = decoder.decode(bytes.subarray(lengthStart, offset));
      if (!/^[a-f0-9]{1,8}$/.test(literal)) throw new Error('Invalid Lucid Flight text length.');
      const length = Number.parseInt(literal, 16);
      offset++;
      if (offset + length > bytes.length) throw new Error('Truncated Lucid Flight text.');
      decoder.decode(bytes.subarray(offset, offset + length));
      offset += length;
    } else {
      const end = bytes.indexOf(10, offset),
        next = end < 0 ? bytes.length : end;
      const payload = decoder.decode(bytes.subarray(offset, next));
      if (!payload.startsWith('I') && !payload.startsWith('HL'))
        nodes.push(JSON.parse(payload) as unknown);
      offset = next + 1;
    }
  }
  return nodes;
}
export function lucidBuilderLoader(html: string, model: LucidModel): LucidBuilder {
  const nodes = lucidFlightNodes(html);
  const props = nodes.flatMap((n) =>
    Array.isArray(n) && n[3] && typeof n[3] === 'object' ? [n[3] as Record<string, unknown>] : [],
  );
  if (!props.some((p) => p.lng === 'en-ca')) throw new Error('Lucid Canadian locale is missing.');
  const configs = props.flatMap((p) => (p.configData ? [p.configData] : []));
  if (configs.length !== 1) throw new Error('Lucid builder identity is ambiguous.');
  const b = lucidBuilderSchema.parse(configs[0]);
  if (b.model !== model || b.modelPrCode !== model.toUpperCase())
    throw new Error('Lucid builder model mismatch.');
  for (const trim of b.data.trimData) {
    if (trim.variant.length !== 1 || trim.edition.length !== 1 || trim.drivetrain.length !== 1)
      throw new Error('Lucid trim powertrain needs renewed scope review.');
    const variant = trim.variant[0]!,
      selected = trim.default.configuration[variant];
    if (
      !selected?.includes(trim.name) ||
      !selected.includes(variant) ||
      !trim.addedItems.some((a) => a.addedItemPRCode === 'COCA' && selected.includes(a.prCode)) ||
      !trim.addedItems.some(
        (a) =>
          a.addedItemPRCode === `MY${String(b.modelYear).slice(2)}` && selected.includes(a.prCode),
      )
    )
      throw new Error('Lucid explicit Canadian model-year/default selection mismatch.');
    if (selected.some((c) => !b.data.optionData[c])) throw new Error('Unknown Lucid default code.');
  }
  return b;
}
export function lucidAmount(
  options: LucidOptions,
  trim: string,
  variant: string,
  code: string,
  on: string,
) {
  date.parse(on);
  const product = options[code];
  if (!product) throw new Error(`Unknown Lucid product ${code}.`);
  const prices = product.prices.filter(
    (p) =>
      p.currency === 'CAD' &&
      p.trim === trim &&
      p.bundle === trim &&
      p.manufacturingTrim === variant,
  );
  const amounts = prices
    .flatMap((p) => p.amountsByCountry)
    .filter((a) => a.countryCode === 'CA' && a.validFrom <= on && on < a.validTo);
  if (prices.length !== 1 || amounts.length !== 1)
    throw new Error(`Lucid exact Canadian price context missing or ambiguous: ${trim}/${code}.`);
  const a = amounts[0]!;
  if (a.basePrice !== a.manufacturePrice)
    throw new Error(`Lucid factory base price conflict: ${code}.`);
  return a;
}
export function lucidSelectionPrice(
  options: LucidOptions,
  trim: string,
  variant: string,
  selected: readonly string[],
  on: string,
) {
  if (
    new Set(selected).size !== selected.length ||
    !selected.includes(trim) ||
    !selected.includes(variant)
  )
    throw new Error('Lucid priced selection identity is missing or duplicated.');
  let msrp = 0,
    total = 0;
  for (const code of selected) {
    const a = lucidAmount(options, trim, variant, code, on);
    msrp += a.basePrice;
    total += a.value;
  }
  const fees = ['DEST_FEE', 'DOC_FEE', 'AC_FEE'].reduce(
    (n, c) => n + lucidAmount(options, trim, variant, c, on).basePrice,
    0,
  );
  if (msrp <= 0 || total !== msrp + fees)
    throw new Error('Lucid factory MSRP and published fee components do not reconcile.');
  return { msrpCad: msrp, configuredTotalCad: total, feesCad: fees };
}

export type LucidSelection = { selected: string[]; forced: string[] };
export const lucidSelectionKey = (s: readonly string[]) => [...s].sort().join('/');
const incompatible = (t: LucidTrim, selected: readonly string[], code: string) =>
  selected.some((s) => t.removedItems[s]?.includes(code));
export function lucidChoices(b: LucidBuilder, t: LucidTrim, state: LucidSelection, on: string) {
  return b.data.sectionData.flatMap((s) => {
    if (
      !s.id ||
      s.type === 'options' ||
      ['trim', 'variant', 'edition', 'drivetrain', 'color'].includes(s.type)
    )
      return [];
    return t[s.type]
      .filter((c) => !incompatible(t, state.selected, c) && !state.forced.includes(c))
      .flatMap((code) => {
        const a = lucidAmount(b.data.optionData, t.name, t.variant[0]!, code, on);
        const mode = s.button?.[t.variant[0]!] ?? 'radio';
        return a.selectableFrom <= on && (mode === 'checkbox' || !state.selected.includes(code))
          ? [{ code, mode }]
          : [];
      });
  });
}
export function lucidChange(
  b: LucidBuilder,
  t: LucidTrim,
  state: LucidSelection,
  code: string,
  on: string,
): LucidSelection {
  const choices = lucidChoices(b, t, state, on),
    choice = choices.find((c) => c.code === code);
  if (!choice) throw new Error(`Lucid option is not currently selectable: ${code}.`);
  const options = b.data.optionData,
    variant = t.variant[0]!,
    rule = b.data.rules[variant];
  const section = (c: string) => b.data.sectionData.find((s) => s.id === options[c]?.typeName);
  const sameType = (c: string, other: string) => options[c]?.typeName === options[other]?.typeName;
  let selected = [...state.selected],
    forced = [...state.forced];
  const group = section(code);
  if (!group) throw new Error('Lucid selected option has no reviewed visible section.');
  const selectedCode = selected.find((c) => sameType(c, code));
  if (choice.mode === 'checkbox' && group.type === 'trimPackage') {
    const pkg = rule?.packagedItems;
    const components = (c: string) => {
      const p = pkg?.[c];
      if (!p || typeof p !== 'object' || Array.isArray(p))
        throw new Error('Lucid package components are missing.');
      return p.selectableCodes;
    };
    if (selectedCode) {
      const old = components(selectedCode);
      selected = selected.filter((c) => c !== selectedCode && !old.includes(c));
      if (selectedCode === code) {
        const defaults = pkg?.default;
        if (!Array.isArray(defaults)) throw new Error('Lucid package reset defaults are missing.');
        selected.push(...defaults);
      } else selected.push(code, ...components(code));
    } else {
      const added = components(code);
      selected = selected.filter((c) => !added.some((a) => sameType(a, c)));
      selected.push(code, ...added);
    }
  } else if (choice.mode === 'checkbox') {
    selected = selectedCode === code ? selected.filter((c) => c !== code) : [...selected, code];
  } else selected = [...selected.filter((c) => !sameType(c, code)), code];
  // The native client replaces incompatible options simultaneously against the
  // post-click selection. Iterating a rule fixpoint changes its event semantics.
  const postClick = selected;
  selected = postClick.flatMap((c) => {
    if (!incompatible(t, postClick, c)) return [c];
    const s = section(c);
    if (!s || s.type === 'options') throw new Error('Lucid incompatible option has no section.');
    const replacements = t[s.type].filter(
      (r) =>
        !incompatible(t, postClick, r) &&
        lucidAmount(options, t.name, variant, r, on).selectableFrom <= on,
    );
    return replacements.slice(0, 1);
  });
  const triggers = Object.keys(rule?.forced ?? {}).filter((c) => selected.includes(c));
  if (triggers.length) {
    forced = [];
    for (const trigger of triggers)
      for (const required of rule!.forced![trigger]!) {
        const s = section(required);
        if (
          s &&
          s.type !== 'options' &&
          t[s.type].includes(required) &&
          !selected.includes(required)
        ) {
          selected.push(required);
          forced.push(required);
        }
      }
  } else if (forced.length) {
    selected = selected.filter((c) => !forced.includes(c));
    forced = [];
  }
  for (const c of [...selected]) {
    const replacement = rule?.default?.[c];
    if (replacement && !selected.includes(replacement)) {
      const index = selected.findIndex((s) => sameType(s, replacement));
      if (index < 0) throw new Error('Lucid default replacement has no selected group.');
      selected[index] = replacement;
    }
  }
  // Published North-American Gravity GT wheel/appearance promotion pairing.
  // It changes compatible equipment, never the pre-incentive factory MSRP.
  const paired = ['WH18', 'WH16', 'AU01', 'DHP01', '7RSC'].filter(
    (c) => !incompatible(t, state.selected, c),
  );
  if (
    b.model === 'gravity' &&
    variant === 'GT' &&
    paired.every((c) => state.selected.includes(c)) &&
    ['EXT11', 'EXT12'].includes(code)
  ) {
    const index = selected.findIndex((c) => options[c]?.typeName === 'LUCID_WHEELS');
    if (index < 0) throw new Error('Lucid promotional wheel pairing is missing wheels.');
    selected[index] = code === 'EXT11' ? 'WH16' : 'WH18';
  }
  return { selected, forced: [...new Set(forced)] };
}
export function lucidSelectionValid(
  b: LucidBuilder,
  t: LucidTrim,
  state: LucidSelection,
  on: string,
) {
  const options = b.data.optionData,
    selected = state.selected;
  if (
    new Set(selected).size !== selected.length ||
    !selected.includes(t.name) ||
    !selected.includes(t.variant[0]!) ||
    selected.some((c) => !options[c] || incompatible(t, selected, c))
  )
    return false;
  const types = selected.map((c) => options[c]!.typeName);
  if (new Set(types).size !== types.length) return false;
  if (state.forced.some((c) => !selected.includes(c))) return false;
  for (const s of b.data.sectionData) {
    if (!s.id || s.type === 'options' || s.type === 'trim') continue;
    const actual = selected.filter((c) => options[c]!.typeName === s.id),
      groupCodes = t[s.type];
    if (actual.some((c) => !groupCodes.includes(c))) return false;
    const required = t.default.configuration[t.variant[0]!]!.some(
      (c) => options[c]?.typeName === s.id,
    );
    if (required && actual.length !== 1) return false;
  }
  return selected.every(
    (c) => lucidAmount(options, t.name, t.variant[0]!, c, on).selectableFrom <= on,
  );
}
// Cosmetic paint is held at the builder default. Wheels/interiors are explored
// for compatibility, then projected to a minimum compatible choice per profile.
// Their actual names remain visible in the price note; ranges are not copied
// between wheel sizes. This projection is reported as a coverage limitation.
export const lucidIdentityGroups = [
  'variant',
  'edition',
  'drivetrain',
  'roof',
  'frontSeating',
  'rearSeating',
  'trimPackage',
  'adas',
  'soundsystem',
  'packages',
  'suspension',
  'dynamicPackage',
  'techPackage',
  'towPackage',
] as const;
export function lucidProfileKey(b: LucidBuilder, selected: readonly string[]) {
  const ids = b.data.sectionData
    .filter((s) => lucidIdentityGroups.includes(s.type as (typeof lucidIdentityGroups)[number]))
    .map((s) => s.id);
  return lucidSelectionKey(
    selected.filter((c) => ids.includes(b.data.optionData[c]?.typeName ?? '')),
  );
}
export function lucidFactoryProfiles(b: LucidBuilder, t: LucidTrim, on: string) {
  const initial = { selected: t.default.configuration[t.variant[0]!]!, forced: [] as string[] };
  if (!lucidSelectionValid(b, t, initial, on)) throw new Error('Lucid factory default is invalid.');
  const states: LucidSelection[] = [initial],
    seen = new Set([`${lucidSelectionKey(initial.selected)}|`]),
    profiles = new Map<string, { key: string; selection: string[]; msrpCad: number }>();
  let transitions = 0;
  for (let index = 0; index < states.length; index++) {
    if (states.length > 100000) throw new Error('Lucid factory graph exceeds the reviewed bound.');
    const state = states[index]!,
      key = lucidProfileKey(b, state.selected);
    const price = lucidSelectionPrice(
      b.data.optionData,
      t.name,
      t.variant[0]!,
      state.selected,
      on,
    ).msrpCad;
    const prior = profiles.get(key);
    if (
      !prior ||
      price < prior.msrpCad ||
      (price === prior.msrpCad &&
        lucidSelectionKey(state.selected) < lucidSelectionKey(prior.selection))
    )
      profiles.set(key, { key, selection: state.selected, msrpCad: price });
    for (const { code } of lucidChoices(b, t, state, on)) {
      const next = lucidChange(b, t, state, code, on);
      transitions++;
      if (!lucidSelectionValid(b, t, next, on)) continue;
      const signature = `${lucidSelectionKey(next.selected)}|${lucidSelectionKey(next.forced)}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      states.push(next);
    }
  }
  return {
    profiles: [...profiles.values()].sort((a, b) => a.key.localeCompare(b.key)),
    states: states.length,
    transitions,
  };
}

export const lucidDeliveryPoints = {
  AB: { long: '-114.057', lat: '51.045' },
  BC: { long: '-123.121', lat: '49.283' },
  MB: { long: '-97.138', lat: '49.895' },
  NB: { long: '-66.644', lat: '45.964' },
  NL: { long: '-52.713', lat: '47.561' },
  NS: { long: '-63.575', lat: '44.649' },
  NT: { long: '-114.381', lat: '62.454' },
  NU: { long: '-68.520', lat: '63.747' },
  ON: { long: '-79.383', lat: '43.653' },
  PE: { long: '-63.131', lat: '46.238' },
  QC: { long: '-73.567', lat: '45.502' },
  SK: { long: '-104.618', lat: '50.445' },
  YT: { long: '-135.056', lat: '60.721' },
} as const;
export function lucidStockUrl(
  model: LucidModel,
  province: keyof typeof lucidDeliveryPoints,
  variant?: string,
) {
  const params = new URLSearchParams({
    ...lucidDeliveryPoints[province],
    type: 'new',
    ...(variant ? { modelVariant: variant } : {}),
    sortType: 'distance',
    distance: '5000',
    zipState: province,
    zipCountry: 'CA',
    requestedVehiclesNum: '200',
  });
  return `https://buynow.lucidmotors.com/api/v4/en_ca/store/inventory/vehicles${model === 'gravity' ? '/gravity' : ''}?${params}`;
}
const stockProduct = z.object({ typeId: text, sapCode: text, zlCode: text, technicalName: text });
export const lucidStockResponseSchema = z.object({
  data: z.array(
    z.object({
      VIN: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/),
      titleStatus: z.literal('New'),
      category: z.literal('Inventory'),
      subCategory: z.enum(['Available', 'Display']),
      availability: text,
      isCPO: z.literal(false),
      model: stockProduct,
      modelVariant: stockProduct,
      modelYear: z
        .string()
        .regex(/^20\d{2}$/)
        .transform(Number),
      country: stockProduct,
      region: stockProduct,
      bundle: stockProduct,
      color: stockProduct,
      interior: stockProduct,
      wheels: stockProduct,
      roof: stockProduct,
      look: stockProduct.optional(),
      motorDrive: stockProduct,
      edition: stockProduct,
      appearance: stockProduct,
      packages: stockProduct,
      seatingOptions: stockProduct,
      additionalFeatures: z.object({ soundSystem: stockProduct, dreamDrive: stockProduct }),
      rearSeats: z.object({ backSeatsCode: text, backSeats: text }),
      zlList: text,
      price: z.object({
        value: money.positive(),
        currency: z.literal('CAD'),
        afterDiscountPrice: money,
      }),
    }),
  ),
});
export type LucidRawStock = z.infer<typeof lucidStockResponseSchema>['data'][number];
export function lucidStockSelection(row: LucidRawStock, options: LucidOptions, on: string) {
  const model = z.enum(['AIR', 'GRAVITY']).parse(row.model.sapCode),
    variant = row.modelVariant.sapCode,
    trim = row.bundle.sapCode;
  if (row.country.sapCode !== 'COCA' || row.region.sapCode !== 'RENA')
    throw new Error('Lucid stock Canadian context mismatch.');
  const raw = row.zlList.split(',');
  if (
    new Set(raw).size !== raw.length ||
    !raw.includes('COCA') ||
    !raw.includes('RENA') ||
    !raw.includes(model) ||
    !raw.includes(variant)
  )
    throw new Error('Lucid stock production-code identity mismatch.');
  if (model === 'AIR' && !row.look)
    throw new Error('Lucid Air stock appearance marker is missing.');
  for (const p of [
    row.model,
    row.modelVariant,
    row.color,
    row.interior,
    row.wheels,
    row.roof,
    ...(row.look ? [row.look] : []),
    row.motorDrive,
    row.edition,
    row.appearance,
    row.packages,
    row.seatingOptions,
    row.additionalFeatures.soundSystem,
    row.additionalFeatures.dreamDrive,
  ]) {
    if (
      p.sapCode !== p.zlCode ||
      !raw.includes(p.sapCode) ||
      options[p.sapCode]?.typeId !== p.typeId
    )
      throw new Error('Lucid typed stock products and production codes disagree.');
  }
  const bundleType = model === 'AIR' && row.modelYear === 2025 ? 'LUCID_MODEL' : 'LUCID_BUNDLE';
  if (options[trim]?.typeId !== bundleType)
    throw new Error('Lucid explicit stock bundle is unknown.');
  const removed: string[] = [],
    selected: string[] = [];
  for (const code of raw) {
    // Legacy stock serializes a model-wide bundle alias (air/gravity), while
    // the typed bundle identifies the retail trim. It contributes no price;
    // exact selected components must still reconcile the published stock total.
    if (
      code === 'air' ||
      code === 'gravity' ||
      code === trim ||
      options[code]?.typeId === 'LUCID_BUNDLE'
    ) {
      removed.push(code);
      continue;
    }
    const p = options[code];
    if (!p) throw new Error(`Unreviewed Lucid stock code: ${code}.`);
    // L929 is an unpriced legacy secondary roof-colour marker. No zero price
    // is fabricated for it: it is explicitly excluded from the priced selection
    // and the full source total must independently reconcile below.
    if (
      code === model ||
      ['LUCID_COUNTRY', 'LUCID_REGION', 'LUCID_MODEL_YEAR'].includes(p.typeId) ||
      (code === 'L929' &&
        p.typeId === 'LUCID_SECONDARY_EXT_COLOR' &&
        p.prices.every((r) => !r.amountsByCountry.length))
    ) {
      removed.push(code);
      continue;
    }
    selected.push(code);
  }
  selected.push(trim);
  if (model === 'GRAVITY' && !selected.includes(row.rearSeats.backSeatsCode))
    throw new Error('Lucid stock seating identity mismatch.');
  const price = lucidSelectionPrice(options, trim, variant, selected, on);
  if (price.configuredTotalCad !== row.price.value)
    throw new Error('Lucid exact model-year stock total does not reconcile.');
  const paint = selected.filter((c) =>
    ['LUCID_EXT_COLOR', 'LUCID_SECONDARY_EXT_COLOR'].includes(options[c]!.typeId),
  );
  return {
    selected,
    removed,
    msrpCad:
      price.msrpCad -
      paint.reduce((n, c) => n + lucidAmount(options, trim, variant, c, on).basePrice, 0),
    configuredTotalCad: price.configuredTotalCad,
    feesCad: price.feesCad,
  };
}

export function lucidLineup(html: string) {
  const props = lucidFlightNodes(html).flatMap((n) =>
    Array.isArray(n) && n[3] && typeof n[3] === 'object' ? [n[3] as Record<string, unknown>] : [],
  );
  if (!props.some((p) => p.lng === 'en-ca'))
    throw new Error('Lucid overview Canadian locale missing.');
  const headers = props.filter((p) => p.carInfo);
  if (headers.length !== 1) throw new Error('Lucid overview model menu is ambiguous.');
  const h = z
    .object({
      carInfo: z.record(
        text,
        z.object({ bundle: text, trimPrCode: text, validPrice: money, basePrice: text }),
      ),
      content: z.object({
        'nav-items': z.object({
          default: z.object({
            children: z.array(
              z.object({
                title: text,
                children: z.array(z.object({ uri: z.string().optional() })).optional(),
              }),
            ),
          }),
        }),
      }),
    })
    .parse(headers[0]);
  const models = h.content['nav-items'].default.children
    .filter((c) => c.children?.some((l) => l.uri?.startsWith('/configure')))
    .map((c) => z.enum(lucidModels).parse(c.title.replace(/^Lucid /, '').toLowerCase()))
    .sort();
  if (models.join('/') !== [...lucidModels].sort().join('/'))
    throw new Error('Lucid ordering model coverage changed.');
  return {
    models,
    trims: Object.entries(h.carInfo)
      .filter(([, v]) => v.validPrice > 0)
      .map(([key, v]) => {
        const model = z.enum(lucidModels).parse(key.split('_')[0]);
        if (key !== `${model}_${v.bundle}`) throw new Error('Lucid menu retail identity mismatch.');
        return { model, trim: v.bundle, variant: v.trimPrCode, configuredTotalCad: v.validPrice };
      }),
    placeholders: Object.entries(h.carInfo)
      .filter(([, v]) => v.validPrice === 0)
      .map(([key, v]) => {
        if (v.basePrice !== '—') throw new Error('Lucid zero-price menu placeholder changed.');
        return key;
      }),
  };
}
const profileSchema = z.strictObject({ key: text, selection: codes, msrpCad: money.positive() });
const currentSchema = z.strictObject({
  source: lucidReceiptSchema,
  builder: lucidBuilderSchema,
  profiles: z.array(profileSchema).min(1),
  expectedProfileKeys: codes.min(1),
  states: z.number().int().positive(),
  transitions: z.number().int().nonnegative(),
});
const stockSchema = z.strictObject({
  identityHash: z.string().regex(/^[a-f0-9]{64}$/),
  model: z.enum(lucidModels),
  year: z.number().int(),
  trim: text,
  variant: text,
  selected: codes,
  removedCodes: codes,
  listedTotalCad: money.positive(),
  afterDiscountPriceCad: money,
  subCategory: z.enum(['Available', 'Display']),
  availability: text,
  searchKeys: codes.min(1),
});
export const lucidSnapshotSchema = z.strictObject({
  version: z.literal(1),
  market: z.literal('CA'),
  currency: z.literal('CAD'),
  retrievedAt: z.iso.datetime(),
  overview: z.strictObject({
    source: lucidReceiptSchema,
    models: z.array(z.enum(lucidModels)),
    trims: z.array(
      z.strictObject({
        model: z.enum(lucidModels),
        trim: text,
        variant: text,
        configuredTotalCad: money.positive(),
      }),
    ),
    placeholders: codes,
  }),
  selectionClient: lucidReceiptSchema,
  current: z.array(currentSchema).length(2),
  years: z
    .array(
      z.strictObject({
        model: z.enum(lucidModels),
        year: z.number().int().min(2025).max(2100),
        priceSource: lucidReceiptSchema,
        trimsSource: lucidReceiptSchema,
        specsSource: lucidReceiptSchema,
        power: z.array(
          z.strictObject({
            variant: text,
            edition: text,
            drive: text,
            hp: money.positive().max(3000),
          }),
        ),
        options: lucidOptionsSchema,
        trims: z.array(lucidTrimSchema).min(1),
      }),
    )
    .min(1),
  searches: z
    .array(
      z.strictObject({
        key: text,
        model: z.enum(lucidModels),
        province: z.enum(
          Object.keys(lucidDeliveryPoints) as [
            keyof typeof lucidDeliveryPoints,
            ...Array<keyof typeof lucidDeliveryPoints>,
          ],
        ),
        variant: text.nullable(),
        source: lucidReceiptSchema,
        identities: codes,
      }),
    )
    .min(1),
  stock: z.array(stockSchema),
});
export type LucidSnapshot = z.infer<typeof lucidSnapshotSchema>;
export const lucidYearKey = (model: string, year: number) => `${model}/${year}`;
export function lucidStockMsrp(
  year: LucidSnapshot['years'][number],
  row: LucidSnapshot['stock'][number],
  on: string,
) {
  const p = lucidSelectionPrice(year.options, row.trim, row.variant, row.selected, on);
  if (p.configuredTotalCad !== row.listedTotalCad)
    throw new Error('Lucid normalized stock price reconciliation failed.');
  return (
    p.msrpCad -
    row.selected
      .filter((c) =>
        ['LUCID_EXT_COLOR', 'LUCID_SECONDARY_EXT_COLOR'].includes(year.options[c]!.typeId),
      )
      .reduce((n, c) => n + lucidAmount(year.options, row.trim, row.variant, c, on).basePrice, 0)
  );
}
export function validateLucidSnapshot(input: unknown, expandFactory = false): LucidSnapshot {
  const s = lucidSnapshotSchema.parse(input),
    on = s.retrievedAt.slice(0, 10);
  if (
    s.overview.source.url !== 'https://lucidmotors.com/en-ca' ||
    s.overview.models.join('/') !== 'air/gravity' ||
    s.selectionClient.url !== lucidSelectionClientUrl ||
    s.selectionClient.sha256 !== lucidSelectionClientSha256
  )
    throw new Error('Lucid overview or reviewed selection-client contract changed.');
  const factoryModels = s.current.map((c) => c.builder.model).sort();
  if (factoryModels.join('/') !== 'air/gravity')
    throw new Error('Lucid current factory models were omitted.');
  const menu = s.overview.trims.map((t) => `${t.model}/${t.trim}/${t.variant}`).sort(),
    offered: string[] = [];
  for (const c of s.current) {
    const b = c.builder,
      options = b.data.optionData;
    if (c.source.url !== lucidBuilderUrl(b.model))
      throw new Error('Lucid current builder source mismatch.');
    for (const t of b.data.trimData) {
      const variant = t.variant[0]!,
        initial = t.default.configuration[variant]!;
      if (
        t.variant.length !== 1 ||
        t.edition.length !== 1 ||
        t.drivetrain.length !== 1 ||
        b.modelPrCode !== b.model.toUpperCase()
      )
        throw new Error('Lucid factory powertrain/model identity changed.');
      if (
        !t.addedItems.some((a) => a.addedItemPRCode === 'COCA' && initial.includes(a.prCode)) ||
        !t.addedItems.some(
          (a) =>
            a.addedItemPRCode === `MY${String(b.modelYear).slice(2)}` && initial.includes(a.prCode),
        )
      )
        throw new Error('Lucid current explicit Canadian year mismatch.');
      offered.push(`${b.model}/${t.name}/${variant}`);
      const menuTrim = s.overview.trims.find(
        (r) => r.model === b.model && r.trim === t.name && r.variant === variant,
      );
      if (
        lucidSelectionPrice(options, t.name, variant, initial, on).configuredTotalCad !==
        menuTrim?.configuredTotalCad
      )
        throw new Error('Lucid menu and default price mismatch.');
    }
    if (
      c.profiles
        .map((p) => p.key)
        .sort()
        .join('|') !== [...c.expectedProfileKeys].sort().join('|') ||
      new Set(c.expectedProfileKeys).size !== c.profiles.length
    )
      throw new Error('Lucid expected factory equipment profiles were omitted.');
    for (const p of c.profiles) {
      const t = b.data.trimData.find((t) => p.selection.includes(t.name));
      if (
        !t ||
        !lucidSelectionValid(b, t, { selected: p.selection, forced: [] }, on) ||
        lucidProfileKey(b, p.selection) !== p.key ||
        lucidSelectionPrice(options, t.name, t.variant[0]!, p.selection, on).msrpCad !== p.msrpCad
      )
        throw new Error('Lucid factory profile compatibility or MSRP mismatch.');
      if (
        p.selection.some(
          (code) =>
            options[code]!.typeId === 'LUCID_EXT_COLOR' &&
            lucidAmount(options, t.name, t.variant[0]!, code, on).basePrice !== 0,
        )
      )
        throw new Error('Lucid factory minimum profile needs paint-price review.');
    }
    // Full graph expansion runs during synchronization. The browser validates
    // every serialized selection and reconciliation above, avoiding 67k UI
    // transitions at application startup.
    if (expandFactory) {
      const full = b.data.trimData.map((t) => lucidFactoryProfiles(b, t, on));
      const profiles = full.flatMap((r) => r.profiles).sort((a, b) => a.key.localeCompare(b.key));
      if (
        JSON.stringify(profiles) !==
          JSON.stringify([...c.profiles].sort((a, b) => a.key.localeCompare(b.key))) ||
        full.reduce((n, r) => n + r.states, 0) !== c.states ||
        full.reduce((n, r) => n + r.transitions, 0) !== c.transitions
      )
        throw new Error('Lucid complete factory graph reconciliation failed.');
    }
  }
  if (menu.join('|') !== offered.sort().join('|'))
    throw new Error('Lucid published menu trims were omitted.');
  const years = new Map(s.years.map((y) => [lucidYearKey(y.model, y.year), y]));
  if (years.size !== s.years.length) throw new Error('Duplicate Lucid exact-year pricing tables.');
  const requiredYears = new Set([
    ...s.current.map((c) => lucidYearKey(c.builder.model, c.builder.modelYear)),
    ...s.stock.map((r) => lucidYearKey(r.model, r.year)),
  ]);
  if ([...years.keys()].sort().join('|') !== [...requiredYears].sort().join('|'))
    throw new Error('Lucid observed model-year pricing coverage mismatch.');
  for (const y of s.years) {
    if (
      y.priceSource.url !== lucidCpqUrl(y.model, y.year, 'prCodes') ||
      y.trimsSource.url !== lucidCpqUrl(y.model, y.year, 'trimsDetails')
    )
      throw new Error('Lucid price source model-year mismatch.');
    if (
      y.specsSource.url !== lucidCpqUrl(y.model, y.year, 'specs') ||
      y.power.length !== y.trims.length ||
      y.trims.some(
        (t) =>
          y.power.filter(
            (p) =>
              t.variant.includes(p.variant) &&
              t.edition.includes(p.edition) &&
              t.drivetrain.includes(p.drive),
          ).length !== 1,
      )
    )
      throw new Error('Lucid exact-year power specification coverage mismatch.');
    const current = s.current.find(
      (c) => c.builder.model === y.model && c.builder.modelYear === y.year,
    );
    if (
      current &&
      (JSON.stringify(y.options) !== JSON.stringify(current.builder.data.optionData) ||
        JSON.stringify(y.trims) !== JSON.stringify(current.builder.data.trimData))
    )
      throw new Error('Lucid builder and exact-year CPQ tables disagree.');
  }
  const records = new Map(s.stock.map((r) => [r.identityHash, r]));
  if (records.size !== s.stock.length) throw new Error('Duplicate Lucid stock identity.');
  for (const r of s.stock) {
    const y = years.get(lucidYearKey(r.model, r.year))!,
      t = y.trims.find((t) => t.name === r.trim);
    if (
      !t?.variant.includes(r.variant) ||
      !r.selected.includes(r.variant) ||
      !r.selected.includes(r.trim) ||
      r.selected.some((c) => !y.options[c]) ||
      new Set(r.selected).size !== r.selected.length
    )
      throw new Error('Lucid exact stock year/trim/selected products mismatch.');
    lucidStockMsrp(y, r, on);
    if (
      r.searchKeys.some(
        (key) => !s.searches.find((q) => q.key === key)?.identities.includes(r.identityHash),
      )
    )
      throw new Error('Lucid stock row lost its offering evidence.');
  }
  const expectedQueries = Object.keys(lucidDeliveryPoints).flatMap((p) =>
    lucidModels.map((m) => `${p}/${m}/all`),
  );
  for (const c of s.current)
    for (const t of c.builder.data.trimData)
      expectedQueries.push(`AB/${c.builder.model}/${t.variant[0]}`);
  if (
    s.searches
      .map((q) => q.key)
      .sort()
      .join('|') !== expectedQueries.sort().join('|')
  )
    throw new Error('Lucid regional/trim search coverage omitted.');
  for (const q of s.searches) {
    if (
      q.key !== `${q.province}/${q.model}/${q.variant ?? 'all'}` ||
      q.source.url !== lucidStockUrl(q.model, q.province, q.variant ?? undefined) ||
      q.identities.length >= 200 ||
      new Set(q.identities).size !== q.identities.length ||
      q.identities.some((id) => {
        const r = records.get(id);
        return (
          !r ||
          r.model !== q.model ||
          (q.variant !== null && q.variant !== r.variant) ||
          !r.searchKeys.includes(q.key)
        );
      })
    )
      throw new Error('Lucid query, row identity or unpaged result cap does not reconcile.');
  }
  for (const model of lucidModels) {
    const broad = s.searches.find((q) => q.key === `AB/${model}/all`)!.identities;
    const split = [
      ...new Set(
        s.searches
          .filter((q) => q.province === 'AB' && q.model === model && q.variant)
          .flatMap((q) => q.identities),
      ),
    ];
    if ([...broad].sort().join('|') !== split.sort().join('|'))
      throw new Error('Lucid broad and trim-partition stock identities disagree.');
  }
  return s;
}
export function lucidRequireNoRegression(previous: LucidSnapshot, next: LucidSnapshot) {
  const current = new Set(
    next.current.flatMap((c) =>
      c.profiles.map((p) => `${c.builder.model}/${c.builder.modelYear}/${p.key}`),
    ),
  );
  if (
    previous.current.some((c) =>
      c.profiles.some((p) => !current.has(`${c.builder.model}/${c.builder.modelYear}/${p.key}`)),
    )
  )
    throw new Error(
      'Lucid current factory offerings were lost; review retirements before replacing the snapshot.',
    );
  const years = new Set(next.stock.map((r) => `${r.model}/${r.year}/${r.trim}`));
  if (previous.stock.some((r) => !years.has(`${r.model}/${r.year}/${r.trim}`)))
    throw new Error(
      'Lucid older new-stock year/trim evidence disappeared; review before retiring it.',
    );
}
export function lucidPower(raw: unknown, model: LucidModel, trim: LucidTrim) {
  const object = (value: unknown) => z.record(text, z.unknown()).parse(value);
  const variant = trim.variant[0]!,
    edition = trim.edition[0]!,
    drive = trim.drivetrain[0]!;
  const root = object(raw),
    v = object(model === 'air' ? object(root[drive])[variant] : root[variant]);
  const spec = object(v[edition]);
  const values = z
    .array(z.object({ title: text, value: text }))
    .parse(spec[model === 'air' ? 'drivetrainSpecs' : 'trimSpecs']);
  const rows = values.filter((s) => s.title === 'Power');
  if (rows.length !== 1 || !/^[\d,]+ hp$/.test(rows[0]!.value))
    throw new Error('Lucid power unit/context needs renewed review.');
  const hp = z
    .number()
    .positive()
    .max(3000)
    .parse(Number(rows[0]!.value.replace(/ hp$|,/g, '')));
  return { variant, edition, drive, hp };
}
