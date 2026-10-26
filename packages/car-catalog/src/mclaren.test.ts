import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/mclaren.json';
import { catalog, nrcanSnapshot } from './index';
import { catalogCoverage } from './coverage';
import {
  mclarenFactory,
  mclarenLanding,
  mclarenNavigation,
  mclarenNoRegression,
  validateMclarenSnapshot,
} from './mclaren-import';
import { mclarenReviewGaps } from './mclaren';

const snapshot = validateMclarenSnapshot(data);
const cars = catalog.cars.filter((c) => c.make === 'McLaren');
const selected = snapshot.profiles.find((p) => p.id === 'artura')!;
const initial = () => ({
  items: [
    {
      country: 'CA',
      language: 'en',
      profileName: 'ARTURA',
      profileInfo: [
        { identifier: 'webui.profileDescription', value: 'McLaren Artura' },
        ...['webui.loginRequired', 'webui.showPriceSummary', 'webui.showPricesByCountry'].map(
          (identifier) => ({ identifier, value: 'false' }),
        ),
      ],
    },
  ],
});
const general = () => ({
  items: [
    ['CH_GEN_COUNTRY', 'Country', 'CA'],
    ['CH_GEN_MODEL_YEAR', 'Model Year', '2027'],
    ['CH_GEN_MODEL', 'Model', 'P16'],
    ['CH_GEN_BODY_STYLE', 'Body Style', 'COUPE'],
    ['CH_GEN_HYBRID_VEHI_CBOX', 'Hybrid VEHI Clasification', 'Y'],
  ].map(([name, langName, value]) => ({ name, langName, value: [value], visible: false })),
});

describe('McLaren Canadian explicit factory identities', () => {
  it('reconciles five 2027 Canadian factory profiles outside the NRCan make baseline', () => {
    expect(cars).toHaveLength(5);
    expect(snapshot.profiles.map((p) => [p.id, p.year, p.country])).toEqual([
      ['artura', 2027, 'CA'],
      ['artura-spider', 2027, 'CA'],
      ['750s', 2027, 'CA'],
      ['750s-spider', 2027, 'CA'],
      ['gts', 2027, 'CA'],
    ]);
    expect(
      cars.every(
        (c) =>
          c.recordKind === 'retail-trim' &&
          c.availability.status === 'manufacturer-listed' &&
          !c.governmentRating,
      ),
    ).toBe(true);
    expect(cars.filter((c) => c.fuel === 'Plug-in hybrid')).toHaveLength(2);
    expect(cars.filter((c) => c.bodyStyle === 'Convertible')).toHaveLength(2);
    const coverage = catalogCoverage(catalog, nrcanSnapshot);
    expect(coverage.ratingRecordsRepresented).toBe(coverage.ratingRecordsExpected);
    expect(coverage.fullMarketCoverageVerified).toBe(false);
    expect(coverage.byMake.find((m) => m.make === 'McLaren')).toMatchObject({
      records: 5,
      retailConfigurations: 5,
      verifiedPrices: 0,
    });
  });
  it('withholds global numeric specifications, Canadian prices and unverified stock or special models', () => {
    for (const c of cars) {
      expect(Object.values(c.facts).every((f) => f.value === null && !!f.note)).toBe(true);
      expect(c.facts.msrpCad.note).toContain('explicitly disables price display');
      expect(c.publishedPrice).toBeUndefined();
      expect(c.manufacturerConfiguration?.transmission).toBe('Not verified');
      expect(c.availability.note).toContain('configured-default profile');
    }
    expect(cars.some((c) => c.year === 2026 || /W1|788HS/.test(c.model))).toBe(false);
    expect(
      mclarenReviewGaps(snapshot)
        .filter((g) => g.field === 'canadian-offering')
        .map((g) => ('configuration' in g ? g.configuration : '')),
    ).toEqual(['788HS', '788HS SPIDER', 'W1']);
    expect(
      mclarenReviewGaps(snapshot).find((g) => g.field === 'older-new-stock')?.reason,
    ).toContain('2026 GTS');
    expect(JSON.stringify(snapshot)).not.toMatch(
      /"(?:windowId|cookie|headers|email|longTextValue|description)"/i,
    );
  });
  it('requires an explicit named year and country even when they are absent from the visible summary', () => {
    expect(mclarenFactory('artura', initial(), general(), selected.sources)).toMatchObject({
      year: 2027,
      body: 'COUPE',
      hybrid: true,
      country: 'CA',
    });
    for (const change of [
      (d: ReturnType<typeof general>) => {
        d.items = d.items.filter((x) => x.name !== 'CH_GEN_MODEL_YEAR');
      },
      (d: ReturnType<typeof general>) => {
        d.items.find((x) => x.name === 'CH_GEN_MODEL_YEAR')!.value = ['MY27'];
      },
      (d: ReturnType<typeof general>) => {
        d.items.find((x) => x.name === 'CH_GEN_MODEL_YEAR')!.langName = 'Copyright Year';
      },
      (d: ReturnType<typeof general>) => {
        d.items.find((x) => x.name === 'CH_GEN_COUNTRY')!.value = ['US'];
      },
      (d: ReturnType<typeof general>) => {
        d.items.push(d.items[0]!);
      },
    ]) {
      const d = general();
      change(d);
      expect(() => mclarenFactory('artura', initial(), d, selected.sources)).toThrow();
    }
    const privateInitial = initial();
    privateInitial.items[0]!.profileInfo[1]!.value = 'true';
    expect(() => mclarenFactory('artura', privateInitial, general(), selected.sources)).toThrow(
      /flags/,
    );
    expect(() => mclarenFactory('gts', initial(), general(), selected.sources)).toThrow(/profile/);
  });
  it('rejects unavailable countries, private access and model aliases in landing data', () => {
    const landing = {
      loginRequired: false,
      clientCountryPreferred: 'CA',
      profileDescription: 'McLaren Artura',
      backupProfile: null,
      countries: { america: ['CA', 'US'] },
      restrictedCountries: [] as string[],
    };
    expect(mclarenLanding(landing, 'artura')).toEqual({ name: 'McLaren Artura' });
    for (const d of [
      { ...landing, loginRequired: true },
      { ...landing, clientCountryPreferred: 'US' },
      { ...landing, restrictedCountries: ['CA'] },
      { ...landing, profileDescription: 'McLaren 750S' },
      { ...landing, backupProfile: '750s' },
    ])
      expect(() => mclarenLanding(d, 'artura')).toThrow();
  });
  it('reconciles configuration links without promoting global road models or race cars', () => {
    const nav = {
      content: [
        {
          data: {
            title: 'MODELS',
            categories: [
              {
                category_name: 'Models',
                models: snapshot.navigation.map((n) => ({
                  model_title: n.name,
                  primary_slug: n.slug,
                  secondary_url: n.profile
                    ? `https://configurator.mclaren.com/mclaren-ui/?model/${n.profile}`
                    : null,
                  secondary_link_enabled: !!n.profile,
                })),
              },
            ],
          },
        },
      ],
    };
    expect(mclarenNavigation(nav)).toHaveLength(snapshot.navigation.length);
    const copy = structuredClone(nav);
    copy.content[0]!.data.categories[0]!.models[0]!.secondary_url =
      'https://configurator.mclaren.com/mclaren-ui/?model/unknown';
    expect(() => mclarenNavigation(copy)).toThrow();
    const missing = structuredClone(nav);
    missing.content[0]!.data.categories[0]!.models.shift();
    expect(() => mclarenNavigation(missing)).toThrow(/menu changed/);
  });
  it('rejects broken source, public client, model, body, year-source and capture joins', () => {
    const changes: ((s: typeof snapshot) => void)[] = [
      (s) => {
        s.profiles.pop();
      },
      (s) => {
        s.profiles[0]!.country = 'US' as 'CA';
      },
      (s) => {
        s.profiles[0]!.body = 'SPIDER';
      },
      (s) => {
        s.profiles[0]!.hybrid = false;
      },
      (s) => {
        s.profiles[0]!.modelCode = 'P28';
      },
      (s) => {
        s.profiles[0]!.name = 'McLaren 750S';
      },
      (s) => {
        s.sources.client.sha256 = '0'.repeat(64);
      },
      (s) => {
        s.profiles[0]!.sources.landing.url = s.profiles[0]!.sources.landing.url.replace(
          'country=CA',
          'country=US',
        );
      },
      (s) => {
        s.profiles[0]!.sources.general.url = s.profiles[0]!.sources.general.url.replace(
          'CSTIC_VIEW_0',
          'DEFAULT_GROUP',
        );
      },
      (s) => {
        s.retrievedAt = '2026-10-27T00:00:00.000Z';
      },
      (s) => {
        s.sources.menu.capturedAt = '2026-10-20T00:00:00.000Z';
      },
    ];
    for (const change of changes) {
      const copy = structuredClone(snapshot);
      change(copy);
      expect(() => validateMclarenSnapshot(copy)).toThrow();
    }
  });
  it('requires review of lost profiles, year changes and older snapshots before refresh', () => {
    for (const change of [
      (s: typeof snapshot) => {
        s.profiles.pop();
      },
      (s: typeof snapshot) => {
        s.profiles[0]!.year = 2028;
      },
      (s: typeof snapshot) => {
        s.retrievedAt = '2026-10-25T00:00:00.000Z';
      },
    ]) {
      const copy = structuredClone(snapshot);
      change(copy);
      expect(() => mclarenNoRegression(snapshot, copy)).toThrow();
    }
  });
});
