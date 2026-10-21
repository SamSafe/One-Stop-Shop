import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/mazda.json';
import { catalog, mazdaSnapshot } from './index';
import { mazdaPackageChoices, mazdaSpecifications, validateMazdaSnapshot } from './mazda-import';
import type { MazdaYear, MazdaEngine } from './mazda-import';
import { mazdaFacts, mazdaMeasurementConflicts, mazdaNumbers, mazdaRecordId } from './mazda';

const gx = mazdaSnapshot.records.find((record) => record.modelCode === 'NXXL86')!;
const getYear = (record = gx) =>
  mazdaSnapshot.modelYears.find((year) => year.id === record.modelYearId)!;
const identity = (id: string, title: string, url_slug: string) => ({ id, title, url_slug });
const year: MazdaYear = {
  id: 'year',
  title: '2026 Example',
  description: 'SUV',
  year: identity('2026', '2026', '2026'),
  carline: identity('example', 'Example', 'EXAMPLE'),
  show_bnp: true,
  is_legacy: false,
  previous_model: false,
  is_coming_soon: false,
  is_ev: false,
};
const engine: MazdaEngine = {
  model_code: 'MODEL6',
  option_code: 'AA00',
  is_package: false,
  engine: { label: '2.5 L', short_description: '2.5 L' },
  transmission: { label: 'Automatic', short_description: 'Automatic' },
  drivetrain: { label: 'AWD', short_description: 'AWD' },
  financial: { msrp: 40000, based_on: { model_code: 'MODEL6', option_code: 'AA00' } },
};

describe('Mazda Canadian factory import', () => {
  it('reconciles all active build-tool years, trims, engine variants and factory packages', () => {
    const snapshot = validateMazdaSnapshot(data);
    expect(snapshot.modelYears).toHaveLength(snapshot.expectedModelYearIds.length);
    expect(snapshot.records).toHaveLength(
      snapshot.engines.reduce((sum, engine) => sum + engine.expectedOptionKeys.length, 0),
    );
    expect(snapshot.records).toHaveLength(68);
    expect(
      catalog.cars.filter((car) => car.make === 'Mazda' && car.recordKind === 'retail-trim'),
    ).toHaveLength(snapshot.records.length);
    expect(snapshot.records.every((record) => record.specifications.length > 0)).toBe(true);
  });
  it('rejects lost years, trims, engine/package references, duplicate SKUs and source mismatches', () => {
    const missingModel = structuredClone(data);
    missingModel.modelYears.pop();
    expect(() => validateMazdaSnapshot(missingModel)).toThrow('model years');
    const missingTrim = structuredClone(data);
    missingTrim.trims.pop();
    expect(() => validateMazdaSnapshot(missingTrim)).toThrow('trims');
    const missingRecord = structuredClone(data);
    missingRecord.records.pop();
    expect(() => validateMazdaSnapshot(missingRecord)).toThrow('factory packages');
    const duplicate = structuredClone(data);
    duplicate.records.push(duplicate.records[0]!);
    expect(() => validateMazdaSnapshot(duplicate)).toThrow('factory packages');
    const wrong = structuredClone(data);
    wrong.records[0]!.specificationsTrimId = 'another-trim';
    expect(() => validateMazdaSnapshot(wrong)).toThrow('identity/source');
  });
  it('uses package MSRP as a complete configuration price and excludes non-SKU add-ons', () => {
    const response = {
      status: 200,
      data: {
        model_year: year,
        trim: { trim_type: { url_slug: 'GX' } },
        default_option: { model_id: 'engine-id', option_code: 'AA00', financial: engine.financial },
        packages: [
          {
            name: 'Factory package',
            type: 'model_option_package',
            option_code: 'PA00',
            financial: { msrp: 42000, based_on: { model_code: 'MODEL6', option_code: 'PA00' } },
          },
          {
            name: 'Appearance protection',
            type: 'non_model_option_package',
            financial: { msrp: 800 },
          },
        ],
      },
    };
    const found = mazdaPackageChoices(response, year, 'GX', engine);
    expect(found.choices.map((option) => option.msrpCad)).toEqual([40000, 42000]);
    expect(found.excluded).toHaveLength(1);
    const premium = mazdaSnapshot.records.find(
      (record) => record.modelCode === 'NXTL86' && record.optionCode === 'PR00',
    )!;
    expect(mazdaFacts(premium, getYear(premium)).msrpCad.value).toBe(46700);
    expect(premium.packageName).toContain('PREMIUM');
  });
  it('preserves an explicit GS Kuro parent alias while matching exact model/option and specification trim IDs', () => {
    const kuro = mazdaSnapshot.records.find((record) => record.trimSlug === 'GS-KURO')!;
    expect(kuro.sourceTrimSlug).toBe('GS');
    expect(kuro.modelCode).toBe('ZXSL86');
    expect(kuro.optionCode).toBe('KE00');
    expect(kuro.specificationsTrimId).toBe(kuro.trimId);
    expect(mazdaFacts(kuro, getYear(kuro)).msrpCad.value).toBe(34400);
  });
  it('normalizes documented header/data/feature row casing instead of silently losing numeric specifications', () => {
    const response = {
      status: 200,
      data: [
        {
          model_code: 'MODEL6',
          option_code: 'AA00',
          model_year: { id: year.id, title: year.title },
          year: year.year,
          carline: year.carline,
          trim: { id: 'trim', title: 'GX', trim_type: { id: 'gx', name: 'GX', url_slug: 'GX' } },
          specifications: {
            'SPECIFICATIONS AND CAPACITIES': [
              { type: 'Header', Title: 'CAPACITIES', Data: '-' },
              { type: 'Data', Title: 'Seating', Data: '5' },
              { type: 'FEATURE', Title: 'Overall length (mm)', Data: '4500' },
            ],
          },
        },
      ],
    };
    const expected = {
      year,
      trimId: 'trim',
      trimSlug: 'GX',
      sourceTrimSlug: 'GX',
      modelCode: 'MODEL6',
      optionCode: 'AA00',
    };
    expect(mazdaSpecifications(response, expected).rows).toHaveLength(2);
    expect(() => mazdaSpecifications(response, { ...expected, optionCode: 'WRONG' })).toThrow(
      'configuration mismatch',
    );
    response.data[0]!.specifications['SPECIFICATIONS AND CAPACITIES'][1]!.type = 'unrecognized';
    expect(() => mazdaSpecifications(response, expected)).toThrow(
      'Unsupported Mazda specification row type',
    );
  });
  it('preserves the original CX-5 ID, exact NRCan join and reviewed measurement conventions', () => {
    const car = catalog.cars.find((car) => car.id === mazdaRecordId(gx))!;
    expect(car.id).toBe('mazda-cx-5-2026-gx-awd');
    expect(car.governmentRating?.recordId).toBe(30731);
    expect(car.facts.msrpCad.value).toBe(36300);
    expect(car.facts.fuelCombinedL100km.value).toBe(9);
    expect(car.facts.widthMm.value).toBe(1892);
    expect(car.facts.widthMm.note).toContain('mirrors folded');
    expect(car.facts.frontHeadroomMm.value).toBe(1007);
    expect(car.facts.rearHeadroomMm.value).toBe(1020);
    expect(car.facts.cargoSeatsUpL.value).toBe(954);
    expect(car.facts.cargoSeatsDownL.value).toBe(1882);
  });
  it('keeps coming-soon flags and excluded older years visible as availability gaps', () => {
    expect(
      mazdaSnapshot.modelYears
        .filter((year) => year.comingSoon)
        .map((year) => year.carline)
        .sort(),
    ).toEqual(['CX-50', 'CX-50-HEV']);
    const announced = catalog.cars.filter(
      (car) => car.make === 'Mazda' && car.availability.status === 'announced',
    );
    expect(announced).toHaveLength(8);
    expect(
      announced.every((car) => car.availability.note.includes('requires reconciliation')),
    ).toBe(true);
    expect(mazdaSnapshot.excludedModelYears).toHaveLength(8);
    expect(
      mazdaSnapshot.excludedModelYears.every((year) =>
        year.reason.includes('not proof of discontinuation'),
      ),
    ).toBe(true);
  });
  it('does not publish or automatically swap contradictory CX-50 cargo measurements', () => {
    const conflicts = mazdaSnapshot.records.filter(
      (record) => mazdaMeasurementConflicts(record).length,
    );
    expect(conflicts).toHaveLength(5);
    for (const record of conflicts) {
      const facts = mazdaFacts(record, getYear(record));
      expect(facts.cargoSeatsUpL.value).toBeNull();
      expect(facts.cargoSeatsDownL.value).toBeNull();
      expect(facts.cargoSeatsUpL.note).toContain('not automatically swapped');
    }
  });
  it('distinguishes published folded-seat cargo and two-seat roadster cargo', () => {
    const mazda3 = mazdaSnapshot.records.find((record) => record.carline === 'MAZDA3')!;
    const sedan = mazdaFacts(mazda3, getYear(mazda3));
    expect(sedan.cargoSeatsUpL.value).toBe(374);
    expect(sedan.cargoSeatsDownL.value).toBe(940);
    const roadster = mazdaSnapshot.records.find((record) => record.carline === 'MX-5-SoftTop')!;
    const facts = mazdaFacts(roadster, getYear(roadster));
    expect(facts.seats.value).toBe(2);
    expect(facts.cargoSeatsUpL.value).toBe(130);
    expect(facts.cargoSeatsDownL.value).toBeNull();
    expect(
      mazdaSnapshot.records
        .filter((record) => record.carline === 'MX-5-SoftTop')
        .some((record) => /manual/i.test(record.transmissionShort)),
    ).toBe(true);
    expect(
      mazdaSnapshot.records
        .filter((record) => record.carline === 'MX-5-SoftTop')
        .some((record) => /automatic/i.test(record.transmissionShort)),
    ).toBe(true);
  });
  it('keeps ambiguous power/fuel/roof alternatives and PHEV modes unknown', () => {
    const multiple = structuredClone(gx);
    multiple.specifications.push({
      ...multiple.specifications.find((row) => /FUEL ECONOMY/.test(row.section))!,
      title: 'Another applicable rating',
      value: '10/8/9',
    });
    expect(mazdaFacts(multiple, getYear(multiple)).fuelCombinedL100km.value).toBeNull();
    const phev = mazdaSnapshot.records.find((record) => record.carline === 'CX-70-PHEV')!;
    const facts = mazdaFacts(phev, getYear(phev));
    expect(facts.fuelCombinedL100km.value).toBeNull();
    expect(facts.horsepower.value).toBeNull();
    expect(mazdaNumbers('0', 1)).toBeNull();
    expect(mazdaNumbers('1,007/1,020', 2)).toEqual([1007, 1020]);
  });
});
