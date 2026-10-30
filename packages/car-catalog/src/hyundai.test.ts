import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/hyundai.json';
import { catalog, hyundaiSnapshot } from './index';
import {
  hyundaiExactPrice,
  hyundaiModels,
  hyundaiTrims,
  validateHyundaiSnapshot,
} from './hyundai-import';
import type { HyundaiModel } from './hyundai-import';
import { hyundaiDrive, hyundaiFacts, hyundaiFuel, hyundaiTransmission } from './hyundai';

const record = (model: string, trim: string) =>
  hyundaiSnapshot.records.find((record) => record.modelSlug === model && record.trimName === trim)!;
const model: HyundaiModel = {
  modelId: 'db60f289-950f-4326-98d7-6cc173446e18',
  vehicleName: 'TUCSON',
  vehicleYear: '2026',
  modelNameCMS: '2026-tucson',
};
const parent = {
  trimId: 'caf5bc0d-1b70-4562-997a-c6c4bc99dbf1',
  trimName: 'Preferred',
  modelId: model.modelId,
  modelNameCMS: model.modelNameCMS,
  vehicleYear: 2026,
  soldOut: false,
  basePrice: { baseTrimId: 'caf5bc0d-1b70-4562-997a-c6c4bc99dbf1', value: 35499 },
  baseTrimConfiguration: [],
  optionTypes: [{ options: [{ key: 2461, productName: 'Trend Package', price: 3700 }] }],
  subTrims: [
    {
      trimID: 'caf5bc0d-1b70-4562-997a-c6c4bc99dbf1',
      trimName: 'Preferred AWD',
      trimNameCMS: 'preferred-awd',
      trimConfiguration: [],
    },
    {
      trimID: 'f8066429-5e3f-4326-85f4-c731cd986e28',
      trimName: 'Preferred AWD with Trend Package',
      trimNameCMS: 'preferred-awd-with-trend-package',
      trimConfiguration: [{ key: '2461', value: 'Trend Package' }],
    },
  ],
};

describe('Hyundai Canadian factory import', () => {
  it('reconciles all captured current years, parent trims and factory subtrims without counting cards as trims', () => {
    expect(hyundaiSnapshot.models).toHaveLength(18);
    expect(hyundaiSnapshot.trims).toHaveLength(55);
    expect(hyundaiSnapshot.records).toHaveLength(80);
    expect(
      catalog.cars.filter((car) => car.make === 'Hyundai' && car.recordKind === 'retail-trim'),
    ).toHaveLength(80);
    const cards = { data: { models: [[model, { ...model, vehicleName: 'TUCSON Hybrid' }]] } };
    expect(hyundaiModels(cards)).toHaveLength(1);
    cards.data.models[0]![1]!.vehicleYear = '2027';
    expect(() => hyundaiModels(cards)).toThrow(/identity mismatch/);
  });
  it('rejects omitted and duplicated factory identities, incorrect years and altered source links', () => {
    const mutations = [
      (value: typeof data) => value.models.pop(),
      (value: typeof data) => value.trims.pop(),
      (value: typeof data) => value.records.pop(),
      (value: typeof data) => value.records.push(value.records[0]!),
      (value: typeof data) => {
        value.records[0]!.year++;
      },
      (value: typeof data) => {
        value.records[0]!.featuresSource.url = value.records[1]!.featuresSource.url;
      },
      (value: typeof data) => {
        value.records[0]!.featuresTrimName = 'Different trim';
      },
      (value: typeof data) => {
        value.lineup.url = 'https://example.com/unreviewed';
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(data);
      mutate(value);
      expect(() => validateHyundaiSnapshot(value)).toThrow();
    }
  });
  it('requires valid model/trim and selection joins before accepting package subtrims', () => {
    expect(
      hyundaiTrims({ data: { trims: [parent], linkedModel: [] } }, model)[0]!.subTrims,
    ).toHaveLength(2);
    expect(() =>
      hyundaiTrims(
        { data: { trims: [{ ...parent, modelId: parent.trimId }], linkedModel: [] } },
        model,
      ),
    ).toThrow(/identity mismatch/);
    const unknownOption = structuredClone(parent);
    unknownOption.subTrims[1]!.trimConfiguration[0]!.key = '9999';
    expect(() =>
      hyundaiTrims({ data: { trims: [unknownOption], linkedModel: [] } }, model),
    ).toThrow(/option ledger/);
    expect(() => hyundaiTrims({ data: { trims: [parent], linkedModel: [{}] } }, model)).toThrow(
      /linked models/,
    );
  });
  it('uses exact-trim MSRP once, excluding destination, and retains the Kona option-price conflict', () => {
    const trend = record('2026-tucson', 'Preferred AWD with Trend Package');
    expect(hyundaiFacts(trend).msrpCad.value).toBe(39199);
    const kona = record('2026-kona', 'N Line AWD with Ultimate Package');
    expect(kona.optionEstimateCad).toBe(39699);
    expect(hyundaiFacts(kona).msrpCad.value).toBe(39399);
    expect(hyundaiFacts(kona).msrpCad.note).toContain('source conflict');
    const price = {
      trimId: trend.trimId,
      trimName: trend.trimName,
      provinceCode: 'AB',
      msrp: 39199,
      delivery: 2200,
      includeDestination: false,
    };
    expect(() => hyundaiExactPrice({ ...price, trimId: kona.trimId }, trend.trimId)).toThrow(
      /identity/,
    );
    expect(() => hyundaiExactPrice({ ...price, includeDestination: true }, trend.trimId)).toThrow(
      /destination/,
    );
  });
  it('keeps AWD, FWD, hybrid, plug-in and battery-electric configurations distinct', () => {
    expect(hyundaiDrive(record('2026-kona', 'Essential FWD'))).toBe('FWD');
    expect(hyundaiDrive(record('2026-kona', 'Essential AWD'))).toBe('AWD');
    expect(hyundaiFuel(record('2026-tucson', 'Preferred AWD'))).toBe('Gasoline');
    expect(hyundaiFuel(record('2026-tucson', 'Ultimate Hybrid AWD'))).toBe('Hybrid');
    expect(hyundaiFuel(record('2026-tucson', 'Ultimate Plug-in Hybrid AWD'))).toBe(
      'Plug-in hybrid',
    );
    expect(hyundaiFuel(record('2027-kona-electric', 'Preferred'))).toBe('Electric');
    expect(
      hyundaiFacts(record('2027-kona-electric', 'Preferred')).fuelCombinedL100km.value,
    ).toBeNull();
  });
  it('retains manual/DCT identities and exact seven/eight-passenger variants', () => {
    expect(hyundaiTransmission(record('2026-elantra-n', 'Manual'))).toMatch(/manual transmission/i);
    expect(hyundaiTransmission(record('2026-elantra-n', 'DCT'))).toMatch(/dual.clutch/i);
    expect(hyundaiFacts(record('2027-palisade', 'Luxury HEV 8-Passenger')).seats.value).toBe(8);
    expect(hyundaiFacts(record('2027-palisade', 'Luxury HEV 7-Passenger')).seats.value).toBe(7);
    const conflict = structuredClone(record('2027-palisade', 'Luxury HEV 8-Passenger'));
    conflict.features.push({ section: 'Interior Features', name: '7 passenger capacity' });
    expect(hyundaiFacts(conflict).seats.value).toBeNull();
    expect(hyundaiFacts(conflict).seats.note).toContain('Conflicting seating evidence');
  });
  it('records specification-table status and avoids applying shared or optional model specifications to exact trims', () => {
    // On 30 October every model table responded; earlier refreshes saw HTTP 503.
    expect(
      hyundaiSnapshot.models.filter((model) => model.specificationsReview.status !== 200),
    ).toHaveLength(0);
    const phev = record('2026-tucson', 'Ultimate Plug-in Hybrid AWD'),
      facts = hyundaiFacts(phev);
    expect(facts.fuelCombinedL100km.value).toBeNull();
    expect(facts.horsepower.value).toBeNull();
    expect(facts.rearLegroomMm.value).toBeNull();
    expect(facts.cargoSeatsUpL.value).toBeNull();
    expect(facts.rearLegroomMm.note).toContain('shared columns');
  });
});
