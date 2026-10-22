import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/nissan.json';
import { catalog, nissanSnapshot } from './index';
import {
  nissanAssignedJson,
  nissanEquipmentPackages,
  nissanKey,
  nissanSelection,
  nissanSpecifications,
  validateNissanSnapshot,
} from './nissan-import';
import {
  nissanDrive,
  nissanFacts,
  nissanMeasurement,
  nissanMsrp,
  nissanRecordId,
  nissanTransmission,
} from './nissan';

const record = (modelCode: string, versionCode?: string) =>
  nissanSnapshot.records.find(
    (record) =>
      record.modelCode === modelCode &&
      (!versionCode || record.versionCode === versionCode) &&
      !record.optionPackage,
  )!;
const facts = (modelCode: string, versionCode?: string) => {
  const row = record(modelCode, versionCode),
    model = nissanSnapshot.models.find(
      (model) => model.brand === row.brand && model.code === row.modelCode,
    )!;
  return nissanFacts(row, model);
};
const flight = (value: unknown) =>
  `<html><script>self.__next_f.push(${JSON.stringify([1, `0:${JSON.stringify(value)}\n`])})</script><script>throw new Error('never execute')</script></html>`;

describe('Nissan/Infiniti Canadian factory import', () => {
  it('reconciles both brands, all listed years, transmission variants and independently offered equipment packages', () => {
    const snapshot = validateNissanSnapshot(data);
    expect(snapshot.models).toHaveLength(25);
    expect(snapshot.records).toHaveLength(101);
    expect(snapshot.records.filter((row) => !row.optionPackage)).toHaveLength(99);
    expect(snapshot.records.filter((row) => row.specification)).toHaveLength(56);
    expect(
      catalog.cars.filter(
        (car) =>
          car.manufacturerConfiguration &&
          /^(Nissan|Infiniti)\//.test(car.manufacturerConfiguration.id),
      ),
    ).toHaveLength(101);
    expect(
      snapshot.records.filter((row) => row.modelName === 'Z' && row.year === 2027),
    ).toHaveLength(6);
    expect(snapshot.records.filter((row) => row.modelName === 'Frontier')).toHaveLength(6);
    const packages = snapshot.records.filter((row) => row.optionPackage);
    expect(packages.map((row) => row.optionPackage!.name)).toEqual([
      'Tech Package',
      'Tech Package',
    ]);
    expect(packages.every((row) => row.optionPackage!.price === '4200.0')).toBe(true);
    expect(snapshot.brands.flatMap((brand) => brand.inventoryOnlyModels)).toHaveLength(35);
    expect(
      snapshot.brands
        .flatMap((brand) => brand.inventoryOnlyModels)
        .some((model) => model.name === 'Kicks Play'),
    ).toBe(true);
  });
  it('rejects lost models, versions, packages and wrong-year specification joins', () => {
    const missingModel = structuredClone(data);
    missingModel.models.pop();
    expect(() => validateNissanSnapshot(missingModel)).toThrow('model years');
    const missingVersion = structuredClone(data);
    missingVersion.records.pop();
    expect(() => validateNissanSnapshot(missingVersion)).toThrow('configurations');
    const missingPackage = structuredClone(nissanSnapshot),
      packaged = missingPackage.records.find((row) => row.optionPackage)!;
    missingPackage.records = missingPackage.records.filter((row) => row !== packaged);
    for (const model of missingPackage.models)
      model.expectedKeys = model.expectedKeys.filter((key) => key !== nissanKey(packaged));
    expect(() => validateNissanSnapshot(missingPackage)).toThrow('equipment packages');
    const wrongYear = structuredClone(nissanSnapshot),
      target = wrongYear.records.find((row) => row.specification)!;
    target.specification!.path = target.specification!.path.replace('/2027-', '/2026-');
    expect(() => validateNissanSnapshot(wrongYear)).toThrow('exact specification identity');
    const wrongPack = structuredClone(nissanSnapshot);
    wrongPack.records.find((row) => row.optionPackage)!.optionPackage!.price = '1.0';
    expect(() => validateNissanSnapshot(wrongPack)).toThrow('package applicability');
  });
  it('keeps factory package suffixes, wheelbase and manual/automatic versions distinct', () => {
    const short = record('42106', '4CVG77-CS00'),
      long = record('42106', '4CPG77-CS00');
    expect(nissanRecordId(short)).not.toBe(nissanRecordId(long));
    expect(nissanMsrp(short).value).toBe(59998);
    expect(nissanMsrp(long).value).toBe(60598);
    expect(nissanTransmission(record('42103', 'Z2NG57'))).toBe('6MT');
    expect(nissanTransmission(record('42103', 'Z2NG77'))).toBe('9AT');
    expect(nissanDrive(long)).toBe('4WD');
    expect(nissanDrive(record('42102', '9CLX77'))).toBe('4WD');
  });
  it('uses fee-excluded Nissan MSRP and leaves conflicting Infiniti price definitions unknown', () => {
    expect(nissanMsrp(record('42088', 'W6BG16')).value).toBe(34848);
    expect(nissanMsrp(record('42108', 'P5CE17')).value).toBe(34998);
    expect(nissanMsrp(record('42102', '9CLX77')).value).toBeNull();
    expect(nissanMsrp(record('42102', '9CLX77')).note).toContain('includes freight/PDI');
    const packaged = nissanSnapshot.records.find((row) => row.optionPackage)!;
    expect(nissanMsrp(packaged).value).toBeNull();
    expect(nissanMsrp(packaged).note).toContain('4200.0');
    const inclusive = structuredClone(record('42088', 'W6BG16'));
    inclusive.retailPrice.disclaimer = 'Price shown includes freight and dealer charges.';
    expect(nissanMsrp(inclusive).value).toBeNull();
  });
  it('requires consistent metric/imperial pairs and rejects ranges or malformed numbers', () => {
    expect(nissanMeasurement('1,033 (36.5)', 'Cargo – L (cu. ft.)')).toBe(1033);
    expect(nissanMeasurement('4,648 (183.0)', 'Overall length – mm (inches)')).toBe(4648);
    expect(nissanMeasurement('241 (6.9)', 'Cargo – L (cu. ft.)')).toBeNull();
    expect(nissanMeasurement('30.8', 'Cargo – L (cu. ft.)')).toBeNull();
    expect(nissanMeasurement('39.1', 'Headroom – mm (inches)')).toBeNull();
    expect(nissanMeasurement('1,945-1,980', 'Height (mm)')).toBeNull();
    expect(nissanMeasurement('5,032 / 5,041', 'Length (mm)')).toBeNull();
    expect(nissanMeasurement('3,556,6 (125.6)', 'Volume – L (cu. ft.)')).toBeNull();
    expect(facts('42102', '9CLX77').heightMm.value).toBeNull();
    expect(facts('42102', '9CLX77').widthMm.value).toBeNull();
    expect(facts('42109').frontHeadroomMm.value).toBeNull();
  });
  it('keeps roof-specific cargo and headroom tied to the exact trim', () => {
    const base = facts('42088', 'W6BG16'),
      moonroof = facts('42088', 'W6CG16');
    expect(base.cargoSeatsUpL.value).toBe(1033);
    expect(moonroof.cargoSeatsUpL.value).toBe(1028);
    expect(base.frontHeadroomMm.value).toBe(1044);
    expect(moonroof.frontHeadroomMm.value).toBe(995);
    expect(facts('42100', 'J6AT77').cargoSeatsUpL.value).toBe(411);
    expect(facts('42100', 'J6AT77').cargoSeatsDownL.value).toBe(2135);
    expect(facts('42100', 'J6AT77').frontLegroomMm.value).toBe(1070);
  });
  it('preserves EV energy equivalence and PHEV operating-mode uncertainty', () => {
    const electric = facts('42108', 'P5CE17'),
      plugIn = facts('42098');
    expect(electric.electricModeLe100km.value).toBe(2);
    expect(electric.electricRangeKm.value).toBe(341);
    expect(electric.fuelCombinedL100km.value).toBeNull();
    expect(electric.electricCombinedKwh100km.value).toBeNull();
    expect(plugIn.horsepower.value).toBe(248);
    expect(plugIn.fuelCombinedL100km.value).toBeNull();
    expect(plugIn.cargoSeatsUpL.value).toBeNull();
    expect(facts('42111', 'S6EG17').fuelCombinedL100km.value).toBeNull();
    expect(facts('42111', 'S6EG17').fuelCombinedL100km.note).toContain('Source conflict');
  });
  it('retains previous/newer years without copying superseded specification pages', () => {
    expect(record('42089').specification).toBeNull();
    expect(record('42089').specificationGap).toContain('42105');
    expect(record('42104').specification).toBeNull();
    expect(record('42104').specificationGap).toContain('42095');
    expect(record('42111').specificationGap).toContain('HTTP 404');
    expect(facts('42089').lengthMm.value).toBeNull();
    expect(facts('42089').msrpCad.value).not.toBeNull();
  });
  it('parses public JSON as data and validates specification grade/version identities', () => {
    const row = record('42088', 'W6BG16');
    const version = {
      ...row,
      id: row.versionCode,
      year: String(row.year),
      priceList: { retail: row.retailPrice },
    };
    const model = {
      id: row.modelCode,
      modelCode: row.modelCode,
      modelName: row.modelName,
      year: String(row.year),
      slug: row.modelSlug,
      isEV: false,
      vehicleTypes: [{ slug: 'crossovers-suvs' }],
      versions: [version],
      otherModelYears: [],
      grades: [
        { gradeCode: row.gradeCode, specification: { fuelConsumption: row.gradeFuelConsumption } },
      ],
    };
    const selector = {
      market: { region: 'ca', brand: 'nissan', lang: 'en', application: 'configurator' },
      brand: 'nissan',
      vehicleData: [model],
      vehicles: [
        {
          id: model.id,
          versions: [
            { versionCode: row.versionCode },
            { versionCode: 'ANOTHER-PUBLISHED-VERSION' },
          ],
        },
      ],
    };
    expect(() => nissanSelection(flight({ selectPageProps: selector }), 'Nissan')).toThrow(
      'factory versions do not reconcile',
    );
    selector.vehicles[0]!.versions.pop();
    expect(
      nissanSelection(flight({ selectPageProps: selector }), 'Nissan')[0]!.versions,
    ).toHaveLength(1);
    const payload = {
      grades: {
        '42100-QX60_AUTOGRAPH': {
          versions: {
            J6AT77: {
              versionKey: 'WRONG',
              path: '/en_CA/cars/2027-qx60/grade/version',
              name: 'AWD',
              engineName: 'Engine',
              driveTrainValue: 'AWD',
              specifications: [],
              packs: { packs: [] },
            },
          },
        },
      },
    };
    const html = `HELIOS.components.c059E = ${JSON.stringify(payload)};<script>throw new Error('must not execute')</script>`;
    expect(nissanAssignedJson(html, 'HELIOS.components.c059E')).toEqual(payload);
    expect(() =>
      nissanSpecifications(html, {
        url: 'https://www.infiniti.ca/vehicles/crossovers-suvs/qx60/specs.html',
        sha256: 'a'.repeat(64),
      }),
    ).toThrow('version key mismatch');
    expect(() =>
      nissanAssignedJson(
        'HELIOS.components.c059E = {"text":"unfinished"',
        'HELIOS.components.c059E',
      ),
    ).toThrow('Truncated');
    expect(() =>
      nissanSelection(
        flight({
          selectPageProps: {
            market: { region: 'us', brand: 'nissan', lang: 'en', application: 'configurator' },
            brand: 'nissan',
            vehicleData: [],
            vehicles: [],
          },
        }),
        'Nissan',
      ),
    ).toThrow();
    expect(nissanEquipmentPackages(record('42100', 'J6SP77').specification!)).toEqual([]);
  });
});
