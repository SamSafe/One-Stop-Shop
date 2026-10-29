import { describe, expect, it } from 'vitest';
import { catalog, mercedesSnapshot as base, mercedesVanStockSnapshot as snapshot } from './index';
import {
  mercedesVanObservation,
  mercedesVanStockUrl,
  mercedesVanArchive,
  mercedesVanStockNoRegression,
  validateMercedesVanStockSnapshot,
} from './mercedes-vans-import';
import { addMercedesVanStock, mercedesVanStockGaps } from './mercedes-vans';

const car = (code: string, year = 2025) =>
  catalog.cars.find((c) => c.id === `mercedes-ca-${year}-${code.toLowerCase()}`)!;
function rawFixture() {
  return {
    type: 'NEW',
    year: '2026',
    modelId: 'DPVS2S',
    classId: 'SPRINTER',
    bodyStyleId: 'Passenger',
    dealerId: '0813',
    modelName: 'Passenger Van 2500 Standard Roof 144" Wheelbase',
    msrp: 94656,
    available: true,
    isVehicleCurrentlyReserved: false,
    roofHeight: { value: 'HIGHROOF' },
    powertrain: { value: '4CYLDIESELSO' },
    wheelbase: { value: '144' },
    vehicleAttributes: { demoVehicle: false, dealer: { id: '0813', address: [{ country: 'CA' }] } },
    options: [{ id: '0:D03' }],
    packages: [{ id: '9:X71' }],
    vin: 'W1Y4EBHY0PT000001',
    properties: [{ name: 'VIN', value: 'W1Y4EBHY0PT000001' }],
  };
}
describe('Canadian Mercedes passenger/crew van new-stock evidence', () => {
  it('reconciles every published Canadian dealer, bounded query page and distinct new-vehicle identity', () => {
    expect(validateMercedesVanStockSnapshot(snapshot, base).dealers).toHaveLength(54);
    expect(snapshot.groups).toHaveLength(18);
    expect(snapshot.groups.reduce((n, g) => n + g.pages.length, 0)).toBe(19);
    expect(snapshot.groups.reduce((n, g) => n + g.total, 0)).toBe(81);
    expect(snapshot.observations).toHaveLength(81);
    expect(new Set(snapshot.observations.map((r) => r.id)).size).toBe(81);
    expect(new Set(snapshot.observations.map((r) => r.key)).size).toBe(13);
    expect(snapshot.modelCodes).toHaveLength(70);
    expect(snapshot.archives).toHaveLength(5);
    expect(snapshot.retrievedAt).toBe('2026-10-23T18:54:30.794Z');
    expect(JSON.stringify(snapshot)).not.toMatch(/"(?:vin|headers|cookie|email|properties)"/i);
  });
  it('uses page numbers in requests, row offsets in responses and the native dealer/model restrictions', () => {
    const group = snapshot.groups.find((g) => g.pages.length === 2)!;
    expect(group.total).toBe(19);
    expect(group.pages[1]!.page).toBe(1);
    expect(group.pages[1]!.offset).toBe(12);
    expect(group.pages[1]!.ids).toHaveLength(7);
    const dealers = group.dealerIds.map((id) => snapshot.dealers.find((d) => d.id === id)!);
    const url = new URL(mercedesVanStockUrl(snapshot.modelCodes, dealers, 1));
    expect(url.searchParams.get('start')).toBe('1');
    expect(url.searchParams.get('count')).toBe('12');
    expect(url.searchParams.get('currentDealerOnly')).toBe('true');
    expect(url.searchParams.get('shared')).toBe('true');
    expect(url.searchParams.get('model')!.split(',')).toHaveLength(70);
    expect(() => mercedesVanStockUrl(snapshot.modelCodes, [], 0)).toThrow(/context/);
    expect(() => mercedesVanStockUrl(snapshot.modelCodes, dealers, -1)).toThrow(/context/);
  });
  it('adds exact older bare-model MSRP without substituting the configured inventory amount', () => {
    for (const [code, amount] of [
      ['2CV144H', 74640],
      ['2CV144S', 70660],
      ['2P144A', 93730],
      ['2P144H', 84290],
      ['2P144S', 80200],
    ] as const) {
      const c = car(code);
      expect(c.year).toBe(2025);
      expect(c.facts.msrpCad.value).toBe(amount);
      expect(c.facts.msrpCad.note).toContain(
        'Confirm the selected equipment and dealer price for an individual stock vehicle',
      );
      expect(c.availability.status).toBe('manufacturer-listed');
      expect(c.variant).toContain('Observed new stock');
      const source = catalog.sources.find((s) => s.id === c.facts.msrpCad.source)!;
      expect(source.url).toContain(`year=2025&class=SPRINTER&model=${code}`);
      expect(c.facts.seats.value).toBeNull();
      expect(c.facts.heightMm.value).toBeNull();
    }
    expect(car('2P144A').drivetrain).toBe('AWD');
    expect(car('2P144S').drivetrain).toBe('Not verified');
    expect(car('2CV144H').trim).toContain('High Output');
    expect(car('2CV144S').trim).toContain('Standard Output');
    const mutated = structuredClone(snapshot);
    mutated.observations.forEach((r) => (r.publishedMsrp = 1));
    const added = addMercedesVanStock(
      {
        schemaVersion: 1,
        reviewedAt: '2026-10-23',
        scope: 'Fixture',
        pricingNote: 'Fixture',
        cars: [],
        sources: [],
      },
      mutated,
    );
    expect(added.cars.find((c) => c.id === car('2P144S').id)!.facts.msrpCad.value).toBe(80200);
  });
  it('keeps optional stock equipment separate from current base seating and excludes filter-only archives', () => {
    const highRoof = snapshot.observations.find(
      (r) => r.model === 'DPVS2S' && r.roof === 'HIGHROOF',
    )!;
    expect(highRoof.optionCodes).toContain('0:D03');
    expect(highRoof.publishedMsrp).not.toBe(car('DPVS2S', 2026).facts.msrpCad.value);
    expect(car('DPVS2S', 2026).facts.msrpCad.value).toBe(78380);
    expect(car('DPVS2S', 2026).facts.seats.value).toBe(12);
    expect(car('DPVS2S', 2026).availability.note).toContain('varying optional equipment');
    expect(catalog.cars.some((c) => c.make === 'Mercedes-Benz' && c.model === 'Metris')).toBe(
      false,
    );
    expect(snapshot.references.some((r) => r.key === '2023/METRISP1264')).toBe(true);
    expect(mercedesVanStockGaps(snapshot).some((g) => g.field === 'van-stock-filter-only')).toBe(
      true,
    );
    expect(catalog.cars.find((c) => c.id === 'honda-cr-v-2026-lx-fwd')).toBeDefined();
  });
  it('rejects missing dealers, query pages, rows, search models and exact older price evidence', () => {
    const group = structuredClone(snapshot);
    group.groups.pop();
    expect(() => validateMercedesVanStockSnapshot(group, base)).toThrow(/dealer search coverage/);
    const page = structuredClone(snapshot);
    page.groups.find((g) => g.pages.length === 2)!.pages.pop();
    expect(() => validateMercedesVanStockSnapshot(page, base)).toThrow(/page count/);
    const rows = structuredClone(snapshot);
    rows.groups.find((g) => g.total > 0)!.pages[0]!.ids.pop();
    expect(() => validateMercedesVanStockSnapshot(rows, base)).toThrow(/row count/);
    const model = structuredClone(snapshot);
    model.modelCodes.pop();
    expect(() => validateMercedesVanStockSnapshot(model, base)).toThrow(
      /model-code search coverage/,
    );
    const archive = structuredClone(snapshot);
    archive.archives.shift();
    expect(() => validateMercedesVanStockSnapshot(archive, base)).toThrow(
      /factory reference coverage/,
    );
    const duplicate = structuredClone(snapshot);
    duplicate.observations.push(duplicate.observations[0]!);
    expect(() => validateMercedesVanStockSnapshot(duplicate, base)).toThrow(/Duplicate normalized/);
  });
  it('rejects wrong source context, row offsets, price years, powertrain joins and renewed review dates', () => {
    const query = structuredClone(snapshot);
    query.groups[0]!.pages[0]!.source.url += '&year=2026';
    expect(() => validateMercedesVanStockSnapshot(query, base)).toThrow(/HTTP\/URL context/);
    const offset = structuredClone(snapshot);
    offset.groups.find((g) => g.pages.length === 2)!.pages[1]!.offset = 1;
    expect(() => validateMercedesVanStockSnapshot(offset, base)).toThrow(/page index/);
    const y = structuredClone(snapshot);
    y.archives[0]!.content.year = 2026;
    expect(() => validateMercedesVanStockSnapshot(y, base)).toThrow(/model\/year\/body/);
    const engine = structuredClone(snapshot);
    engine.archives[0]!.content.cylinder = '4CYLGAS';
    expect(() => validateMercedesVanStockSnapshot(engine, base)).toThrow(/powertrain conflict/);
    const date = structuredClone(snapshot);
    date.retrievedAt = '2026-10-24T18:54:30.794Z';
    expect(() => validateMercedesVanStockSnapshot(date, base)).toThrow(/review date/);
    const client = structuredClone(snapshot);
    client.clients[0]!.sha256 = '0'.repeat(64);
    expect(() => validateMercedesVanStockSnapshot(client, base)).toThrow(/native client changed/);
  });
  it('normalizes positive NEW Canadian stock without retaining vehicle identifiers and rejects unknown conditions', () => {
    const normalized = mercedesVanObservation(rawFixture(), '1'.repeat(64));
    expect(normalized.body).toBe('PV');
    expect(normalized.year).toBe(2026);
    expect(normalized.roof).toBe('HIGHROOF');
    expect(JSON.stringify(normalized)).not.toContain('W1Y4EBHY0PT000001');
    expect(JSON.stringify(normalized)).not.toMatch(/vin|properties/i);
    expect(() =>
      mercedesVanObservation({ ...rawFixture(), type: 'USED' }, '1'.repeat(64)),
    ).toThrow();
    const foreign = rawFixture();
    foreign.vehicleAttributes.dealer.address[0]!.country = 'US';
    expect(() => mercedesVanObservation(foreign, '1'.repeat(64))).toThrow(/Canadian dealer/);
    const missing = rawFixture() as Record<string, unknown>;
    delete missing.vehicleAttributes;
    expect(() => mercedesVanObservation(missing, '1'.repeat(64))).toThrow();
  });
  it('does not lose previously observed model-year profiles or Canadian dealer search contexts during refresh', () => {
    const lost = structuredClone(snapshot);
    lost.observations = lost.observations.filter((r) => r.key !== '2025/2P144A');
    expect(() => mercedesVanStockNoRegression(snapshot, lost)).toThrow(
      /lose an observed new model-year/,
    );
    const dealer = structuredClone(snapshot);
    dealer.dealers.pop();
    expect(() => mercedesVanStockNoRegression(snapshot, dealer)).toThrow(/dealer search context/);
    const ref = snapshot.references.find((r) => r.key === snapshot.archives[0]!.key)!;
    expect(() =>
      mercedesVanArchive(snapshot.archives[0]!.content, { ...ref, year: ref.year + 1 }),
    ).toThrow(/model\/year\/body/);
    expect(() => mercedesVanArchive({ ...snapshot.archives[0]!.content, msrp: 0 }, ref)).toThrow();
    expect(() =>
      mercedesVanArchive({ ...snapshot.archives[0]!.content, brand: 'us' }, ref),
    ).toThrow();
    expect(() =>
      mercedesVanArchive({ ...snapshot.archives[0]!.content, model: 'OTHER' }, ref),
    ).toThrow(/model\/year\/body/);
  });
});
