import { z } from 'zod';

export const vinfastOrigin = 'https://vinfastauto.ca';
export const vinfastModels = ['vf-8', 'vf-9'] as const;
export const vinfastProvinces = ['BC', 'ON', 'QC'] as const;
const provinceNames = { BC: 'British Columbia', ON: 'Ontario', QC: 'Quebec' } as const;
const model = z.enum(vinfastModels),
  province = z.enum(vinfastProvinces),
  trim = z.enum(['ECO', 'PLUS']);
const text = z.string().min(1),
  money = z.number().finite().min(10000).max(10000000);
export const vinfastPricingClient = {
  url: `${vinfastOrigin}/modules/custom/vinfast_price/assets/js/vinfast_price.js?tnax8z`,
  sha256: '941498c9d79528ab1df1d7555ddebd227e3e81c5ef0168ee9b8f13f54eb8b560',
};
export const vinfastPageUrl = (model: (typeof vinfastModels)[number]) =>
  `${vinfastOrigin}/en/vehicles/${model}`;
export const vinfastReceiptSchema = z.strictObject({
  url: z.url().refine((value) => {
    const u = new URL(value);
    return u.origin === vinfastOrigin && !u.username && !u.password;
  }),
  status: z.number().int().min(100).max(599),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.iso.datetime(),
  province: province.nullable(),
});
export function vinfastText(input: string) {
  const entities: Record<string, string> = {
    amp: '&',
    nbsp: ' ',
    quot: '"',
    apos: "'",
    rsquo: '’',
    lsquo: '‘',
    ndash: '–',
    mdash: '—',
    lt: '<',
    gt: '>',
  };
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
      if (!key.startsWith('#')) return entities[key.toLowerCase()] ?? entity;
      const n = key[1]?.toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}
function attribute(tag: string, name: string) {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return match?.[1] ?? match?.[2];
}
function divs(html: string, match: (tag: string) => boolean) {
  if (html.length > 5_000_000) throw new Error('VinFast source exceeds reviewed size bound.');
  const safe = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const stack: { start: number; keep: boolean }[] = [],
    results: string[] = [];
  for (const token of safe.matchAll(/<\/?div\b[^>]*>/gi)) {
    if (/^<\//.test(token[0])) {
      const open = stack.pop();
      if (!open) throw new Error('VinFast source div structure changed.');
      if (open.keep) results.push(safe.slice(open.start, token.index + token[0].length));
    } else stack.push({ start: token.index, keep: match(token[0]) });
  }
  if (stack.some((s) => s.keep)) throw new Error('Truncated VinFast price/terms block.');
  return results;
}
const byClass = (html: string, name: string) =>
  divs(html, (tag) => (attribute(tag, 'class') ?? '').split(/\s+/).includes(name));
function byId(html: string, id: string) {
  const found = divs(html, (tag) => attribute(tag, 'id') === id);
  if (found.length !== 1)
    throw new Error(`VinFast required ${id} source block is missing or duplicated.`);
  return found[0]!;
}
function only(values: string[], name: string) {
  if (values.length !== 1) throw new Error(`VinFast ${name} is missing or ambiguous.`);
  return values[0]!;
}
function amount(input: string) {
  if (!/^\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?$/.test(input))
    throw new Error('VinFast price is not an explicit dollar amount.');
  return money.parse(Number(input.slice(1).replaceAll(',', '')));
}
export function vinfastLineup(html: string) {
  const values = new Set<string>();
  for (const link of html.matchAll(/<a\b[^>]*href=(?:"([^"]*)"|'([^']*)')/gi)) {
    const u = new URL(vinfastText(link[1] ?? link[2]!), vinfastOrigin);
    const path = /^\/(?:en\/)?vehicles\/(vf-\d+)\/?$/.exec(u.pathname);
    if (u.origin === vinfastOrigin && path) values.add(path[1]!);
  }
  if (!values.size) throw new Error('VinFast Canadian model menu is empty.');
  return [...values].sort().map((value) => model.parse(value));
}
const cardSchema = z.strictObject({
  model,
  trim,
  msrpCad: money,
  publishedAllInCad: money,
  termsId: text,
  year: z.number().int().min(1990).max(2100).nullable(),
  cashYearEvidence: z
    .strictObject({
      kind: z.literal('new-unregistered-cash-msrp'),
      model,
      trim,
      year: z.number().int().min(1990).max(2100),
      msrpCad: money,
      publishedAllInCad: money,
    })
    .nullable(),
  unqualifiedYearCandidates: z.array(z.number().int().min(1990).max(2100)),
});
export function vinfastPricePage(
  html: string,
  expectedModel: (typeof vinfastModels)[number],
  p: (typeof vinfastProvinces)[number],
) {
  const offer = byId(html, 'block-offer'),
    number = expectedModel.slice(-1);
  if (!vinfastText(offer).includes(`VF ${number} Pricing`))
    throw new Error('VinFast price page model does not reconcile.');
  const cards = byClass(offer, 'vehicle-item').map((card) => {
    const t = trim.parse(vinfastText(only(byClass(card, 'vehicle-class'), 'trim')));
    if (!vinfastText(only(byClass(card, 'slogan'), 'model label')).includes(`VinFast VF ${number}`))
      throw new Error('VinFast price card identifies a different model.');
    let msrpCad: number | undefined,
      publishedAllInCad: number | undefined,
      termsId: string | undefined;
    for (const item of byClass(card, 'vehicle-price-item')) {
      const label = vinfastText(only(byClass(item, 'sub-price'), 'price basis'));
      const price = amount(vinfastText(only(byClass(item, 'price'), 'price amount')));
      if (/^MSRP\s*1$/.test(label)) {
        if (msrpCad !== undefined) throw new Error('Duplicated VinFast MSRP component.');
        msrpCad = price;
      } else if (/^All-in Starting Price\s*\*$/.test(label)) {
        if (publishedAllInCad !== undefined)
          throw new Error('Duplicated VinFast all-in component.');
        publishedAllInCad = price;
        termsId = /data-target="#([^"]+)"/.exec(item)?.[1];
      } else throw new Error('VinFast price basis changed; review before refresh.');
    }
    const expectedTerms = `${expectedModel.replace('-', '')}-${t.toLowerCase()}-terms-modal`;
    if (termsId !== expectedTerms || msrpCad === undefined || publishedAllInCad === undefined)
      throw new Error('VinFast price/terms join is incomplete.');
    const terms = vinfastText(byId(html, termsId));
    if (!terms.startsWith(`${provinceNames[p]} Terms `))
      throw new Error('VinFast public province preference was not honored.');
    const cash =
      /^.*?Selling Price of a new and previously unregistered (20\d{2}) VF\s*([89]) (ECO|PLUS) is (\$[\d,.]+) and includes MSRP of (\$[\d,.]+),/.exec(
        terms,
      );
    let year: number | null = null;
    if (cash) {
      if (
        cash[2] !== number ||
        cash[3] !== t ||
        amount(cash[4]!) !== publishedAllInCad ||
        amount(cash[5]!) !== msrpCad
      )
        throw new Error('VinFast exact-year cash terms and price card conflict.');
      const years = [...terms.matchAll(/\b20\d{2}\b/g)].map((m) => m[0]);
      if (
        years.length !== 1 ||
        /\b(?:expir(?:es|y|ation)|valid (?:until|through|from)|offer (?:ends|period)|limited.time)\b/i.test(
          terms,
        ) ||
        /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d|\b\d{1,2}\/\d{1,2}\b/i.test(
          terms,
        ) ||
        !terms.includes(`Offer only valid for residents of ${provinceNames[p]}.`)
      )
        throw new Error(
          'VinFast cash terms acquired a date/eligibility qualification; review before assigning a year.',
        );
      year = Number(cash[1]);
    }
    const candidates = [...terms.matchAll(/\b(20\d{2})\s+VF\s*([89])\s+(ECO|PLUS)\b/gi)]
      .filter((m) => m[2] === number && m[3]!.toUpperCase() === t)
      .map((m) => Number(m[1]));
    return cardSchema.parse({
      model: expectedModel,
      trim: t,
      msrpCad,
      publishedAllInCad,
      termsId,
      year,
      cashYearEvidence:
        year === null
          ? null
          : {
              kind: 'new-unregistered-cash-msrp',
              model: expectedModel,
              trim: t,
              year,
              msrpCad,
              publishedAllInCad,
            },
      unqualifiedYearCandidates: year === null ? [...new Set(candidates)].sort() : [],
    });
  });
  if (cards.length !== 2 || new Set(cards.map((c) => c.trim)).size !== 2)
    throw new Error('VinFast complete Eco/Plus price-card coverage does not reconcile.');
  return cards.sort((a, b) => a.trim.localeCompare(b.trim));
}
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  market: z.literal('CA'),
  currency: z.literal('CAD'),
  retrievedAt: z.iso.datetime(),
  overviewSource: vinfastReceiptSchema,
  pricingClient: vinfastReceiptSchema,
  models: z.array(model).min(1),
  pages: z
    .array(
      z.strictObject({ model, province, source: vinfastReceiptSchema, cards: z.array(cardSchema) }),
    )
    .min(1),
});
export type VinfastSnapshot = z.infer<typeof snapshotSchema>;
export function vinfastProfiles(snapshot: VinfastSnapshot) {
  return snapshot.models.flatMap((m) =>
    (['ECO', 'PLUS'] as const).map((t) => {
      const pages = snapshot.pages.filter((p) => p.model === m),
        cards = pages.map((p) => p.cards.find((c) => c.trim === t));
      if (cards.some((c) => !c)) throw new Error('VinFast required regional trim is missing.');
      const first = cards[0]!;
      if (cards.some((c) => c!.msrpCad !== first.msrpCad || c!.year !== first.year))
        throw new Error(
          'VinFast regional MSRP/model-year context conflicts; review before combining.',
        );
      return {
        model: m,
        trim: t,
        year: first.year,
        msrpCad: first.msrpCad,
        provinces: pages.map((p) => p.province),
      };
    }),
  );
}
export function validateVinfastSnapshot(input: unknown) {
  const s = snapshotSchema.parse(input);
  function source(
    r: z.infer<typeof vinfastReceiptSchema>,
    url: string,
    p: (typeof vinfastProvinces)[number] | null,
  ) {
    if (r.status !== 200 || r.url !== url || r.province !== p)
      throw new Error('VinFast required source HTTP/URL/province context changed.');
  }
  source(s.overviewSource, `${vinfastOrigin}/en`, null);
  source(s.pricingClient, vinfastPricingClient.url, null);
  if (s.pricingClient.sha256 !== vinfastPricingClient.sha256)
    throw new Error('VinFast public province client changed; review before refresh.');
  if (
    new Set(s.models).size !== s.models.length ||
    s.pages.length !== s.models.length * vinfastProvinces.length
  )
    throw new Error('VinFast model/province source coverage is missing or duplicated.');
  for (const m of s.models)
    for (const p of vinfastProvinces) {
      const rows = s.pages.filter((r) => r.model === m && r.province === p);
      if (rows.length !== 1)
        throw new Error('VinFast required model/province source is missing or duplicated.');
      const row = rows[0]!;
      source(row.source, vinfastPageUrl(m), p);
      if (
        row.cards.length !== 2 ||
        row.cards.some((c) => c.model !== m) ||
        new Set(row.cards.map((c) => c.trim)).size !== 2
      )
        throw new Error('VinFast complete regional trim coverage does not reconcile.');
      for (const card of row.cards) {
        const proof = card.cashYearEvidence;
        if (
          card.termsId !== `${m.replace('-', '')}-${card.trim.toLowerCase()}-terms-modal` ||
          (card.year === null
            ? proof !== null
            : !proof ||
              proof.year !== card.year ||
              proof.model !== m ||
              proof.trim !== card.trim ||
              proof.msrpCad !== card.msrpCad ||
              proof.publishedAllInCad !== card.publishedAllInCad)
        )
          throw new Error('VinFast exact model-year/trim/cash-price evidence does not reconcile.');
      }
    }
  const times = [s.overviewSource, s.pricingClient, ...s.pages.map((p) => p.source)]
    .map((r) => r.capturedAt)
    .sort();
  if (
    s.retrievedAt !== times.at(-1) ||
    Date.parse(times.at(-1)!) - Date.parse(times[0]!) > 86400000
  )
    throw new Error('VinFast original source capture window/review date does not reconcile.');
  vinfastProfiles(s);
  return s;
}
export function vinfastNoRegression(previous: VinfastSnapshot, next: VinfastSnapshot) {
  if (Date.parse(next.retrievedAt) < Date.parse(previous.retrievedAt))
    throw new Error('VinFast refresh would replace newer evidence with older captures.');
  const profiles = vinfastProfiles(next);
  if (
    vinfastProfiles(previous).some(
      (p) =>
        !profiles.some(
          (n) => n.model === p.model && n.trim === p.trim && (p.year === null || n.year === p.year),
        ),
    )
  )
    throw new Error(
      'VinFast refresh would lose a listed trim or known model year; reconcile remaining new offerings before replacement.',
    );
}
