import { describe, expect, it } from 'vitest';
import { catalog, nrcanSnapshot, retailCatalog } from './index';
import links from '../data/retail-rating-links.json';
import { expandCatalog } from './expand';

describe('rating baseline and retail overlays', () => {
  it('accounts for every rating ID without duplicating matched variants', () => {
    const records = catalog.cars.flatMap((car) =>
      car.governmentRating ? [car.governmentRating.recordId] : [],
    );
    expect([...new Set(records)].sort()).toEqual(
      nrcanSnapshot.records.map((record) => record.RecordId).sort(),
    );
    expect(catalog.cars.filter((car) => car.recordKind === 'retail-trim')).toHaveLength(
      retailCatalog.cars.length,
    );
  });
  it('never invents MSRP, retail trims, horsepower or availability from a rating', () => {
    const ratings = catalog.cars.filter((car) => car.recordKind === 'government-rating');
    expect(ratings.length).toBeGreaterThan(2000);
    expect(
      ratings.every(
        (car) =>
          car.facts.msrpCad.value === null &&
          car.facts.horsepower.value === null &&
          car.availability.status === 'not-checked',
      ),
    ).toBe(true);
    expect(ratings.every((car) => car.trim === 'Retail trim not specified')).toBe(true);
  });
  it('keeps electric units separate and preserves published PHEV electric-mode fuel', () => {
    const ev = catalog.cars.find((car) => car.id === 'nrcan-29063')!;
    expect(ev.facts.fuelCombinedL100km.value).toBeNull();
    expect(ev.facts.electricCombinedKwh100km.value).toBe(14.4);
    expect(ev.facts.co2Gkm.value).toBe(0);
    const phev = catalog.cars.find((car) => car.id === 'nrcan-29292')!;
    expect(phev.facts.electricModeFuelL100km.value).toBe(6.1);
    expect(phev.facts.electricModeFuelL100km.sourceUrl).toBe(
      'https://fcr-ccc.nrcan-rncan.gc.ca/en/VehicleReport/29292',
    );
  });
  it('refuses broken or obsolete retail-to-rating joins', () => {
    expect(() =>
      expandCatalog(retailCatalog, nrcanSnapshot, { ...links, 'unknown-retail-id': 30701 }),
    ).toThrow('Unknown retail rating link');
    expect(() =>
      expandCatalog(retailCatalog, nrcanSnapshot, { ...links, 'honda-cr-v-2026-lx-fwd': 29292 }),
    ).toThrow('Review the retail-to-rating mapping');
  });
});
