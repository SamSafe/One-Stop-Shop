import { describe, expect, it } from 'vitest';
import { catalog } from '@oss/car-catalog';
import { defaultEnergy, defaultWeights, scoreCar } from './domain';
import { explainFit } from './fit';

function example() {
  const car = structuredClone(catalog.cars[0]!);
  car.bodyStyle = 'Coupe';
  car.drivetrain = 'AWD';
  car.fuel = 'Gasoline';
  car.facts.msrpCad.value = 45000;
  car.facts.fuelCombinedL100km.value = 6.25;
  car.facts.seats.value = 4;
  car.facts.horsepower.value = 240;
  car.facts.rearLegroomMm.value = 1000;
  return car;
}

describe('fit explanations', () => {
  it('accounts for every default point and identifies priorities left out', () => {
    const car = example();
    const fit = explainFit(car, defaultWeights, defaultEnergy);
    expect(fit.score).toBe(54);
    const price = fit.criteria.find((row) => row.priority === 'price')!;
    const energy = fit.criteria.find((row) => row.priority === 'efficiency')!;
    expect(price).toMatchObject({ value: 45000, points: 25, maximumPoints: 50 });
    expect(energy.value).toBe(10);
    expect(energy.points).toBeCloseTo(29.1666667);
    expect(fit.criteria.filter((row) => !row.active).map((row) => row.priority)).toEqual([
      'cargo',
      'room',
      'power',
    ]);
    expect(
      fit.criteria.filter((row) => row.active).reduce((sum, row) => sum + row.maximumPoints, 0),
    ).toBe(100);
    expect(Math.round(fit.criteria.reduce((sum, row) => sum + (row.points ?? 0), 0))).toBe(
      fit.score,
    );
  });
  it('scores horsepower on its fixed scale', () => {
    const car = example();
    const weights = { price: 0, efficiency: 0, cargo: 0, room: 0, power: 5 };
    const fit = explainFit(car, weights, defaultEnergy);
    // 240 hp sits 30% of the way from 150 to 450 hp.
    expect(fit.score).toBe(30);
    expect(fit.criteria.find((row) => row.priority === 'power')).toMatchObject({
      points: 30,
      maximumPoints: 100,
      value: 240,
    });
    expect(fit.score).toBe(scoreCar(car, weights, defaultEnergy).score);
  });
  it('reports all missing active inputs and withholds earned points for an incomplete score', () => {
    const car = example();
    car.facts.msrpCad.value = null;
    car.facts.rearLegroomMm.value = null;
    const fit = explainFit(car, { ...defaultWeights, room: 3 }, defaultEnergy);
    expect(fit.score).toBeNull();
    expect(
      fit.criteria.filter((row) => row.active && row.missingReason).map((row) => row.priority),
    ).toEqual(['price', 'room']);
    expect(fit.criteria.every((row) => row.points === null)).toBe(true);
    expect(fit.criteria.find((row) => row.priority === 'efficiency')!.value).toBe(10);
  });
  it('retains invalid energy explanations and ignores unused energy settings', () => {
    const car = example();
    const invalid = { ...defaultEnergy, fuelPrice: NaN };
    const fit = explainFit(car, defaultWeights, invalid);
    expect(fit.score).toBeNull();
    expect(fit.criteria.find((row) => row.priority === 'efficiency')!.missingReason).toContain(
      'Enter a fuel price',
    );
    expect(
      explainFit(car, { price: 5, efficiency: 0, cargo: 0, room: 0, power: 0 }, invalid).score,
    ).toBe(50);
  });
  it('keeps zero weights out of the denominator', () => {
    const fit = explainFit(example(), { ...defaultWeights, efficiency: 0 }, defaultEnergy);
    expect(fit.totalWeight).toBe(3);
    expect(fit.criteria.find((row) => row.priority === 'price')!.maximumPoints).toBe(100);
    expect(fit.criteria.find((row) => row.priority === 'power')!.excludedReason).toBe(
      'Importance is set to zero.',
    );
    const none = explainFit(
      example(),
      { price: 0, efficiency: 0, cargo: 0, room: 0, power: 0 },
      defaultEnergy,
    );
    expect(none.totalWeight).toBe(0);
    expect(none.score).toBeNull();
    expect(none.criteria.every((row) => Number.isFinite(row.maximumPoints))).toBe(true);
  });
  it('shows a known zero-cost EV value and full earned points', () => {
    const car = example();
    car.fuel = 'Electric';
    car.facts.electricCombinedKwh100km.value = 20;
    const fit = explainFit(
      car,
      { price: 0, efficiency: 5, cargo: 0, room: 0, power: 0 },
      { ...defaultEnergy, electricityPrice: 0 },
    );
    expect(fit.score).toBe(100);
    expect(fit.criteria.find((row) => row.priority === 'efficiency')).toMatchObject({
      value: 0,
      points: 100,
      missingReason: null,
    });
  });
});
