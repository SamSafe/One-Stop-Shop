import { describe, expect, it } from 'vitest';
import { catalog } from '@oss/car-catalog';
import {
  annualFuelCost,
  defaultFilters,
  defaultWeights,
  filterCars,
  knownIds,
  loadShortlist,
  parseSharedState,
  rankCars,
  saveShortlist,
  scoreCar,
  serializeSharedState,
} from './domain';

const cars = catalog.cars;
const first = cars[0]!;
const hybrid = cars.find((car) => car.fuel === 'Hybrid')!;
const onlyPrice = { price: 5, efficiency: 0, cargo: 0, room: 0 };

describe('ranking', () => {
  it('matches a hand-calculated weighted score', () => {
    // LX: price .704×.3 + L/100 km .3333×.3 + cargo .772×.2 + room .7×.2 = .6056
    const example = structuredClone(first);
    example.facts.msrpCad.value = 38880;
    example.facts.fuelCombinedL100km.value = 9.333333333;
    example.facts.cargoSeatsUpL.value = 1040.4;
    example.facts.rearLegroomMm.value = 1060;
    expect(scoreCar(example, defaultWeights).score).toBe(61);
  });
  it('changes the winner when priorities change', () => {
    expect(rankCars(cars, onlyPrice)[0]!.car.id).toBe('subaru-forester-2026-convenience-awd');
    expect(rankCars(cars, { price: 0, efficiency: 5, cargo: 0, room: 0 })[0]!.car.id).toBe(
      hybrid.id,
    );
  });
  it('keeps a car score unchanged after filtering other cars out', () => {
    const before = rankCars(cars, defaultWeights).find(({ car }) => car.id === first.id)!;
    const after = rankCars([first], defaultWeights)[0]!;
    expect(after.score).toBe(before.score);
  });
  it('does not rank unknown active metrics as zero or renormalize them away', () => {
    const incomplete = structuredClone(first);
    incomplete.facts.fuelCombinedL100km = { value: null, source: null, note: 'Not published.' };
    expect(scoreCar(incomplete, defaultWeights).score).toBeNull();
    expect(scoreCar(incomplete, onlyPrice).score).not.toBeNull();
  });
  it('returns no score for zero weights', () => {
    expect(scoreCar(first, { price: 0, efficiency: 0, cargo: 0, room: 0 }).score).toBeNull();
  });
  it.each([-1, 6, 0.5, NaN, Infinity])('rejects invalid weight %s', (price) => {
    expect(() => scoreCar(first, { ...defaultWeights, price })).toThrow('Invalid weight');
  });
  it('caps scores at the fixed scale boundaries', () => {
    const inexpensive = structuredClone(first);
    inexpensive.facts.msrpCad.value = 10000;
    expect(scoreCar(inexpensive, onlyPrice).score).toBe(100);
    inexpensive.facts.msrpCad.value = 100000;
    expect(scoreCar(inexpensive, onlyPrice).score).toBe(0);
  });
  it('breaks equal-score ties by price then configuration ID', () => {
    const a = { ...first, id: 'a' };
    const b = { ...first, id: 'b' };
    expect(rankCars([b, a], defaultWeights).map(({ car }) => car.id)).toEqual(['a', 'b']);
  });
});

describe('filters and fuel estimates', () => {
  it('combines search, fuel, drivetrain, budget and saved filters', () => {
    expect(
      filterCars(
        cars,
        {
          query: '  FORESTER  ',
          fuel: 'Gasoline',
          drivetrain: 'AWD',
          budget: 35000,
          savedOnly: true,
        },
        [cars[2]!.id],
      ),
    ).toEqual([cars[2]]);
    expect(filterCars(cars, { ...defaultFilters, fuel: 'Hybrid', drivetrain: 'FWD' })).toEqual([]);
  });
  it('does not include an unknown price under a budget', () => {
    const unknown = structuredClone(first);
    unknown.facts.msrpCad.value = null;
    expect(filterCars([unknown], defaultFilters)).toEqual([]);
  });
  it('calculates annual fuel cost using combined L/100 km', () => {
    const example = structuredClone(hybrid);
    example.facts.fuelCombinedL100km.value = 6.4;
    expect(annualFuelCost(example, 15000, 1.6)).toBe(1536);
    expect(annualFuelCost(hybrid, 0, 1.6)).toBe(0);
  });
  it.each([
    [NaN, 3.5],
    [-1, 3.5],
    [200001, 1.6],
    [12000, 0],
    [15000, 6],
    [12000, Infinity],
  ])('rejects invalid fuel assumptions %s / %s', (miles, price) => {
    expect(annualFuelCost(first, miles!, price!)).toBeNull();
  });
});

describe('shared comparisons', () => {
  it('roundtrips selected IDs and weights', () => {
    const state = {
      compare: [first.id, hybrid.id],
      weights: { price: 5, efficiency: 2, cargo: 0, room: 1 },
    };
    expect(parseSharedState(serializeSharedState(state), cars)).toEqual(state);
  });
  it('drops unknown IDs, duplicates, excessive cars and unsafe values', () => {
    const query = `?compare=${[...cars.map((car) => car.id), first.id, '<script>'].join(',')}&price=-1&cargo=NaN&room=99&efficiency=0`;
    expect(parseSharedState(query, cars)).toEqual({
      compare: cars.slice(0, 4).map((car) => car.id),
      weights: { ...defaultWeights, efficiency: 0 },
    });
  });
  it('handles malformed and oversized parameters without errors', () => {
    expect(parseSharedState('?compare=%E0%A4%A&price=1e1', cars).compare).toEqual([]);
    expect(parseSharedState(`?compare=${'x'.repeat(10000)}`, cars).compare).toEqual([]);
    expect(knownIds('not an array', cars, 4)).toEqual([]);
  });
});

describe('device shortlists', () => {
  it('treats unknown formats as read-only rather than authorizing an overwrite', () => {
    const result = loadShortlist({ getItem: () => '{"version":2,"ids":["future-car"]}' }, cars);
    expect(result.canPersist).toBe(false);
    expect(result.warning).toContain('Clear your shortlist');
    expect(loadShortlist({ getItem: () => null }, cars).canPersist).toBe(true);
  });
  it('loads only unique catalog IDs and writes a versioned payload', () => {
    const stored = JSON.stringify({ version: 1, ids: [first.id, 'gone', first.id, hybrid.id, 42] });
    expect(loadShortlist({ getItem: () => stored }, cars).ids).toEqual([first.id, hybrid.id]);
    let written = '';
    expect(
      saveShortlist(
        {
          setItem: (_key, value) => {
            written = value;
          },
        },
        [first.id],
      ),
    ).toBe(true);
    expect(JSON.parse(written)).toEqual({ version: 1, ids: [first.id] });
  });
  it.each(['{bad json', 'null', '[]', '{"version":2,"ids":[]}', '{"version":1,"ids":{}}'])(
    'recovers from corrupt payload %s',
    (raw) => {
      const result = loadShortlist({ getItem: () => raw }, cars);
      expect(result.ids).toEqual([]);
      expect(result.warning).toBeTruthy();
    },
  );
  it('recovers from unavailable or full storage', () => {
    expect(
      loadShortlist(
        {
          getItem: () => {
            throw new Error('blocked');
          },
        },
        cars,
      ).warning,
    ).toBeTruthy();
    expect(
      saveShortlist(
        {
          setItem: () => {
            throw new Error('full');
          },
        },
        [first.id],
      ),
    ).toBe(false);
  });
});
