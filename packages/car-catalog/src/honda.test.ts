import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/honda.json';
import { catalog, hondaSnapshot } from './index';
import { hondaModels, hondaPriceEntries, validateHondaSnapshot } from './honda-import';
import { hondaDrivetrain, hondaFacts, hondaNumbers, hondaRecordId } from './honda';
import { embeddedJson } from './subaru-import';

const get = (model: string, trim?: string) =>
  hondaSnapshot.records.find(
    (record) => record.modelName === model && (!trim || record.trimName === trim),
  )!;

describe('Honda and Acura Canadian manufacturer import', () => {
  it('reconciles every listed model, overlapping year, trim and transmission', () => {
    const snapshot = validateHondaSnapshot(data);
    expect(snapshot.records).toHaveLength(
      snapshot.models.flatMap((model) =>
        model.years.flatMap((year) => year.expectedConfigurationKeys),
      ).length,
    );
    expect(
      catalog.cars.filter(
        (car) => ['Honda', 'Acura'].includes(car.make) && car.manufacturerConfiguration,
      ),
    ).toHaveLength(snapshot.records.length);
    expect(
      snapshot.models.find((model) => model.key === 'cr-v')!.years.map((year) => year.year),
    ).toEqual([2026, 2027]);
    expect(snapshot.records.every((record) => record.msrpCad !== null)).toBe(true);
  });
  it('rejects missing models, trims, transmissions and wrong specification identities', () => {
    const missingModel = structuredClone(data);
    missingModel.models.pop();
    expect(() => validateHondaSnapshot(missingModel)).toThrow('models');
    const missingRecord = structuredClone(data);
    missingRecord.records.pop();
    expect(() => validateHondaSnapshot(missingRecord)).toThrow('trims');
    const duplicate = structuredClone(data);
    duplicate.records.push(duplicate.records[0]!);
    expect(() => validateHondaSnapshot(duplicate)).toThrow('transmissions');
    const wrongTrim = structuredClone(data);
    wrongTrim.records[0]!.specifications[0]!.TrimId = 1;
    expect(() => validateHondaSnapshot(wrongTrim)).toThrow('specification trim mismatch');
  });
  it('reads embedded state without executing scripts and retains nonbuildable and yearless cards', () => {
    const field = (value: string) => ({ value });
    const card = {
      componentName: 'ModelCardWithTrims',
      fields: {
        data: {
          value: {
            model: {
              fields: { detKey: field('example'), modelName: field('Example'), modelYears: [] },
            },
          },
        },
      },
    };
    const html = `<script id="__JSS_STATE__" type="application/json">${JSON.stringify({ cards: [card] })}</script><script>throw new Error('must not execute');</script>`;
    expect(hondaModels(html, 'honda')[0]!.years).toEqual([]);
    expect(() => embeddedJson(html, '.*', 'script')).toThrow('Invalid JSON node ID');
    const typeR = get('Type R');
    expect(typeR.buildable).toBe(false);
    const car = catalog.cars.find((car) => car.id === hondaRecordId(typeR))!;
    expect(car.availability.status).toBe('manufacturer-listed');
    expect(car.availability.note).toContain('LOW INVENTORY');
    expect(
      hondaSnapshot.models.filter((model) => !model.years.length).map((model) => model.name),
    ).toEqual(['TLX', 'ZDX']);
  });
  it('reconciles calculator transmission aliases by ID and rejects another model year', () => {
    const expected = [{ trimId: '10910', trimKey: 'sport_hybrid_10910', transmissionId: '10958' }];
    const response = {
      ProvinceKey: 'ON',
      Models: [
        {
          ModelKey: 'civic_sedan',
          ModelId: 10293,
          Trims: [
            {
              Id: 10910,
              Key: 'sport_hybrid_10910',
              Transmissions: [{ Id: 10958, Key: '10958-Default', Msrp: 34200 }],
            },
          ],
        },
      ],
    };
    expect(hondaPriceEntries(response, 'civic_sedan', expected)[0]!.Transmissions[0]!.Msrp).toBe(
      34200,
    );
    expect(() =>
      hondaPriceEntries(response, 'civic_sedan', [{ ...expected[0]!, trimId: '10962' }]),
    ).toThrow('model/year configuration mismatch');
    expect(() => hondaPriceEntries(response, 'cr-v', expected)).toThrow(
      'model/year identity mismatch',
    );
    response.Models[0]!.Trims[0]!.Transmissions.push(
      response.Models[0]!.Trims[0]!.Transmissions[0]!,
    );
    expect(() => hondaPriceEntries(response, 'civic_sedan', expected)).toThrow('Duplicate');
  });
  it('keeps calculator-only configurations as availability gaps', () => {
    const keys = hondaSnapshot.models.flatMap((model) =>
      model.years.flatMap((year) => year.pricingOnlyConfigurationKeys),
    );
    expect(keys).toEqual(['sport_l_10961/11009-Automatic', 'sport_l_10964/11012-CVT']);
    expect(
      hondaSnapshot.records.some(
        (record) => record.trimId === '10961' || record.trimId === '10964',
      ),
    ).toBe(false);
  });
  it('refreshes MSRP while preserving the original CR-V IDs and specification joins', () => {
    const car = catalog.cars.find((car) => car.id === 'honda-cr-v-2026-lx-fwd')!;
    expect(car.facts.msrpCad.value).toBe(37075);
    expect(car.facts.msrpCad.sourceUrl).toContain('include_fees=false');
    expect(car.manufacturerConfiguration?.code).toBe('RS3H2TES');
    expect(car.governmentRating?.recordId).toBe(30701);
    expect(car.facts.fuelCombinedL100km.value).toBe(7.8);
    const manual = get('Integra', 'Elite A-SPEC MT');
    expect(manual.transmissionName).toBe('Manual');
    expect(hondaRecordId(manual)).not.toBe(hondaRecordId(get('Integra', 'Elite A-SPEC')));
  });
  it('uses exact fuel rows rather than optional AWD marketing for the FWD CR-V', () => {
    const record = get('CR-V', 'LX 2WD');
    expect(hondaDrivetrain(record)).toBe('FWD');
    expect(hondaFacts(record).fuelCombinedL100km.value).toBe(7.8);
    expect(hondaFacts(get('CR-V', 'LX AWD')).fuelCombinedL100km.value).toBe(8.4);
  });
  it('uses all seats up for three-row cargo and leaves unresolved maximums/widths unknown', () => {
    const pilot = hondaFacts(get('Pilot'));
    expect(pilot.cargoSeatsUpL.value).toBe(635);
    expect(pilot.cargoSeatsDownL.value).toBe(3166);
    expect(pilot.widthMm.value).toBeNull();
    expect(hondaFacts(get('MDX')).cargoSeatsUpL.value).toBeNull();
    expect(hondaFacts(get('Ridgeline')).cargoSeatsUpL.value).toBeNull();
  });
  it('parses explicit metric values without choosing arbitrary alternatives', () => {
    expect(hondaNumbers('1,006 / 968 (39.6 in. / 38.1 in.)', 2)).toEqual([1006, 968]);
    expect(hondaNumbers('1680 (FWD)', 1)).toEqual([1680]);
    for (const value of ['TBC', '0', '2254/2090', 'Available 500', '1000–1200'])
      expect(hondaNumbers(value, 1)).toBeNull();
    expect(hondaFacts(get('PROLOGUE')).frontHeadroomMm.value).toBe(1006);
  });
  it('distinguishes combined hybrid power and electric range from liquid consumption', () => {
    expect(hondaFacts(get('CR-V', 'SPORT HYBRID')).horsepower.value).toBe(204);
    const ev = hondaFacts(get('PROLOGUE'));
    expect(ev.fuelCombinedL100km.value).toBeNull();
    expect(ev.electricRangeKm.value).toBe(473);
    expect(ev.horsepower.value).toBe(300);
  });
});
