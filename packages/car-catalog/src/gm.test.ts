import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/gm.json';
import { catalog, gmSnapshot } from './index';
import {
  gmConfiguration,
  gmMatrix,
  gmMsrp,
  gmOptionKey,
  gmReferences,
  gmModelIdentity,
  validateGmSnapshot,
} from './gm-import';
import type { GmOption } from './gm-import';
import { gmDrive, gmFacts, gmFuel, gmRecordId } from './gm';

const option: GmOption = {
  styleId: 475054,
  bodyTypeId: 2,
  driveType: '2WD',
  mmcPeg: 'CC10903_1WT',
  trimName: 'WT',
  engine: 'L84',
  transmission: 'MHT',
  axleRatio: 'GU5',
  battery: null,
  propulsion: null,
  ss: 'source-state',
};
const component = (
  code: string,
  value: number,
  category = 'exterior.mechanical',
  dealerInstalled = false,
) => ({
  code,
  selected: true,
  description: code,
  dealerInstalled,
  priceState: 'Actual',
  msrpDisplay: { amount: { value }, display: null },
  hierarchy: { step: 'options', category },
  appliedPackageCash: false,
  discountedPriceTotal: null,
  opdMsrp: null,
  rpoCash: null,
});
const calculation = () => ({
  config: {
    styleId: option.styleId,
    selected: ['L84', 'MHT', 'GU5', 'G80'],
    ss: 'returned-state',
    summary: {
      keyAttributes: [],
      options: [
        {
          key: 'options',
          options: [
            component('L84', 2995),
            component('G80', 450),
            component('PAINT', 100, 'exterior.color'),
            component('DEALER', 900, 'accessories', true),
          ],
        },
      ],
      prices: {
        standardVehiclePrice: { value: 49299 },
        vehicleOptionsTotal: { value: 53744 },
        totalVehiclePrice: { value: 57278 },
      },
    },
  },
  modelMatrix: {
    styles: [
      {
        styleId: option.styleId,
        selected: true,
        styleConfig: {
          styleId: option.styleId,
          engine: 'L84',
          transmission: 'MHT',
          axleRatio: 'GU5',
          battery: null,
          propulsion: null,
        },
        vehicleInfo: {
          bodyTypeId: 2,
          mmcPeg: option.mmcPeg,
          bodyStyleTitle: 'Silverado 1500',
          orderAvailabilityType: 'retail',
        },
      },
    ],
  },
});
const byModel = (record: (typeof gmSnapshot.records)[number]) =>
  gmSnapshot.models.find((model) => model.key === record.modelKey)!;
const v8 = gmSnapshot.records.find(
  (record) =>
    record.modelKey === 'chevrolet/silverado-1500/2026/silverado-1500' &&
    record.option.styleId === 475054 &&
    record.option.engine === 'L84' &&
    record.option.axleRatio === 'GU5',
)!;

describe('GM Canadian factory matrices and calculations', () => {
  it('reconciles every captured model and full powertrain tuple without reducing styles to default engines', () => {
    expect(gmSnapshot.models).toHaveLength(83);
    expect(gmSnapshot.records).toHaveLength(1230);
    expect(
      new Set(
        gmSnapshot.records
          .filter((record) => record.modelKey === 'chevrolet/silverado-1500/2026/silverado-1500')
          .map((record) => record.option.styleId),
      ).size,
    ).toBe(35);
    expect(
      gmSnapshot.records.filter(
        (record) => record.modelKey === 'chevrolet/silverado-1500/2026/silverado-1500',
      ),
    ).toHaveLength(121);
    expect(catalog.cars.filter((car) => car.id.startsWith('gm-ca-'))).toHaveLength(1230);
  });
  it('rejects missing or duplicate variants, broken country/year identities, missing lineups and calculation-source substitutions', () => {
    const changes = [
      (value: typeof data) => value.records.pop(),
      (value: typeof data) => value.models.pop(),
      (value: typeof data) => value.records.push(value.records[0]!),
      (value: typeof data) => {
        value.models[0]!.reference.year++;
      },
      (value: typeof data) => {
        value.lineupSources = value.lineupSources.filter(
          (source) => !source.url.includes('gmccanada'),
        );
      },
      (value: typeof data) => {
        const record = value.records.find((record) => record.configuration)!;
        record.configuration!.source.url = 'https://example.com/unreviewed';
      },
      (value: typeof data) => {
        const record = value.records.find((record) => !record.configuration)!;
        (record as { configurationGap: string | null }).configurationGap = null;
      },
    ];
    for (const change of changes) {
      const value = structuredClone(data);
      change(value);
      expect(() => validateGmSnapshot(value)).toThrow();
    }
  });
  it('decodes nested EV battery/propulsion identities and rejects lost trim configurations', () => {
    const ev = {
      ...option,
      styleId: 1,
      engine: 'EN0',
      transmission: 'MF1',
      axleRatio: null,
      battery: 'BAT1',
      propulsion: 'XRJ',
      driveType: '4WD',
    };
    const matrix = {
      options: [ev],
      engines: [],
      transmissions: [],
      batteries: [],
      propulsions: [],
      axleRatios: [],
      bodyTypes: [{ id: 2, description: 'Pickup', cabSize: 'crew' }],
      trims: [
        {
          styleId: 1,
          bodyTypeId: 2,
          mmcPeg: ev.mmcPeg,
          trimName: 'WT',
          driveType: { id: '4WD' },
          lateAvailabilityDisclaimer: null,
          configurations: [
            {
              ...ev,
              engine: { code: 'EN0' },
              transmission: { code: 'MF1' },
              battery: { code: 'BAT1' },
              propulsion: { code: 'XRJ' },
            },
          ],
        },
      ],
    };
    expect(gmOptionKey(gmMatrix(matrix).options[0]!)).toBe('1/EN0/MF1/none/BAT1/XRJ');
    expect(() => gmMatrix({ ...matrix, options: [{ ...ev, axleRatio: 'OTHER' }] })).toThrow(
      /identity mismatch/,
    );
    expect(() => gmMatrix({ ...matrix, options: [ev, { ...ev, battery: 'BAT2' }] })).toThrow(
      /Incomplete/,
    );
  });
  it('includes selectable previous years while ignoring templates, hidden reference text, US links and unrelated hosts', () => {
    const url = (year: number) =>
      `https://www.buick.ca/byo-vc/client/en/CA/buick/envista/${year}/envista/trims`;
    const html = `<main><a href="${url(2026)}">current</a><li class="gb-hide"><a href="${url(2025)}">previous</a></li><template><a href="${url(2024)}">stale</a></template><h3 class="hide-for-small hide-for-medium hide-for-large hide-for-xlarge hide-for-xxlarge"><a href="${url(2023)}">hidden</a></h3><a href="${url(2027).replace('/CA/', '/US/')}">US</a><a href="${url(2027).replace('www.buick.ca', 'example.com')}">unreviewed</a></main>`;
    expect(gmReferences(html, 'buick').models.map((model) => model.year)).toEqual([2026, 2025]);
    expect(gmReferences(html, 'buick').hidden.map((model) => model.year)).toEqual([2023]);
  });
  it('reads model identity JSON without executing scripts and requires an exact Canadian model/year match', () => {
    const model = { brand: 'buick' as const, carline: 'envista', year: 2026, bodyStyle: 'envista' };
    const identity = {
      ...model,
      country: 'CA',
      language: 'en',
      bodyStyleTitle: 'Envista',
      evMode: false,
      extra: 'a } in quoted text',
    };
    expect(
      gmModelIdentity(
        `<script>window.appResources=${JSON.stringify(identity)};throw new Error('never executed')</script>`,
        model,
      ).year,
    ).toBe(2026);
    expect(() =>
      gmModelIdentity(
        `<script>window.appResources=${JSON.stringify({ ...identity, country: 'US' })}</script>`,
        model,
      ),
    ).toThrow();
    expect(() =>
      gmModelIdentity(
        `<script>window.appResources=${JSON.stringify({ ...identity, year: 2027 })}</script>`,
        model,
      ),
    ).toThrow(/mismatch/);
  });
  it('reconciles complete factory MSRP and excludes freight, fees, paid colours and dealer products', () => {
    expect(gmMsrp(calculation(), option).value).toBe(52744);
    expect(gmFacts(v8, byModel(v8)).msrpCad.value).toBe(52744);
    expect(catalog.cars.find((car) => car.id === gmRecordId(v8))!.facts.msrpCad.value).toBe(52744);
  });
  it('keeps unknown prices unknown for missing components, discounts and unresolved subtotals', () => {
    const subtotal = calculation();
    subtotal.config.summary.prices.vehicleOptionsTotal.value++;
    expect(gmMsrp(subtotal, option).value).toBeNull();
    const discount = calculation();
    discount.config.summary.options[0]!.options[0]!.appliedPackageCash = true;
    expect(gmMsrp(discount, option).value).toBeNull();
    const negative = calculation();
    negative.config.summary.options[0]!.options[0]!.msrpDisplay.amount.value = -1;
    expect(gmMsrp(negative, option).value).toBeNull();
    const missing = structuredClone(calculation()) as unknown as {
      config: {
        summary: {
          options: { options: { msrpDisplay: { amount: unknown; display: unknown } }[] }[];
        };
      };
    };
    missing.config.summary.options[0]!.options[0]!.msrpDisplay = {
      amount: null,
      display: 'See dealer',
    };
    expect(gmMsrp(missing, option).value).toBeNull();
  });
  it('never substitutes a default engine, axle or battery for an unavailable exact calculation', () => {
    expect(() => gmConfiguration(calculation(), { ...option, engine: 'L3B' })).toThrow(/differs/);
    expect(() => gmConfiguration(calculation(), { ...option, axleRatio: 'GU6' })).toThrow(
      /differs/,
    );
    const unpriced = gmSnapshot.records.find(
      (record) =>
        record.modelKey === 'buick/envista/2026/envista' && record.option.trimName === 'Avenir',
    )!;
    expect(unpriced.configuration).toBeNull();
    expect(gmFacts(unpriced, byModel(unpriced)).msrpCad.value).toBeNull();
    expect(gmFacts(unpriced, byModel(unpriced)).msrpCad.note).toContain('unverified');
  });
  it('retains passenger vans and personal HD pickups, excluding only the separately identified cargo bodies', () => {
    expect(gmSnapshot.models.filter((model) => model.excludedReason)).toHaveLength(4);
    expect(
      gmSnapshot.models
        .filter((model) => model.excludedReason)
        .reduce((sum, model) => sum + model.expectedKeys.length, 0),
    ).toBe(32);
    expect(
      gmSnapshot.records.filter((record) => record.modelKey.includes('passenger')),
    ).toHaveLength(48);
    expect(gmSnapshot.records.some((record) => record.modelKey.includes('3500hd'))).toBe(true);
    expect(gmSnapshot.records.some((record) => record.modelKey.includes('-cargo'))).toBe(false);
  });
  it('preserves engine-specific attributes and separates electric, hybrid and diesel propulsion without guessing 2WD axle layout', () => {
    expect(gmDrive(v8)).toBe('Not verified');
    expect(gmFacts(v8, byModel(v8)).horsepower.value).toBe(355);
    const hybrid = gmSnapshot.records.find((record) => record.modelKey.includes('corvette-eray'))!;
    const ev = gmSnapshot.records.find((record) => record.option.engine === 'EN0')!;
    const diesel = gmSnapshot.records.find((record) =>
      /diesel/i.test(record.engineDescription ?? ''),
    )!;
    expect(gmFuel(hybrid, byModel(hybrid))).toBe('Hybrid');
    expect(gmFuel(ev, byModel(ev))).toBe('Electric');
    expect(gmFuel(diesel, byModel(diesel))).toBe('Diesel');
    expect(gmFacts(ev, byModel(ev)).fuelCombinedL100km.value).toBeNull();
    expect(gmFacts(v8, byModel(v8)).cargoSeatsUpL.value).toBeNull();
  });
});
