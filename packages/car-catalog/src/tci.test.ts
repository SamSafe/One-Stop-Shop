import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/tci.json';
import { catalog, tciSnapshot } from './index';
import { tciModelReferences, validateTciSnapshot } from './tci-import';
import { tciFacts, tciNumber, tciRecordId } from './tci';

const record = tciSnapshot.records.find(
  (row) =>
    row.brand === 'toyota' &&
    row.seriesCode === 'COR' &&
    row.year === 2026 &&
    row.modelCode === 'BPRBLC' &&
    row.packageCode === 'A',
)!;
const series = tciSnapshot.series.find(
  (series) => series.brand === record.brand && series.code === record.seriesCode,
)!;
const facts = () => tciFacts(record, series, tciSnapshot.retrievedAt);

describe('Toyota/Lexus Canadian factory import', () => {
  it('reconciles every advertised series, current factory reference and visible package', () => {
    const snapshot = validateTciSnapshot(data);
    expect(snapshot.records.length).toBe(
      snapshot.models.reduce((sum, model) => sum + model.expectedPackagePaths.length, 0),
    );
    expect(
      catalog.cars.filter(
        (car) => car.manufacturerConfiguration && ['Toyota', 'Lexus'].includes(car.make),
      ),
    ).toHaveLength(snapshot.records.length);
    expect(snapshot.series.filter((series) => series.brand === 'toyota')).toHaveLength(
      snapshot.brands.find((brand) => brand.brand === 'toyota')!.expectedSeries.length,
    );
  });
  it('does not silently lose current model references, packages or source gaps', () => {
    const missingModel = structuredClone(data);
    missingModel.models.pop();
    expect(() => validateTciSnapshot(missingModel)).toThrow('Incomplete TCI model');
    const missingPackage = structuredClone(data);
    missingPackage.records.pop();
    expect(() => validateTciSnapshot(missingPackage)).toThrow('Incomplete TCI package');
    const hiddenGaps = structuredClone(tciSnapshot);
    const unavailable = hiddenGaps.models[0]!;
    unavailable.unavailable = true;
    unavailable.definition = null;
    unavailable.expectedPackagePaths = [];
    hiddenGaps.records = hiddenGaps.records.filter(
      (record) => record.modelSource.url !== unavailable.source.url,
    );
    hiddenGaps.gaps = [];
    expect(() => validateTciSnapshot(hiddenGaps)).toThrow('Unreported TCI factory model gap');
  });
  it('excludes archived active records and inactive records outside the configured offering', () => {
    const reference = (year: string, status: string) => ({
      _path: `/content/dam/tcidigital/vehicle-fragments/TOYOTA/COR/${year}-${status}-models`,
      modelStatus: status,
      modelCode: 'BPRBLC',
      modelYear: year,
    });
    const input = {
      data: {
        seriesV2ByPath: {
          item: {
            seriesCode: 'COR',
            modelsFragmentPath: [
              reference('2025', 'active'),
              reference('2026', 'active'),
              reference('2026', 'inactive'),
              reference('2027', 'active'),
            ],
          },
        },
      },
    };
    const found = tciModelReferences(input, 'toyota', { code: 'COR', years: [2026, 2027] });
    expect(found.selected.map((model) => model.modelYear)).toEqual(['2026', '2027']);
    expect(found.historical).toBe(1);
    expect(found.inactive).toBe(1);
  });
  it('rejects duplicate packages, wrong source identities and mismatched model years', () => {
    const duplicate = structuredClone(data);
    duplicate.records.push(duplicate.records[0]!);
    expect(() => validateTciSnapshot(duplicate)).toThrow('Duplicate TCI packages');
    const wrongYear = structuredClone(data);
    wrongYear.records[0]!.year = wrongYear.records[0]!.year === 2026 ? 2027 : 2026;
    expect(() => validateTciSnapshot(wrongYear)).toThrow();
  });
  it('resolves shared Lexus package references to their original factory model', () => {
    const alias = tciSnapshot.records.find(
      (record) => record.brand === 'lexus' && record.originalModelCode === 'LMXSTT',
    )!;
    const car = catalog.cars.find((car) => car.id === tciRecordId(alias))!;
    expect(car.trim).toBe('350 F SPORT');
    expect(car.manufacturerConfiguration?.code).toBe(`LMXSTT-${alias.packageCode}`);
    expect(tciSnapshot.gaps).toEqual([]);
  });
  it('preserves an explicit marketed AWD designation when the technical code says 4WD', () => {
    const input = tciSnapshot.records.find(
      (row) =>
        row.seriesCode === 'RAP' &&
        /\bAWD\b/.test(row.modelDescription) &&
        row.dimensions.drivetrain === '4WD',
    )!;
    expect(catalog.cars.find((car) => car.id === tciRecordId(input))!.drivetrain).toBe('AWD');
  });
  it('uses total configuration MSRP once, including the selected factory package', () => {
    expect(facts().msrpCad.value).toBe(26200);
    const upgrade = tciSnapshot.records.find(
      (row) =>
        row.brand === 'toyota' &&
        row.year === 2026 &&
        row.modelCode === 'BPRBLC' &&
        row.packageCode === 'B',
    )!;
    expect(upgrade.basePrice).toBe(26200);
    expect(upgrade.packagePrice).toBe(2119);
    expect(tciFacts(upgrade, series, tciSnapshot.retrievedAt).msrpCad.value).toBe(28319);
    const hidden = structuredClone(record);
    hidden.priceHidden = true;
    expect(tciFacts(hidden, series, tciSnapshot.retrievedAt).msrpCad.value).toBeNull();
  });
  it('keeps manufacturer placeholders unknown and applies specification visibility rules', () => {
    for (const value of ['0000', '0', 'TBD', null]) expect(tciNumber(value)).toBeNull();
    const hidden = { ...series, rules: [{ year: '2026', displayLegroomSecondRow: false }] };
    expect(facts().rearLegroomMm.value).toBe(883);
    expect(tciFacts(record, hidden, tciSnapshot.retrievedAt).rearLegroomMm.value).toBeNull();
    const threeRow = structuredClone(record);
    threeRow.dimensions.seatingCapacity = '7';
    threeRow.dimensions.cargoCapacityBehindThirdRowL = '0000';
    threeRow.dimensions.cargoCapacityBehindSecondRowL = '838';
    expect(tciFacts(threeRow, series, tciSnapshot.retrievedAt).cargoSeatsUpL.value).toBeNull();
  });
  it('never publishes electric/hydrogen equivalent values as gasoline consumption', () => {
    for (const code of ['BZ4', 'MIR']) {
      const input = tciSnapshot.records.find(
        (row) => row.brand === 'toyota' && row.seriesCode === code,
      )!;
      expect(tciNumber(input.dimensions.fuelConsumptionRatingCombL100Km)).not.toBeNull();
      const car = catalog.cars.find((car) => car.id === tciRecordId(input))!;
      expect(car.facts.fuelCombinedL100km.value).toBeNull();
    }
    const ev = tciSnapshot.records.find(
      (row) =>
        row.seriesCode === 'BZ4' &&
        row.year === 2026 &&
        row.dimensions.energyConsumptionRatingCombinedKWhPer100km === '18.6',
    )!;
    const car = catalog.cars.find((car) => car.id === tciRecordId(ev))!;
    expect(car.facts.electricCombinedKwh100km.value).toBe(18.6);
    expect(car.facts.rechargeHours.value).toBe(8);
  });
});
