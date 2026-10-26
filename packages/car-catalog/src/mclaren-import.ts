import { z } from 'zod';

export const mclarenOrigin = 'https://configurator.mclaren.com';
export const mclarenCmsOrigin = 'https://mclaren-cms.production.aws.mclaren.com';
export const mclarenProfiles = ['artura', 'artura-spider', '750s', '750s-spider', 'gts'] as const;
const profileId = z.enum(mclarenProfiles);
export const mclarenPageUrl = (id: string) => `${mclarenOrigin}/mclaren-ui/?model/${id}`;
export const mclarenClientUrl = `${mclarenOrigin}/mclaren-ui/assets/index-8XucOWk-.js`;
export const mclarenClientHash = '27cec051d887efdaae7e5f57fc1545bc7ecf79cdd32f601ae7a1f73af679f540';
export const mclarenMenuUrl = `${mclarenCmsOrigin}/api/mainnav?site=1`;
export const mclarenLandingUrl = (id: string) =>
  `${mclarenOrigin}/configuration/ajaxLandingPageData.do?profileName=${id}&country=CA&language=en`;
const reviewed = {
  artura: { name: 'McLaren Artura', model: 'P16', body: 'COUPE', hybrid: true },
  'artura-spider': { name: 'McLaren Artura Spider', model: 'P16', body: 'SPIDER', hybrid: true },
  '750s': { name: 'McLaren 750S', model: 'P28', body: 'COUPE', hybrid: false },
  '750s-spider': { name: 'McLaren 750S Spider', model: 'P28', body: 'SPIDER', hybrid: false },
  gts: { name: 'McLaren GTS', model: 'P22S', body: 'GT', hybrid: false },
} as const;
export const mclarenReceiptSchema = z.strictObject({
  url: z.url().refine((s) => {
    const u = new URL(s);
    return (
      [mclarenOrigin, mclarenCmsOrigin, 'https://www.mclaren.com'].includes(u.origin) &&
      !u.username &&
      !u.password
    );
  }),
  status: z.literal(200),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.iso.datetime(),
});
export type MclarenReceipt = z.infer<typeof mclarenReceiptSchema>;
const navSchema = z.strictObject({
  category: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().regex(/^cars\/gl_en\//),
  profile: profileId.nullable(),
});
const factorySchema = z.strictObject({
  id: profileId,
  name: z.string().min(1),
  profileName: z.string().min(1),
  country: z.literal('CA'),
  modelCode: z.string().min(1),
  body: z.enum(['COUPE', 'SPIDER', 'GT']),
  year: z.number().int().min(2020).max(2100),
  hybrid: z.boolean(),
  priceDisplay: z.literal(false),
  sources: z.strictObject({
    landing: mclarenReceiptSchema,
    initial: mclarenReceiptSchema,
    general: mclarenReceiptSchema,
  }),
});
const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  market: z.literal('CA'),
  retrievedAt: z.iso.datetime(),
  sources: z.strictObject({
    bootstrap: mclarenReceiptSchema,
    client: mclarenReceiptSchema,
    menu: mclarenReceiptSchema,
  }),
  navigation: z.array(navSchema).min(1).max(100),
  profiles: z.array(factorySchema).length(5),
});
export type MclarenSnapshot = z.infer<typeof snapshotSchema>;
export function mclarenNavigation(input: unknown): MclarenSnapshot['navigation'] {
  const root = z
    .object({ content: z.array(z.object({ data: z.record(z.string(), z.unknown()) })) })
    .parse(input);
  const models = root.content.filter((b) => b.data.title === 'MODELS');
  if (models.length !== 1) throw new Error('McLaren model navigation is missing or ambiguous.');
  const categories = z
    .array(
      z.object({
        category_name: z.string(),
        models: z.array(
          z.object({
            model_title: z.string(),
            primary_slug: z.string(),
            secondary_url: z.string().nullable().optional(),
            secondary_link_enabled: z.boolean(),
          }),
        ),
      }),
    )
    .parse(models[0]!.data.categories);
  const rows = categories.flatMap((c) =>
    c.models.map((m) => {
      let profile: z.infer<typeof profileId> | null = null;
      if (m.secondary_url) {
        const u = new URL(m.secondary_url);
        if (
          u.origin !== mclarenOrigin ||
          u.pathname !== '/mclaren-ui/' ||
          !u.search.startsWith('?model/')
        )
          throw new Error('McLaren configuration link changed.');
        if (!m.secondary_link_enabled)
          throw new Error('Disabled McLaren configuration link requires review.');
        profile = profileId.parse(u.search.slice(7));
      }
      return navSchema.parse({
        category: c.category_name,
        name: m.model_title.trim(),
        slug: m.primary_slug,
        profile,
      });
    }),
  );
  if (new Set(rows.map((r) => r.slug)).size !== rows.length)
    throw new Error('Duplicate McLaren model page.');
  const ids = rows.flatMap((r) => (r.profile ? [r.profile] : [])).sort();
  if (JSON.stringify(ids) !== JSON.stringify([...mclarenProfiles].sort()))
    throw new Error('McLaren current configuration menu changed; review every model.');
  return rows;
}
export function mclarenLanding(input: unknown, id: z.infer<typeof profileId>) {
  const d = z
    .object({
      loginRequired: z.literal(false),
      clientCountryPreferred: z.literal('CA'),
      profileDescription: z.string(),
      backupProfile: z.null(),
      countries: z.record(z.string(), z.array(z.string())),
      restrictedCountries: z.array(z.string()),
    })
    .parse(input);
  if (
    d.profileDescription !== reviewed[id].name ||
    !Object.values(d.countries).flat().includes('CA') ||
    d.restrictedCountries.includes('CA')
  )
    throw new Error('McLaren Canadian landing/profile join failed.');
  return { name: d.profileDescription };
}
export function mclarenFactory(
  id: z.infer<typeof profileId>,
  initialInput: unknown,
  generalInput: unknown,
  sources: z.infer<typeof factorySchema>['sources'],
) {
  const initial = z
    .object({
      items: z
        .array(
          z.object({
            country: z.literal('CA'),
            language: z.literal('en'),
            profileName: z.string(),
            profileInfo: z.array(
              z.object({ identifier: z.string(), value: z.string().nullable() }),
            ),
          }),
        )
        .length(1),
    })
    .parse(initialInput).items[0]!;
  const info = new Map(initial.profileInfo.map((x) => [x.identifier, x.value]));
  if (
    info.size !== initial.profileInfo.length ||
    initial.profileName.toLowerCase() !== id ||
    info.get('webui.profileDescription') !== reviewed[id].name ||
    ['webui.loginRequired', 'webui.showPriceSummary', 'webui.showPricesByCountry'].some(
      (k) => info.get(k) !== 'false',
    )
  )
    throw new Error('McLaren public country/profile/price flags changed; review before importing.');
  const rows = z
    .object({
      items: z.array(
        z.object({ name: z.string(), langName: z.string().nullable(), value: z.array(z.string()) }),
      ),
    })
    .parse(generalInput).items;
  const get = (name: string, label: string) => {
    const matches = rows.filter((x) => x.name === name);
    if (matches.length !== 1 || matches[0]!.langName !== label || matches[0]!.value.length !== 1)
      throw new Error(`McLaren explicit ${name} identity is missing or ambiguous.`);
    return matches[0]!.value[0]!;
  };
  if (get('CH_GEN_COUNTRY', 'Country') !== 'CA')
    throw new Error('McLaren factory country is not Canada.');
  const year = get('CH_GEN_MODEL_YEAR', 'Model Year');
  if (!/^20\d{2}$/.test(year))
    throw new Error('McLaren model year is not an explicit four-digit year.');
  const hybrid = get('CH_GEN_HYBRID_VEHI_CBOX', 'Hybrid VEHI Clasification');
  if (!['Y', 'N'].includes(hybrid)) throw new Error('McLaren hybrid classification changed.');
  return factorySchema.parse({
    id,
    name: reviewed[id].name,
    profileName: initial.profileName,
    country: 'CA',
    modelCode: get('CH_GEN_MODEL', 'Model'),
    body: get('CH_GEN_BODY_STYLE', 'Body Style'),
    year: Number(year),
    hybrid: hybrid === 'Y',
    priceDisplay: false,
    sources,
  });
}
export function validateMclarenSnapshot(input: unknown): MclarenSnapshot {
  const s = snapshotSchema.parse(input),
    receipts = [
      ...Object.values(s.sources),
      ...s.profiles.flatMap((p) => Object.values(p.sources)),
    ];
  if (
    s.sources.bootstrap.url !== mclarenPageUrl('gts') ||
    s.sources.client.url !== mclarenClientUrl ||
    s.sources.client.sha256 !== mclarenClientHash ||
    s.sources.menu.url !== mclarenMenuUrl
  )
    throw new Error('McLaren production client/menu source changed; review it.');
  const ids = s.profiles.map((p) => p.id).sort(),
    nav = s.navigation.flatMap((n) => (n.profile ? [n.profile] : [])).sort();
  if (
    JSON.stringify(ids) !== JSON.stringify([...mclarenProfiles].sort()) ||
    JSON.stringify(nav) !== JSON.stringify(ids) ||
    new Set(s.navigation.map((n) => n.slug)).size !== s.navigation.length
  )
    throw new Error('McLaren menu and factory identities do not reconcile.');
  for (const p of s.profiles) {
    const r = reviewed[p.id];
    if (
      p.name !== r.name ||
      p.profileName.toLowerCase() !== p.id ||
      p.modelCode !== r.model ||
      p.body !== r.body ||
      p.hybrid !== r.hybrid
    )
      throw new Error('McLaren reviewed model/body/powertrain identity changed.');
    if (p.sources.landing.url !== mclarenLandingUrl(p.id))
      throw new Error('McLaren Canadian landing source changed.');
    for (const key of ['initial', 'general'] as const) {
      const u = new URL(p.sources[key].url);
      const params = [...u.searchParams.keys()];
      if (
        u.origin !== mclarenOrigin ||
        u.pathname !==
          `/configuration/${key === 'initial' ? 'ajaxGetInitialData.do' : 'ajaxGetCharacteristics.do'}` ||
        params.some((k) => !['cacheControl', 'instanceId', 'csticViewId'].includes(k)) ||
        (key === 'general' &&
          (u.searchParams.get('csticViewId') !== 'CSTIC_VIEW_0' ||
            u.searchParams.get('instanceId') !== '1'))
      )
        throw new Error('McLaren explicit year/country source route changed.');
    }
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
    throw new Error('McLaren source capture dates do not reconcile.');
  return s;
}
export function mclarenNoRegression(before: MclarenSnapshot, after: MclarenSnapshot) {
  if (
    Date.parse(after.retrievedAt) < Date.parse(before.retrievedAt) ||
    before.profiles.some((p) => !after.profiles.some((q) => p.id === q.id && q.year === p.year))
  )
    throw new Error(
      'McLaren refresh loses a reviewed profile/year or moves backwards; review older new stock before advancing years.',
    );
}
