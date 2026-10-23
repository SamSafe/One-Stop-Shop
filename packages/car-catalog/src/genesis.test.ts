import { describe, expect, it } from 'vitest';
import { catalog, genesisSnapshot as snapshot } from './index';
import {
  genesisPublishedPrice,
  genesisRecordKey,
  genesisRequireNoRegression,
  validateGenesisSnapshot,
} from './genesis-import';
import { genesisFacts, genesisFuel, genesisRecordId, genesisReviewGaps } from './genesis';

const row = (id: number) => snapshot.records.find((r) => r.trim.extTrimId === id)!;
describe('Canadian Genesis ordering, price basis and exact-year specifications', () => {
  it('reconciles every selector family, year, trim and distinct HSC without collapsing editions', () => {
    expect(validateGenesisSnapshot(snapshot).families).toHaveLength(14);
    expect(snapshot.records).toHaveLength(41);
    expect(new Set(snapshot.records.map((r) => r.trim.guid)).size).toBe(40);
    expect(new Set(snapshot.records.map((r) => r.trim.modelYear))).toEqual(new Set([2026, 2027]));
    const cars = catalog.cars.filter((c) => c.make === 'Genesis' && c.recordKind === 'retail-trim');
    expect(cars).toHaveLength(41);
    expect(cars.filter((c) => c.publishedPrice)).toHaveLength(39);
    expect(cars.filter((c) => c.availability.status === 'announced')).toHaveLength(1);
    expect(cars.every((c) => c.facts.msrpCad.value === null)).toBe(true);
    expect(catalog.cars.find((c) => c.id === 'honda-cr-v-2026-lx-fwd')).toBeDefined();
  });
  it('rejects omitted older years, trims, selector models and interior factory variants', () => {
    const old = structuredClone(snapshot);
    old.records = old.records.filter(
      (r) => !(r.trim.modelNameEn === 'G70' && r.trim.modelYear === 2026),
    );
    expect(() => validateGenesisSnapshot(old)).toThrow(/omitted/);
    const model = structuredClone(snapshot);
    model.families.pop();
    expect(() => validateGenesisSnapshot(model)).toThrow(/families/);
    const variant = structuredClone(snapshot);
    variant.records = variant.records.filter(
      (r) => !(r.trim.extTrimId === 1020 && r.colour?.hsc.endsWith('AU')),
    );
    expect(() => validateGenesisSnapshot(variant)).toThrow(/HSC/);
    const duplicate = structuredClone(snapshot);
    duplicate.records.push(duplicate.records[0]!);
    expect(() => validateGenesisSnapshot(duplicate)).toThrow(/HSC|duplicate/);
  });
  it('keeps publisher amounts and Alberta fees separate from comparable base MSRP', () => {
    const r = row(1064);
    expect(r.trim.msrp).toBe(57000);
    expect(genesisPublishedPrice(r)).toBe(57131.88);
    expect(genesisFacts(r).msrpCad.value).toBeNull();
    const car = catalog.cars.find((c) => c.id === genesisRecordId(r))!;
    expect(car.publishedPrice).toMatchObject({
      value: 57131.88,
      currency: 'CAD',
      province: 'AB',
      basis: 'all-inclusive-before-sales-tax',
    });
    expect(car.sourceIds).toContain(car.publishedPrice!.source);
    expect(car.publishedPrice!.value).not.toBe(57150);
  });
  it('does not turn missing fees, mandatory paint or preorder placeholders into free or complete quotes', () => {
    const electric = row(1056);
    expect(electric.trim.msrp).toBe(89500);
    expect(electric.colour!.exteriorPrice).toBe(900);
    expect(electric.trim.trimTaxes.some((t) => t.amount === null)).toBe(true);
    expect(genesisPublishedPrice(electric)).toBeNull();
    expect(
      catalog.cars.find((c) => c.id === genesisRecordId(electric))!.publishedPrice,
    ).toBeUndefined();
    const preorder = row(1044);
    expect(preorder.trim.msrp).toBe(0);
    expect(genesisPublishedPrice(preorder)).toBeNull();
    expect(catalog.cars.find((c) => c.id === genesisRecordId(preorder))!.availability.status).toBe(
      'announced',
    );
    expect(
      genesisReviewGaps(snapshot).some(
        (g) =>
          g.configuration === genesisRecordKey(electric) && g.field === 'regional-price-components',
      ),
    ).toBe(true);
  });
  it('retains both public GV70 factory HSCs even with identical model/trim names and prices', () => {
    const variants = snapshot.records.filter((r) => r.trim.extTrimId === 1020);
    expect(variants).toHaveLength(2);
    expect(new Set(variants.map(genesisRecordId)).size).toBe(2);
    expect(variants.some((r) => r.colour!.interiorName.includes('Suede'))).toBe(true);
    expect(genesisPublishedPrice(variants[0]!)).toBe(genesisPublishedPrice(variants[1]!));
  });
  it('quarantines eleven conflicting year tables while keeping thirteen exact joins and older factory features', () => {
    expect(snapshot.rejectedSpecifications).toHaveLength(11);
    expect(snapshot.records.filter((r) => r.specification)).toHaveLength(13);
    expect(
      snapshot.rejectedSpecifications.some(
        (s) => s.requestedYear === 2027 && s.publishedYears.includes(2023),
      ),
    ).toBe(true);
    const g90 = snapshot.records.find((r) => r.trim.modelNameEn === 'G90')!;
    expect(g90.specification).toBeNull();
    expect(genesisFacts(g90).heightMm.value).toBeNull();
    expect(genesisFacts(g90).horsepower.value).toBe(409);
    expect(genesisFuel(g90)).toBe('Gasoline / hybrid');
    expect(genesisFacts(row(1056)).electricRangeKm.value).toBeNull();
  });
  it('uses explicit metric, hp and passenger labels without inventing cargo arrangements or Canadian consumption units', () => {
    const facts = genesisFacts(row(1064));
    expect(facts.horsepower.value).toBe(300);
    expect(facts.lengthMm.value).toBe(4685);
    expect(facts.widthMm.value).toBe(1850);
    expect(facts.seats.value).toBe(5);
    expect(facts.cargoSeatsUpL.value).toBeNull();
    expect(facts.cargoSeatsDownL.value).toBeNull();
    expect(facts.fuelCombinedL100km.value).toBeNull();
    expect(facts.rechargeHours.value).toBeNull();
  });
  it('rejects cross-year specification rows, missing request receipts and unrelated fee identities', () => {
    const year = structuredClone(snapshot);
    year.records.find((r) => r.specification)!.specification!.rows[0]!.prdnMyer = '2025';
    expect(() => validateGenesisSnapshot(year)).toThrow(/specification/);
    const request = structuredClone(snapshot);
    delete request.records.find((r) => r.specification)!.specification!.source.requestSha256;
    expect(() => validateGenesisSnapshot(request)).toThrow(/specification/);
    const fee = structuredClone(snapshot);
    fee.records[0]!.trim.trimTaxes[0]!.extTrimId = 'OTHER';
    expect(() => validateGenesisSnapshot(fee)).toThrow(/fee/);
  });
  it('prevents live refreshes from silently removing offerings, technical evidence or known regional prices', () => {
    expect(() => genesisRequireNoRegression(snapshot, structuredClone(snapshot))).not.toThrow();
    const missing = structuredClone(snapshot);
    missing.records.pop();
    expect(() => genesisRequireNoRegression(snapshot, missing)).toThrow(/offering/);
    const technical = structuredClone(snapshot);
    technical.records.find((r) => r.specification)!.specification = null;
    expect(() => genesisRequireNoRegression(snapshot, technical)).toThrow(/technical/);
    const price = structuredClone(snapshot);
    price.records.find((r) => genesisPublishedPrice(r) !== null)!.trim.trimTaxes[0]!.amount = null;
    expect(() => genesisRequireNoRegression(snapshot, price)).toThrow(/regional price/);
  });
});
