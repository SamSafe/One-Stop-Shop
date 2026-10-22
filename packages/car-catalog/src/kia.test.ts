import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/kia.json';
import { catalog, kiaSnapshot } from './index';
import { kiaAttribute, kiaModels, kiaRecords, validateKiaSnapshot } from './kia-import';
import type { KiaModel } from './kia-import';
import { kiaDrive, kiaFacts, kiaNumber, kiaReviewGaps } from './kia';

const get = (code: string) => kiaSnapshot.records.find((record) => record.trimCode === code)!;
const html = (value: unknown) =>
  `<div vehicle-list="${JSON.stringify(value).replace(/&/g, '&amp;').replace(/"/g, '&#34;')}"></div>`;
const base = {
  contentFragmentPath: '/content/dam/marketing/en/vehicles/models/example/2026/trims/base',
  trim: 'Base',
  trimCode: 'BASE6',
  fscCodes: ['SOURCE-CODE'],
  hasSibling: true,
  isHev: false,
  isPhev: false,
  isPackageHev: false,
  isPackagePhev: false,
  dimensions: { seating: '5' },
  features: { powertrainFeatures: [{ enName: 'FWD' }] },
  performance: { drivetrain: 'FWD' },
  transmission: {},
  priceDetails: { AB: { msrp: 40000, dnd: 2000 } },
};
const model: KiaModel = {
  contentFragmentPath: '/content/dam/marketing/en/vehicles/models/example/2026/example',
  year: '2026',
  make: 'Kia',
  model: 'Example',
  bodyType: 'SUV',
  engineType: 'EV',
  vmpUrl: '/content/marketing/ca/en/vehicles/example',
  specsPageUrl: '/content/marketing/ca/en/vehicles/example/specs',
  defaultYear: false,
  trims: [
    {
      ...base,
      packages: [
        {
          ...base,
          contentFragmentPath: '/content/dam/marketing/en/vehicles/models/example/2026/trims/awd',
          packageName: 'AWD',
          packageParentTrim: base.contentFragmentPath,
          trimCode: 'AWD6',
          performance: {},
          features: { powertrainFeatures: [] },
          priceDetails: { AB: { msrp: 43500, dnd: 2000 } },
        },
      ],
    },
  ],
};

describe('Kia Canadian factory import', () => {
  it('reconciles every model, parent and package, including non-default years and separately confirmed EV4', () => {
    expect(kiaSnapshot.expectedModelPaths).toHaveLength(24);
    expect(kiaSnapshot.groupedModelPaths).toHaveLength(23);
    expect(kiaSnapshot.models).toHaveLength(23);
    expect(kiaSnapshot.records).toHaveLength(126);
    expect(kiaSnapshot.additionalModelEvidence).toHaveLength(1);
    expect(kiaSnapshot.additionalModelEvidence[0]!.modelPath).toContain('2027-ev4');
    expect(
      kiaSnapshot.records.some((record) => record.year === 2025 && record.modelName === 'EV6'),
    ).toBe(true);
    expect(
      catalog.cars.filter((car) => car.make === 'Kia' && car.recordKind === 'retail-trim'),
    ).toHaveLength(126);
  });
  it('rejects lost configurations, bad parent/year links, missing additional evidence and changed units/domains', () => {
    const changes = [
      (value: typeof data) => value.records.pop(),
      (value: typeof data) => value.models.pop(),
      (value: typeof data) => value.records.push(value.records[0]!),
      (value: typeof data) => {
        value.records[0]!.year++;
      },
      (value: typeof data) => {
        value.records[0]!.parentPath = value.records[1]!.parentPath;
      },
      (value: typeof data) => value.additionalModelEvidence.pop(),
      (value: typeof data) => {
        value.units.power = 'Power - kW';
      },
      (value: typeof data) => {
        value.build.url = 'https://example.com/unreviewed';
      },
      (value: typeof data) => {
        value.excludedModels[0]!.name = 'Passenger model';
      },
    ];
    for (const change of changes) {
      const value = structuredClone(data);
      change(value);
      expect(() => validateKiaSnapshot(value)).toThrow();
    }
  });
  it('reads encoded JSON without executing scripts and requires grouped/flat references to agree', () => {
    expect(
      kiaAttribute(html({ text: 'A & B "quote"', literal: '&quot;' }), 'vehicle-list'),
    ).toEqual({ text: 'A & B "quote"', literal: '&quot;' });
    expect(() => kiaAttribute('<script>throw new Error()</script>', 'vehicle-list')).toThrow(
      /missing/,
    );
    const value = {
      vehicles: {
        vehicleList: [model],
        vehicleFamiliesList: [{ name: 'Example', models: [model] }],
      },
    };
    expect(kiaModels(html(value)).models[0]!.defaultYear).toBe(false);
    const changed = structuredClone(value);
    changed.vehicles.vehicleFamiliesList[0]!.models[0] = { ...model, year: '2027' };
    expect(() => kiaModels(html(changed))).toThrow(/discrepancy/);
  });
  it('uses complete package MSRP and each package’s own specifications without inheriting base drive/power', () => {
    expect(kiaFacts(get('E9157T')).msrpCad.value).toBe(79495);
    expect(kiaFacts(get('E5153V')).msrpCad.value).toBe(49995);
    const awd = get('E3153V');
    expect(awd.performance.drivetrain).toBeUndefined();
    expect(kiaDrive(awd)).toBe('AWD');
    expect(kiaFacts(awd).horsepower.value).toBe(262);
    const choices = kiaRecords(model);
    expect(choices[1]!.msrpCad).toBe(43500);
    expect(choices[1]!.performance.drivetrain).toBeUndefined();
    const badParent = structuredClone(model);
    badParent.trims[0]!.packages[0]!.packageParentTrim = model.contentFragmentPath;
    expect(() => kiaRecords(badParent)).toThrow(/parent mismatch/);
  });
  it('preserves a sibling package’s original source alias while resolving its explicit parent identity', () => {
    const premium = get('E4145V');
    expect(premium.sourceTrimName).toBe('Wind');
    expect(premium.parentTrimName).toBe('Wind Premium');
    expect(premium.trimName).toBe('Wind Premium');
    expect(premium.msrpCad).toBe(48595);
    expect(kiaReviewGaps(kiaSnapshot)).toContainEqual(
      expect.objectContaining({ configuration: '2027/E4145V', field: 'trimName' }),
    );
  });
  it('uses published units and combined hybrid horsepower without converting EV equivalent energy to gasoline', () => {
    const hybrid = kiaSnapshot.records.find(
      (record) => record.modelName === 'Niro' && record.trimName === 'LX',
    )!;
    expect(kiaFacts(hybrid).horsepower.value).toBe(139);
    expect(kiaFacts(hybrid).fuelCombinedL100km.value).toBe(4.4);
    const carnival = kiaSnapshot.records.find(
      (record) => record.modelName === 'Carnival HEV' && record.year === 2027,
    )!;
    expect(kiaDrive(carnival)).toBe('FWD');
    expect(kiaFacts(carnival).horsepower.value).toBe(242);
    const ev = kiaSnapshot.records.find((record) => record.modelName === 'Niro EV')!;
    const facts = kiaFacts(ev);
    expect(facts.electricModeLe100km.value).toBe(2.1);
    expect(facts.electricCombinedKwh100km.value).toBeNull();
    expect(facts.fuelCombinedL100km.value).toBeNull();
    expect(facts.electricRangeKm.value).toBe(407);
    const phev = kiaSnapshot.records.find((record) => record.modelName === 'Sorento PHEV')!;
    expect(kiaFacts(phev).fuelCombinedL100km.value).toBeNull();
    expect(kiaFacts(get('E5151V')).electricRangeKm.value).toBeNull();
  });
  it('distinguishes third-row cargo from second-row space and leaves floor/roof/minimum-volume alternatives unknown', () => {
    const sorento = kiaSnapshot.records.find((record) => record.modelName === 'Sorento PHEV')!;
    expect(kiaFacts(sorento).cargoSeatsUpL.value).toBe(357);
    expect(kiaFacts(sorento).cargoSeatsDownL.value).toBe(2139);
    expect(kiaFacts(get('E3153V')).cargoSeatsUpL.value).toBeNull();
    const carnival = kiaSnapshot.records.find((record) => record.modelName === 'Carnival')!;
    expect(kiaFacts(carnival).cargoSeatsUpL.value).toBeNull();
    expect(kiaFacts(carnival).cargoSeatsUpL.note).toContain('minimumVolume');
    expect(kiaNumber('1,090~1,274 L', 'L')).toBeNull();
    expect(kiaNumber('1,,139 L', 'L')).toBeNull();
    expect(kiaNumber('0 mm', 'mm')).toBeNull();
  });
  it('retains FSC aliases for reconciliation and excludes only the reviewed commercial cargo model', () => {
    expect(kiaSnapshot.records.some((record) => record.fscCodes.length > 1)).toBe(true);
    expect(kiaReviewGaps(kiaSnapshot).some((gap) => gap.field === 'fscCodes')).toBe(true);
    expect(kiaSnapshot.excludedModels[0]!.name).toBe('PV5');
    expect(kiaSnapshot.excludedModels[0]!.expectedKeys).toHaveLength(2);
    expect(kiaSnapshot.records.some((record) => record.modelName === 'PV5')).toBe(false);
    expect(kiaSnapshot.records.some((record) => record.modelName === 'Carnival')).toBe(true);
  });
});
