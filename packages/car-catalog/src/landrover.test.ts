import { describe, it, expect } from 'vitest';
import data from '../data/manufacturers/landrover.json';
import {
  landroverJsonp,
  landroverRaw,
  landroverVisibleProducts,
  landroverBasePrice,
  landroverYear,
  validateLandroverSnapshot,
} from './landrover-import';
import { addLandroverRetail } from './landrover';
const snapshot = validateLandroverSnapshot(data);
const root = () =>
  landroverRaw({
    metadata: {
      status: '200',
      url: 'https://rules.config.landrover.com/rc/lr/en_ca/l663_k27/x.jsonp',
      meta: { Market: 'ca', SpecMarket: 'CDA', Environment: 'LIVE', 'Hides.active': 'true' },
    },
    'feature-dictionary': {
      vehicle: {
        id: 'l663',
        modelyear: 'k27',
        href: '/rc/lr/en_ca/l663_k27/x.jsonp',
        description: { en: 'DEFENDER' },
        property: {},
      },
      'feature-list': [
        {
          name: 'BODYSTYLE',
          type: 'product',
          feature: [
            {
              id: 'body',
              availability: 'default',
              compatibility: [{ 'definer-name': 'PRODUCT', refs: 'P1 P2' }],
            },
          ],
        },
        {
          name: 'MODEL',
          type: 'product',
          feature: [
            {
              id: 'model',
              availability: 'default',
              property: { 'HideRegisterCompatibility.PRODUCT': 'P1' },
              compatibility: [{ 'definer-name': 'PRODUCT', refs: 'P1 P2' }],
            },
          ],
        },
        {
          name: 'ENGINE',
          type: 'product',
          feature: [
            {
              id: 'engine',
              availability: 'default',
              compatibility: [{ 'definer-name': 'PRODUCT', refs: 'P1 P2' }],
            },
          ],
        },
        {
          name: 'PRODUCT',
          type: 'product',
          feature: ['P1', 'P2'].map((id) => ({
            id,
            availability: 'available',
            property: { definition: 'body model engine' },
          })),
        },
      ],
    },
    configuration: { summary: { price: {} } },
  });
describe('Canadian Land Rover configuration qualification', () => {
  it('retains visible products, year uncertainty and base price basis', () => {
    const c = addLandroverRetail(
      {
        schemaVersion: 1,
        reviewedAt: '2026-10-26',
        scope: 'test',
        pricingNote: 'test',
        sources: [],
        cars: [],
      },
      snapshot,
    );
    expect(c.cars).toHaveLength(42);
    expect(c.cars.filter((c) => c.year === null)).toHaveLength(13);
    expect(c.cars.filter((c) => c.year === 2027)).toHaveLength(27);
    expect(
      c.cars.find((c) => c.manufacturerConfiguration?.id === 'A-S-P300-I6-110')?.facts.msrpCad
        .value,
    ).toBe(78700);
    expect(
      c.cars.find((c) => c.manufacturerConfiguration?.id === 'A-SV1-P635-110')?.facts.msrpCad.value,
    ).toBe(179400);
    expect(c.cars.every((c) => c.facts.horsepower.value === null)).toBe(true);
    expect(c.cars.some((c) => c.manufacturerConfiguration?.id === 'A-X-P400')).toBe(false);
  });
  it('uses the public hide-register override rather than raw compatibility', () => {
    expect(landroverVisibleProducts(root()).visible.map((v) => v.product.id)).toEqual(['P1']);
    expect(landroverVisibleProducts(root()).hidden).toEqual(['P2']);
  });
  it('does not infer a model year from program codes or another family title', () => {
    expect(landroverYear(root()).year).toBeNull();
    expect(landroverYear(root(), 'Range Rover 2027 | Test').year).toBeNull();
  });
  it('rejects code execution, mismatched CAD price basis, duplicate profiles and missing coverage', () => {
    expect(() => landroverJsonp('config_rcjson({});alert(1)')).toThrow();
    expect(() =>
      landroverBasePrice({
        id: 'P',
        availability: 'default',
        price: {
          GROSS: { currency: 'CAD', value: '84360.00' },
          NET: { currency: 'CAD', value: '78700.00' },
        },
      }),
    ).toThrow();
    const duplicate = structuredClone(data);
    duplicate.profiles.push(duplicate.profiles[0]!);
    expect(() => validateLandroverSnapshot(duplicate)).toThrow(/Duplicate/);
    const missing = structuredClone(data);
    missing.profiles.pop();
    expect(() => validateLandroverSnapshot(missing)).toThrow();
  });
  it('rejects foreign-market and stale cohorts', () => {
    const r = root();
    r.metadata.meta.Market = 'us' as 'ca';
    expect(() => landroverRaw(r)).toThrow();
    const stale = structuredClone(data);
    stale.lineup.capturedAt = '2026-10-20T00:00:00.000Z';
    expect(() => validateLandroverSnapshot(stale)).toThrow(/cohort/);
  });
});
