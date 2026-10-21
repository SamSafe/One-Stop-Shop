import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/ford.json';
import { catalog, fordSnapshot } from './index';
import { fordFlight, fordSelection, fordShowroom, validateFordSnapshot } from './ford-import';
import { fordDrive, fordFuel, fordMsrp, fordRecordId } from './ford';

const flightHtml = (value: unknown) =>
  `<html><script>self.__next_f.push(${JSON.stringify([1, `0:${JSON.stringify(value)}\n`])})</script></html>`;
const f150 = fordSnapshot.records.find(
  (record) =>
    record.key === 'f150' &&
    record.build.trimId === 'xl' &&
    record.build.features.CAB?.description === 'Regular Cab' &&
    record.build.features.BOX?.description === "8' Box",
)!;

describe('Ford/Lincoln Canadian factory import', () => {
  it('reconciles every current retail model year and passenger/pickup default variant', () => {
    const snapshot = validateFordSnapshot(data);
    expect(snapshot.models).toHaveLength(
      snapshot.brands.reduce((sum, brand) => sum + brand.expectedModelKeys.length, 0),
    );
    expect(snapshot.records).toHaveLength(
      snapshot.models.flatMap((model) =>
        model.variants.filter((variant) => variant.excludedReason === null),
      ).length,
    );
    expect(
      catalog.cars.filter(
        (car) => ['Ford', 'Lincoln'].includes(car.make) && car.recordKind === 'retail-trim',
      ),
    ).toHaveLength(snapshot.records.length);
    expect(
      snapshot.models.filter((model) => model.key === 'superduty').map((model) => model.year),
    ).toEqual([2026, 2027]);
    expect(snapshot.records.filter((record) => record.key === 'superduty')).toHaveLength(92);
    expect(snapshot.records.filter((record) => record.key === 'transitvanwagon')).toHaveLength(16);
  });
  it('reports cargo-only and future/commercial exclusions without silently dropping source references', () => {
    const excluded = fordSnapshot.models.flatMap((model) =>
      model.variants.filter((variant) => variant.excludedReason !== null),
    );
    expect(excluded).toHaveLength(42);
    expect(excluded.every((variant) => /Cargo Van/.test(variant.trimName))).toBe(true);
    const showroomExclusions = fordSnapshot.brands.flatMap(
      (brand) => brand.excludedShowroomEntries,
    );
    expect(showroomExclusions.some((entry) => entry.market.includes('Future'))).toBe(true);
    expect(showroomExclusions.some((entry) => entry.market.includes('Commercial'))).toBe(true);
    expect(
      fordSnapshot.records.every(
        (record) => !excluded.some((variant) => variant.key === record.variantKey),
      ),
    ).toBe(true);
  });
  it('rejects missing model years, lost variants, duplicate records and wrong factory identities', () => {
    const missingModel = structuredClone(data);
    missingModel.models.pop();
    expect(() => validateFordSnapshot(missingModel)).toThrow('model years');
    const missingRecord = structuredClone(data);
    missingRecord.records.pop();
    expect(() => validateFordSnapshot(missingRecord)).toThrow('configurations');
    const duplicate = structuredClone(data);
    duplicate.records.push(duplicate.records[0]!);
    expect(() => validateFordSnapshot(duplicate)).toThrow('configurations');
    const wrongYear = structuredClone(data);
    wrongYear.records[0]!.build.year--;
    expect(() => validateFordSnapshot(wrongYear)).toThrow('build identity');
    const wrongCode = structuredClone(fordSnapshot);
    wrongCode.records[0]!.build.selectedCodes = [];
    wrongCode.records[0]!.build.features = {};
    expect(() => validateFordSnapshot(wrongCode)).toThrow('variant codes');
  });
  it('reads split Flight payloads, UTF-8 text lengths and references without executing remote scripts', () => {
    const text = 'Ford®\nCanadian text';
    const body = `2:T${new TextEncoder().encode(text).length.toString(16)},${text}3:["$","component",null,{"title":"$2"}]\n0:{"vehicle":{"title":"$3:props:title"}}\n`;
    const split = Math.floor(body.length / 2);
    const html = `<html><script>self.__next_f.push(${JSON.stringify([1, body.slice(0, split)])})</script><script>self.__next_f.push(${JSON.stringify([1, body.slice(split)])})</script><script>throw new Error('must not execute')</script></html>`;
    expect(fordFlight(html).property('vehicle')).toEqual({ title: text });
    expect(() => fordFlight('2:Tff,short')).toThrow('Truncated Ford text');
    expect(() => fordFlight('<html>No data</html>')).toThrow('embedded data');
    expect(() => fordFlight('0:{"vehicle":"$f"}\n').property('vehicle')).toThrow(
      'Missing Ford data reference',
    );
  });
  it('filters showroom entries by Canadian retail identity rather than price or primary-year status', () => {
    const vehicle = (year: number, market = ['Retail']) => ({
      id: `Ford-Example-${year}`,
      urlKey: 'example',
      desc: 'Example',
      year,
      segment: 'truck',
      market,
      currency: 'CAD',
      bnpUrl: `/configure/example/${year}/`,
    });
    expect(
      fordShowroom(
        flightHtml({ vehicles: [vehicle(2026), vehicle(2027), vehicle(2028, ['Future'])] }),
        'Ford',
      ).models.map((model) => model.year),
    ).toEqual([2026, 2027]);
    expect(() =>
      fordShowroom(flightHtml({ vehicles: [{ ...vehicle(2026), currency: 'USD' }] }), 'Ford'),
    ).toThrow('country/identity');
    expect(() =>
      fordShowroom(flightHtml({ vehicles: [vehicle(2026), vehicle(2026)] }), 'Ford'),
    ).toThrow('Duplicate');
  });
  it('accepts published URL aliases while rejecting a different country or model year', () => {
    const metadata = {
      id: 'CANExample2026',
      country: 'CAN',
      make: 'Ford',
      model: 'Example',
      year: '2026',
      catalogId: 'CAN-CATALOG',
      urlKey: 'example-canonical',
      urlKeyAliases: ['example'],
      segment: 'suv',
      electric: false,
      active: true,
    };
    const trimConfig = {
      holderType: 'TRIM_RESP',
      configModelId: metadata.id,
      year: '2026',
      brand: 'Ford',
      trimModels: [
        {
          name: 'Base',
          wersCodes: ['SERIES'],
          configId: metadata.id,
          catalogId: metadata.catalogId,
          year: '2026',
          trimVariants: [
            { trimId: 'base', variantName: 'Base', configTokenHash: '1', seriesWersCode: 'SERIES' },
          ],
        },
      ],
    };
    expect(
      fordSelection(flightHtml({ configModel: metadata, trimConfig }), {
        brand: 'Ford',
        key: 'example',
        year: 2026,
      }).variants[0]!.variantCodes,
    ).toEqual([]);
    expect(() =>
      fordSelection(flightHtml({ configModel: { ...metadata, country: 'USA' }, trimConfig }), {
        brand: 'Ford',
        key: 'example',
        year: 2026,
      }),
    ).toThrow();
    expect(() =>
      fordSelection(flightHtml({ configModel: metadata, trimConfig }), {
        brand: 'Ford',
        key: 'example',
        year: 2027,
      }),
    ).toThrow('identity');
  });
  it('removes fees, allowances, explicit discounts and colour charges from MSRP', () => {
    expect(f150.build.prices.TRIM_PRICE).toBe(48235);
    expect(f150.build.prices.Base).toBe(52690);
    expect(f150.build.prices['Delivery allowance']).toBe(-5500);
    expect(fordMsrp(f150.build)).toBe(52690);
    const painted = structuredClone(f150.build);
    painted.prices.Options! += 750;
    painted.pricingAdjustments.push({ code: 'PREMIUM', category: 'COLOR', price: 750 });
    expect(fordMsrp(painted)).toBe(52690);
    const missing = structuredClone(f150.build);
    delete missing.prices.Base;
    expect(fordMsrp(missing)).toBeNull();
    const accessories = structuredClone(f150.build);
    accessories.prices.Accessories = 1000;
    expect(fordMsrp(accessories)).toBeNull();
  });
  it('retains factory engine/drive/gearbox identity and honest missing specifications', () => {
    const car = catalog.cars.find((car) => car.id === fordRecordId(f150))!;
    expect(car.variant).toContain('Regular Cab');
    expect(car.variant).toContain("8' Box");
    expect(car.manufacturerConfiguration?.transmission).toContain('10-Speed');
    expect(car.facts.msrpCad.sourceUrl).toBe(f150.source.url);
    expect(car.facts.fuelCombinedL100km.value).toBeNull();
    expect(car.facts.cargoSeatsUpL.value).toBeNull();
    expect(fordDrive(f150.build)).toBe('Not verified');
    expect(car.variant).toContain('4X2');
  });
  it('distinguishes BEV, FHEV and diesel without borrowing another rating variant', () => {
    const electric = fordSnapshot.records.find((record) => record.key === 'mach-e')!;
    expect(fordFuel(electric.build, true)).toBe('Electric');
    const car = catalog.cars.find((car) => car.id === fordRecordId(electric))!;
    expect(car.facts.fuelCombinedL100km.value).toBeNull();
    expect(car.facts.electricCombinedKwh100km.value).toBeNull();
    const corsair = fordSnapshot.records.find((record) => record.key === 'corsair')!;
    expect(fordFuel(corsair.build, false)).toBe('Hybrid');
    const diesel = fordSnapshot.records.find((record) =>
      /diesel/i.test(record.build.features.ENGINE?.description ?? ''),
    )!;
    expect(fordFuel(diesel.build, false)).toBe('Diesel');
  });
  it('preserves composite marketed-series identities and available options for further expansion', () => {
    const maverick = fordSnapshot.records.find(
      (record) => record.key === 'maverick' && record.build.trimId === 'xl',
    )!;
    expect(maverick.build.features.MARKETED_SERIES?.werscode).toContain('_');
    expect(
      f150.build.powertrainOptions.some(
        (option) => option.status === 'AVAILABLE' && option.category === 'ENGINE',
      ),
    ).toBe(true);
    expect(
      catalog.cars.find((car) => car.id === fordRecordId(maverick))!.availability.note,
    ).toContain('not yet exhaustively expanded');
  });
});
