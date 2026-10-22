import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/polestar.json';
import { catalog, polestarSnapshot as snapshot } from './index';
import {
  polestarConfigurationKey,
  polestarInit,
  polestarInventory,
  polestarLineup,
  polestarSelected,
  polestarStockIdentity,
  validatePolestarSnapshot,
} from './polestar-import';
import {
  polestarFactoryFacts,
  polestarFactoryMsrp,
  polestarRecordId,
  polestarStockFacts,
  polestarStockMsrp,
  polestarUnit,
} from './polestar';

const factory = (slug: string, engine: string, price?: number) =>
  snapshot.factoryRecords.find(
    (row) =>
      row.modelSlug === slug &&
      row.configuration.engineName === engine &&
      (price === undefined || polestarFactoryMsrp(row) === price),
  )!;
describe('Canadian Polestar exact factory and new-stock import', () => {
  it('retains all current motor/pack/single-option paths and all listed Canadian retailers', () => {
    expect(validatePolestarSnapshot(data).currentModelSlugs).toEqual([
      'polestar-2',
      'polestar-3',
      'polestar-4-coupe',
    ]);
    expect(snapshot.factoryRecords).toHaveLength(14);
    expect(
      snapshot.factoryRecords.filter((row) => row.modelSlug === 'polestar-4-coupe'),
    ).toHaveLength(11);
    expect(snapshot.retailers).toHaveLength(6);
    expect(snapshot.inventories).toHaveLength(18);
    expect(
      new Set(
        snapshot.inventories.flatMap((group) => group.records.map((row) => row.vehicle.modelYear)),
      ),
    ).toEqual(new Set(['2026', '2027']));
    expect(catalog.cars.find((car) => car.id === 'honda-cr-v-2026-lx-fwd')).toBeDefined();
  });
  it('rejects missing models, selected configurations, transitions and retailer groups', () => {
    const missingModel = structuredClone(data);
    missingModel.models.pop();
    expect(() => validatePolestarSnapshot(missingModel)).toThrow(/model set/);
    const missingConfiguration = structuredClone(data);
    missingConfiguration.factoryRecords.splice(1, 1);
    expect(() => validatePolestarSnapshot(missingConfiguration)).toThrow();
    const missingTransition = structuredClone(data);
    missingTransition.transitions.pop();
    expect(() => validatePolestarSnapshot(missingTransition)).toThrow(/transition/);
    const missingRetailer = structuredClone(data);
    missingRetailer.inventories.pop();
    expect(() => validatePolestarSnapshot(missingRetailer)).toThrow(/inventory coverage/);
    const missingStock = structuredClone(data);
    missingStock.inventories[0]!.records.pop();
    expect(() => validatePolestarSnapshot(missingStock)).toThrow(/count mismatch/);
  });
  it('uses undiscounted configuration MSRP and reconciles the separate delivery amount', () => {
    expect(polestarFactoryMsrp(factory('polestar-2', 'Long range Dual motor'))).toBe(69900);
    expect(polestarFactoryMsrp(factory('polestar-3', 'Dual motor'))).toBe(105000);
    expect(polestarFactoryMsrp(factory('polestar-3', 'Performance'))).toBe(120000);
    expect(polestarFactoryMsrp(factory('polestar-4-coupe', 'Rear motor', 64900))).toBe(64900);
    expect(polestarFactoryMsrp(factory('polestar-4-coupe', 'Dual motor', 85700))).toBe(85700);
    const invalid = structuredClone(factory('polestar-2', 'Long range Dual motor'));
    invalid.configuration.cpsPriceBreakdown.delivery.deliveryChargeBasicPrice.value += 500;
    expect(polestarFactoryMsrp(invalid)).toBeNull();
    const stock = snapshot.inventories[0]!.records[0]!;
    expect(polestarStockMsrp(stock)).toBe(69900);
    const invalidStock = structuredClone(stock);
    invalidStock.vehicle.cashPriceData!.listPrice!.totals.car.carTotalPrice.value -= 1000;
    expect(polestarStockMsrp(invalidStock)).toBeNull();
  });
  it('keeps roof and Performance dependencies in the returned motor and complete package price', () => {
    const roof = factory('polestar-4-coupe', 'Dual motor', 78600);
    const selected = polestarSelected(roof.configuration);
    expect(selected.some((item) => item.code === '221003')).toBe(true);
    expect(selected.some((item) => item.code === 'PA')).toBe(true);
    expect(selected.some((item) => item.code === 'XPLUSS')).toBe(true);
    const performance = factory('polestar-4-coupe', 'Dual motor', 82500);
    expect(polestarSelected(performance.configuration).map((item) => item.code)).toEqual(
      expect.arrayContaining(['PA', 'XPLUSS', '220001', 'XPFWHE']),
    );
    expect(polestarConfigurationKey(roof.configuration)).not.toBe(
      polestarConfigurationKey(performance.configuration),
    );
  });
  it('preserves explicit EPA units, ambiguous consumption ranges and mirror width', () => {
    const facts = polestarFactoryFacts(factory('polestar-2', 'Long range Dual motor'));
    expect(facts.electricRangeKm.value).toBe(447);
    expect(facts.electricCombinedKwh100km.value).toBeNull();
    expect(facts.horsepower.value).toBe(421);
    expect(facts.widthMm.value).toBe(1985);
    expect(facts.widthMm.note).toContain('includes mirrors');
    expect(facts.rechargeHours.value).toBe(8);
    expect(facts.seats.value).toBeNull();
    expect(facts.cargoSeatsUpL.value).toBeNull();
    expect(polestarFactoryFacts(factory('polestar-3', 'Performance')).horsepower.value).toBe(680);
    expect(polestarUnit('Up to 499 km (EPA)', 'km', true)).toBe(499);
    expect(polestarUnit('499 km (WLTP)', 'km', true)).toBeNull();
    expect(polestarUnit('310 miles', 'km', true)).toBeNull();
    expect(polestarUnit('21.1–21.7 kWh/100 km', 'kWh/100 km')).toBeNull();
  });
  it('retains older new-stock configurations without copying current-year technical fields', () => {
    const old = snapshot.inventories
      .flatMap((group) => group.records)
      .find((row) => row.vehicle.modelYear === '2026')!;
    const facts = polestarStockFacts(old);
    expect(facts.horsepower.value).toBe(272);
    expect(facts.electricRangeKm.value).toBe(499);
    expect(facts.lengthMm.value).toBeNull();
    expect(facts.rechargeHours.value).toBeNull();
    expect(facts.electricCombinedKwh100km.value).toBeNull();
    const id = polestarRecordId(polestarStockIdentity(old.vehicle));
    expect(catalog.cars.find((car) => car.id === id)).toMatchObject({
      year: 2026,
      availability: { status: 'manufacturer-listed' },
    });
  });
  it('deduplicates repeated equipped identities while preserving different paint and package identities', () => {
    const records = catalog.cars.filter(
      (car) => car.make === 'Polestar' && car.recordKind === 'retail-trim',
    );
    expect(records).toHaveLength(120);
    expect(new Set(records.map((car) => car.id)).size).toBe(records.length);
    expect(records.every((car) => car.facts.msrpCad.value !== null)).toBe(true);
    expect(
      new Set(
        snapshot.inventories.flatMap((group) =>
          group.records.map((row) => polestarStockIdentity(row.vehicle)),
        ),
      ).size,
    ).toBe(112);
  });
  it('rejects a wrong market/year and HTTP-success GraphQL errors', () => {
    const initial = snapshot.models[0]!.initial;
    const wrongMarket = {
      ...initial,
      staticData: {
        ...initial.staticData,
        market: { ...initial.staticData.market, country: 'US' },
      },
    };
    expect(() => polestarInit(wrongMarket, snapshot.models[0]!.slug)).toThrow();
    const wrongYear = structuredClone(data);
    wrongYear.factoryRecords[0]!.configuration.model.modelYear = '2026';
    expect(() => validatePolestarSnapshot(wrongYear)).toThrow(/initial configuration|identity/);
    expect(() =>
      polestarInventory(
        { errors: [{ message: 'source failure' }], data: null },
        { modelCode: '534', pageNo: 1 },
      ),
    ).toThrow(/GraphQL/);
    expect(
      polestarLineup(
        '<a href="/en-ca/configure/polestar-2/">Configure</a><script>throw Error()</script>',
      ),
    ).toEqual(['polestar-2']);
    expect(() => polestarLineup('<html>Loading</html>')).toThrow(/links/);
  });
});
