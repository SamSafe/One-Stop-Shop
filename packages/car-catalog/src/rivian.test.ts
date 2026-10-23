import { describe, expect, it } from 'vitest';
import { catalog, rivianSnapshot as snapshot } from './index';
import {
  rivianBuilderLoader,
  rivianChange,
  rivianFactoryPrice,
  rivianFactoryProfiles,
  rivianSelectionValid,
  rivianStockSelectionValid,
  rivianOptionPrice,
  rivianRequireNoRegression,
  validateRivianSnapshot,
  validateRivianRules,
} from './rivian-import';
import { rivianProfiles, rivianFacts, rivianStockMsrp } from './rivian';
const current = (model: 'R1S' | 'R1T') =>
  snapshot.current.find((c) => c.builder.sku === model)!.builder;

describe('Canadian Rivian visible factory choices and dated new-stock evidence', () => {
  it('reconciles current ordering, both stock years and delivery-point limitations without a national inventory claim', () => {
    expect(snapshot.listedOrderModels).toEqual(['R1S', 'R1T']);
    expect(snapshot.current.map((c) => c.expectedProfileKeys.length)).toEqual([46, 23]);
    expect(snapshot.stock).toHaveLength(45);
    expect(snapshot.searches).toHaveLength(26);
    expect(snapshot.searches.filter((s) => !s.error)).toHaveLength(8);
    expect(snapshot.searches.reduce((n, q) => n + q.reportedRows, 0)).toBe(132);
    expect(new Set(snapshot.stock.map((r) => r.modelYear))).toEqual(new Set([2026, 2027]));
    const profiles = rivianProfiles(snapshot);
    expect(profiles).toHaveLength(106);
    expect(profiles.filter((p) => p.stockOnly)).toHaveLength(37);
    expect(
      catalog.cars.filter((c) => c.make === 'Rivian' && c.recordKind === 'retail-trim'),
    ).toHaveLength(106);
    expect(JSON.stringify(snapshot)).not.toMatch(/"(?:VIN|cookie|headers|configId|x-api-key)"/i);
  });
  it('rejects omitted factory profiles, delivery searches and mismatched stock years', () => {
    const missing = structuredClone(snapshot);
    missing.current[0]!.expectedProfileKeys.pop();
    expect(() => validateRivianSnapshot(missing)).toThrow(/profiles/);
    const search = structuredClone(snapshot);
    search.searches.pop();
    expect(() => validateRivianSnapshot(search)).toThrow(/coverage/);
    const year = structuredClone(snapshot);
    year.stock[0]!.modelYear = 2025;
    expect(() => validateRivianSnapshot(year)).toThrow(/year/);
    const context = structuredClone(snapshot);
    context.current[0]!.builder.ruleset.meta.country = 'US' as 'CA';
    expect(() => validateRivianSnapshot(context)).toThrow();
  });
  it('uses Canadian factory MSRP and reconciles the native fee breakdown instead of stale marketing cards', () => {
    for (const [model, prices] of [
      ['R1S', [151990, 181990, 202990]],
      ['R1T', [144990, 172990, 193990]],
    ] as const) {
      const b = current(model),
        r = b.ruleset;
      for (const [i, build] of [`BLD-D${model}`, `BLD-T${model}`, `BLD-Q${model}`].entries()) {
        const selected = rivianChange(r, b.selection, build);
        expect(rivianFactoryPrice(r, selected)).toBe(prices[i]);
        expect(b.buildPricing[build]!.finalPrice).toBe(prices[i]! + 3117);
      }
    }
    const fees = structuredClone(snapshot);
    fees.current[0]!.builder.buildPricing['BLD-DR1S']!.msrp += 3117;
    expect(() => validateRivianSnapshot(fees)).toThrow(/MSRP/);
  });
  it('expands All-Terrain through its compatible wheel choice and never invents an independent Large-battery package', () => {
    for (const model of ['R1S', 'R1T'] as const) {
      const b = current(model),
        r = b.ruleset,
        expanded = rivianFactoryProfiles(r, b.selection);
      expect(
        expanded.profiles.every(
          (p) => !p.selection.includes('ATP-001') || p.selection.includes('WHL-0AD'),
        ),
      ).toBe(true);
      expect(
        expanded.profiles.some(
          (p) => p.selection.includes('ATP-001') && p.selection.includes('BAT-B01'),
        ),
      ).toBe(false);
      let selected = rivianChange(r, b.selection, 'DTN-202');
      selected = rivianChange(r, selected, 'WHL-0AD');
      expect(selected).toContain('WHLPKG-0AD');
      expect(selected).toContain('ATP-001');
      expect(rivianOptionPrice(r, selected, 'ATP-001')).toBe(0);
      expect(rivianSelectionValid(r, selected)).toBe(true);
      expect(rivianFactoryPrice(r, selected)).toBe(model === 'R1S' ? 169390 : 161290);
    }
  });
  it('preserves deliberate package events, dependencies and their exact minimum component prices', () => {
    const b = current('R1S'),
      r = b.ruleset;
    let selected = rivianChange(r, b.selection, 'BUND-AR02');
    expect(selected).toContain('ROOF-DGP');
    expect(selected).toContain('AUD-P01');
    expect(rivianFactoryPrice(r, selected)).toBe(157890);
    selected = rivianChange(r, selected, 'DTN-202');
    selected = rivianChange(r, selected, 'SWUP-PERF01');
    expect(selected).toContain('BUND-AR02');
    expect(rivianFactoryPrice(r, selected)).toBe(174290);
    const unknown = structuredClone(r);
    unknown.rules[0]!.then.select!.push('INVENTED');
    expect(() => validateRivianRules(unknown)).toThrow(/unknown/);
  });
  it('accepts only the reviewed zero-cost stock serialization omissions and preserves meaningful equipment requirements', () => {
    const b = current('R1S'),
      r = b.ruleset,
      selected = b.selection.filter((c) => c !== 'PROC40WJ94');
    expect(rivianSelectionValid(r, selected)).toBe(false);
    expect(rivianStockSelectionValid(r, selected)).toBe(true);
    const charged = structuredClone(r);
    charged.options.PROC40WJ94!.price = 100;
    expect(rivianStockSelectionValid(charged, selected)).toBe(false);
    expect(
      rivianStockSelectionValid(
        r,
        selected.filter((c) => c !== 'BAT-B01'),
      ),
    ).toBe(false);
  });
  it('retains factory pricing before stock adjustments, discounts, paint and provincial charges', () => {
    const row = snapshot.stock.find((r) => r.listingPrice === 139290)!;
    const rules = snapshot.stockRules.find((r) => r.key === `${row.model}/${row.ruleset}`)!.rules;
    const selected = row.marketingOptions.map((o) => o.optionId);
    expect(rivianFactoryPrice(rules, selected)).toBe(139990);
    expect(rivianStockMsrp(rules, selected)).toBe(139990);
    expect(row.finalPrice).toBe(139607);
    expect(row.vehicleDiscountAmount).toBe(2800);
    const repriced = structuredClone(snapshot);
    for (const entry of repriced.stockRules)
      if (entry.rules.groups.MODEL_YEAR!.options.includes('2026'))
        entry.rules.defaults.basePrice += 1000;
    expect(
      rivianProfiles(repriced)
        .filter((p) => p.year === 2026)
        .map((p) => p.id)
        .sort(),
    ).toEqual(
      rivianProfiles(snapshot)
        .filter((p) => p.year === 2026)
        .map((p) => p.id)
        .sort(),
    );
  });
  it('uses exact seating choices and withholds older seating, ambiguous ranges and unjoined technical fields', () => {
    const profiles = rivianProfiles(snapshot);
    const captains = profiles.find(
      (p) => !p.stockOnly && p.model === 'R1S' && p.selection.includes('BUND-AR02'),
    )!;
    expect(rivianFacts(captains, snapshot).seats.value).toBe(6);
    const truck = profiles.find((p) => !p.stockOnly && p.model === 'R1T')!;
    expect(rivianFacts(truck, snapshot).seats.value).toBe(5);
    const old = profiles.find((p) => p.year === 2026)!;
    const facts = rivianFacts(old, snapshot);
    for (const key of [
      'seats',
      'horsepower',
      'fuelCombinedL100km',
      'electricRangeKm',
      'cargoSeatsUpL',
    ] as const)
      expect(facts[key].value).toBeNull();
  });
  it('refuses silent retirement of older stock, current model years and previously served source contexts', () => {
    const stock = structuredClone(snapshot);
    stock.stock.pop();
    expect(() => rivianRequireNoRegression(snapshot, stock)).toThrow(/reconciliation/);
    const year = structuredClone(snapshot);
    year.current[0]!.builder.ruleset.groups.MODEL_YEAR!.options = ['2028'];
    expect(() => rivianRequireNoRegression(snapshot, year)).toThrow(/reconciliation/);
    const area = structuredClone(snapshot);
    area.searches.find((q) => !q.error)!.error = 'NO_DC';
    expect(() => rivianRequireNoRegression(snapshot, area)).toThrow(/reconciliation/);
  });
  it('decodes only the anonymous JSON loader and rejects authentication, cycles and unsupported streams', () => {
    const flat = [
      { _1: 2 },
      'loaderData',
      { _3: 4, _7: 8 },
      'root',
      { _5: 6 },
      'IS_AUTHENTICATED',
      false,
      'routes/builder/vehicleProduct',
      { _9: 10 },
      'sku',
      'R1S',
    ];
    const html = (v: unknown) =>
      `<script>window.__reactRouterContext.streamController.enqueue(${JSON.stringify(JSON.stringify(v))})</script>`;
    expect(rivianBuilderLoader(html(flat))).toEqual({ sku: 'R1S' });
    const authenticated = structuredClone(flat);
    authenticated[6] = true;
    expect(() => rivianBuilderLoader(html(authenticated))).toThrow(/anonymous/);
    const cycle = structuredClone(flat);
    cycle[8] = { _9: 8 };
    expect(() => rivianBuilderLoader(html(cycle))).toThrow(/reference/);
    expect(() => rivianBuilderLoader(html(flat) + html(flat))).toThrow(/stream/);
  });
});
