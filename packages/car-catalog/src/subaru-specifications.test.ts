import { describe, expect, it } from 'vitest';
import {
  catalog,
  curatedCatalog,
  retailCatalog,
  subaruSnapshot,
  subaruSpecificationsSnapshot,
  nrcanSnapshot,
} from './index';
import { validateCatalog } from './schema';
import { addSubaruRetail } from './subaru';
import {
  parseSubaruSpecifications,
  validateSubaruSpecifications,
} from './subaru-specifications-import';
import {
  addSubaruSpecifications,
  assertSubaruRatingEvidence,
  compatibleSubaruFuelUnits,
  subaruPowertrainEvidence,
  subaruSpecificationsReviewGaps,
} from './subaru-specifications';
import { reviewedRatingLinksSchema, expandCatalog } from './expand';
import links from '../data/retail-rating-links.json';
import audit from '../data/reviewed-rating-links.json';

const owned = (id: number) =>
  catalog.cars.find(
    (car) => car.make === 'Subaru' && car.manufacturerConfiguration?.id === String(id),
  )!;

describe('exact Subaru specification evidence', () => {
  it('reconciles all 41 factory identities and preserves exact base prices, including the newly listed BRZ', () => {
    expect(subaruSpecificationsSnapshot.models).toHaveLength(9);
    expect(subaruSpecificationsSnapshot.models.flatMap((model) => model.trims)).toHaveLength(41);
    for (const trim of subaruSnapshot.trims) {
      const car = owned(trim.manufacturerId);
      expect(car.year).toBe(trim.year);
      expect(car.manufacturerConfiguration?.code).toBe(trim.modelCode);
      expect(car.facts.msrpCad.value).toBe(trim.msrpCad);
      expect(car.facts.msrpCad.sourceUrl).toContain(`CarID=${trim.manufacturerId}`);
    }
    expect(owned(1625)).toMatchObject({
      id: 'subaru-ca-1625',
      year: 2027,
      trim: '輝 Kagayaki Edition',
      facts: { msrpCad: { value: 39995 } },
    });
    expect(owned(1562).id).toBe('subaru-forester-2026-convenience-awd');
    expect(owned(1563).id).toBe('subaru-forester-2026-touring-awd');
  });

  it('extracts per-ID columns and feature status without assuming column order or optional equipment', () => {
    const html = `<title>Specifications - 2026 Forester - Subaru Canada</title>
      <div class="car-spec-column for-car-1563"><div class="car-name"><p>Touring</p></div><span class='displayHidden modelcode'>TJATP</span></div>
      <div class="car-spec-column for-car-1562"><div class="car-name"><p>Convenience</p></div><span class='displayHidden modelcode'>TJACP</span></div>
      <div class="scrolling-row car-spec-row for-spec-cate-20"><div class="spec-title">Cargo volume (L): Seats up</div>
      <div class="car-spec-column for-car-1563"><div class="spec-value">779</div></div>
      <div class="car-spec-column for-car-1562"><div class="spec-value">838<sup>1</sup></div></div></div>
      <div class="scrolling-row car-spec-row for-spec-cate-74"><div class="spec-title">Engine: 194-hp, 2.5-L Direct Injection, SUBARU Hybrid</div>
      <div class="car-spec-column for-car-1562"><div class="spec-value"><span class='symbol O'> </span></div></div>
      <div class="car-spec-column for-car-1563"><div class="spec-value"><span class='symbol N'> </span></div></div></div>`;
    const parsed = parseSubaruSpecifications(html, 'Forester', 2026);
    const model = {
      ...parsed,
      source: subaruSpecificationsSnapshot.models.find((model) => model.model === 'Forester')!
        .source,
    };
    expect(parsed.rows[0]!.cells).toEqual([
      { manufacturerId: 1563, value: '779', status: null },
      { manufacturerId: 1562, value: '838', status: null },
    ]);
    expect(subaruPowertrainEvidence(model, 1562).engine).toBeUndefined();
    expect(() => parseSubaruSpecifications(html, 'Forester', 2027)).toThrow('model/year mismatch');
  });

  it('rejects missing models, changed model codes, duplicate columns and redirected identities', () => {
    const missing = structuredClone(subaruSpecificationsSnapshot);
    missing.models.pop();
    expect(() => validateSubaruSpecifications(missing, subaruSnapshot)).toThrow('Incomplete');
    const changed = structuredClone(subaruSpecificationsSnapshot);
    changed.models[0]!.trims[0]!.modelCode = 'other-code';
    expect(() => validateSubaruSpecifications(changed, subaruSnapshot)).toThrow('changed');
    const duplicate = structuredClone(subaruSpecificationsSnapshot);
    duplicate.models[0]!.rows[0]!.cells[1] = structuredClone(
      duplicate.models[0]!.rows[0]!.cells[0]!,
    );
    expect(() => validateSubaruSpecifications(duplicate, subaruSnapshot)).toThrow('columns');
    const redirected = structuredClone(subaruSpecificationsSnapshot);
    redirected.models[0]!.source.responseUrl = redirected.models[0]!.source.responseUrl.replace(
      'ModelYear=2026',
      'ModelYear=2027',
    );
    expect(() => validateSubaruSpecifications(redirected, subaruSnapshot)).toThrow('URL');
  });

  it('keeps roof/cargo differences, body-width conventions and powertrain identities attached to the correct trims', () => {
    expect(owned(1562).facts.cargoSeatsUpL.value).toBe(838);
    expect(owned(1563).facts.cargoSeatsUpL.value).toBe(779);
    expect(owned(1564).facts.rearLegroomMm.value).toBe(1000);
    expect(owned(1584).facts.horsepower.value).toBe(260);
    expect(owned(1623).drivetrain).toBe('RWD');
    expect(owned(1606).drivetrain).toBe('FWD');
    expect(owned(1608).drivetrain).toBe('AWD');
    expect(owned(1606).facts.widthMm.note).toContain('Body width');
  });

  it('publishes bounded manufacturer range and peak power without inventing electric consumption or summed motor output', () => {
    expect(owned(1606).facts.horsepower.value).toBe(165);
    expect(owned(1608).facts.horsepower.value).toBe(338);
    expect(owned(1606).facts.electricRangeKm).toMatchObject({ value: 399, qualifier: 'up-to' });
    expect(owned(1606).facts.electricCombinedKwh100km.value).toBeNull();
    expect(owned(1606).facts.fuelCombinedL100km.note).toContain('Not applicable');
    const nonstandard = structuredClone(subaruSpecificationsSnapshot);
    const model = nonstandard.models.find((model) => model.model === 'Uncharted')!;
    model.rows
      .find((row) => row.label === 'Horsepower (peak) (hp): 165')!
      .cells.find((cell) => cell.manufacturerId === 1606)!.status = 'O';
    const result = addSubaruSpecifications(
      addSubaruRetail(curatedCatalog, subaruSnapshot),
      nonstandard,
    );
    expect(
      result.cars.find((car) => car.id === 'subaru-ca-1606')!.facts.horsepower.value,
    ).toBeNull();
  });

  it('checks rounded imperial/metric consistency and leaves conflicting WRX GT values unknown', () => {
    expect(compatibleSubaruFuelUnits('9.1', '31')).toBe(true);
    expect(compatibleSubaruFuelUnits('6.8', '42')).toBe(true);
    expect(compatibleSubaruFuelUnits('12.0', '23')).toBe(true);
    expect(compatibleSubaruFuelUnits('9.4', '12.7')).toBe(false);
    expect(owned(1595).facts.fuelCityL100km.value).toBeNull();
    expect(owned(1595).facts.fuelHighwayL100km.note).toContain('Source conflict');
    expect(owned(1595).governmentRating).toBeUndefined();
    const gaps = subaruSpecificationsReviewGaps(subaruSpecificationsSnapshot);
    expect(gaps.find((gap) => gap.manufacturerId === 1595)?.conflicts).toHaveLength(2);
    expect(gaps.find((gap) => gap.manufacturerId === 1582)?.reason).toContain('cylinder');
    expect(owned(1582).facts.fuelCombinedL100km.value).toBeNull();
  });

  it('uses reviewed government combined ratings while retaining manufacturer city/highway values and public rating IDs', () => {
    const reviewed = reviewedRatingLinksSchema
      .parse(audit)
      .links.filter((link) => link.evidenceProvider === 'subaru-specifications');
    expect(reviewed).toHaveLength(18);
    for (const link of reviewed) {
      const car = catalog.cars.find((car) => car.id === link.retailId)!,
        original = retailCatalog.cars.find((car) => car.id === link.retailId)!;
      expect(original.facts.fuelCombinedL100km.value).toBeNull();
      expect(car.facts.fuelCityL100km).toEqual(original.facts.fuelCityL100km);
      expect(car.facts.fuelHighwayL100km).toEqual(original.facts.fuelHighwayL100km);
      expect(car.facts.fuelCombinedL100km.sourceUrl).toContain(`/VehicleReport/${link.recordId}`);
      if (!Object.values(links).includes(link.recordId))
        expect(catalog.cars.some((car) => car.id === `nrcan-${link.recordId}`)).toBe(true);
    }
    expect(owned(1625).facts.fuelCombinedL100km.value).toBe(10.5);
    expect(owned(1623).facts.fuelCombinedL100km.value).toBe(9.6);
    expect(owned(1579).facts.fuelCombinedL100km.value).toBe(8);
  });

  it('rejects stale standard-feature evidence, fuel modes and transmission kinds before joining', () => {
    const link = reviewedRatingLinksSchema
      .parse(audit)
      .links.find((link) => link.evidenceProvider === 'subaru-specifications')!;
    const changed = structuredClone(subaruSpecificationsSnapshot);
    const cell = changed.models
      .find((model) => model.model === 'Forester')!
      .rows.find((row) => row.label === link.engineLayoutEvidence)!
      .cells.find((cell) => cell.manufacturerId === 1564)!;
    cell.status = 'N';
    expect(() => assertSubaruRatingEvidence(retailCatalog.cars, changed, link)).toThrow(
      'powertrain evidence',
    );
    const transmission = structuredClone(audit);
    transmission.links.find((entry) => entry.retailId === link.retailId)!.transmissionEvidence =
      'Transmission: 6-speed manual';
    expect(() => expandCatalog(retailCatalog, nrcanSnapshot, links, transmission)).toThrow(
      'audited',
    );
    const fuel = structuredClone(audit);
    Object.assign(fuel.links.find((entry) => entry.retailId === link.retailId)!.rating, {
      fuelType: 'D',
    });
    expect(() => expandCatalog(retailCatalog, nrcanSnapshot, links, fuel)).toThrow();
  });

  it('restricts up-to metadata to known electric range values', () => {
    const car = structuredClone(owned(1606));
    const mini = { ...catalog, cars: [car] };
    expect(() => validateCatalog(mini)).not.toThrow();
    car.facts.electricRangeKm.value = null;
    expect(() => validateCatalog(mini)).toThrow('known electric range');
    car.facts.electricRangeKm.value = 399;
    car.facts.msrpCad.qualifier = 'up-to';
    expect(() => validateCatalog(mini)).toThrow('known electric range');
  });
});
