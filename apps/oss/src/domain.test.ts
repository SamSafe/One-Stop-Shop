import { describe, expect, it } from 'vitest';
import { catalog, curatedCatalog, retailCatalog } from '@oss/car-catalog';
import {
  estimateEnergy,
  annualEnergyEstimate,
  energyInputsUsed,
  fuelPriceFor,
  fuelTypeForPricing,
} from './energy';
import { nonApplicableReason } from './specifications';
import {
  annualFuelCost,
  annualEnergyCost,
  defaultFilters,
  defaultWeights,
  defaultEnergy,
  energyCostPer100km,
  vehicleBodyStyle,
  filterCars,
  hasMatchingSpecification,
  specificationDifference,
  fullName,
  modelYearLabel,
  knownIds,
  loadShortlist,
  parseSharedState,
  rankCars,
  saveShortlist,
  scoreCar,
  serializeSharedState,
} from './domain';

const cars = curatedCatalog.cars;
const first = cars[0]!;
const hybrid = cars.find((car) => car.fuel === 'Hybrid')!;
const onlyPrice = { price: 5, efficiency: 0, cargo: 0, room: 0 };

describe('explainable energy estimates and applicability', () => {
  const plugIn = () => {
    const car = structuredClone(first);
    car.fuel = 'Plug-in hybrid';
    car.facts.fuelCombinedL100km.value = 10;
    car.facts.electricCombinedKwh100km.value = 20;
    car.facts.electricModeFuelL100km.value = 2;
    return car;
  };
  it('separates fuel and electricity, including fuel burned in electric operation', () => {
    const estimate = estimateEnergy(plugIn(), {
      ...defaultEnergy,
      fuelPrice: 1.5,
      electricityPrice: 0.2,
    });
    expect(estimate).toEqual({
      available: true,
      fuelLitres: 6,
      electricityKwh: 10,
      fuelCost: 9,
      electricityCost: 2,
      total: 11,
      usesFuel: true,
      usesElectricity: true,
      fuelPrice: { key: null, label: 'Fuel grade not verified', price: 1.5, basis: 'shared' },
    });
    expect(annualEnergyEstimate(estimate, 10000).cost).toBe(1100);
    expect(annualEnergyEstimate(estimate, 0).cost).toBe(0);
  });
  it('explains missing active consumption and invalid prices without a partial total', () => {
    const car = plugIn();
    car.facts.electricModeFuelL100km.value = null;
    expect(estimateEnergy(car, { ...defaultEnergy, fuelPrice: NaN })).toEqual({
      available: false,
      reasons: [
        'Fuel consumption during plug-in electric operation has not been verified.',
        'Enter a fuel price from $0.01 to $5 per litre.',
      ],
    });
    expect(estimateEnergy(first, { ...defaultEnergy, fuelPrice: 0.001 }).available).toBe(false);
  });
  it('keeps per-distance costs available when only annual distance is invalid', () => {
    const estimate = estimateEnergy(plugIn(), { ...defaultEnergy, kilometres: NaN });
    expect(estimate.available).toBe(true);
    expect(annualEnergyEstimate(estimate, NaN)).toEqual({
      cost: null,
      reasons: ['Enter annual kilometres from 0 to 200,000.'],
    });
  });
  it('shares active-mode requirements with the inputs, including zero fuel and invalid shares', () => {
    const car = plugIn();
    expect(energyInputsUsed(car, 0)).toEqual({ fuel: true, electricity: false, share: true });
    expect(energyInputsUsed(car, 1).fuel).toBe(true);
    car.facts.electricModeFuelL100km.value = 0;
    expect(energyInputsUsed(car, 1)).toEqual({ fuel: false, electricity: true, share: true });
    expect(
      estimateEnergy(car, { ...defaultEnergy, fuelPrice: NaN, electricFraction: 1 }),
    ).toMatchObject({ available: true, total: 3 });
    expect(energyInputsUsed(car, 2)).toEqual({ fuel: true, electricity: true, share: true });
    expect(estimateEnergy(car, { ...defaultEnergy, electricFraction: 2 })).toEqual({
      available: false,
      reasons: ['Enter an electric-mode share from 0% to 100%.'],
    });
  });
  it('allows a free charging rate only with verified consumption and does not estimate hydrogen costs', () => {
    const ev = plugIn();
    ev.fuel = 'Electric';
    const energy = { ...defaultEnergy, electricityPrice: 0, fuelPrice: NaN };
    expect(estimateEnergy(ev, energy)).toMatchObject({
      available: true,
      total: 0,
      usesFuel: false,
    });
    ev.facts.electricCombinedKwh100km.value = null;
    expect(annualEnergyEstimate(estimateEnergy(ev, energy), 0).cost).toBeNull();
    ev.fuel = 'Hydrogen';
    expect(estimateEnergy(ev, defaultEnergy)).toEqual({
      available: false,
      reasons: ['Hydrogen energy costs are not supported.'],
    });
  });
  it('distinguishes irrelevant fields from unknown applicable data and preserves published values', () => {
    const car = plugIn();
    car.fuel = 'Electric';
    car.facts.fuelCombinedL100km.value = null;
    expect(nonApplicableReason(car, 'fuelCombinedL100km')).toContain('does not use liquid fuel');
    car.facts.electricCombinedKwh100km.value = null;
    expect(nonApplicableReason(car, 'electricCombinedKwh100km')).toBeNull();
    car.fuel = 'Hybrid';
    expect(nonApplicableReason(car, 'electricCombinedKwh100km')).toContain('do not apply');
    expect(nonApplicableReason(car, 'fuelCombinedL100km')).toBeNull();
    car.facts.electricCombinedKwh100km.value = 20;
    expect(nonApplicableReason(car, 'electricCombinedKwh100km')).toBeNull();
    car.facts.electricModeFuelL100km.value = null;
    expect(nonApplicableReason(car, 'electricModeFuelL100km')).toContain('only to plug-in hybrid');
    car.fuel = 'Plug-in hybrid';
    expect(nonApplicableReason(car, 'electricModeFuelL100km')).toBeNull();
  });
  it('hides matching inapplicable fields while keeping missing facts and mixed applicability visible', () => {
    const car = structuredClone(first);
    car.facts.electricRangeKm.value = null;
    expect(hasMatchingSpecification([car, car], 'electricRangeKm')).toBe(true);
    const ev = structuredClone(car);
    ev.fuel = 'Electric';
    expect(hasMatchingSpecification([car, ev], 'electricRangeKm')).toBe(false);
    expect(hasMatchingSpecification([ev, ev], 'electricRangeKm')).toBe(false);
    car.facts.electricRangeKm.value = 100;
    expect(hasMatchingSpecification([car, ev], 'electricRangeKm')).toBe(false);
  });
});

describe('fuel-specific price assumptions', () => {
  const priced = {
    ...defaultEnergy,
    premiumPrice: 2,
    dieselPrice: 1.8,
    e85Price: 1.3,
  };
  const rated = (fuelType: string) =>
    structuredClone(catalog.cars.find((car) => car.governmentRating?.fuelType === fuelType)!);

  it('uses only the matching verified fuel price and includes its basis in the breakdown', () => {
    for (const [type, price] of [
      ['Regular gasoline', 1.6],
      ['Premium gasoline', 2],
      ['Diesel', 1.8],
      ['Ethanol (E85)', 1.3],
    ] as const) {
      const car = rated(type);
      car.facts.fuelCombinedL100km.value = 8;
      const estimate = estimateEnergy(car, priced);
      expect(estimate.available).toBe(true);
      if (!estimate.available) throw Error('Expected a known fuel estimate.');
      expect(estimate.total).toBeCloseTo(8 * price);
      expect(estimate.fuelPrice?.price).toBe(price);
      expect(estimate.fuelPrice?.basis).toBe(type === 'Regular gasoline' ? 'shared' : 'specific');
    }
  });
  it('retains shared assumptions when no override is supplied and does not guess premium or E85 from names', () => {
    const premium = rated('Premium gasoline');
    expect(fuelPriceFor(premium, defaultEnergy)).toMatchObject({ price: 1.6, basis: 'shared' });
    const unknown = structuredClone(first);
    delete unknown.governmentRating;
    unknown.make = 'Porsche';
    unknown.trim = 'Premium Turbo';
    expect(fuelPriceFor(unknown, priced)).toEqual({
      key: null,
      label: 'Fuel grade not verified',
      price: 1.6,
      basis: 'shared',
    });
    unknown.fuel = 'Flex-fuel';
    expect(fuelPriceFor(unknown, priced).price).toBe(1.6);
    unknown.fuel = 'Diesel';
    expect(fuelPriceFor(unknown, priced)).toMatchObject({
      key: 'dieselPrice',
      price: 1.8,
      basis: 'specific',
    });
  });
  it('rejects only invalid prices used by the selected fuel and operating mode', () => {
    const premium = rated('Premium gasoline');
    premium.facts.fuelCombinedL100km.value = 8;
    expect(estimateEnergy(premium, { ...priced, fuelPrice: NaN }).available).toBe(true);
    expect(estimateEnergy(premium, { ...priced, premiumPrice: NaN })).toEqual({
      available: false,
      reasons: ['Enter a premium gasoline price from $0.01 to $5 per litre.'],
    });
    const regular = rated('Regular gasoline');
    expect(
      estimateEnergy(regular, { ...priced, premiumPrice: NaN, dieselPrice: 0 }).available,
    ).toBe(true);
    premium.fuel = 'Plug-in hybrid';
    premium.facts.electricCombinedKwh100km.value = 20;
    premium.facts.electricModeFuelL100km.value = 0;
    expect(
      estimateEnergy(premium, {
        ...priced,
        premiumPrice: NaN,
        fuelPrice: NaN,
        electricFraction: 1,
      }),
    ).toMatchObject({ available: true, total: 3, usesFuel: false, fuelPrice: null });
    expect(fuelTypeForPricing(regular).key).toBeNull();
  });
  it('applies fuel-specific assumptions to ranking without making annual distance a scoring input', () => {
    const car = rated('Premium gasoline');
    expect(scoreCar(car, defaultWeights, priced).score).toBeLessThan(
      scoreCar(car, defaultWeights).score!,
    );
    expect(scoreCar(car, defaultWeights, { ...priced, kilometres: NaN }).score).toBe(
      scoreCar(car, defaultWeights, priced).score,
    );
    expect(scoreCar(car, onlyPrice, { ...priced, premiumPrice: NaN }).score).not.toBeNull();
  });
  it('roundtrips optional prices in shared state, including a price equal to the shared assumption', () => {
    for (const overrides of [
      { premiumPrice: 2 },
      { dieselPrice: 1.8, e85Price: 1.3 },
      { premiumPrice: 1.6 },
    ]) {
      const state = {
        compare: [first.id],
        weights: defaultWeights,
        energy: { ...defaultEnergy, ...overrides },
      };
      expect(parseSharedState(serializeSharedState(state), cars)).toEqual(state);
    }
  });
  it('ignores malformed URL overrides and omits invalid values when sharing', () => {
    expect(
      parseSharedState('?premiumPrice=Infinity&dieselPrice=0&e85Price=5.01', cars).energy,
    ).toBeUndefined();
    expect(parseSharedState('?premiumPrice=2&dieselPrice=-1&e85Price=NaN', cars).energy).toEqual({
      ...defaultEnergy,
      premiumPrice: 2,
    });
    expect(
      serializeSharedState({
        compare: [],
        weights: defaultWeights,
        energy: { ...defaultEnergy, premiumPrice: NaN, dieselPrice: 0, e85Price: 6 },
      }),
    ).toBe('');
  });
});

describe('meaningful specification differences', () => {
  it('roundtrips a selected reference through the shared comparison URL', () => {
    const state = { compare: [first.id, hybrid.id], weights: defaultWeights, reference: hybrid.id };
    expect(parseSharedState(serializeSharedState(state), cars)).toEqual(state);
  });
  it('does not accept a reference outside the selected comparison or redundantly encode the first car', () => {
    const parsed = parseSharedState(`?compare=${first.id}&reference=${hybrid.id}`, cars);
    expect(parsed.reference).toBeUndefined();
    expect(serializeSharedState({ ...parsed, reference: first.id })).not.toContain('reference=');
  });
  it('compares base CAD prices and reverses the delta when the reference changes', () => {
    const other = structuredClone(first);
    other.facts.msrpCad.value = first.facts.msrpCad.value! + 2000;
    other.facts.msrpCad.note = 'A different Canadian publication.';
    expect(specificationDifference(first, other, 'msrpCad')).toMatchObject({
      kind: 'different',
      delta: 2000,
    });
    expect(specificationDifference(other, first, 'msrpCad').delta).toBe(-2000);
  });
  it('keeps a missing value unknown rather than manufacturing a numeric saving', () => {
    const other = structuredClone(first);
    other.facts.msrpCad = { value: null, source: null, note: 'Not published.' };
    expect(specificationDifference(first, other, 'msrpCad')).toMatchObject({
      kind: 'unknown',
      delta: null,
    });
  });
  it('flags differing measurement notes even when the published numbers are equal', () => {
    const other = structuredClone(first);
    other.facts.rearLegroomMm.note = 'Second-row seats in a different position.';
    expect(specificationDifference(first, other, 'rearLegroomMm')).toMatchObject({
      kind: 'context',
      delta: null,
    });
  });
  it('does not call cargo volumes directly comparable across different seating layouts', () => {
    const other = structuredClone(first);
    other.facts.seats.value = 7;
    expect(specificationDifference(first, other, 'cargoSeatsUpL')).toMatchObject({
      kind: 'context',
      delta: null,
    });
    other.facts.seats.value = null;
    expect(specificationDifference(first, other, 'cargoSeatsUpL').kind).toBe('context');
  });
  it('calculates a published spatial delta when the recorded context agrees', () => {
    const other = structuredClone(first);
    other.facts.rearLegroomMm.value = first.facts.rearLegroomMm.value! + 35;
    expect(specificationDifference(first, other, 'rearLegroomMm')).toMatchObject({
      kind: 'different',
      delta: 35,
    });
    expect(specificationDifference(first, first, 'seats')).toMatchObject({
      kind: 'same',
      delta: 0,
    });
  });
});

describe('matching comparison specifications', () => {
  it('keeps an up-to range distinct from an unqualified range with the same numeric value', () => {
    const bounded = structuredClone(first),
      fixed = structuredClone(first);
    bounded.facts.electricRangeKm = {
      value: 400,
      source: first.facts.msrpCad.source,
      note: 'Same source context.',
      qualifier: 'up-to',
    };
    fixed.facts.electricRangeKm = { ...bounded.facts.electricRangeKm };
    delete fixed.facts.electricRangeKm.qualifier;
    expect(hasMatchingSpecification([bounded, fixed], 'electricRangeKm')).toBe(false);
    fixed.facts.electricRangeKm.qualifier = 'up-to';
    expect(hasMatchingSpecification([bounded, fixed], 'electricRangeKm')).toBe(true);
  });
  it('recognizes a known match across separate publications', () => {
    const second = structuredClone(first);
    second.facts.seats = { ...first.facts.seats, source: 'another-publication' };
    expect(hasMatchingSpecification([first, second], 'seats')).toBe(true);
  });
  it('keeps matching numbers visible when their measurement notes differ', () => {
    const second = structuredClone(first);
    second.facts.widthMm.note = 'Measured including mirrors.';
    expect(hasMatchingSpecification([first, second], 'widthMm')).toBe(false);
  });
  it('does not treat unknown values as matching specifications', () => {
    const unknown = structuredClone(first);
    unknown.facts.seats = { value: null, source: null, note: 'Not published.' };
    expect(hasMatchingSpecification([unknown, unknown], 'seats')).toBe(false);
    expect(hasMatchingSpecification([first, unknown], 'seats')).toBe(false);
  });
  it('requires at least two vehicles and agreement across every selected vehicle', () => {
    const different = structuredClone(first);
    different.facts.seats.value = first.facts.seats.value! + 1;
    expect(hasMatchingSpecification([], 'seats')).toBe(false);
    expect(hasMatchingSpecification([first], 'seats')).toBe(false);
    expect(hasMatchingSpecification([first, first, different], 'seats')).toBe(false);
  });
});

describe('ranking', () => {
  it('matches a hand-calculated weighted score', () => {
    // Price .704×.3 + energy (1 - 14.93/24)×.3 + cargo .772×.2 + room .7×.2.
    const example = structuredClone(first);
    example.facts.msrpCad.value = 38880;
    example.facts.fuelCombinedL100km.value = 9.333333333;
    example.facts.cargoSeatsUpL.value = 1040.4;
    example.facts.rearLegroomMm.value = 1060;
    expect(scoreCar(example, { price: 3, efficiency: 3, cargo: 2, room: 2 }).score).toBe(62);
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
  it('matches reordered words, punctuation variants and powertrains without conflating numeric model names', () => {
    const crv = {
      ...structuredClone(first),
      make: 'Honda',
      model: 'CR-V',
      fuel: 'Hybrid' as const,
    };
    expect(filterCars([crv], { ...defaultFilters, query: 'hybrid 2026 hónda crv' })).toEqual([crv]);
    expect(filterCars([crv], { ...defaultFilters, query: 'Honda CR–V' })).toEqual([crv]);
    expect(filterCars([crv], { ...defaultFilters, query: 'hybrid diesel' })).toEqual([]);
    const cx5 = { ...crv, model: 'CX-5', make: 'Mazda' },
      cx50 = { ...crv, model: 'CX-50', make: 'Mazda' };
    expect(filterCars([cx5, cx50], { ...defaultFilters, query: 'mazda cx5' })).toEqual([cx5]);
    const xl = { ...crv, make: 'Ford', model: 'F-150', trim: 'XL', variant: 'Cab: Regular Cab' };
    const xlt = { ...xl, trim: 'XLT' };
    expect(filterCars([xl, xlt], { ...defaultFilters, query: 'F150 XL Cab:' })).toEqual([xl]);
    expect(filterCars([xl, xlt], { ...defaultFilters, query: '"f-150 xl" regular' })).toEqual([xl]);
    expect(filterCars([xl], { ...defaultFilters, query: '"xl f150"' })).toEqual([]);
  });
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
    expect(filterCars([unknown], { ...defaultFilters, budget: 50000 })).toEqual([]);
    expect(filterCars([unknown], defaultFilters)).toEqual([unknown]);
  });
  it('keeps an all-inclusive published quote separate from base MSRP scoring and budgets', () => {
    const car = structuredClone(first);
    car.facts.msrpCad = { value: null, source: null, note: 'No comparable base MSRP.' };
    car.publishedPrice = {
      value: 40000,
      currency: 'CAD',
      basis: 'all-inclusive-before-sales-tax',
      province: 'AB',
      source: car.sourceIds[0]!,
      note: 'Regional published quote with a different price basis.',
    };
    expect(scoreCar(car, onlyPrice).score).toBeNull();
    expect(filterCars([car], { ...defaultFilters, budget: 50000 })).toEqual([]);
    expect(filterCars([car], defaultFilters)).toEqual([car]);
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

describe('full-market filtering and energy calculations', () => {
  it('scores EVs with sourced energy consumption and keeps missing spatial priorities explicit', () => {
    const ev = structuredClone(catalog.cars.find((car) => car.fuel === 'Electric')!);
    ev.facts.msrpCad = { value: 45000, source: ev.sourceIds[0]! };
    ev.facts.electricCombinedKwh100km = { value: 20, source: ev.sourceIds[0]! };
    ev.facts.cargoSeatsUpL = {
      value: null,
      source: null,
      note: 'This fixture has no cargo measurement.',
    };
    expect(energyCostPer100km(ev)).toBe(3);
    expect(scoreCar(ev, defaultWeights).score).toBe(69);
    expect(scoreCar(ev, { ...defaultWeights, cargo: 2 }).score).toBeNull();
    expect(scoreCar(ev, defaultWeights, { ...defaultEnergy, fuelPrice: NaN }).score).toBe(69);
    expect(
      scoreCar(ev, defaultWeights, { ...defaultEnergy, electricityPrice: NaN }).score,
    ).toBeNull();
  });
  it('changes energy scores with energy prices but not annual distance', () => {
    expect(scoreCar(first, defaultWeights, { ...defaultEnergy, kilometres: 0 }).score).toBe(
      scoreCar(first, defaultWeights).score,
    );
    expect(scoreCar(first, defaultWeights, { ...defaultEnergy, fuelPrice: 3 }).score).toBeLessThan(
      scoreCar(first, defaultWeights).score!,
    );
  });
  it('filters body styles and verified seating without requiring a rating join', () => {
    const suv = { ...structuredClone(first), bodyStyle: 'SUV' as const };
    delete suv.governmentRating;
    expect(
      filterCars([suv], { ...defaultFilters, bodyStyle: 'SUV', minSeats: 5, pricedOnly: true }),
    ).toEqual([suv]);
    suv.facts.seats.value = null;
    expect(filterCars([suv], { ...defaultFilters, minSeats: 5 })).toEqual([]);
    expect(vehicleBodyStyle({ ...suv, bodyStyle: 'Not verified' })).toBe('Not verified');
    const rating = catalog.cars.find(
      (car) =>
        car.governmentRating?.vehicleClass === 'Sport utility vehicle: Small' &&
        car.recordKind === 'government-rating',
    )!;
    expect(vehicleBodyStyle(rating)).toBe('SUV');
  });
  it('keeps year-unverified manufacturer offers visible without assigning them a model year', () => {
    const offer = {
      ...structuredClone(first),
      id: 'fixture-current-offer',
      recordKind: 'manufacturer-offer' as const,
      year: null,
      modelYearNote: 'Current pricing does not identify the model year.',
    };
    const mixed = [...cars, offer];
    expect(modelYearLabel(offer)).toBe('Year not verified');
    expect(fullName(offer)).toContain('Year not verified');
    expect(fullName(offer)).not.toContain('null');
    expect(filterCars(mixed, defaultFilters)).toHaveLength(mixed.length);
    expect(filterCars(mixed, { ...defaultFilters, year: 'unverified' })).toEqual([offer]);
    expect(filterCars(mixed, { ...defaultFilters, recordKind: 'manufacturer-offer' })).toEqual([
      offer,
    ]);
    expect(filterCars(mixed, { ...defaultFilters, year: '2026' })).not.toContain(offer);
    expect(filterCars(mixed, { ...defaultFilters, recordKind: 'retail-trim' })).not.toContain(
      offer,
    );
    expect(
      parseSharedState(
        serializeSharedState({ compare: [offer.id], weights: defaultWeights }),
        mixed,
      ).compare,
    ).toEqual([offer.id]);
  });
  it('includes every record without a hidden budget cap and can filter makes, years and record types', () => {
    expect(filterCars(catalog.cars, defaultFilters)).toHaveLength(catalog.cars.length);
    const selected = filterCars(catalog.cars, {
      ...defaultFilters,
      make: 'Tesla',
      year: '2027',
      fuel: 'Electric',
      recordKind: 'government-rating',
    });
    expect(selected.length).toBeGreaterThan(0);
    expect(
      selected.every((car) => car.make === 'Tesla' && car.year === 2027 && car.fuel === 'Electric'),
    ).toBe(true);
    expect(filterCars(catalog.cars, { ...defaultFilters, recordKind: 'retail-trim' })).toHaveLength(
      retailCatalog.cars.length,
    );
  });
  it('does not turn missing EV gasoline consumption into a free gasoline estimate', () => {
    const ev = catalog.cars.find((car) => car.fuel === 'Electric')!;
    expect(annualFuelCost(ev, 15000, 1.6)).toBeNull();
    expect(ev.facts.fuelCombinedL100km.value).toBeNull();
    const example = structuredClone(ev);
    example.facts.electricCombinedKwh100km.value = 14.4;
    expect(annualEnergyCost(example, 15000, NaN, 0.15)).toBe(324);
    expect(annualEnergyCost(example, 15000, 1.6, NaN)).toBeNull();
  });
  it('includes fuel burned during a PHEV electric-mode share', () => {
    const example = structuredClone(catalog.cars.find((car) => car.fuel === 'Plug-in hybrid')!);
    example.facts.fuelCombinedL100km.value = 10;
    example.facts.electricCombinedKwh100km.value = 20;
    example.facts.electricModeFuelL100km.value = 2;
    expect(annualEnergyCost(example, 10000, 1.5, 0.2, 0.5)).toBe(1100);
    expect(annualEnergyCost(example, 10000, 1.5, 0.2, 0)).toBe(1500);
    expect(annualEnergyCost(example, 10000, 1.5, 0.2, 1)).toBe(700);
    example.facts.electricModeFuelL100km.value = null;
    expect(annualEnergyCost(example, 10000, 1.5, 0.2, 0.5)).toBeNull();
  });
  it('requires only the energy modes actually used by a plug-in scenario', () => {
    const car = structuredClone(catalog.cars.find((car) => car.fuel === 'Plug-in hybrid')!);
    car.facts.fuelCombinedL100km.value = 8;
    car.facts.electricCombinedKwh100km.value = null;
    car.facts.electricModeFuelL100km.value = null;
    expect(annualEnergyCost(car, 10000, 1.5, NaN, 0)).toBe(1200);
    expect(annualEnergyCost(car, 10000, 1.5, 0.2, 0.01)).toBeNull();
    car.facts.electricCombinedKwh100km.value = 20;
    car.facts.electricModeFuelL100km.value = 0;
    car.facts.fuelCombinedL100km.value = null;
    expect(annualEnergyCost(car, 10000, NaN, 0.2, 1)).toBe(400);
    expect(annualEnergyCost(car, 10000, 1.5, 0.2, 0.99)).toBeNull();
    car.facts.electricModeFuelL100km.value = 2;
    expect(annualEnergyCost(car, 10000, NaN, 0.2, 1)).toBeNull();
    expect(annualEnergyCost(car, 10000, 1.5, 0.2, 1)).toBe(700);
    expect(annualEnergyCost(car, 10000, 1.5, 0.2, NaN)).toBeNull();
  });
});

describe('shared comparisons', () => {
  it('restores energy assumptions and ignores invalid or excessive inputs', () => {
    const state = {
      compare: [first.id],
      weights: defaultWeights,
      energy: { kilometres: 24000, fuelPrice: 1.9, electricityPrice: 0.23, electricFraction: 0.8 },
    };
    expect(parseSharedState(serializeSharedState(state), cars)).toEqual(state);
    expect(
      parseSharedState(
        '?fuelPrice=Infinity&electricityPrice=-1&kilometres=200001&electricFraction=2',
        cars,
      ).energy,
    ).toBeUndefined();
  });
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
