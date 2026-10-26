import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/vinfast.json';
import { catalog, nrcanSnapshot, retailCatalog } from './index';
import { catalogCoverage } from './coverage';
import { validateCatalog } from './schema';
import {
  validateVinfastSnapshot,
  vinfastLineup,
  vinfastNoRegression,
  vinfastPricePage,
  vinfastProfiles,
} from './vinfast-import';
import { vinfastReviewGaps } from './vinfast';

const snapshot = validateVinfastSnapshot(data);
const cars = catalog.cars.filter(
  (c) => c.make === 'VinFast' && c.recordKind !== 'government-rating',
);
const year = (y: number | null) =>
  y === null
    ? 'Current offer without a published model year.'
    : `Selling Price of a new and previously unregistered ${y} VF9 ECO is $77,310 and includes MSRP of $74,890, fees. Offer only valid for residents of British Columbia.`;
function pricePage(cash = year(2024)) {
  return `<script>throw new Error('must not execute');</script><div id="block-offer"><h2>VF 9 Pricing</h2>${['ECO', 'PLUS'].map((trim) => `<div class="vehicle-item"><div class="vehicle-class">${trim}</div><div class="slogan">VinFast VF 9</div><div class="vehicle-price-item"><div class="sub-price">MSRP<sup>1</sup></div><div class="price">$${trim === 'ECO' ? '74,890' : '78,890'}</div></div><div class="vehicle-price-item"><div class="sub-price">All-in Starting Price<sup>*</sup></div><div class="price">$${trim === 'ECO' ? '77,310' : '81,310'}</div><a data-target="#vf9-${trim.toLowerCase()}-terms-modal">Terms</a></div></div>`).join('')}</div><div id="vf9-eco-terms-modal">British Columbia Terms ${cash}</div><div id="vf9-plus-terms-modal">British Columbia Terms Finance example for 2024 VF9 Plus. Offer expires April 30, 2026.</div>`;
}

describe('VinFast Canadian public price offers', () => {
  it('reconciles six province views, four offers and only one current exact model year', () => {
    expect(snapshot.models).toEqual(['vf-8', 'vf-9']);
    expect(snapshot.pages).toHaveLength(6);
    expect(snapshot.pages.every((p) => p.cards.length === 2)).toBe(true);
    expect(vinfastProfiles(snapshot)).toHaveLength(4);
    expect(cars).toHaveLength(4);
    expect(cars.map((c) => [c.id, c.year, c.facts.msrpCad.value])).toEqual([
      ['vinfast-ca-vf8-eco', null, 54490],
      ['vinfast-ca-vf8-plus', null, 61490],
      ['vinfast-ca-vf9-eco', 2024, 74890],
      ['vinfast-ca-vf9-plus', null, 78890],
    ]);
    expect(retailCatalog.cars.filter((c) => c.make === 'VinFast')).toHaveLength(1);
    expect(cars.filter((c) => c.recordKind === 'manufacturer-offer')).toHaveLength(3);
    expect(snapshot.retrievedAt).toBe('2026-10-26T00:26:19.341Z');
    expect(JSON.stringify(snapshot)).not.toMatch(/"(?:vin|headers|cookie|email|account)"/i);
  });
  it('keeps regional all-in prices, projected specifications and historical years separate', () => {
    const vf9 = snapshot.pages.filter((p) => p.model === 'vf-9');
    expect(vf9.map((p) => p.cards[0]!.publishedAllInCad)).toEqual([77310, 77321, 77308]);
    for (const car of cars) {
      expect(car.publishedPrice).toBeUndefined();
      expect(car.governmentRating).toBeUndefined();
      expect(car.drivetrain).toBe('Not verified');
      expect(car.availability.status).toBe('manufacturer-listed');
      expect(car.sourceIds).toHaveLength(3);
      expect(car.facts.msrpCad.note).toContain('Excludes freight/PDI');
      expect(
        Object.entries(car.facts)
          .filter(([k]) => k !== 'msrpCad')
          .every(([, f]) => f.value === null && !!f.note),
      ).toBe(true);
      if (car.year === null) expect(car.modelYearNote).toContain('does not verify a model year');
    }
    expect(vinfastReviewGaps(snapshot).filter((g) => g.field === 'model-year')).toHaveLength(3);
    expect(
      snapshot.pages.find((p) => p.model === 'vf-9')!.cards[1]!.unqualifiedYearCandidates,
    ).toContain(2024);
  });
  it('parses scoped cards without executing scripts or promoting expired finance years', () => {
    const cards = vinfastPricePage(pricePage(), 'vf-9', 'BC');
    expect(cards.map((c) => c.year)).toEqual([2024, null]);
    expect(cards[0]!.cashYearEvidence).toMatchObject({ year: 2024, msrpCad: 74890 });
    expect(cards[1]!.cashYearEvidence).toBeNull();
    expect(cards[1]!.unqualifiedYearCandidates).toEqual([2024]);
    expect(vinfastPricePage(pricePage(year(null)), 'vf-9', 'BC')[0]!.year).toBeNull();
  });
  it('rejects changed model, province, cash-price or dated cash eligibility', () => {
    expect(() => vinfastPricePage(pricePage(), 'vf-8', 'BC')).toThrow(/model/);
    expect(() => vinfastPricePage(pricePage(), 'vf-9', 'ON')).toThrow(/preference/);
    expect(() =>
      vinfastPricePage(pricePage(year(2024).replace('$74,890', '$75,890')), 'vf-9', 'BC'),
    ).toThrow(/conflict/);
    expect(() =>
      vinfastPricePage(pricePage(year(2024).replace('VF9 ECO', 'VF8 ECO')), 'vf-9', 'BC'),
    ).toThrow(/conflict/);
    expect(() =>
      vinfastPricePage(pricePage(year(2024) + ' Offer expires October 31, 2026.'), 'vf-9', 'BC'),
    ).toThrow(/qualification/);
    for (const qualifier of [
      'Offer expires October 31.',
      'Offer valid through 10/31.',
      'Cash price October 31.',
    ])
      expect(() => vinfastPricePage(pricePage(year(2024) + qualifier), 'vf-9', 'BC')).toThrow(
        /qualification/,
      );
  });
  it('rejects missing, duplicated, unjoined and malformed price blocks', () => {
    for (const html of [
      pricePage().replace('id="block-offer"', 'data-id="block-offer"'),
      pricePage() + '<div id="block-offer"></div>',
      pricePage().replace('class="vehicle-class"', 'class="unreviewed"'),
      pricePage().replace('data-target="#vf9-eco-', 'data-target="#vf8-eco-'),
      pricePage().replace('$74,890', '74,890'),
      pricePage().replace('$74,890', '$0'),
      pricePage().replace('MSRP<sup>1</sup>', 'Sale price'),
      pricePage().slice(0, -6),
    ])
      expect(() => vinfastPricePage(html, 'vf-9', 'BC')).toThrow();
  });
  it('reconciles only official menu models and requires review for a new model', () => {
    expect(
      vinfastLineup(
        '<a href="/en/vehicles/vf-9">9</a><a href="/vehicles/vf-8">8</a><a href="https://example.com/vehicles/vf-7">external</a>',
      ),
    ).toEqual(['vf-8', 'vf-9']);
    expect(() => vinfastLineup('<a href="/en/vehicles/vf-7">7</a>')).toThrow();
    expect(() => vinfastLineup('')).toThrow(/empty/);
  });
  it('rejects lost regional pages, incomplete trims and inconsistent regional price or year', () => {
    for (const change of [
      (s: typeof snapshot) => s.pages.pop(),
      (s: typeof snapshot) => s.pages[0]!.cards.pop(),
      (s: typeof snapshot) => s.pages[0]!.cards[0]!.msrpCad++,
      (s: typeof snapshot) => (s.pages[0]!.cards[0]!.year = 2024),
      (s: typeof snapshot) => (s.pages[0]!.cards[0]!.termsId = 'vf9-eco-terms-modal'),
      (s: typeof snapshot) => (s.pages[0]!.source.province = 'QC'),
      (s: typeof snapshot) => (s.pages[0]!.source.status = 403),
      (s: typeof snapshot) => (s.pages[0]!.source.url += '?unreviewed=1'),
      (s: typeof snapshot) => (s.pricingClient.sha256 = '0'.repeat(64)),
      (s: typeof snapshot) => (s.retrievedAt = '2026-10-27T00:00:00.000Z'),
      (s: typeof snapshot) => (s.overviewSource.capturedAt = '2026-10-20T00:00:00.000Z'),
    ]) {
      const copy = structuredClone(snapshot);
      change(copy);
      expect(() => validateVinfastSnapshot(copy)).toThrow();
    }
  });
  it('requires exact structured cash evidence for a year-qualified offer', () => {
    const copy = structuredClone(snapshot);
    copy.pages
      .filter((p) => p.model === 'vf-9')
      .forEach((p) => (p.cards[0]!.cashYearEvidence = null));
    expect(() => validateVinfastSnapshot(copy)).toThrow(/cash-price evidence/);
    const wrong = structuredClone(snapshot);
    wrong.pages.find((p) => p.model === 'vf-9')!.cards[0]!.cashYearEvidence!.year = 2025;
    expect(() => validateVinfastSnapshot(wrong)).toThrow(/cash-price evidence/);
  });
  it('prevents refreshing backwards or silently losing a model, trim or known model year', () => {
    expect(() => vinfastNoRegression(snapshot, snapshot)).not.toThrow();
    const older = structuredClone(snapshot);
    older.retrievedAt = '2026-10-23T00:00:00.000Z';
    expect(() => vinfastNoRegression(snapshot, older)).toThrow(/older captures/);
    const missing = structuredClone(snapshot);
    missing.models = ['vf-8'];
    missing.pages = missing.pages.filter((p) => p.model === 'vf-8');
    expect(() => vinfastNoRegression(snapshot, missing)).toThrow(/lose/);
    const lostYear = structuredClone(snapshot);
    lostYear.pages
      .filter((p) => p.model === 'vf-9')
      .forEach((p) => {
        p.cards[0]!.year = null;
        p.cards[0]!.cashYearEvidence = null;
      });
    expect(() => vinfastNoRegression(snapshot, lostYear)).toThrow(/known model year/);
    expect(() => vinfastNoRegression(lostYear, snapshot)).not.toThrow();
  });
  it('counts year-unverified offers separately while preserving every government rating', () => {
    const report = catalogCoverage(catalog, nrcanSnapshot);
    expect(report.catalogRecords).toBe(
      report.retailConfigurations +
        report.manufacturerOffersWithUnverifiedYear +
        report.governmentRatingVariants,
    );
    expect(report.manufacturerOffersWithUnverifiedYear).toBeGreaterThanOrEqual(3);
    expect(report.modelYears).toEqual([2024, 2025, 2026, 2027]);
    expect(report.ratingModelYears).toEqual([2025, 2026, 2027]);
    expect(report.ratingRecordsRepresented).toBe(report.ratingRecordsExpected);
    expect(report.fullMarketCoverageVerified).toBe(false);
    expect(report.byMake.find((r) => r.make === 'VinFast')).toMatchObject({
      retailConfigurations: 1,
      manufacturerOffersWithUnverifiedYear: 3,
    });
    expect(report.makesWithoutCurrentManufacturerListings).not.toContain('VinFast');
  });
  it('refuses an exact government-rating join on a year-unverified offer', () => {
    const offer = structuredClone(cars.find((c) => c.year === null)!);
    offer.governmentRating = catalog.cars.find((c) => c.governmentRating)!.governmentRating;
    expect(() => validateCatalog({ ...catalog, cars: [offer] })).toThrow(
      /cannot carry an exact government rating/,
    );
  });
});
