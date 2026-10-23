import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/lucid.json';
import { catalog } from './index';
import {
  lucidAmount,
  lucidChange,
  lucidFactoryProfiles,
  lucidFlightNodes,
  lucidSelectionPrice,
  lucidSelectionValid,
  lucidStockResponseSchema,
  lucidStockSelection,
  lucidRequireNoRegression,
  validateLucidSnapshot,
} from './lucid-import';
import type { LucidRawStock } from './lucid-import';
import { lucidFacts, lucidProfiles } from './lucid';

const snapshot = validateLucidSnapshot(data),
  on = snapshot.retrievedAt.slice(0, 10);
const builder = (model: 'air' | 'gravity') =>
  snapshot.current.find((c) => c.builder.model === model)!.builder;
function rawStockFixture(): LucidRawStock {
  const row = snapshot.stock.find(
    (r) => r.model === 'air' && r.year === 2026 && r.variant === 'AT',
  )!;
  const y = snapshot.years.find((y) => y.model === 'air' && y.year === 2026)!;
  const product = (code: string) => ({
    typeId: y.options[code]!.typeId,
    sapCode: code,
    zlCode: code,
    technicalName: y.options[code]!.technicalName,
  });
  const type = (id: string) => product(row.selected.find((c) => y.options[c]!.typeId === id)!);
  return lucidStockResponseSchema.parse({
    data: [
      {
        VIN: '50EA1GBA0NA000001',
        titleStatus: 'New',
        category: 'Inventory',
        subCategory: 'Available',
        isCPO: false,
        availability: 'AVAILABLE NOW',
        model: product('AIR'),
        modelVariant: product('AT'),
        modelYear: '2026',
        country: product('COCA'),
        region: product('RENA'),
        bundle: product(row.trim),
        color: type('LUCID_EXT_COLOR'),
        interior: type('LUCID_INT_THEME'),
        wheels: type('LUCID_WHEELS'),
        roof: type('LUCID_ROOF'),
        look: type('LUCID_TRIM'),
        motorDrive: type('LUCID_DRIVETRAIN'),
        edition: type('LUCID_EDITION'),
        appearance: type('LUCID_APPEARANCE'),
        packages: type('LUCID_PACKAGES'),
        seatingOptions: type('LUCID_SEATING'),
        additionalFeatures: {
          soundSystem: type('LUCID_SOUNDSYSTEM'),
          dreamDrive: type('LUCID_DREAMDRIVE'),
        },
        rearSeats: { backSeatsCode: 'RS02', backSeats: 'Bench Seat' },
        zlList: [...row.selected.filter((c) => c !== row.trim), ...row.removedCodes].join(','),
        price: {
          value: row.listedTotalCad,
          currency: 'CAD',
          afterDiscountPrice: row.afterDiscountPriceCad,
        },
      },
    ],
  }).data[0]!;
}
describe('Canadian Lucid factory choices and exact-year new stock', () => {
  it('reconciles menu, complete factory graphs, all delivery samples and all observed years', () => {
    expect(snapshot.overview.models).toEqual(['air', 'gravity']);
    expect(snapshot.overview.trims).toHaveLength(6);
    expect(snapshot.overview.placeholders).toHaveLength(5);
    expect(snapshot.current.map((c) => c.profiles.length)).toEqual([28, 320]);
    expect(snapshot.current.reduce((n, c) => n + c.states, 0)).toBe(5028);
    expect(snapshot.current.reduce((n, c) => n + c.transitions, 0)).toBe(67078);
    expect(snapshot.searches).toHaveLength(32);
    expect(snapshot.stock).toHaveLength(115);
    expect(new Set(snapshot.stock.map((r) => r.year))).toEqual(new Set([2025, 2026, 2027]));
    expect(lucidProfiles(snapshot)).toHaveLength(421);
    expect(
      catalog.cars.filter((c) => c.make === 'Lucid' && c.recordKind === 'retail-trim'),
    ).toHaveLength(421);
    const rows = catalog.cars.filter((c) => c.make === 'Lucid' && c.recordKind === 'retail-trim');
    expect(new Set(rows.map((c) => [c.year, c.model, c.trim, c.variant].join('/'))).size).toBe(
      rows.length,
    );
    expect(JSON.stringify(snapshot)).not.toMatch(
      /"(?:VIN|uuid|cookie|headers|shortCode|batchNumber)"/i,
    );
  });
  it('decodes byte-framed UTF-8 text followed immediately by a JSON frame without executing code', () => {
    const value = 'é😀\n',
      bytes = new TextEncoder().encode(value).length;
    const frame = `1:T${bytes.toString(16)},${value}2:${JSON.stringify(['$', 'fixture', null, { safe: true }])}\n`;
    const html = `<script>self.__next_f.push(${JSON.stringify([1, frame])})</script>`;
    expect(lucidFlightNodes(html)).toEqual([['$', 'fixture', null, { safe: true }]]);
    expect(() =>
      lucidFlightNodes(
        `<script>self.__next_f.push(${JSON.stringify([1, '1:Tff,short'])})</script>`,
      ),
    ).toThrow(/Truncated/);
    expect(() => lucidFlightNodes('<script>process.exit()</script>')).toThrow(/missing/);
  });
  it('keeps fee-inclusive totals separate from explicit factory base prices', () => {
    for (const [model, prices, fees] of [
      ['air', [97600, 110500, 158900, 325000], 2300],
      ['gravity', [110700, 136700], 2800],
    ] as const) {
      const b = builder(model);
      for (const [index, t] of b.data.trimData.entries()) {
        const p = lucidSelectionPrice(
          b.data.optionData,
          t.name,
          t.variant[0]!,
          t.default.configuration[t.variant[0]!]!,
          on,
        );
        expect(p.msrpCad).toBe(prices[index]);
        expect(p.configuredTotalCad).toBe(prices[index]! + fees);
        expect(p.feesCad).toBe(fees);
      }
    }
  });
  it('prices each Pure package once and resets its forced sound/appearance/wheel components', () => {
    const b = builder('air'),
      t = b.data.trimData[0]!,
      initial = { selected: t.default.configuration.PURE!, forced: [] };
    const first = lucidChange(b, t, initial, 'PKG08', on);
    expect(first.selected).toEqual(expect.arrayContaining(['PKG08', 'AU01', 'EXT09M', 'WH22']));
    expect(lucidSelectionPrice(b.data.optionData, t.name, 'PURE', first.selected, on).msrpCad).toBe(
      103800,
    );
    const second = lucidChange(b, t, first, 'PKG09', on);
    expect(second.selected).not.toContain('PKG08');
    expect(second.selected).not.toContain('WH22');
    expect(
      lucidSelectionPrice(b.data.optionData, t.name, 'PURE', second.selected, on).msrpCad,
    ).toBe(106300);
    const reset = lucidChange(b, t, second, 'PKG09', on);
    expect(new Set(reset.selected)).toEqual(new Set(initial.selected));
    expect(lucidFactoryProfiles(b, t, on).profiles).toHaveLength(3);
  });
  it('keeps Gravity seat counts and package dependencies exact', () => {
    const b = builder('gravity'),
      t = b.data.trimData[0]!,
      initial = { selected: t.default.configuration.AT!, forced: [] };
    const seven = lucidChange(b, t, initial, '7RSC', on);
    expect(lucidSelectionPrice(b.data.optionData, t.name, 'AT', seven.selected, on).msrpCad).toBe(
      114700,
    );
    const upgraded = lucidChange(b, t, seven, 'AD02', on);
    expect(upgraded.selected).toContain('CCP05');
    expect(lucidSelectionValid(b, t, upgraded, on)).toBe(true);
    expect(
      lucidSelectionValid(
        b,
        t,
        { selected: upgraded.selected.filter((c) => c !== 'CCP05'), forced: [] },
        on,
      ),
    ).toBe(false);
    const profiles = lucidProfiles(snapshot);
    const five = profiles.find(
      (p) => !p.stockOnly && p.model === 'gravity' && p.selection.includes('5RSC'),
    )!;
    const sevenProfile = profiles.find(
      (p) => !p.stockOnly && p.model === 'gravity' && p.selection.includes('7RSC'),
    )!;
    expect(lucidFacts(five, snapshot).seats.value).toBe(5);
    expect(lucidFacts(sevenProfile, snapshot).seats.value).toBe(7);
  });
  it('rejects foreign, missing, overlapping and inconsistent price components', () => {
    const original = builder('air').data.optionData;
    const foreign = structuredClone(original);
    foreign.PURE!.prices[0]!.currency = 'USD';
    expect(() => lucidAmount(foreign, 'pure', 'PURE', 'PURE', on)).toThrow(/context/);
    const ambiguous = structuredClone(original);
    ambiguous.PURE!.prices.push(ambiguous.PURE!.prices[0]!);
    expect(() => lucidAmount(ambiguous, 'pure', 'PURE', 'PURE', on)).toThrow(/ambiguous/);
    const expired = structuredClone(original);
    expired.PURE!.prices[0]!.amountsByCountry[0]!.validTo = on;
    expect(() => lucidAmount(expired, 'pure', 'PURE', 'PURE', on)).toThrow(/context/);
    const conflict = structuredClone(original);
    conflict.PURE!.prices[0]!.amountsByCountry[0]!.manufacturePrice++;
    expect(() => lucidAmount(conflict, 'pure', 'PURE', 'PURE', on)).toThrow(/conflict/);
  });
  it('reconciles explicit stock trim aliases without borrowing another year or discount', () => {
    const row = rawStockFixture(),
      y = snapshot.years.find((y) => y.model === 'air' && y.year === 2026)!;
    const p = lucidStockSelection(row, y.options, on);
    expect(p.removed).toContain('air');
    expect(p.selected).toContain('touring');
    expect(p.configuredTotalCad).toBe(row.price.value);
    row.price.afterDiscountPrice = 1;
    expect(lucidStockSelection(row, y.options, on).msrpCad).toBe(p.msrpCad);
    row.price.value++;
    expect(() => lucidStockSelection(row, y.options, on)).toThrow(/total/);
    const wrong = rawStockFixture();
    wrong.interior.sapCode = 'INVENTED';
    expect(() => lucidStockSelection(wrong, y.options, on)).toThrow(/disagree/);
    const used = { data: [{ ...rawStockFixture(), titleStatus: 'Used' }] };
    expect(() => lucidStockResponseSchema.parse(used)).toThrow();
  });
  it('rejects omitted factory profiles, regional queries, mismatched year sources and stock totals', () => {
    const missing = structuredClone(snapshot);
    missing.current[0]!.profiles.pop();
    expect(() => validateLucidSnapshot(missing)).toThrow(/profiles/);
    const query = structuredClone(snapshot);
    query.searches.pop();
    expect(() => validateLucidSnapshot(query)).toThrow(/evidence|coverage/);
    const year = structuredClone(snapshot);
    year.years[0]!.priceSource.url = year.years[1]!.priceSource.url;
    expect(() => validateLucidSnapshot(year)).toThrow(/year/);
    const price = structuredClone(snapshot);
    price.stock[0]!.listedTotalCad++;
    expect(() => validateLucidSnapshot(price)).toThrow(/price/);
  });
  it('keeps stable profile identities when exact stock MSRP changes', () => {
    const next = structuredClone(snapshot),
      y = next.years.find((y) => y.model === 'air' && y.year === 2026)!;
    for (const p of y.options.AT!.prices)
      for (const a of p.amountsByCountry) {
        a.basePrice += 1000;
        a.manufacturePrice += 1000;
        a.value += 1000;
      }
    for (const r of next.stock)
      if (r.model === 'air' && r.year === 2026 && r.variant === 'AT') r.listedTotalCad += 1000;
    expect(lucidProfiles(next).map((p) => p.id)).toEqual(lucidProfiles(snapshot).map((p) => p.id));
  });
  it('uses exact power while withholding projected ranges, ambiguous cargo and mirror conventions', () => {
    const profiles = lucidProfiles(snapshot),
      sapphire = profiles.find((p) => p.variant === 'TRIMO')!;
    expect(lucidFacts(sapphire, snapshot).horsepower.value).toBe(1234);
    for (const p of profiles) {
      const facts = lucidFacts(p, snapshot);
      expect(facts.horsepower.value).toBeGreaterThan(0);
      for (const field of [
        'electricRangeKm',
        'cargoSeatsUpL',
        'cargoSeatsDownL',
        'widthMm',
      ] as const)
        expect(facts[field].value).toBeNull();
    }
  });
  it('refuses silent loss of current factory profiles and older new-stock year/trim evidence', () => {
    const lost = structuredClone(snapshot);
    lost.current[0]!.profiles.pop();
    expect(() => lucidRequireNoRegression(snapshot, lost)).toThrow(/factory/);
    const older = structuredClone(snapshot);
    older.stock = older.stock.filter((r) => r.year !== 2025);
    expect(() => lucidRequireNoRegression(snapshot, older)).toThrow(/older/);
  });
});
