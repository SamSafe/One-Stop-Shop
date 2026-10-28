import type { Car } from '@oss/car-catalog';
import type { EnergySettings } from './domain';

export type FuelPriceKey = 'premiumPrice' | 'dieselPrice' | 'e85Price';
export function fuelTypeForPricing(car: Car): {
  label: string;
  key: FuelPriceKey | null;
} {
  switch (car.governmentRating?.fuelType) {
    case 'Regular gasoline':
      return { label: 'Regular gasoline', key: null };
    case 'Premium gasoline':
      return { label: 'Premium gasoline', key: 'premiumPrice' };
    case 'Diesel':
      return { label: 'Diesel', key: 'dieselPrice' };
    case 'Ethanol (E85)':
      return { label: 'E85', key: 'e85Price' };
  }
  if (!car.governmentRating && car.fuel === 'Diesel')
    return { label: 'Diesel', key: 'dieselPrice' };
  return { label: 'Fuel grade not verified', key: null };
}

export function fuelPriceFor(car: Car, energy: EnergySettings) {
  const type = fuelTypeForPricing(car);
  const override = type.key ? energy[type.key] : undefined;
  return {
    ...type,
    price: override ?? energy.fuelPrice,
    basis: override === undefined ? ('shared' as const) : ('specific' as const),
  };
}

export function energyInputsUsed(car: Car, electricFraction: number) {
  if (car.fuel === 'Electric') return { fuel: false, electricity: true, share: false };
  if (car.fuel === 'Hydrogen') return { fuel: false, electricity: false, share: false };
  if (car.fuel !== 'Plug-in hybrid') return { fuel: true, electricity: false, share: false };
  const validShare =
    Number.isFinite(electricFraction) && electricFraction >= 0 && electricFraction <= 1;
  return {
    fuel: !validShare || electricFraction < 1 || car.facts.electricModeFuelL100km.value !== 0,
    electricity: !validShare || electricFraction > 0,
    share: true,
  };
}

export type EnergyEstimate =
  | { available: false; reasons: string[] }
  | {
      available: true;
      fuelLitres: number;
      electricityKwh: number;
      fuelCost: number;
      electricityCost: number;
      total: number;
      usesFuel: boolean;
      usesElectricity: boolean;
      fuelPrice: ReturnType<typeof fuelPriceFor> | null;
    };

// Quantities and costs are per 100 km. Unused modes need no consumption or price.
export function estimateEnergy(car: Car, energy: EnergySettings): EnergyEstimate {
  if (car.fuel === 'Hydrogen')
    return { available: false, reasons: ['Hydrogen energy costs are not supported.'] };
  const used = energyInputsUsed(car, energy.electricFraction);
  const fuelPrice = fuelPriceFor(car, energy);
  if (
    used.share &&
    (!Number.isFinite(energy.electricFraction) ||
      energy.electricFraction < 0 ||
      energy.electricFraction > 1)
  )
    return { available: false, reasons: ['Enter an electric-mode share from 0% to 100%.'] };
  const reasons: string[] = [];
  let fuelLitres = 0,
    electricityKwh = 0;
  function consumption(value: number | null, share: number, label: string, zeroAllowed = false) {
    if (value === null || !Number.isFinite(value) || (zeroAllowed ? value < 0 : value <= 0)) {
      reasons.push(`${label} has not been verified.`);
      return 0;
    }
    return value * share;
  }
  if (car.fuel === 'Electric')
    electricityKwh = consumption(
      car.facts.electricCombinedKwh100km.value,
      1,
      'Electric consumption (kWh/100 km)',
    );
  else if (car.fuel === 'Plug-in hybrid') {
    if (energy.electricFraction < 1)
      fuelLitres += consumption(
        car.facts.fuelCombinedL100km.value,
        1 - energy.electricFraction,
        'Fuel-only combined consumption',
      );
    if (energy.electricFraction > 0) {
      electricityKwh = consumption(
        car.facts.electricCombinedKwh100km.value,
        energy.electricFraction,
        'Electric consumption (kWh/100 km)',
      );
      fuelLitres += consumption(
        car.facts.electricModeFuelL100km.value,
        energy.electricFraction,
        'Fuel consumption during plug-in electric operation',
        true,
      );
    }
  } else
    fuelLitres = consumption(car.facts.fuelCombinedL100km.value, 1, 'Combined fuel consumption');
  if (
    used.fuel &&
    (!Number.isFinite(fuelPrice.price) || fuelPrice.price < 0.01 || fuelPrice.price > 5)
  )
    reasons.push(
      fuelPrice.basis === 'specific'
        ? `Enter a ${fuelPrice.label.toLowerCase()} price from $0.01 to $5 per litre.`
        : 'Enter a fuel price from $0.01 to $5 per litre.',
    );
  if (
    used.electricity &&
    (!Number.isFinite(energy.electricityPrice) ||
      energy.electricityPrice < 0 ||
      energy.electricityPrice > 2)
  )
    reasons.push('Enter an electricity price from $0 to $2 per kWh.');
  if (reasons.length) return { available: false, reasons };
  const fuelCost = used.fuel ? fuelLitres * fuelPrice.price : 0,
    electricityCost = used.electricity ? electricityKwh * energy.electricityPrice : 0;
  return {
    available: true,
    fuelLitres,
    electricityKwh,
    fuelCost,
    electricityCost,
    total: fuelCost + electricityCost,
    usesFuel: used.fuel,
    usesElectricity: used.electricity,
    fuelPrice: used.fuel ? fuelPrice : null,
  };
}

export function annualEnergyEstimate(estimate: EnergyEstimate, kilometres: number) {
  const reasons = estimate.available ? [] : [...estimate.reasons];
  if (!Number.isFinite(kilometres) || kilometres < 0 || kilometres > 200000)
    reasons.push('Enter annual kilometres from 0 to 200,000.');
  return estimate.available && reasons.length === 0
    ? { cost: Math.round((kilometres / 100) * estimate.total), reasons }
    : { cost: null, reasons };
}
