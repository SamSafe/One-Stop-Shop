import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Car } from '@oss/car-catalog';
import { defaultFilters } from './domain';
import type { Filters } from './domain';
import { Icon, currency } from './catalogView';

type SetFilters = Dispatch<SetStateAction<Filters>>;

const quickViews: { label: string; filters: Partial<Filters> }[] = [
  { label: 'Priced retail vehicles', filters: { recordKind: 'retail-trim', pricedOnly: true } },
  { label: 'Electric vehicles', filters: { fuel: 'Electric' } },
  {
    label: 'Family SUVs',
    filters: { bodyStyle: 'SUV', minSeats: 5, recordKind: 'retail-trim', pricedOnly: true },
  },
];

export function DiscoveryShortcuts({
  onQuickView,
  onShareSearch,
}: {
  onQuickView: (filters: Filters) => void;
  onShareSearch: () => void;
}) {
  return (
    <div className="discovery-shortcuts" role="group" aria-label="Quick views">
      <span>Start with</span>
      {quickViews.map((view) => (
        <button
          key={view.label}
          type="button"
          className="text-button"
          onClick={() => onQuickView({ ...defaultFilters, ...view.filters })}
        >
          {view.label}
        </button>
      ))}
      <button type="button" className="text-button search-share" onClick={onShareSearch}>
        <Icon name="link" size={16} /> Copy search link
      </button>
    </div>
  );
}

export function PrimaryFilters({
  cars,
  makes,
  years,
  unverifiedYearCount,
  filters,
  setFilters,
  filtersOpen,
  onToggleFilters,
  onReset,
  briefActive,
}: {
  cars: Car[];
  makes: string[];
  years: number[];
  unverifiedYearCount: number;
  filters: Filters;
  setFilters: SetFilters;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onReset: () => void;
  briefActive: boolean;
}) {
  const models = useMemo(
    () =>
      [
        ...new Set(
          cars
            .filter(
              (c) =>
                (filters.make === 'all' || c.make === filters.make) &&
                (filters.year === 'all' ||
                  (c.year === null
                    ? filters.year === 'unverified'
                    : String(c.year) === filters.year)),
            )
            .map((c) => c.model),
        ),
      ].sort((a, b) => a.localeCompare(b, 'en-CA')),
    [cars, filters.make, filters.year],
  );
  return (
    <div className="catalog-primary-filters">
      <div className="catalog-field">
        <label className="field-label" htmlFor="year">
          Model year
        </label>
        <select
          id="year"
          value={filters.year}
          onChange={(event) => setFilters({ ...filters, year: event.target.value, model: 'all' })}
        >
          <option value="all">All model years</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
          {unverifiedYearCount > 0 && <option value="unverified">Year not verified</option>}
        </select>
      </div>
      <div className="catalog-field">
        <label className="field-label" htmlFor="make">
          Make
        </label>
        <select
          id="make"
          value={filters.make}
          onChange={(event) => setFilters({ ...filters, make: event.target.value, model: 'all' })}
        >
          <option value="all">All makes</option>
          {makes.map((make) => (
            <option key={make} value={make}>
              {make}
            </option>
          ))}
        </select>
      </div>
      <div className="catalog-field">
        <label className="field-label" htmlFor="model">
          Model
        </label>
        <select
          id="model"
          disabled={filters.make === 'all'}
          value={filters.model ?? 'all'}
          onChange={(e) => setFilters({ ...filters, model: e.target.value })}
        >
          <option value="all">
            {filters.make === 'all' ? 'Choose a make first' : 'All models'}
          </option>
          {filters.make !== 'all' &&
            models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
        </select>
      </div>
      <button
        className="filter-toggle button secondary"
        type="button"
        aria-expanded={filtersOpen}
        aria-controls="vehicle-filters"
        onClick={onToggleFilters}
      >
        <Icon name="sliders" size={17} />
        {filtersOpen ? 'Hide filters' : 'Filters & priorities'}
      </button>
      <button type="button" className="text-button filter-reset" onClick={onReset}>
        {briefActive ? 'Reset catalog' : 'Reset'}
      </button>
    </div>
  );
}

const filterLabels: Record<string, string> = {
  query: 'Search',
  budget: 'Max MSRP',
  make: 'Make',
  model: 'Model',
  year: 'Year',
  vehicleClass: 'NRCan class',
  recordKind: 'Record type',
  availability: 'Availability',
  fuel: 'Powertrain',
  drivetrain: 'Drivetrain',
  bodyStyle: 'Body style',
  minSeats: 'Minimum seats',
  pricedOnly: 'Verified base price',
  savedOnly: 'Shortlist',
};

export function ActiveFilters({
  filters,
  setFilters,
  scoredOnly,
  onClearScoredOnly,
}: {
  filters: Filters;
  setFilters: SetFilters;
  scoredOnly: boolean;
  onClearScoredOnly: () => void;
}) {
  return (
    <div className="active-filters" role="group" aria-label="Active filters">
      {Object.entries(filters)
        .filter(
          ([key, value]) =>
            value !== defaultFilters[key as keyof Filters] &&
            value !== undefined &&
            value !== null &&
            value !== false &&
            value !== '',
        )
        .map(([key, value]) => {
          const label = `${filterLabels[key]}${value === true ? '' : `: ${key === 'budget' ? currency.format(Number(value)) : String(value).replaceAll('-', ' ')}`}`;
          return (
            <button
              type="button"
              key={key}
              className="filter-chip"
              aria-label={`Remove ${label} filter`}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  [key]: defaultFilters[key as keyof Filters],
                  ...(key === 'make' || key === 'year' ? { model: 'all' } : {}),
                }))
              }
            >
              {label} ×
            </button>
          );
        })}
      {scoredOnly && (
        <button type="button" className="filter-chip" onClick={onClearScoredOnly}>
          Has a fit score ×
        </button>
      )}
    </div>
  );
}
