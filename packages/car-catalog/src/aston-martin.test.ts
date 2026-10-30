import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/aston-martin.json';
import { catalog, nrcanSnapshot, retailCatalog } from './index';
import { catalogCoverage } from './coverage';
import {
  astonConfiguration,
  astonMenu,
  astonNoRegression,
  astonProduct,
  validateAstonSnapshot,
} from './aston-martin-import';
import { astonReviewGaps } from './aston-martin';

const snapshot = validateAstonSnapshot(data);
const cars = catalog.cars.filter(
  (c) => c.make === 'Aston Martin' && c.recordKind !== 'government-rating',
);
const product = {
  id: 'AM662',
  modelCode: 'M210',
  isAuthorizedOnly: false,
  meta: { isConvertible: false },
};
const translations = () => ({
  DERIVATIVE_SELECTION: {
    CTA: 'Configure',
    M210: {
      MODEL_NAME: 'Vantage',
      AM662: {
        DERIVATIVE_NAME: 'Vantage S Coupe',
        STATS: { POWER: { VALUE: { '0': '671', '1': '680' }, UNIT: { '0': 'bhp', '1': 'PS' } } },
      },
    },
  },
  STANDARD_LIST: {
    M210: {
      AM662: {
        BODY: { CONTENT: ['Two-door Coupe body style 2+0 seating'] },
        TRANSMISSION: { CONTENT: ['Rear mid-mounted ZF eight-speed automatic transmission'] },
      },
    },
  },
});

describe('Aston Martin Canadian public listings', () => {
  it('reconciles all 16 Canadian menu products, withholding stock-only and future-delivery products', () => {
    expect(snapshot.products).toHaveLength(16);
    expect(cars).toHaveLength(10);
    expect(
      snapshot.products
        .filter((p) => p.role === 'stock-only')
        .map((p) => p.id)
        .sort(),
    ).toEqual(['AM546A', 'AM576A', 'AM617', 'AM647', 'AM890']);
    expect(snapshot.products.filter((p) => p.role === 'announced-only').map((p) => p.name)).toEqual(
      ['Valen'],
    );
    expect(snapshot.valenFirstDeliveryQuarter).toBe('2027-Q2');
    expect(cars.some((c) => c.trim === 'Valen' || c.trim === 'DBX707')).toBe(false);
    expect(retailCatalog.cars.filter((c) => c.make === 'Aston Martin')).toHaveLength(0);
    expect(
      astonReviewGaps(snapshot).filter((g) => ['stock-only', 'announced-only'].includes(g.field)),
    ).toHaveLength(6);
  });
  it('does not infer year, price, government rating or Canadian consumption from global specifications', () => {
    for (const car of cars) {
      expect(car.year).toBeNull();
      expect(car.recordKind).toBe('manufacturer-offer');
      expect(car.modelYearNote).toContain('does not publish an exact model year');
      expect(car.availability.status).toBe('manufacturer-listed');
      expect(car.availability.note).toContain('order acceptance');
      expect(car.facts.msrpCad.value).toBeNull();
      expect(car.facts.msrpCad.note).toContain('No Canadian currency or price');
      expect(car.governmentRating).toBeUndefined();
      expect(car.publishedPrice).toBeUndefined();
      expect(
        Object.entries(car.facts)
          .filter(([k]) => !['horsepower', 'seats'].includes(k))
          .every(([, f]) => f.value === null && !!f.note),
      ).toBe(true);
    }
    const coverage = catalogCoverage(catalog, nrcanSnapshot);
    expect(coverage.fullMarketCoverageVerified).toBe(false);
    expect(coverage.makesWithoutCurrentManufacturerListings).not.toContain('Aston Martin');
    expect(coverage.ratingRecordsRepresented).toBe(coverage.ratingRecordsExpected);
  });
  it('preserves product-specific bhp, seating, body and hybrid identity without substituting PS', () => {
    const get = (id: string) => cars.find((c) => c.manufacturerConfiguration?.id === id)!;
    expect(get('AM662').facts.horsepower.value).toBe(671);
    expect(get('AM662').facts.seats.value).toBe(2);
    expect(get('AM682').bodyStyle).toBe('Convertible');
    expect(get('AM578').facts.horsepower.value).toBe(690);
    expect(get('AM578').facts.seats.value).toBe(4);
    expect(get('AM810').facts.seats.value).toBe(5);
    expect(get('AM810').manufacturerConfiguration?.transmission).toBe('Nine-speed automatic');
    expect(get('AM003A').fuel).toBe('Plug-in hybrid');
    expect(get('AM003A').facts.horsepower.value).toBe(1064);
    expect(get('AM003A').facts.seats.value).toBeNull();
    expect(get('AM003A').sourceIds).toContain('aston-martin-valhalla-powertrain');
    expect(get('AM003A').facts.electricRangeKm.value).toBeNull();
    // The Spider's own page describes a hybrid but not plug-in charging.
    expect(get('AM004').fuel).toBe('Hybrid');
    expect(get('AM004').bodyStyle).toBe('Convertible');
    expect(get('AM004').sourceIds).toContain('aston-martin-valhalla-spider-powertrain');
    expect(get('AM004').sourceIds).not.toContain('aston-martin-valhalla-powertrain');
  });
  it('requires reviewed product/family labels, public access and an explicit bhp unit', () => {
    const menu = astonMenu([product]);
    const parsed = astonProduct(
      menu[0]!,
      translations(),
      snapshot.products.find((p) => p.id === 'AM662')!.configuration,
    );
    expect([parsed.powerBhp, parsed.seats, parsed.transmission]).toEqual([
      671,
      2,
      'Eight-speed automatic',
    ]);
    for (const changed of [
      { ...product, modelCode: 'M230' },
      { ...product, id: 'AM999' },
      { ...product, isAuthorizedOnly: true },
      { ...product, pricing: { amount: 250000 } },
    ])
      expect(() => astonMenu([changed])).toThrow();
    expect(() => astonMenu([product, product])).toThrow(/Duplicated/);
    const wrong = translations();
    wrong.DERIVATIVE_SELECTION.M210.AM662.STATS.POWER.UNIT['0'] = 'PS';
    expect(() => astonProduct(menu[0]!, wrong, null)).toThrow(/power unit/);
    const alias = translations();
    alias.DERIVATIVE_SELECTION.M210.AM662.DERIVATIVE_NAME = 'Vantage Coupe';
    expect(() => astonProduct(menu[0]!, alias, null)).toThrow(/label/);
  });
  it('requires review when a native configuration starts publishing price or year data', () => {
    const source = snapshot.products.find((p) => p.id === 'AM662')!.configuration!.source;
    expect(
      astonConfiguration({ config: [{}], options: ['DRL'], projectReturn: {} }, source),
    ).toMatchObject({ pricePublished: false, modelYearPublished: false, selectedOptionCount: 1 });
    for (const key of ['price', 'pricing', 'currency', 'modelYear', 'model_year'])
      expect(() =>
        astonConfiguration(
          { config: [{ meta: { [key]: 2027 } }], options: ['DRL'], projectReturn: {} },
          source,
        ),
      ).toThrow(/price\/year/);
    expect(() =>
      astonConfiguration({ config: [], options: [], projectReturn: {} }, source),
    ).toThrow();
  });
  it('rejects broken country, product, announcement, source, client and capture joins', () => {
    const changes: ((s: typeof snapshot) => void)[] = [
      (s) => {
        s.countries = ['US'];
      },
      (s) => {
        s.menuIds.pop();
      },
      (s) => {
        s.products.push(s.products[0]!);
      },
      (s) => {
        s.products.find((p) => p.id === 'AM890')!.role = 'menu-offer';
      },
      (s) => {
        s.products.find((p) => p.id === 'AM390')!.role = 'menu-offer';
      },
      (s) => {
        s.products.find((p) => p.id === 'AM662')!.configuration!.source.url =
          s.products[0]!.configuration!.source.url;
      },
      (s) => {
        s.products[0]!.configuration = null;
      },
      (s) => {
        s.products[0]!.convertible = true;
      },
      (s) => {
        s.sources.menu.url = s.sources.menu.url.replace('/CA', '/US');
      },
      (s) => {
        s.sources.client.sha256 = '0'.repeat(64);
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
      expect(() => validateAstonSnapshot(copy)).toThrow();
    }
    expect(JSON.stringify(snapshot)).not.toMatch(
      /"(?:sessionId|configurationDetailId|headers|cookie|email|account|description)"/i,
    );
  });
  it('rejects refreshes that lose coverage, known seating or transmission, or move backwards', () => {
    for (const change of [
      (s: typeof snapshot) => {
        s.products.pop();
      },
      (s: typeof snapshot) => {
        s.products.find((p) => p.id === 'AM662')!.seats = null;
      },
      (s: typeof snapshot) => {
        s.products[0]!.transmission = 'Not verified';
      },
      (s: typeof snapshot) => {
        s.retrievedAt = '2026-10-25T00:00:00.000Z';
      },
    ]) {
      const copy = structuredClone(snapshot);
      change(copy);
      expect(() => astonNoRegression(snapshot, copy)).toThrow();
    }
  });
});
