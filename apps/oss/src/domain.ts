import type { Car, Metric } from '@oss/car-catalog';

export const priorityDefinitions = {
  price: {
    label: 'Purchase price',
    metric: 'msrpCad',
    min: 30000,
    max: 60000,
    lowerIsBetter: true,
  },
  efficiency: {
    label: 'Fuel economy',
    metric: 'fuelCombinedL100km',
    min: 4,
    max: 12,
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
export const defaultWeights: Weights = { price: 3, efficiency: 3, cargo: 2, room: 2 };
export const priorityKeys = Object.keys(priorityDefinitions) as Priority[];
export const fullName = (car: Car) =>
  car.recordKind === 'government-rating'
    ? `${car.year} ${car.make} ${car.model} · ${car.governmentRating?.engineLitres ? `${car.governmentRating.engineLitres} L · ` : ''}${car.governmentRating?.transmission} · NRCan ${car.governmentRating?.recordId}`
    : `${car.year} ${car.make} ${car.model} ${car.trim} ${car.drivetrain}`;

export interface Filters {
  query: string;
  budget: number | null;
  make?: string;
  year?: string;
  vehicleClass?: string;
  recordKind?: string;
  fuel: string;
  drivetrain: string;
  savedOnly: boolean;
}
export const defaultFilters: Filters = {
  query: '',
  budget: null,
  make: 'all',
  year: 'all',
  vehicleClass: 'all',
  recordKind: 'all',
  fuel: 'all',
  drivetrain: 'all',
  savedOnly: false,
};

export function filterCars(cars: Car[], filters: Filters, savedIds: string[] = []): Car[] {
  const query = filters.query.trim().toLocaleLowerCase('en-CA');
  return cars.filter(
    (car) =>
      (!query || fullName(car).toLocaleLowerCase('en-CA').includes(query)) &&
      (filters.budget === null ||
        (car.facts.msrpCad.value !== null && car.facts.msrpCad.value <= filters.budget)) &&
      (!filters.make || filters.make === 'all' || car.make === filters.make) &&
      (!filters.year || filters.year === 'all' || String(car.year) === filters.year) &&
      (!filters.vehicleClass ||
        filters.vehicleClass === 'all' ||
        car.governmentRating?.vehicleClass === filters.vehicleClass) &&
      (!filters.recordKind ||
        filters.recordKind === 'all' ||
        car.recordKind === filters.recordKind) &&
      (filters.fuel === 'all' || car.fuel === filters.fuel) &&
      (filters.drivetrain === 'all' || car.drivetrain === filters.drivetrain) &&
      (!filters.savedOnly || savedIds.includes(car.id)),
  );
}

export function scoreCar(car: Car, weights: Weights) {
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
    const value = car.facts[definition.metric].value;
    if (value === null)
      return {
        score: null,
        contributions: [],
        reason: `Missing ${definition.label.toLowerCase()} data.`,
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

export function rankCars(cars: Car[], weights: Weights) {
  return cars
    .map((car) => ({ car, ...scoreCar(car, weights) }))
    .sort(
      (a, b) =>
        (b.score ?? -1) - (a.score ?? -1) ||
        (a.car.facts.msrpCad.value ?? Infinity) - (b.car.facts.msrpCad.value ?? Infinity) ||
        a.car.id.localeCompare(b.car.id, 'en-CA'),
    );
}

export function annualFuelCost(car: Car, kilometres: number, cadPerLitre: number): number | null {
  const consumption = car.facts.fuelCombinedL100km.value;
  if (
    car.fuel === 'Electric' ||
    car.fuel === 'Plug-in hybrid' ||
    car.fuel === 'Hydrogen' ||
    consumption === null ||
    consumption <= 0 ||
    !Number.isFinite(kilometres) ||
    kilometres < 0 ||
    kilometres > 200000 ||
    !Number.isFinite(cadPerLitre) ||
    cadPerLitre <= 0 ||
    cadPerLitre > 5
  )
    return null;
  return Math.round((kilometres / 100) * consumption * cadPerLitre);
}

export function annualEnergyCost(
  car: Car,
  kilometres: number,
  fuelPrice: number,
  electricityPrice: number,
  electricFraction = 0.5,
): number | null {
  if (!Number.isFinite(kilometres) || kilometres < 0 || kilometres > 200000) return null;
  if (car.fuel !== 'Electric' && car.fuel !== 'Plug-in hybrid')
    return annualFuelCost(car, kilometres, fuelPrice);
  if (!Number.isFinite(electricityPrice) || electricityPrice < 0 || electricityPrice > 2)
    return null;
  const kwh = car.facts.electricCombinedKwh100km.value;
  if (kwh === null) return null;
  if (car.fuel === 'Electric') return Math.round((kilometres / 100) * kwh * electricityPrice);
  if (
    !Number.isFinite(electricFraction) ||
    electricFraction < 0 ||
    electricFraction > 1 ||
    !Number.isFinite(fuelPrice) ||
    fuelPrice <= 0 ||
    fuelPrice > 5
  )
    return null;
  const fuel = car.facts.fuelCombinedL100km.value;
  const electricModeFuel = car.facts.electricModeFuelL100km.value;
  if (fuel === null || electricModeFuel === null) return null;
  return Math.round(
    (kilometres / 100) *
      ((1 - electricFraction) * fuel * fuelPrice +
        electricFraction * (kwh * electricityPrice + electricModeFuel * fuelPrice)),
  );
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
}
export function parseSharedState(search: string, cars: Car[]): SharedState {
  const params = new URLSearchParams(search.slice(0, 4096));
  const weights = { ...defaultWeights };
  for (const key of priorityKeys) {
    const raw = params.get(key);
    if (raw !== null && /^[0-5]$/.test(raw)) weights[key] = Number(raw);
  }
  return { compare: knownIds(params.get('compare')?.split(','), cars, 4), weights };
}

export function serializeSharedState(state: SharedState): string {
  const params = new URLSearchParams();
  if (state.compare.length) params.set('compare', state.compare.join(','));
  for (const key of priorityKeys)
    if (state.weights[key] !== defaultWeights[key]) params.set(key, String(state.weights[key]));
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
