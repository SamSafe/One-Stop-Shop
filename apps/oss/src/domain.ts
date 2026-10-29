import type { Car, Metric } from '@oss/car-catalog';
import { estimateEnergy, annualEnergyEstimate } from './energy';
import { nonApplicableReason } from './specifications';
import { scoreBuyingBrief } from './buying';
import type { BuyingBrief } from './buying';
import { vehicleBodyStyle } from './vehicleBodyStyle';
export { vehicleBodyStyle } from './vehicleBodyStyle';

export const priorityDefinitions = {
  price: {
    label: 'Purchase price',
    metric: 'msrpCad',
    min: 30000,
    max: 60000,
    lowerIsBetter: true,
  },
  efficiency: {
    label: 'Energy cost',
    metric: 'fuelCombinedL100km',
    min: 0,
    max: 24,
    lowerIsBetter: true,
  },
  cargo: {
    label: 'Cargo space',
    metric: 'cargoSeatsUpL',
    min: 500,
    max: 1200,
    lowerIsBetter: false,
  },
  room: {
    label: 'Rear legroom',
    metric: 'rearLegroomMm',
    min: 850,
    max: 1150,
    lowerIsBetter: false,
  },
} as const satisfies Record<
  string,
  { label: string; metric: Metric; min: number; max: number; lowerIsBetter: boolean }
>;
export type Priority = keyof typeof priorityDefinitions;
export type Weights = Record<Priority, number>;
export const defaultWeights: Weights = { price: 3, efficiency: 3, cargo: 0, room: 0 };
export interface EnergySettings {
  kilometres: number;
  fuelPrice: number;
  electricityPrice: number;
  electricFraction: number;
  premiumPrice?: number;
  dieselPrice?: number;
  e85Price?: number;
}
export const defaultEnergy = {
  kilometres: 15000,
  fuelPrice: 1.6,
  electricityPrice: 0.15,
  electricFraction: 0.5,
} satisfies EnergySettings;
export const priorityPresets: { label: string; weights: Weights }[] = [
  { label: 'Price & energy', weights: defaultWeights },
  { label: 'Family space', weights: { price: 3, efficiency: 2, cargo: 3, room: 3 } },
  { label: 'Price only', weights: { price: 5, efficiency: 0, cargo: 0, room: 0 } },
];
export const priorityKeys = Object.keys(priorityDefinitions) as Priority[];
export const modelYearLabel = (car: Pick<Car, 'year'>) =>
  car.year === null ? 'Year not verified' : String(car.year);
export const configurationLabel = (car: Car) =>
  car.recordKind === 'government-rating'
    ? `${car.governmentRating?.engineLitres ? `${car.governmentRating.engineLitres} L · ` : ''}${car.governmentRating?.transmission} · NRCan ${car.governmentRating?.recordId}`
    : `${car.trim}${car.variant ? ` ${car.variant}` : ''}${car.drivetrain !== 'Not verified' && !car.trim.split(/\s+/).includes(car.drivetrain) ? ` ${car.drivetrain}` : ''}`;
export const fullName = (car: Car) =>
  `${modelYearLabel(car)} ${car.make} ${car.model}${car.recordKind === 'government-rating' ? ' · ' : ' '}${configurationLabel(car)}`;

export interface Filters {
  query: string;
  budget: number | null;
  make?: string;
  model?: string;
  year?: string;
  vehicleClass?: string;
  recordKind?: string;
  availability?: string;
  bodyStyle?: string;
  minSeats?: number | null;
  pricedOnly?: boolean;
  fuel: string;
  drivetrain: string;
  savedOnly: boolean;
}
export const defaultFilters: Filters = {
  query: '',
  budget: null,
  make: 'all',
  model: 'all',
  year: 'all',
  vehicleClass: 'all',
  recordKind: 'all',
  availability: 'all',
  fuel: 'all',
  drivetrain: 'all',
  savedOnly: false,
  bodyStyle: 'all',
  minSeats: null,
  pricedOnly: false,
};

export function hasMatchingSpecification(cars: Car[], metric: Metric): boolean {
  if (cars.length < 2) return false;
  const applicability = cars.map((car) => nonApplicableReason(car, metric));
  if (applicability.some(Boolean))
    return applicability.every((reason) => reason === applicability[0]);
  const first = cars[0]!.facts[metric];
  return (
    first.value !== null &&
    cars.every(
      (car) =>
        car.facts[metric].value === first.value &&
        car.facts[metric].qualifier === first.qualifier &&
        (car.facts[metric].note ?? '') === (first.note ?? ''),
    )
  );
}

export type SummaryMetric = 'msrpCad' | 'seats' | 'cargoSeatsUpL' | 'rearLegroomMm';
export function specificationDifference(reference: Car, other: Car, metric: SummaryMetric) {
  const a = reference.facts[metric],
    b = other.facts[metric];
  const values = { referenceValue: a.value, value: b.value };
  if (a.value === null || b.value === null)
    return {
      ...values,
      kind: 'unknown' as const,
      delta: null,
      reason: 'Not verified for both vehicles',
    };
  if (
    metric === 'cargoSeatsUpL' &&
    (reference.facts.seats.value === null ||
      other.facts.seats.value === null ||
      reference.facts.seats.value !== other.facts.seats.value)
  )
    return {
      ...values,
      kind: 'context' as const,
      delta: null,
      reason: 'Seating layouts differ or are unverified',
    };
  if (metric !== 'msrpCad' && metric !== 'seats' && (a.note ?? '') !== (b.note ?? ''))
    return {
      ...values,
      kind: 'context' as const,
      delta: null,
      reason: 'Measurement or qualification notes differ',
    };
  const delta = b.value - a.value;
  return {
    ...values,
    kind: delta === 0 ? ('same' as const) : ('different' as const),
    delta,
    reason: null,
  };
}

const searchWords = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en-CA')
    .replace(/[-‐‑‒–—−'’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export function filterCars(cars: Car[], filters: Filters, savedIds: string[] = []): Car[] {
  const phrases: string[] = [];
  const query = searchWords(
    filters.query.replace(/"([^"]*)"/g, (_match, phrase: string) => {
      const normalized = searchWords(phrase).join(' ');
      if (normalized) phrases.push(normalized);
      return ' ';
    }),
  );
  const partialLast = !/[\s"]$/.test(filters.query);
  const matches = (car: Car) => {
    const words = searchWords(
      `${fullName(car)} ${car.fuel} ${car.drivetrain} ${vehicleBodyStyle(car)}`,
    );
    const text = ` ${words.join(' ')} `;
    return (
      phrases.every((phrase) => text.includes(` ${phrase} `)) &&
      query.every((term, index) =>
        words.some(
          (word) =>
            (word === term ||
              (partialLast && index === query.length - 1 && word.startsWith(term))) &&
            // CX-5 and CX-50 (or X5 and X50) are different model identities.
            !(/[\p{L}].*\d$/u.test(term) && /^\d/.test(word.slice(term.length))),
        ),
      )
    );
  };
  return cars.filter(
    (car) =>
      ((!query.length && !phrases.length) || matches(car)) &&
      (filters.budget === null ||
        (car.facts.msrpCad.value !== null && car.facts.msrpCad.value <= filters.budget)) &&
      (!filters.pricedOnly || car.facts.msrpCad.value !== null) &&
      (!filters.minSeats ||
        (car.facts.seats.value !== null && car.facts.seats.value >= filters.minSeats)) &&
      (!filters.bodyStyle ||
        filters.bodyStyle === 'all' ||
        vehicleBodyStyle(car) === filters.bodyStyle) &&
      (!filters.make || filters.make === 'all' || car.make === filters.make) &&
      (!filters.model || filters.model === 'all' || car.model === filters.model) &&
      (!filters.year ||
        filters.year === 'all' ||
        (car.year === null ? filters.year === 'unverified' : String(car.year) === filters.year)) &&
      (!filters.vehicleClass ||
        filters.vehicleClass === 'all' ||
        car.governmentRating?.vehicleClass === filters.vehicleClass) &&
      (!filters.recordKind ||
        filters.recordKind === 'all' ||
        car.recordKind === filters.recordKind) &&
      (filters.fuel === 'all' || car.fuel === filters.fuel) &&
      (!filters.availability ||
        filters.availability === 'all' ||
        car.availability.status === filters.availability) &&
      (filters.drivetrain === 'all' || car.drivetrain === filters.drivetrain) &&
      (!filters.savedOnly || savedIds.includes(car.id)),
  );
}

export function energyCostPer100km(
  car: Car,
  energy: EnergySettings = defaultEnergy,
): number | null {
  const estimate = estimateEnergy(car, energy);
  return estimate.available ? Math.round(estimate.total * 100) / 100 : null;
}

export function scoreCar(
  car: Car,
  weights: Weights,
  energy: EnergySettings = defaultEnergy,
  brief?: BuyingBrief | null,
) {
  if (brief?.enabled) return scoreBuyingBrief(car, brief, energy);
  const contributions: { priority: Priority; value: number; weight: number; points: number }[] = [];
  let totalWeight = 0;
  for (const key of priorityKeys) {
    const weight = weights[key];
    if (!Number.isInteger(weight) || weight < 0 || weight > 5)
      throw new Error(`Invalid weight: ${key}`);
    totalWeight += weight;
  }
  if (totalWeight === 0)
    return { score: null, contributions, reason: 'Choose at least one priority.' };
  for (const key of priorityKeys) {
    const weight = weights[key];
    if (weight === 0) continue;
    const definition = priorityDefinitions[key];
    const value =
      key === 'efficiency' ? energyCostPer100km(car, energy) : car.facts[definition.metric].value;
    if (value === null)
      return {
        score: null,
        contributions: [],
        reason:
          key === 'efficiency'
            ? 'Energy estimate unavailable: check published consumption and energy inputs.'
            : `Missing ${definition.label.toLowerCase()} data.`,
      };
    const normalized = Math.max(
      0,
      Math.min(1, (value - definition.min) / (definition.max - definition.min)),
    );
    const points =
      (((definition.lowerIsBetter ? 1 - normalized : normalized) * weight) / totalWeight) * 100;
    contributions.push({ priority: key, value, weight, points });
  }
  return {
    score: Math.round(contributions.reduce((sum, item) => sum + item.points, 0)),
    contributions,
    reason: null,
  };
}

export function rankCars(
  cars: Car[],
  weights: Weights,
  energy: EnergySettings = defaultEnergy,
  brief?: BuyingBrief | null,
) {
  return cars
    .map((car) => ({ car, ...scoreCar(car, weights, energy, brief) }))
    .sort(
      (a, b) =>
        (b.score ?? -1) - (a.score ?? -1) ||
        (a.car.facts.msrpCad.value ?? Infinity) - (b.car.facts.msrpCad.value ?? Infinity) ||
        a.car.id.localeCompare(b.car.id, 'en-CA'),
    );
}

export function annualFuelCost(car: Car, kilometres: number, cadPerLitre: number): number | null {
  if (['Electric', 'Plug-in hybrid', 'Hydrogen'].includes(car.fuel)) return null;
  return annualEnergyCost(car, kilometres, cadPerLitre, NaN);
}

export function annualEnergyCost(
  car: Car,
  kilometres: number,
  fuelPrice: number,
  electricityPrice: number,
  electricFraction = 0.5,
): number | null {
  return annualEnergyEstimate(
    estimateEnergy(car, { kilometres, fuelPrice, electricityPrice, electricFraction }),
    kilometres,
  ).cost;
}

export function knownIds(ids: unknown, cars: Car[], limit: number): string[] {
  if (!Array.isArray(ids)) return [];
  const known = new Set(cars.map((car) => car.id));
  return [
    ...new Set(ids.filter((id): id is string => typeof id === 'string' && known.has(id))),
  ].slice(0, limit);
}

export interface SharedState {
  compare: string[];
  weights: Weights;
  reference?: string;
  energy?: EnergySettings;
}
const energyLimits = {
  kilometres: [0, 200000],
  fuelPrice: [0.01, 5],
  electricityPrice: [0, 2],
  electricFraction: [0, 1],
} satisfies Record<keyof typeof defaultEnergy, [number, number]>;
const fuelPriceKeys = ['premiumPrice', 'dieselPrice', 'e85Price'] as const;
export function readSharedEnergy(search: string): EnergySettings {
  const params = new URLSearchParams(search.slice(0, 4096));
  const energy: EnergySettings = { ...defaultEnergy };
  for (const key of Object.keys(energyLimits) as (keyof typeof energyLimits)[]) {
    const raw = params.get(key),
      [min, max] = energyLimits[key];
    if (raw !== null && /^\d+(?:\.\d+)?$/.test(raw) && Number(raw) >= min && Number(raw) <= max)
      energy[key] = Number(raw);
  }
  for (const key of fuelPriceKeys) {
    const raw = params.get(key);
    if (raw !== null && /^\d+(?:\.\d+)?$/.test(raw) && Number(raw) >= 0.01 && Number(raw) <= 5)
      energy[key] = Number(raw);
  }
  return energy;
}
export function parseSharedState(search: string, cars: Car[]): SharedState {
  const params = new URLSearchParams(search.slice(0, 4096));
  const weights = { ...defaultWeights };
  for (const key of priorityKeys) {
    const raw = params.get(key);
    if (raw !== null && /^[0-5]$/.test(raw)) weights[key] = Number(raw);
  }
  const compare = knownIds(params.get('compare')?.split(','), cars, 4);
  const reference = params.get('reference');
  const energy = readSharedEnergy(search);
  return {
    compare,
    weights,
    ...(reference && compare.includes(reference) && reference !== compare[0] ? { reference } : {}),
    ...(Object.keys(energyLimits).some(
      (key) =>
        energy[key as keyof typeof energyLimits] !==
        defaultEnergy[key as keyof typeof energyLimits],
    ) || fuelPriceKeys.some((key) => energy[key] !== undefined)
      ? { energy }
      : {}),
  };
}

export function serializeSharedState(state: SharedState): string {
  const params = new URLSearchParams();
  if (state.compare.length) params.set('compare', state.compare.join(','));
  if (
    state.reference &&
    state.compare.includes(state.reference) &&
    state.reference !== state.compare[0]
  )
    params.set('reference', state.reference);
  for (const key of priorityKeys)
    if (state.weights[key] !== defaultWeights[key]) params.set(key, String(state.weights[key]));
  if (state.energy)
    for (const key of Object.keys(energyLimits) as (keyof typeof energyLimits)[])
      if (
        Number.isFinite(state.energy[key]) &&
        state.energy[key] >= energyLimits[key][0] &&
        state.energy[key] <= energyLimits[key][1] &&
        state.energy[key] !== defaultEnergy[key]
      )
        params.set(key, String(state.energy[key]));
  if (state.energy)
    for (const key of fuelPriceKeys) {
      const value = state.energy[key];
      if (value !== undefined && Number.isFinite(value) && value >= 0.01 && value <= 5)
        params.set(key, String(value));
    }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const storageKey = 'oss-shortlist-v1';
export function loadShortlist(
  storage: Pick<Storage, 'getItem'>,
  cars: Car[],
): { ids: string[]; warning: string | null; canPersist: boolean } {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return { ids: [], warning: null, canPersist: true };
    const data: unknown = JSON.parse(raw);
    if (
      typeof data !== 'object' ||
      data === null ||
      !('version' in data) ||
      data.version !== 1 ||
      !('ids' in data) ||
      !Array.isArray(data.ids)
    ) {
      return {
        ids: [],
        warning:
          'Your saved shortlist uses an unreadable format. Changes will only last for this visit. Clear your shortlist to start a new one.',
        canPersist: false,
      };
    }
    return { ids: knownIds(data.ids, cars, cars.length), warning: null, canPersist: true };
  } catch {
    return {
      ids: [],
      warning:
        'Device storage is unavailable or unreadable. Your shortlist will work for this visit.',
      canPersist: false,
    };
  }
}

export function saveShortlist(storage: Pick<Storage, 'setItem'>, ids: string[]): boolean {
  try {
    storage.setItem(storageKey, JSON.stringify({ version: 1, ids }));
    return true;
  } catch {
    return false;
  }
}
