import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/bmw.json';
import { catalog, bmwSnapshot as snapshot } from './index';
import {
  assertBmwSourceResponse,
  bmwPrices,
  bmwRecordKey,
  bmwReferenceKey,
  bmwSolverUrl,
  bmwTechnicalUrl,
  validateBmwSnapshot,
} from './bmw-import';
import { bmwFacts, bmwFuel, bmwMsrp, bmwRecordId } from './bmw';

const row = (code: string) =>
  snapshot.records.find((record) => record.referenceKey.split('/')[1] === code)!;
const reference = (code: string) =>
  snapshot.inventory.modelReferences.find((reference) => reference.code === code)!;
describe('Canadian BMW stock and factory import', () => {
  it('allows specific dated model gaps and rejects transient, access and unrelated source failures', () => {
    const solver = bmwSolverUrl('2627', snapshot.date, null);
    const price = row('2550').priceSource.url;
    for (const errorCode of ['RUL_B_1006', 'RUL_B_1007'])
      expect(() =>
        assertBmwSourceResponse(solver, 404, JSON.stringify({ errorCode })),
      ).not.toThrow();
    expect(() =>
      assertBmwSourceResponse(solver, 400, JSON.stringify({ errorCode: 'RUL_B_1018' })),
    ).not.toThrow();
    expect(() =>
      assertBmwSourceResponse(price, 400, JSON.stringify({ errorCode: 'PRI_B_1004' })),
    ).not.toThrow();
    for (const status of [401, 403, 429, 500, 503])
      expect(() =>
        assertBmwSourceResponse(price, status, JSON.stringify({ errorCode: 'PRI_B_1004' })),
      ).toThrow(/Unexpected BMW source/);
    expect(() => assertBmwSourceResponse(price, 400, '{}')).toThrow();
    expect(() => assertBmwSourceResponse(solver, 404, '<html>unavailable</html>')).toThrow();
    expect(() =>
      assertBmwSourceResponse(
        'https://www.bmw.ca/en/all-models.html',
        404,
        JSON.stringify({ errorCode: 'RUL_B_1006' }),
      ),
    ).toThrow();
  });
  it('retains all observed exact year/code groups while keeping inventory completeness unproven', () => {
    expect(validateBmwSnapshot(data).records).toHaveLength(110);
    expect(snapshot.inventory.modelReferences).toHaveLength(110);
    expect(snapshot.inventory.sources).toHaveLength(202);
    expect(snapshot.inventory.total).toBe(9666);
    expect(snapshot.inventory.distinctStockRecords).toBe(9201);
    expect(new Set(snapshot.inventory.modelReferences.map((reference) => reference.year))).toEqual(
      new Set([2025, 2026, 2027]),
    );
    expect(snapshot.overview).toHaveLength(55);
    expect(snapshot.matrixModels).toHaveLength(49);
    expect(
      snapshot.matrixModels.filter(
        (model) =>
          !snapshot.inventory.modelReferences.some(
            (reference) => reference.code === model.code && reference.agCode === model.agCode,
          ),
      ),
    ).toHaveLength(6);
    expect(
      catalog.cars.filter((car) => car.make === 'BMW' && car.recordKind === 'retail-trim'),
    ).toHaveLength(110);
    expect(catalog.cars.find((car) => car.id === 'honda-cr-v-2026-lx-fwd')).toBeDefined();
  });
  it('rejects omitted stock years, count changes, duplicate configurations and wrong factory joins', () => {
    const missing = structuredClone(data);
    missing.records.pop();
    expect(() => validateBmwSnapshot(missing)).toThrow(/omitted/);
    const count = structuredClone(data);
    count.inventory.distinctStockRecords--;
    expect(() => validateBmwSnapshot(count)).toThrow(/counts/);
    const duplicate = structuredClone(data);
    duplicate.records.push(duplicate.records[0]!);
    expect(() => validateBmwSnapshot(duplicate)).toThrow(/Duplicate/);
    const wrong = structuredClone(snapshot);
    wrong.records.find((row) => row.model)!.model!.agCode = 'WRONG';
    expect(() => validateBmwSnapshot(wrong)).toThrow(/identity/);
  });
  it('takes CAD net model RRP and exact transmission cost before paint, fees and taxes', () => {
    const record = row('272A'),
      ref = reference('272A');
    expect(bmwMsrp(record, ref)).toBe(50900);
    const gross = record.prices!.find(
      (price) => price.category === 'MODEL' && price.key === ref.code,
    )!;
    expect(gross.grossListPrice).toBe(55095);
    const paint = structuredClone(record);
    paint.prices!.push({
      category: 'OPTION',
      key: 'PFAKE',
      netListPrice: 50000,
      grossListPrice: 60000,
    });
    expect(bmwMsrp(paint, ref)).toBe(50900);
    const gear = structuredClone(record);
    gear.prices!.find(
      (price) => price.category === 'OPTION' && price.key === 'S02TF',
    )!.netListPrice = 500;
    expect(bmwMsrp(gear, ref)).toBe(51400);
    const wrong = structuredClone(record);
    wrong.prices!.find((price) => price.category === 'MODEL')!.key = 'OTHER';
    expect(bmwMsrp(wrong, ref)).toBeNull();
    expect(bmwMsrp(row('2550'), reference('2550'))).toBeNull();
  });
  it('rejects foreign currency and invalid/undefined price inputs even with HTTP success', () => {
    const response = {
      metadata: { currency: 'CAD', modelPriceType: 'RRP_NET', optionPriceType: 'RRP_NET' },
      invalidOptionCodes: [],
      optionsWithUndefinedPrices: [],
      invalidAccessoryIds: [],
      accessoryWithUndefinedPrices: {
        accessoryHardware: [],
        accessoryPriceOnRequest: [],
        accessoryInstallation: [],
      },
      priceTreeNode: {
        category: 'MODEL',
        key: '272A',
        effectivePrice: { netListPrice: 50900, grossListPrice: 55095 },
      },
    };
    expect(bmwPrices(response)[0]!.netListPrice).toBe(50900);
    expect(() =>
      bmwPrices({ ...response, metadata: { ...response.metadata, currency: 'USD' } }),
    ).toThrow();
    expect(() => bmwPrices({ ...response, invalidOptionCodes: ['SINVALID'] })).toThrow(/invalid/);
    expect(() =>
      bmwPrices({
        ...response,
        accessoryWithUndefinedPrices: {
          ...response.accessoryWithUndefinedPrices,
          accessoryHardware: ['A'],
        },
      }),
    ).toThrow(/undefined/);
  });
  it('uses explicit 48 V and combined BHP evidence without copying engine-only or metric PS output', () => {
    const record = row('2634'),
      ref = reference('2634'),
      facts = bmwFacts(record, ref);
    expect(bmwFuel(record, ref)).toBe('Hybrid');
    expect(record.configuration!.classifiedConfiguration.volt48.isVolt48Variant).toBe(true);
    expect(facts.horsepower.value).toBe(386);
    expect(record.technical!.values.C_LEISTUNG_HP!.targetValue).toBe(375);
    expect(facts.widthMm.value).toBe(2068);
    expect(facts.widthMm.note).toContain('includes mirrors');
    expect(facts.seats.value).toBe(5);
    expect(facts.fuelCombinedL100km.value).toBeNull();
    expect(facts.cargoSeatsUpL.value).toBeNull();
    expect(facts.electricCombinedKwh100km.value).toBeNull();
  });
  it('retains older new stock without inventing current ordering, hybrid subtype or technical data', () => {
    const record = row('2550'),
      ref = reference('2550'),
      facts = bmwFacts(record, ref);
    expect(ref.year).toBe(2025);
    expect(record.configuration).toBeNull();
    expect(bmwFuel(record, ref)).toBe('Gasoline / hybrid');
    expect(facts.horsepower.value).toBeNull();
    expect(facts.widthMm.value).toBeNull();
    expect(catalog.cars.find((car) => car.id === bmwRecordId(record))).toMatchObject({
      year: 2025,
      availability: { status: 'manufacturer-listed' },
    });
    expect(row('2622').configuration).toBeNull();
    expect(reference('2622').transmissions).toEqual(
      expect.arrayContaining(['Automatic', 'Manual']),
    );
  });
  it('keeps electric and plug-in identities separate and preserves exact solver/technical request context', () => {
    expect(bmwFuel(row('27C1'), reference('27C1'))).toBe('Electric');
    expect(bmwMsrp(row('27C1'), reference('27C1'))).toBe(75900);
    expect(bmwMsrp(row('26I0'), reference('26I0'))).toBe(89900);
    const phev = snapshot.records.find((record) => record.model?.hybrid === 'PHEV')!;
    const ref = snapshot.inventory.modelReferences.find(
      (reference) => bmwReferenceKey(reference) === phev.referenceKey,
    )!;
    expect(bmwFuel(phev, ref)).toBe('Plug-in hybrid');
    const manual = row('2722');
    expect(manual.configuration!.classifiedConfiguration.transmission.type).toBe('manual');
    expect(bmwRecordKey(manual)).not.toBe(bmwRecordKey(row('2723')));
    expect(manual.solverSource.url).toBe(bmwSolverUrl('2722', snapshot.date, null));
    expect(manual.technicalSource!.url).toBe(
      bmwTechnicalUrl(
        reference('2722').agCode,
        snapshot.date,
        Object.keys(manual.configuration!.configuration.elements),
      ),
    );
  });
  it('rejects a changed transmission and source context', () => {
    const wrong = structuredClone(snapshot);
    const record = wrong.records.find((record) => record.configuration)!;
    record.requestedGear = 'SFAKE';
    expect(() => validateBmwSnapshot(wrong)).toThrow(/transmission/);
    const source = structuredClone(data);
    source.records[0]!.priceSource.url = 'https://prod.ucp.bmw.cloud/other';
    expect(() => validateBmwSnapshot(source)).toThrow(/source context/);
  });
});
