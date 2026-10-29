import { describe, expect, it } from 'vitest';
import { catalog } from '@oss/car-catalog';
import { defaultEnergy, defaultWeights, scoreCar } from './domain';
import { emptyBrief, requirementChecks } from './buying';
import { explainFit, requirementDescription, requirementValue } from './fit';

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
    expect(fit.mode).toBe('priorities');
    expect(fit.score).toBe(54);
    const price = fit.criteria.find((row) => row.priority === 'price')!;
    const energy = fit.criteria.find((row) => row.priority === 'efficiency')!;
    expect(price).toMatchObject({ value: 45000, points: 25, maximumPoints: 50 });
    expect(energy.value).toBe(10);
    expect(energy.points).toBeCloseTo(29.1666667);
    expect(fit.criteria.filter((row) => !row.active).map((row) => row.priority)).toEqual([
      'cargo',
      'room',
    ]);
    expect(
      fit.criteria.filter((row) => row.active).reduce((sum, row) => sum + row.maximumPoints, 0),
    ).toBe(100);
    expect(Math.round(fit.criteria.reduce((sum, row) => sum + (row.points ?? 0), 0))).toBe(
      fit.score,
    );
  });
  it('explains target attainment and a preference trade-off without changing the score', () => {
    const car = example();
    const brief = emptyBrief();
    brief.weights = { price: 0, energy: 0, cargo: 0, room: 0, power: 5, body: 3, drive: 2 };
    brief.horsepower = 300;
    brief.bodies = ['Coupe'];
    brief.drive = 'RWD';
    const fit = explainFit(car, defaultWeights, defaultEnergy, brief);
    expect(fit.score).toBe(70);
    expect(fit.criteria.find((row) => row.priority === 'power')).toMatchObject({
      points: 40,
      maximumPoints: 50,
      value: 240,
    });
    expect(fit.criteria.find((row) => row.priority === 'body')).toMatchObject({
      points: 30,
      maximumPoints: 30,
      value: 'Coupe',
    });
    expect(fit.criteria.find((row) => row.priority === 'drive')).toMatchObject({
      points: 0,
      maximumPoints: 20,
      value: 'AWD',
    });
    expect(fit.score).toBe(scoreCar(car, defaultWeights, defaultEnergy, brief).score);
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
    expect(explainFit(car, { price: 5, efficiency: 0, cargo: 0, room: 0 }, invalid).score).toBe(50);
  });
  it('keeps dormant preferences and zero weights out of the denominator', () => {
    const brief = emptyBrief();
    brief.weights = { price: 5, energy: 0, cargo: 0, room: 0, power: 0, body: 5, drive: 5 };
    const fit = explainFit(example(), defaultWeights, defaultEnergy, brief);
    expect(fit.totalWeight).toBe(5);
    expect(fit.score).toBe(50);
    expect(fit.criteria.find((row) => row.priority === 'body')!.excludedReason).toContain(
      'Choose a preferred body style',
    );
    expect(fit.criteria.find((row) => row.priority === 'drive')!.excludedReason).toContain(
      'Choose a preferred drivetrain',
    );
    expect(fit.criteria.find((row) => row.priority === 'price')!.maximumPoints).toBe(100);
    const none = explainFit(
      example(),
      { price: 0, efficiency: 0, cargo: 0, room: 0 },
      defaultEnergy,
    );
    expect(none.totalWeight).toBe(0);
    expect(none.score).toBeNull();
    expect(none.criteria.every((row) => Number.isFinite(row.maximumPoints))).toBe(true);
  });
  it('distinguishes failed and unknown requirements with their actual values', () => {
    const car = example();
    const brief = emptyBrief();
    Object.assign(brief, {
      budget: 40000,
      minSeats: 5,
      bodies: ['Convertible'],
      bodyRequired: true,
      drive: 'RWD',
      driveRequired: true,
      powerRequired: true,
      roomRequired: true,
    });
    car.facts.horsepower.value = null;
    const checks = requirementChecks(car, brief);
    expect(checks.map((check) => check.status)).toEqual([
      'failed',
      'failed',
      'failed',
      'failed',
      'unknown',
      'met',
    ]);
    expect(requirementDescription(checks[0]!)).toBe('Base MSRP up to $40,000 CAD');
    expect(requirementValue(checks[0]!)).toBe('$45,000 CAD');
    expect(requirementValue(checks[4]!)).toBe('Not verified');
    const fit = explainFit(car, defaultWeights, defaultEnergy, brief);
    expect(fit.score).toBeNull();
    expect(fit.requirements).toEqual(checks);
    expect(fit.criteria.every((row) => row.points === null)).toBe(true);
  });
  it('uses the original scales when a saved brief is paused and preserves fractional budget thresholds', () => {
    const brief = emptyBrief();
    brief.budget = 50001;
    const fit = explainFit(example(), defaultWeights, defaultEnergy, brief);
    expect(fit.criteria.find((row) => row.priority === 'price')!.target).toContain('$25,000.5 CAD');
    brief.enabled = false;
    expect(explainFit(example(), defaultWeights, defaultEnergy, brief)).toEqual(
      explainFit(example(), defaultWeights, defaultEnergy),
    );
  });
  it('shows a known zero-cost EV value and full earned points', () => {
    const car = example();
    car.fuel = 'Electric';
    car.facts.electricCombinedKwh100km.value = 20;
    const fit = explainFit(
      car,
      { price: 0, efficiency: 5, cargo: 0, room: 0 },
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
