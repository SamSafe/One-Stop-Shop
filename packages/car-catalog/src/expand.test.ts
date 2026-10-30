import { describe, expect, it } from 'vitest';
import { catalog, nrcanSnapshot, retailCatalog } from './index';
import links from '../data/retail-rating-links.json';
import reviewedLinks from '../data/reviewed-rating-links.json';
import { expandCatalog } from './expand';

describe('rating baseline and retail overlays', () => {
  it('adds audited Honda and Subaru joins while preserving existing rating URLs and manufacturer facts', () => {
    const linked = catalog.cars.filter(
      (car) => car.recordKind === 'retail-trim' && car.governmentRating,
    );
    // GM configurations add exact engine/transmission/consumption joins.
    expect(linked.filter((car) => !car.id.startsWith('gm-ca-'))).toHaveLength(47);
    expect(linked.filter((car) => car.id.startsWith('gm-ca-'))).toHaveLength(149);
    for (const link of reviewedLinks.links) {
      const car = catalog.cars.find((car) => car.id === link.retailId)!;
      const original = retailCatalog.cars.find((car) => car.id === link.retailId)!;
      expect(car.governmentRating?.recordId).toBe(link.recordId);
      if (!Object.values(links).includes(link.recordId))
        expect(catalog.cars.find((car) => car.id === `nrcan-${link.recordId}`)).toBeDefined();
      if (original.facts.fuelCombinedL100km.value !== null)
        expect(car.facts.fuelCombinedL100km).toEqual(original.facts.fuelCombinedL100km);
      expect(car.facts.widthMm).toEqual(original.facts.widthMm);
      expect(car.facts.co2Gkm.sourceUrl).toContain(`/VehicleReport/${link.recordId}`);
    }
  });
  it('rejects audited joins when a trim identity or any consumption mode changes', () => {
    const wrong = structuredClone(reviewedLinks);
    wrong.links[0]!.retail.drivetrain = wrong.links[0]!.retail.drivetrain === 'FWD' ? 'AWD' : 'FWD';
    expect(() => expandCatalog(retailCatalog, nrcanSnapshot, links, wrong)).toThrow(
      'audited retail-to-rating mapping',
    );
    const changed = structuredClone(nrcanSnapshot);
    changed.records.find(
      (record) => record.RecordId === reviewedLinks.links[0]!.recordId,
    )!.CityGasConsumption += 0.1;
    expect(() => expandCatalog(retailCatalog, changed, links, reviewedLinks)).toThrow(
      'audited retail-to-rating mapping',
    );
    const wrongEngine = structuredClone(reviewedLinks);
    wrongEngine.links[0]!.engineEvidence = '3.5-litre, V6';
    expect(() => expandCatalog(retailCatalog, nrcanSnapshot, links, wrongEngine)).toThrow(
      'audited retail-to-rating mapping',
    );
  });
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
