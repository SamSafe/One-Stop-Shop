import type { Car } from '@oss/car-catalog';
import { defaultFilters, serializeSharedState, vehicleBodyStyle } from './domain';
import type { Filters, SharedState } from './domain';

export const seatChoices = [2, 4, 5, 6, 7, 8];
export const horsepowerChoices = [150, 200, 250, 300, 400, 500];
export const legroomChoices = [900, 950, 1000, 1050];
export type SortOrder = 'fit' | 'price' | 'fuel';
export interface BrowsingState {
  filters: Filters;
  sort: SortOrder;
  scoredOnly: boolean;
  // Every configuration gets its own card instead of one card per model.
  allTrims: boolean;
  page: number;
}
export const initialBrowsingState = (): BrowsingState => ({
  filters: { ...defaultFilters },
  sort: 'fit',
  scoredOnly: false,
  allTrims: false,
  page: 1,
});
const filterParams = {
  query: 'q',
  budget: 'budget',
  make: 'make',
  model: 'model',
  year: 'year',
  vehicleClass: 'class',
  recordKind: 'kind',
  availability: 'availability',
  bodyStyle: 'body',
  minSeats: 'seats',
  minHorsepower: 'hp',
  minRearLegroom: 'legroom',
  pricedOnly: 'priced',
  includeUnverified: 'unverified',
  hideRuledOut: 'ruledout',
  fuel: 'powertrain',
  drivetrain: 'drive',
  savedOnly: 'saved',
} as const satisfies Record<keyof Filters, string>;

export function parseBrowsingState(search: string, cars: Car[]): BrowsingState {
  const params = new URLSearchParams(search.slice(0, 4096));
  const state = initialBrowsingState(),
    filters = state.filters;
  filters.query = (params.get('q') ?? '').slice(0, 100);
  const select = (key: keyof typeof filterParams, values: (string | undefined)[]) => {
    const value = params.get(filterParams[key]);
    return value !== null && values.includes(value) ? value : 'all';
  };
  filters.make = select(
    'make',
    cars.map((car) => car.make),
  );
  filters.year = select(
    'year',
    cars.map((car) => (car.year === null ? 'unverified' : String(car.year))),
  );
  const models = cars.filter(
    (car) =>
      car.make === filters.make &&
      (filters.year === 'all' ||
        (car.year === null ? 'unverified' : String(car.year)) === filters.year),
  );
  filters.model =
    filters.make === 'all'
      ? 'all'
      : select(
          'model',
          models.map((car) => car.model),
        );
  filters.fuel = select(
    'fuel',
    cars.map((car) => car.fuel),
  );
  filters.drivetrain = select(
    'drivetrain',
    cars.map((car) => car.drivetrain),
  );
  filters.recordKind = select(
    'recordKind',
    cars.map((car) => car.recordKind),
  );
  filters.availability = select(
    'availability',
    cars.map((car) => car.availability.status),
  );
  filters.vehicleClass = select(
    'vehicleClass',
    cars.map((car) => car.governmentRating?.vehicleClass),
  );
  filters.bodyStyle = select('bodyStyle', cars.map(vehicleBodyStyle));
  const budget = params.get('budget');
  if (budget && /^\d{1,8}$/.test(budget) && Number(budget) > 0 && Number(budget) <= 10000000)
    filters.budget = Number(budget);
  const seats = Number(params.get('seats'));
  if (seatChoices.includes(seats)) filters.minSeats = seats;
  const horsepower = Number(params.get('hp'));
  if (horsepowerChoices.includes(horsepower)) filters.minHorsepower = horsepower;
  const legroom = Number(params.get('legroom'));
  if (legroomChoices.includes(legroom)) filters.minRearLegroom = legroom;
  filters.pricedOnly = params.get('priced') === '1';
  filters.includeUnverified = params.get('unverified') === '1';
  filters.hideRuledOut = params.get('ruledout') === '1';
  filters.savedOnly = params.get('saved') === '1';
  state.scoredOnly = params.get('scored') === '1';
  state.allTrims = params.get('trims') === 'all';
  const sort = params.get('sort');
  if (sort === 'price' || sort === 'fuel') state.sort = sort;
  const page = params.get('page');
  if (page && /^\d{1,6}$/.test(page) && Number(page) > 0) state.page = Number(page);
  return state;
}

export function serializeViewState(shared: SharedState, browsing: BrowsingState): string {
  const params = new URLSearchParams(serializeSharedState(shared));
  for (const key of Object.keys(filterParams) as (keyof Filters)[]) {
    const value = browsing.filters[key];
    if (
      value !== undefined &&
      value !== null &&
      value !== false &&
      value !== '' &&
      value !== defaultFilters[key]
    )
      params.set(filterParams[key], value === true ? '1' : String(value));
  }
  if (browsing.sort !== 'fit') params.set('sort', browsing.sort);
  if (browsing.scoredOnly) params.set('scored', '1');
  if (browsing.allTrims) params.set('trims', 'all');
  if (Number.isInteger(browsing.page) && browsing.page > 1)
    params.set('page', String(browsing.page));
  const query = params.toString();
  return query ? `?${query}` : '';
}
