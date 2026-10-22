import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/volkswagen.json';
import { catalog, volkswagenSnapshot as snapshot } from './index';
import {
  validateVwSnapshot,
  vwCatalogue,
  vwKey,
  vwLineup,
  vwMsrpDefinition,
  vwState,
} from './volkswagen-import';
import {
  vwBody,
  vwDrive,
  vwFacts,
  vwFuel,
  vwMsrp,
  vwNumber,
  vwRecordId,
  vwTransmission,
  vwUnit,
} from './volkswagen';

const row = (model: string, code?: string) =>
  snapshot.records.find(
    (record) => record.modelNode === model && (!code || record.key.modelId === code),
  )!;
const engine = (record: ReturnType<typeof row>) => ({
  category: record.category,
  virtual: false as const,
  key: record.key,
  modelName: record.factory.name,
  engineTypes: record.engineTypes,
  gearTypes: record.gearTypes,
  bodyTypes: record.bodyTypes,
  driveType: record.driveType,
  allWheelDrive: record.allWheelDrive,
});
const stateHtml = (state: unknown) =>
  `<html><script type="x-feature-hub/serialized-states">${encodeURIComponent(JSON.stringify({ app: JSON.stringify({ modelOverviewResult: state }) }))}</script><script>throw new Error('must not execute')</script></html>`;
function state() {
  const record = row('/2026-tiguan', 'RM12PJ'),
    groupId = '/2026-tiguan/standard-trims';
  return {
    status: 'loaded',
    url: 'https://v1-569-22.mofa.feature-app.io/bff/model-overview?countryCode=CA&currency=CAD&language=en',
    modelOverview: {
      models: [
        {
          type: 'carline',
          nodeId: record.modelNode,
          category: record.category,
          data: { name: record.modelName, referenceModel: { virtual: false }, isElectric: false },
          children: [
            {
              type: 'salesgroup',
              nodeId: groupId,
              parentNodeId: record.modelNode,
              children: [
                {
                  type: 'trim',
                  nodeId: record.trimNode,
                  parentNodeId: groupId,
                  category: record.category,
                  data: { name: record.trimName, key: record.key, engines: [engine(record)] },
                },
              ],
            },
          ],
        },
      ],
      modelStructure: {
        modelElements: [
          {
            type: 'carline',
            nodeId: record.modelNode,
            children: [
              {
                type: 'salesgroup',
                nodeId: groupId,
                children: [{ type: 'trim', nodeId: record.trimNode }],
              },
            ],
          },
        ],
      },
    },
  };
}
describe('Volkswagen Canadian factory import', () => {
  it('reconciles both current views, every listed trim engine and non-default model years', () => {
    const valid = validateVwSnapshot(data);
    expect(valid.models).toHaveLength(12);
    expect(valid.records).toHaveLength(33);
    expect(valid.records.every((record) => vwMsrp(record) !== null)).toBe(true);
    expect(
      valid.models.filter((model) => !model.configureEnabled).map((model) => model.nodeId),
    ).toEqual(['/2026-jetta', '/2026-jetta-gli', '/2026-taos']);
    expect(valid.virtualVehicleReferences.map((reference) => reference.nodeId)).toEqual([
      '/2026-atlas',
    ]);
    expect(valid.nonVehicleReferences.map((reference) => reference.nodeId)).toEqual([
      '/our-suvw-family',
      '/previous-models',
    ]);
    expect(
      catalog.cars.filter((car) => car.make === 'Volkswagen' && car.recordKind === 'retail-trim'),
    ).toHaveLength(33);
    expect(catalog.cars.find((car) => car.id === 'honda-cr-v-2026-lx-fwd')).toBeDefined();
  });
  it('rejects missing years/versions, wrong factory tuples, package loss and foreign pricing', () => {
    const lost = structuredClone(data);
    lost.records.pop();
    expect(() => validateVwSnapshot(lost)).toThrow('factory configurations');
    const year = structuredClone(data);
    year.models.pop();
    expect(() => validateVwSnapshot(year)).toThrow();
    const identity = structuredClone(snapshot);
    identity.records[0]!.factory.year = '2025';
    expect(() => validateVwSnapshot(identity)).toThrow('factory record identity');
    const packageLoss = structuredClone(snapshot);
    packageLoss.records.find((record) => record.key.modelId.includes('$'))!.factory.code = 'DA1RPT';
    expect(() => validateVwSnapshot(packageLoss)).toThrow('factory record identity');
    const foreign = structuredClone(data) as unknown as {
      records: { factory: { prices: { currency: string }[] } }[];
    };
    foreign.records[0]!.factory.prices[0]!.currency = 'USD';
    expect(() => validateVwSnapshot(foreign)).toThrow();
  });
  it('keeps the GLI manual and automatic identities and fuel ratings separate', () => {
    const manual = row('/2026-jetta-gli', 'BU59V2'),
      automatic = row('/2026-jetta-gli', 'BU59VZ');
    expect(vwRecordId(manual)).not.toBe(vwRecordId(automatic));
    expect(vwTransmission(manual)).toBe('6-speed Manual');
    expect(vwTransmission(automatic)).toBe('7-speed Automatic');
    expect(vwFacts(manual).fuelCombinedL100km.value).toBe(8.1);
    expect(vwFacts(automatic).fuelCombinedL100km.value).toBe(8.2);
    expect(vwDrive(manual)).toBe('FWD');
    expect(() =>
      vwCatalogue({ models: [manual.factory] }, [engine(manual), engine(automatic)]),
    ).toThrow('catalogue engine identities');
  });
  it('uses factory model MSRP, retains encoded packages and ignores discounted regional totals', () => {
    expect(vwMsrp(row('/2026-tiguan', 'RM12PJ'))).toBe(37495);
    expect(vwMsrp(row('/2025-id-buzz', 'EBJR5S'))).toBe(82995);
    const black = snapshot.records.find(
      (record) => record.modelNode === '/2026-golfr' && record.key.modelId.includes('$'),
    )!;
    expect(black.key.modelId).toBe('DA1RPT$MAAUE40$GPS1PS1$GWO1WO1');
    expect(vwMsrp(black)).toBe(54595);
    const ambiguous = structuredClone(black);
    ambiguous.factory.prices.push({ ...ambiguous.factory.prices[0]!, price: 1 });
    expect(vwMsrp(ambiguous)).toBeNull();
    expect(
      vwMsrpDefinition(
        'MSRP is the Manufacturer’s Suggested Retail Price and excludes taxes, freight and PDI',
      ),
    ).toBe(true);
    expect(() => vwMsrpDefinition('Price includes fees and freight.')).toThrow('MSRP definition');
  });
  it('retains both passenger ID. Buzz versions despite the manufacturer commercial category', () => {
    const rear = row('/2025-id-buzz', 'EBJR7S'),
      all = row('/2025-id-buzz', 'EBJR5S');
    expect(rear.category).toBe('commercial');
    expect(vwBody(rear)).toBe('Van');
    expect(vwFacts(rear).seats.value).toBe(7);
    expect(vwFacts(all).seats.value).toBe(6);
    expect(vwDrive(rear)).toBe('RWD');
    expect(vwDrive(all)).toBe('AWD');
    expect(vwFuel(rear)).toBe('Electric');
    expect(vwFacts(rear).cargoSeatsUpL.value).toBe(526.7);
    expect(vwFacts(rear).cargoSeatsDownL.value).toBe(4120);
  });
  it('preserves kWh units, range and charger-power uncertainty without converting motor kW to hp', () => {
    const facts = vwFacts(row('/2025-id-buzz', 'EBJR7S'));
    expect(facts.electricCombinedKwh100km.value).toBe(25.3);
    expect(facts.electricRangeKm.value).toBe(377);
    expect(facts.horsepower.value).toBe(282);
    expect(facts.fuelCombinedL100km.value).toBeNull();
    expect(facts.electricModeLe100km.value).toBeNull();
    expect(facts.rechargeHours.value).toBeNull();
    expect(facts.rechargeHours.note).toContain('Several AC charger powers');
  });
  it('normalizes published decimal commas while leaving roof and dimensional alternatives unresolved', () => {
    expect(vwNumber('7,6')).toBe(7.6);
    expect(vwUnit('1,853 mm', 'mm')).toBe(1853);
    expect(vwUnit('25.3 (kWh/100km)', 'kWh/100km')).toBe(25.3);
    expect(vwUnit('25.3 (kWh/100km', 'kWh/100km')).toBeNull();
    expect(vwUnit('201 kW', 'hp')).toBeNull();
    expect(vwUnit('1853 / 2151 mm', 'mm')).toBeNull();
    expect(vwUnit('8,2 l/100km', 'l/100km')).toBe(8.2);
    const facts = vwFacts(row('/2026-tiguan', 'RM12PJ'));
    expect(facts.frontHeadroomMm.value).toBeNull();
    expect(facts.widthMm.value).toBe(1853);
    expect(facts.fuelHighwayL100km.value).toBe(7.6);
    expect(vwFacts(row('/2026-jetta-gli', 'BU59V2')).rearHeadroomMm.value).toBe(945);
  });
  it('reads encoded data without evaluating scripts and reconciles independently declared hierarchy references', () => {
    const valid = state();
    expect(vwState(stateHtml(valid)).status).toBe('loaded');
    expect(vwLineup(stateHtml(valid))[0]!.nodeId).toBe('/2026-tiguan');
    const missing = structuredClone(valid);
    missing.modelOverview.models[0]!.children[0]!.children = [];
    expect(() => vwLineup(stateHtml(missing))).toThrow('trim references');
    const country = structuredClone(valid);
    country.url = country.url.replace('countryCode=CA', 'countryCode=US');
    expect(() => vwLineup(stateHtml(country))).toThrow('Canadian overview identity');
    const year = structuredClone(valid);
    year.modelOverview.models[0]!.children[0]!.children[0]!.data.engines[0]!.key.modelYear = '2025';
    expect(() => vwLineup(stateHtml(year))).toThrow('engine/model-year identity');
    expect(() => vwState('<html>No data</html>')).toThrow('serialized state');
    expect(new Set(snapshot.records.map((record) => vwKey(record.key))).size).toBe(33);
  });
});
