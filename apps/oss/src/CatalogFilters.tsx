import type { Dispatch, SetStateAction } from 'react';
import { catalog, governmentRatingCount } from '@oss/car-catalog';
import { priorityDefinitions, priorityKeys, priorityPresets, vehicleBodyStyle } from './domain';
import type { Filters, Weights } from './domain';
import { currency } from './catalogView';
import { horsepowerChoices, legroomChoices, seatChoices } from './browsing';
import { EnergyInputs } from './EnergyInputs';
import type { EnergyInputs as Inputs } from './useEnergySettings';
const fuels = [...new Set(catalog.cars.map((car) => car.fuel))].sort();
const bodyStyles = [...new Set(catalog.cars.map(vehicleBodyStyle))].sort();
const vehicleClasses = [
  ...new Set(
    catalog.cars.flatMap((car) =>
      car.governmentRating ? [car.governmentRating.vehicleClass] : [],
    ),
  ),
].sort();
export function CatalogFilters({
  filtersOpen,
  filters,
  setFilters,
  weights,
  setWeights,
  scoredOnly,
  setScoredOnly,
  savedIds,
  ruledOutCount,
  energyInputs,
  onEnergyInput,
}: {
  filtersOpen: boolean;
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  weights: Weights;
  setWeights: Dispatch<SetStateAction<Weights>>;
  scoredOnly: boolean;
  setScoredOnly: (value: boolean) => void;
  savedIds: string[];
  // Vehicles whose latest test-drive verdict is "ruled out".
  ruledOutCount: number;
  energyInputs: Inputs;
  onEnergyInput: (key: keyof Inputs, value: string) => void;
}) {
  return (
    <aside
      id="vehicle-filters"
      className={`filters ${filtersOpen ? 'is-open' : ''}`}
      aria-label="Filters and priorities"
    >
      <div className="advanced-filters">
        <div className="catalog-field">
          <label className="field-label" htmlFor="budget">
            Max base MSRP
          </label>
          <select
            id="budget"
            value={filters.budget ?? 'all'}
            onChange={(event) =>
              setFilters({
                ...filters,
                budget: event.target.value === 'all' ? null : Number(event.target.value),
              })
            }
          >
            <option value="all">Any price, including unverified</option>
            {filters.budget !== null &&
              ![25000, 35000, 50000, 75000, 100000, 150000, 250000, 500000, 1000000].includes(
                filters.budget,
              ) && (
                <option value={filters.budget}>
                  {currency.format(filters.budget)} · custom limit
                </option>
              )}
            {[25000, 35000, 50000, 75000, 100000, 150000, 250000, 500000, 1000000].map((value) => (
              <option key={value} value={value}>
                {currency.format(value)}
              </option>
            ))}
          </select>
          <p className="field-hint">
            Limits use verified CAD base MSRP. Unknown prices are not treated as free.
          </p>
        </div>
        <div className="catalog-field">
          <label className="field-label" htmlFor="body-style">
            Body style
          </label>
          <select
            id="body-style"
            value={filters.bodyStyle}
            onChange={(event) => setFilters({ ...filters, bodyStyle: event.target.value })}
          >
            <option value="all">Any body style</option>
            {bodyStyles.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
          <p className="field-hint">
            Manufacturer body styles and broad government categories. Unverified styles are listed
            separately.
          </p>
        </div>
        <div className="catalog-field">
          <label className="field-label" htmlFor="min-seats">
            Minimum seats
          </label>
          <select
            id="min-seats"
            value={filters.minSeats ?? 'all'}
            onChange={(event) =>
              setFilters({
                ...filters,
                minSeats: event.target.value === 'all' ? null : Number(event.target.value),
              })
            }
          >
            <option value="all">Any seating capacity</option>
            {seatChoices.map((seats) => (
              <option key={seats} value={seats}>
                {seats}+ seats
              </option>
            ))}
          </select>
        </div>
        <div className="catalog-field">
          <label className="field-label" htmlFor="min-horsepower">
            Minimum horsepower
          </label>
          <select
            id="min-horsepower"
            value={filters.minHorsepower ?? 'all'}
            onChange={(event) =>
              setFilters({
                ...filters,
                minHorsepower: event.target.value === 'all' ? null : Number(event.target.value),
              })
            }
          >
            <option value="all">Any output</option>
            {horsepowerChoices.map((hp) => (
              <option key={hp} value={hp}>
                {hp}+ hp
              </option>
            ))}
          </select>
        </div>
        <div className="catalog-field">
          <label className="field-label" htmlFor="min-legroom">
            Minimum rear legroom
          </label>
          <select
            id="min-legroom"
            value={filters.minRearLegroom ?? 'all'}
            onChange={(event) =>
              setFilters({
                ...filters,
                minRearLegroom: event.target.value === 'all' ? null : Number(event.target.value),
              })
            }
          >
            <option value="all">Any legroom</option>
            {legroomChoices.map((mm) => (
              <option key={mm} value={mm}>
                {mm.toLocaleString('en-CA')}+ mm
              </option>
            ))}
          </select>
        </div>
        <div className="catalog-field">
          <label className="field-label" htmlFor="fuel">
            Powertrain
          </label>
          <select
            id="fuel"
            value={filters.fuel}
            onChange={(event) => setFilters({ ...filters, fuel: event.target.value })}
          >
            <option value="all">Any powertrain</option>
            {fuels.map((fuel) => (
              <option key={fuel} value={fuel}>
                {fuel}
              </option>
            ))}
          </select>
        </div>
        <div className="catalog-field">
          <label className="field-label" htmlFor="drive">
            Drivetrain
          </label>
          <select
            id="drive"
            value={filters.drivetrain}
            onChange={(event) => setFilters({ ...filters, drivetrain: event.target.value })}
          >
            <option value="all">Any drivetrain</option>
            <option value="AWD">All-wheel drive</option>
            <option value="FWD">Front-wheel drive</option>
            <option value="RWD">Rear-wheel drive</option>
            <option value="4WD">Four-wheel drive</option>
            <option value="Not verified">Not verified</option>
          </select>
        </div>
        <div className="catalog-field">
          <label className="field-label" htmlFor="record-kind">
            Record type
          </label>
          <select
            id="record-kind"
            value={filters.recordKind}
            onChange={(event) => setFilters({ ...filters, recordKind: event.target.value })}
          >
            <option value="all">All catalog records</option>
            <option value="retail-trim">Retail configurations</option>
            <option value="government-rating">Government rating variants</option>
            <option value="manufacturer-offer">Manufacturer offers · year unverified</option>
          </select>
        </div>
        <div className="catalog-field">
          <label className="field-label" htmlFor="vehicle-class">
            NRCan vehicle class
          </label>
          <select
            id="vehicle-class"
            value={filters.vehicleClass}
            onChange={(event) => setFilters({ ...filters, vehicleClass: event.target.value })}
          >
            <option value="all">All vehicle classes</option>
            {vehicleClasses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <p className="field-hint">
            Exact NRCan classes apply only to linked ratings. Use Body style to browse manufacturer
            configurations more broadly.
          </p>
        </div>
        <div className="catalog-field">
          <label className="field-label" htmlFor="availability">
            Availability evidence
          </label>
          <select
            id="availability"
            value={filters.availability}
            onChange={(event) => setFilters({ ...filters, availability: event.target.value })}
          >
            <option value="all">All evidence statuses</option>
            <option value="manufacturer-listed">Currently manufacturer-listed</option>
            <option value="not-checked">Not yet checked</option>
            <option value="announced">Announced</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>
        <label className="saved-filter">
          <input
            type="checkbox"
            checked={filters.savedOnly}
            onChange={(event) => setFilters({ ...filters, savedOnly: event.target.checked })}
          />
          Only my shortlist <span>{savedIds.length}</span>
        </label>
        <label className="saved-filter">
          <input
            type="checkbox"
            checked={!!filters.pricedOnly}
            onChange={(event) => setFilters({ ...filters, pricedOnly: event.target.checked })}
          />
          Verified base price only
        </label>
        <label className="saved-filter">
          <input
            type="checkbox"
            checked={!!filters.includeUnverified}
            onChange={(event) =>
              setFilters({ ...filters, includeUnverified: event.target.checked })
            }
          />
          Keep vehicles with unverified price, seats, power or legroom
        </label>
        {(ruledOutCount > 0 || filters.hideRuledOut) && (
          <label className="saved-filter">
            <input
              type="checkbox"
              checked={!!filters.hideRuledOut}
              onChange={(event) => setFilters({ ...filters, hideRuledOut: event.target.checked })}
            />
            Hide vehicles I ruled out after a test drive <span>{ruledOutCount}</span>
          </label>
        )}
        <label className="saved-filter">
          <input
            type="checkbox"
            checked={scoredOnly}
            onChange={(event) => setScoredOnly(event.target.checked)}
          />
          Has a fit score for my priorities
        </label>
      </div>
      <fieldset className="priorities">
        <legend>What matters most?</legend>
        <div className="priority-presets" role="group" aria-label="Priority presets">
          {priorityPresets.map((preset) => (
            <button
              type="button"
              key={preset.label}
              className="text-button"
              aria-pressed={priorityKeys.every((key) => weights[key] === preset.weights[key])}
              onClick={() => setWeights({ ...preset.weights })}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p>
          Give each priority a weight.
          <br />0 = ignore · 5 = matters most
        </p>
        {priorityKeys.map((key) => (
          <div className="priority" key={key}>
            <label htmlFor={`weight-${key}`}>
              {priorityDefinitions[key].label}
              <output htmlFor={`weight-${key}`}>{weights[key]}</output>
            </label>
            <input
              id={`weight-${key}`}
              type="range"
              min="0"
              max="5"
              step="1"
              value={weights[key]}
              onChange={(event) => setWeights({ ...weights, [key]: Number(event.target.value) })}
              aria-valuetext={`${weights[key]} out of 5`}
            />
          </div>
        ))}
        <a href="#methodology" className="methodology-link">
          How your fit score works ↗
        </a>
      </fieldset>
      <EnergyInputs inputs={energyInputs} onInput={onEnergyInput} />
      <div className="scope-note">
        <strong>Coverage is expanding.</strong>
        <p>
          {governmentRatingCount.toLocaleString('en-CA')} government ratings are imported. Retail
          trim, price and current availability reviews are still in progress. NRCan groups some
          conventional and hybrid variants together. Check the manufacturer's listings for current
          availability.
        </p>
      </div>
    </aside>
  );
}
