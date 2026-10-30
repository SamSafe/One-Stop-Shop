import { describe, expect, it } from 'vitest';
import { catalog, miniSnapshot as snapshot } from './index';
import {
  miniCarousel,
  miniModelKey,
  miniPackageSelections,
  miniReviewedLineFailure,
  miniTechnical,
  validateMiniSnapshot,
} from './mini-import';
import { miniFacts, miniMsrp, miniRecordId, miniReviewGaps } from './mini';

const model = (code: string) => snapshot.models.find((m) => m.code === code)!;
const row = (code: string, line?: number, style?: number) =>
  snapshot.records.find(
    (r) =>
      r.modelKey === model(code).key &&
      (line === undefined || r.lineId === line) &&
      (style === undefined || r.style?.StyleID === style),
  )!;
const stock = (code: string) => snapshot.inventory.references.find((r) => r.code === code);
describe('Canadian MINI factory selections and new-stock reconciliation', () => {
  it('retains every current selector reference and older stock code without exposing vehicle identifiers', () => {
    expect(validateMiniSnapshot(snapshot).models).toHaveLength(39);
    expect(snapshot.currentModelKeys).toHaveLength(27);
    expect(snapshot.selectorReferenceCount).toBe(29);
    expect(snapshot.records.filter((r) => !r.stockBaseOnly)).toHaveLength(98);
    expect(snapshot.records.filter((r) => r.stockBaseOnly)).toHaveLength(12);
    expect(snapshot.inventory.references).toHaveLength(36);
    // Two complete stock passes (price ascending, then descending) cover every vehicle.
    expect(snapshot.inventory.sources).toHaveLength(84);
    expect(snapshot.inventory.total).toBe(1481);
    expect(snapshot.inventory.returnedRows).toBe(2962);
    expect(snapshot.inventory.distinctVehicles).toBe(1481);
    const partial = structuredClone(snapshot);
    partial.inventory.sources.pop();
    expect(() => validateMiniSnapshot(partial)).toThrow(/reconcile/);
    const repeated = structuredClone(snapshot);
    repeated.inventory.returnedRows++;
    expect(() => validateMiniSnapshot(repeated)).toThrow(/reconcile/);
    expect(new Set(snapshot.inventory.references.map((r) => r.year))).toEqual(
      new Set([2025, 2026, 2027]),
    );
    const cars = catalog.cars.filter((c) => c.make === 'MINI' && c.recordKind === 'retail-trim');
    expect(cars).toHaveLength(203);
    expect(cars.filter((c) => c.facts.msrpCad.value !== null)).toHaveLength(199);
    expect(JSON.stringify(snapshot)).not.toMatch(/"(?:VIN|RDayAF|cookie|headers|x-api-key)"/i);
    expect(catalog.cars.find((c) => c.id === 'honda-cr-v-2026-lx-fwd')).toBeDefined();
  });
  it('reconciles duplicate electric-family references and rejects inferred years or conflicting aliases', () => {
    const value = {
      Year: 2027,
      CACode: '27YE',
      AGCode: '13HP',
      Name: '2027 MINI Countryman SE ALL4',
      IsActive: true,
      IsElectric: true,
      IsAllFour: true,
      Price: 59990,
      AllInclusivePrice: 64510,
      TotalFees: 4520,
    };
    const raw = {
      ModelYearList: [2027],
      ModelList: [
        { Ecode: 'U25', Vehicles: [value] },
        { Ecode: 'U25-E', Vehicles: [value] },
      ],
    };
    expect(miniCarousel(raw).models).toHaveLength(1);
    expect(miniCarousel(raw).models[0]!.families).toEqual(['U25', 'U25-E']);
    expect(() => miniCarousel({ ...raw, ModelYearList: [2026] })).toThrow(/year/);
    expect(() =>
      miniCarousel({
        ...raw,
        ModelList: [raw.ModelList[0], { Ecode: 'U25-E', Vehicles: [{ ...value, Price: 50000 }] }],
      }),
    ).toThrow(/aliases/);
  });
  it('rejects missing current/stock years, style choices, duplicate selections and filtered totals', () => {
    const current = structuredClone(snapshot);
    current.models = current.models.filter((m) => m.code !== '26YE');
    current.records = current.records.filter((r) => r.modelKey !== '2026/26YE');
    expect(() => validateMiniSnapshot(current)).toThrow(/selector/);
    const older = structuredClone(snapshot);
    older.models = older.models.filter((m) => m.code !== '25HC');
    older.records = older.records.filter((r) => r.modelKey !== '2025/25HC');
    expect(() => validateMiniSnapshot(older)).toThrow(/stock/);
    const style = structuredClone(snapshot);
    style.records = style.records.filter(
      (r) => !(r.modelKey === '2027/27HA' && r.lineId === 310 && r.style?.StyleID === 60),
    );
    expect(() => validateMiniSnapshot(style)).toThrow(/style/);
    const duplicate = structuredClone(snapshot);
    duplicate.records.push(duplicate.records[0]!);
    expect(() => validateMiniSnapshot(duplicate)).toThrow(/duplicate/);
    const count = structuredClone(snapshot);
    count.inventory.distinctVehicles--;
    expect(() => validateMiniSnapshot(count)).toThrow(/inventory/);
    const variants = structuredClone(snapshot);
    variants.inventory.references[0]!.agCodes.push('OTHER');
    expect(() => validateMiniSnapshot(variants)).toThrow(/variants/);
  });
  it('prices exact model, line, style and named packages before all-inclusive fees and unrelated products', () => {
    const m = model('27HA'),
      r = row('27HA', 310, 60);
    expect(miniMsrp(m, r, [], stock('27HA'))).toBe(39240);
    expect(m.current!.allInclusivePrice).not.toBe(m.current!.basePrice);
    const country = row('27YD', 305, 58),
      choices = miniPackageSelections(country, snapshot.rules['27YD'] ?? []);
    const both = choices.find((p) => p.length === 2)!;
    expect(both.map((p) => p.code).sort()).toEqual(['ZYU', 'ZZ0']);
    expect(miniMsrp(model('27YD'), country, both, stock('27YD'))).toBe(53890);
    expect(
      miniRecordId(
        country,
        both.map((p) => p.code),
      ),
    ).not.toBe(miniRecordId(country));
    expect(() => miniMsrp(m, r, [{ code: 'OTHER', price: 1000 }])).toThrow(/package/);
    const changed = structuredClone(snapshot);
    changed.records.find((r) => r.style?.Price)!.style!.Path = 'UNREVIEWED';
    expect(() => validateMiniSnapshot(changed)).toThrow(/price basis/);
  });
  it('enforces published package dependencies and exclusions instead of blindly multiplying selections', () => {
    const r = structuredClone(row('27YD', 305, 58));
    expect(
      miniPackageSelections(r, [{ code: 'ZYU', requires: ['ZZ0'] }]).map((p) =>
        p
          .map((v) => v.code)
          .sort()
          .join(','),
      ),
    ).toEqual(['', 'ZZ0', 'ZYU,ZZ0']);
    expect(miniPackageSelections(r, [{ code: 'ZYU', excludes: ['ZZ0'] }])).toHaveLength(3);
    expect(
      miniPackageSelections(r, [{ code: 'ZYU', requires: ['UNRESOLVED'] }]).every(
        (p) => !p.some((v) => v.code === 'ZYU'),
      ),
    ).toBe(true);
  });
  it('keeps explicit hp, metric/mirror dimensions, luggage arrangements and full AC recharge modes', () => {
    const facts = miniFacts(model('27HA'), row('27HA', 310, 60), [], stock('27HA'));
    expect(facts.horsepower.value).toBe(161);
    expect(facts.widthMm.value).toBe(1970);
    expect(facts.widthMm.note).toContain('mirrors');
    expect(facts.cargoSeatsUpL.value).toBe(210);
    expect(facts.cargoSeatsDownL.value).toBe(725);
    expect(facts.fuelCombinedL100km.value).toBeNull();
    expect(facts.seats.value).toBeNull();
    const electric = miniFacts(model('27YE'), row('27YE'), [], stock('27YE'));
    expect(electric.rechargeHours.value).toBe(7.5);
    expect(electric.rechargeHours.note).toContain('9.6 kW');
    expect(electric.electricRangeKm.value).toBeNull();
    const older = miniFacts(model('25YE'), row('25YE'), [], stock('25YE'));
    expect(older.rechargeHours.value).toBeNull();
  });
  it('quarantines stale manual tables and conflicting AG identities while retaining observed stock years', () => {
    for (const code of ['25HC', '25HE', '25VA']) {
      expect(stock(code)!.transmissions).toEqual(['Automatic']);
      const facts = miniFacts(model(code), row(code), [], stock(code));
      expect(facts.msrpCad.value).toBeNull();
      expect(facts.horsepower.value).toBeNull();
      expect(facts.lengthMm.value).toBeNull();
    }
    const paul = model('27HP');
    expect(paul.current!.agCode).toBe('43GD');
    expect(stock('27HP')!.agCodes).toEqual(['53GD']);
    const facts = miniFacts(paul, row('27HP'), [], stock('27HP'));
    expect(facts.msrpCad.value).toBe(45990);
    expect(facts.horsepower.value).toBeNull();
    expect(model('26VE').year).toBe(2026);
    expect(model('26VE').lines!.Vehicle).toBe('1965 Victory Edition');
    expect(miniModelKey(model('26VE'))).toBe('2026/26VE');
    expect(
      miniReviewGaps(snapshot).some(
        (g) => g.configuration === '2027/27HP' && g.field === 'technical-identity',
      ),
    ).toBe(true);
  });
  it('accepts only the reviewed unavailable SKU source and never substitutes a supplier or sibling price', () => {
    const m = model('27YQ');
    expect(miniReviewedLineFailure(m.lineSource, m.code)).toBe(true);
    expect(miniReviewedLineFailure({ ...m.lineSource, status: 503 }, m.code)).toBe(false);
    expect(miniReviewedLineFailure(m.lineSource, '27YD')).toBe(false);
    expect(stock('27YQ')!.supplierBasePrices).toContain(46290);
    expect(miniMsrp(m, row('27YQ'), [], stock('27YQ'))).toBeNull();
    expect(miniTechnical({ Error: 'Invalid cacode' }, '27YQ').SpecData).toEqual([]);
    expect(() => miniTechnical({ Error: 'Invalid cacode' }, '27HA')).toThrow();
    expect(() => miniTechnical({ Error: 'server failure' }, '27YQ')).toThrow();
    const changed = structuredClone(snapshot);
    changed.models.find((m) => m.code === '27YQ')!.lineSource.status = 503;
    expect(() => validateMiniSnapshot(changed)).toThrow(/Unreviewed/);
  });
  it('rejects wrong source contexts and missing or charged required selections', () => {
    const wrong = structuredClone(snapshot);
    wrong.carouselSource.url = 'https://www.mini.ca/en';
    expect(() => validateMiniSnapshot(wrong)).toThrow(/context/);
    const group = structuredClone(snapshot);
    group.records.find((r) => r.nav)!.nav!.minimumSelectionPrices.Colour = 700;
    expect(() => validateMiniSnapshot(group)).toThrow(/pricing/);
    const missing = structuredClone(snapshot);
    delete missing.records.find((r) => r.nav)!.nav!.minimumSelectionPrices.Upholstery;
    expect(() => validateMiniSnapshot(missing)).toThrow(/missing/);
  });
});
