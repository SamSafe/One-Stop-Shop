import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/subaru.json';
import { catalog, curatedCatalog, subaruSnapshot } from './index';
import { addSubaruRetail } from './subaru';
import {
  embeddedJson,
  subaruModels,
  subaruModelPrices,
  validateSubaruSnapshot,
} from './subaru-import';

describe('Subaru manufacturer retail import', () => {
  it('reconciles every captured trim and model and preserves original Forester IDs', () => {
    const snapshot = validateSubaruSnapshot(data);
    expect(snapshot.trims.length).toBe(
      snapshot.models.reduce((sum, model) => sum + model.trimIds.length, 0),
    );
    expect(addSubaruRetail(curatedCatalog, snapshot).cars.length).toBe(
      curatedCatalog.cars.length + snapshot.trims.length - 2,
    );
    expect(
      catalog.cars.filter(
        (car) => car.make === 'Subaru' && car.availability.status === 'manufacturer-listed',
      ),
    ).toHaveLength(snapshot.trims.length);
    for (const id of ['subaru-forester-2026-convenience-awd', 'subaru-forester-2026-touring-awd']) {
      expect(catalog.cars.filter((car) => car.id === id)).toHaveLength(1);
    }
  });
  it('publishes exact trim MSRP and provenance without inventing missing specifications', () => {
    const trim = catalog.cars.find((car) => car.manufacturerConfiguration?.id === '1606')!;
    expect(trim.model).toBe('Uncharted');
    expect(trim.year).toBe(2027);
    expect(trim.facts.msrpCad.value).toBe(40995);
    expect(trim.facts.msrpCad.sourceUrl).toContain('CarID=1606');
    expect(trim.availability.status).toBe('manufacturer-listed');
    expect(trim.facts.horsepower.value).toBe(165);
    expect(trim.facts.electricRangeKm.qualifier).toBe('up-to');
    expect(trim.facts.electricCombinedKwh100km.value).toBeNull();
    expect(trim.facts.fuelCombinedL100km.value).toBeNull();
    expect(trim.manufacturerConfiguration?.specificationsUrl).toMatch(/^https:\/\/m\.subaru.ca\//);
    expect(
      subaruSnapshot.trims.some((car) => car.model === 'WRX' && car.trim.includes('Kaminari')),
    ).toBe(true);
  });
  it('rejects incomplete model pages and duplicate manufacturer trim IDs', () => {
    const missing = structuredClone(data);
    missing.trims.pop();
    expect(() => validateSubaruSnapshot(missing)).toThrow('Incomplete Subaru model');
    const duplicate = structuredClone(data);
    duplicate.trims.push(duplicate.trims[0]!);
    expect(() => validateSubaruSnapshot(duplicate)).toThrow();
  });
  it('extracts nested JSON without evaluating scripts or truncating quoted HTML/braces', () => {
    const value = { text: 'Quoted "braces }" and </div>', nested: [{ okay: true }] };
    expect(
      embeddedJson(`<div id="fixture">${JSON.stringify(value)}</div>tail`, 'fixture', 'div'),
    ).toEqual(value);
    expect(() => embeddedJson('<div id="fixture">{"incomplete":', 'fixture', 'div')).toThrow(
      'truncated',
    );
    expect(() => embeddedJson('<p>missing</p>', 'fixture', 'div')).toThrow('missing');
  });
  it('uses the pricing-page base MSRP instead of the header selling price', () => {
    const index = {
      Subaru: {
        Forester: [
          {
            CarID: '1562',
            year: '2026',
            TrimName: 'Convenience',
            ModelCode: 'TJACP',
            Price: '26171',
            Specifications: '26168',
            seating: '5',
            IsHybrid: false,
            IsPlugInHybrid: false,
            IsElectric: false,
            msrp: '37,020',
          },
        ],
      },
      Models: { Forester: { ModelYear: 2026, RangeId: 1, DisplayModelName: 'Forester' } },
    };
    const models = subaruModels(
      `<script type="application/json" id="Cars">${JSON.stringify(index)}</script>`,
    );
    const pricing = {
      Year: 2026,
      RangeId: 1,
      Trims: [{ ID: 1562, Transmissions: [{ ID: 1562, MSRP: 34195, Name: 'Automatic' }] }],
    };
    const page = `<div id="preloadedTrimData">${JSON.stringify(pricing)}</div>`;
    expect(subaruModelPrices(models[0]!, page)[0]!.msrpCad).toBe(34195);
    pricing.Year = 2027;
    expect(() =>
      subaruModelPrices(models[0]!, `<div id="preloadedTrimData">${JSON.stringify(pricing)}</div>`),
    ).toThrow('model/year mismatch');
  });
});
