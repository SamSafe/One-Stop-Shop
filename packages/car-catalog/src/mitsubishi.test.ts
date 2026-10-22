import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/mitsubishi.json';
import { catalog, mitsubishiSnapshot as snapshot } from './index';
import {
  mitsubishiApollo,
  mitsubishiModels,
  mitsubishiSpecifications,
  validateMitsubishiSnapshot,
} from './mitsubishi-import';
import {
  mitsubishiDrive,
  mitsubishiFacts,
  mitsubishiFuel,
  mitsubishiMeasurement,
  mitsubishiMsrp,
  mitsubishiRecordId,
} from './mitsubishi';

const row = (key: string, suffix?: string) =>
  snapshot.records.find(
    (record) => record.modelKey === key && (!suffix || record.model.code.endsWith(suffix)),
  )!;
const facts = (key: string, suffix?: string) =>
  mitsubishiFacts(
    row(key, suffix),
    snapshot.models.find((model) => model.key === key)!,
  );
function html(rows: unknown, market = 'ca') {
  return `<html><script>window.__PRELOADED_STATE__ = ${JSON.stringify({ appRegion: market, appMode: 'liveapp', GQLParams: { endpoint: 'https://www-graphql.prod.mipulse.co/prod/graphql', appRegion: market, appLang: 'en' }, Config: { market, currencyFormat: 'CAD', measurementSystem: 'metric' } })};window.__APOLLO_STATE__ = ${JSON.stringify(rows)};</script><script>throw new Error('must not execute')</script></html>`;
}
describe('Mitsubishi Canadian factory and inventory import', () => {
  it('reconciles current active codes plus additional new-inventory model years', () => {
    const valid = validateMitsubishiSnapshot(data);
    expect(valid.models).toHaveLength(9);
    expect(valid.records).toHaveLength(49);
    expect(valid.currentModelKeys).toHaveLength(6);
    expect(valid.records.filter((record) => record.specification)).toHaveLength(32);
    expect(valid.inventoryReferences).toHaveLength(9);
    expect(valid.inventoryGaps.map((gap) => [gap.reference.year, gap.reference.model])).toEqual([
      [2027, 'Outlander'],
    ]);
    expect(valid.records.every((record) => mitsubishiMsrp(record) !== null)).toBe(true);
    const imported = catalog.cars.filter(
      (car) => car.make === 'Mitsubishi' && car.recordKind === 'retail-trim',
    );
    expect(imported).toHaveLength(49);
    expect(
      imported.filter((car) => car.availability.status === 'manufacturer-listed'),
    ).toHaveLength(32);
    expect(imported.filter((car) => car.availability.status === 'not-checked')).toHaveLength(17);
  });
  it('rejects lost trims, omitted inventory years and mismatched sources or model years', () => {
    const missing = structuredClone(data);
    missing.records.pop();
    expect(() => validateMitsubishiSnapshot(missing)).toThrow('factory configurations');
    const lostFamily = structuredClone(snapshot);
    lostFamily.models = lostFamily.models.filter((model) => model.key !== 'DG/2025');
    lostFamily.records = lostFamily.records.filter((record) => record.modelKey !== 'DG/2025');
    expect(() => validateMitsubishiSnapshot(lostFamily)).toThrow('inventory model years');
    const lostGap = structuredClone(snapshot);
    lostGap.inventoryGaps = [];
    expect(() => validateMitsubishiSnapshot(lostGap)).toThrow('inventory model years');
    const year = structuredClone(snapshot);
    year.records[0]!.model.year--;
    expect(() => validateMitsubishiSnapshot(year)).toThrow('record model/year');
    const source = structuredClone(snapshot);
    source.models[0]!.priceSource.requestSha256 = null;
    expect(() => validateMitsubishiSnapshot(source)).toThrow('model source identity');
    const spec = structuredClone(snapshot);
    spec.records.find((record) => record.specification)!.specification!.source.sha256 = 'a'.repeat(
      64,
    );
    expect(() => validateMitsubishiSnapshot(spec)).toThrow('exact specification source');
  });
  it('keeps model-year factory prices and separates returned fees from MSRP', () => {
    expect(facts('DG/2026', '_C61').msrpCad.value).toBe(36398);
    expect(facts('DG/2025', '_C51').msrpCad.value).toBe(35598);
    expect(facts('ZC/2027', '_C71').msrpCad.value).toBe(25278);
    expect(facts('ZC/2026', '_C61').msrpCad.value).toBe(24998);
    const value = structuredClone(row('DG/2026', '_C61'));
    value.model.price.fees = [{ label: 'Freight', value: 100 }];
    value.model.price.value += 100;
    expect(mitsubishiMsrp(value)).toBe(36398);
    value.model.price.value--;
    expect(mitsubishiMsrp(value)).toBeNull();
    expect(mitsubishiRecordId(row('ZC/2027', '_C71'))).not.toBe(
      mitsubishiRecordId(row('ZC/2026', '_C61')),
    );
  });
  it('distinguishes the 48 V mild hybrid, PHEV, EV and exact drive variants', () => {
    expect(mitsubishiFuel(row('DG/2026'))).toBe('Hybrid');
    expect(mitsubishiFuel(row('DG/2025'))).toBe('Gasoline');
    expect(mitsubishiFuel(row('DGE/2026'))).toBe('Plug-in hybrid');
    expect(mitsubishiFuel(row('DME/2027'))).toBe('Electric');
    expect(mitsubishiDrive(row('ZC/2027', '_C71'))).toBe('FWD');
    expect(mitsubishiDrive(row('ZC/2027', '_C72'))).toBe('AWD');
    expect(facts('DG/2026', '_C61').fuelCombinedL100km.value).toBe(8.7);
    expect(facts('DG/2026', '_C61').horsepower.value).toBe(174);
  });
  it('uses matching metric/imperial pairs and explicit all-seats-upright cargo', () => {
    expect(mitsubishiMeasurement('4720 / 185.8', 'Length (mm / in)')).toBe(4720);
    expect(mitsubishiMeasurement('308 / 10.9', 'Cargo (L / cu ft)')).toBe(308);
    expect(mitsubishiMeasurement('4720 / 150', 'Length (mm / in)')).toBeNull();
    expect(mitsubishiMeasurement('308 / 10.9', 'Cargo in unknown units')).toBeNull();
    expect(facts('DG/2026', '_C61').cargoSeatsUpL.value).toBe(308);
    expect(facts('DG/2026', '_C61').cargoSeatsDownL.value).toBe(1822);
    expect(facts('ZC/2027', '_C71').cargoSeatsUpL.value).toBeNull();
    expect(facts('ZC/2027', '_C71').cargoSeatsUpL.note).toContain('generic cargo label');
    expect(facts('DG/2025', '_C51').lengthMm.value).toBeNull();
  });
  it('keeps EV equivalence distinct from kWh and preserves PHEV mode/power uncertainty', () => {
    const electric = facts('DME/2027', '_F71'),
      plugIn = facts('DGE/2026', '_C61');
    expect(electric.electricRangeKm.value).toBe(454);
    expect(electric.electricModeLe100km.value).toBe(2.1);
    expect(electric.electricCombinedKwh100km.value).toBeNull();
    expect(electric.fuelCombinedL100km.value).toBeNull();
    expect(electric.rechargeHours.value).toBeNull();
    expect(electric.rechargeHours.note).toContain('10–100%');
    expect(plugIn.electricRangeKm.value).toBe(72);
    expect(plugIn.electricRangeKm.value).not.toBe(690);
    expect(plugIn.horsepower.value).toBeNull();
    expect(plugIn.horsepower.note).toContain('combined-system');
    expect(plugIn.fuelCombinedL100km.value).toBeNull();
    expect(plugIn.electricModeLe100km.value).toBeNull();
  });
  it('requires complete model codes and rejects success-status GraphQL errors', () => {
    const model = snapshot.models.find((model) => model.key === 'DG/2026')!,
      record = row(model.key, '_C61');
    const response = {
      data: {
        getModelsSelector: {
          msrpLabel: 'MSRP',
          vehicleInfo: {
            id: 'fixture',
            code: model.vehicleCode,
            name: model.name,
            year: model.year,
          },
          models: [record.model],
        },
      },
    };
    expect(() =>
      mitsubishiModels(response, {
        vehicleCode: model.vehicleCode,
        year: model.year,
        expectedCodes: model.expectedCodes,
      }),
    ).toThrow('factory trim codes');
    expect(() =>
      mitsubishiModels(response, { vehicleCode: model.vehicleCode, year: 2027 }),
    ).toThrow('vehicle/year identity');
    expect(() =>
      mitsubishiModels(
        { errors: [{ message: 'Vehicle not found' }], data: { getModelsSelector: null } },
        { vehicleCode: 'DG', year: 2027 },
      ),
    ).toThrow('Vehicle not found');
  });
  it('reads normalized public data without execution and rejects foreign or superseded specs', () => {
    const record = row('DG/2026', '_C61'),
      root = {
        __typename: 'Specifications',
        vehicle: { name: '2026 Outlander' },
        models: [
          {
            id: record.model.id,
            code: record.model.code,
            name: record.model.name,
            price: { value: 36398 },
            specifications: record.specification!.fields,
          },
        ],
      };
    expect(mitsubishiApollo(html({ root })).byType('Specifications')).toHaveLength(1);
    expect(() => mitsubishiApollo(html({ root }, 'us'))).toThrow();
    expect(
      mitsubishiSpecifications(html({ root }), {
        name: 'Outlander',
        year: 2026,
        models: [record.model],
      }),
    ).toHaveLength(1);
    expect(() =>
      mitsubishiSpecifications(html({ root }), {
        name: 'Outlander',
        year: 2025,
        models: [record.model],
      }),
    ).toThrow('specification page model/year');
    expect(() =>
      mitsubishiApollo(
        html({ root: { __typename: 'Specifications', vehicle: { type: 'id', id: 'missing' } } }),
      ).byType('Specifications'),
    ).toThrow('Missing Mitsubishi public data reference');
  });
});
