import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { catalog } from '@oss/car-catalog';
import type { Car } from '@oss/car-catalog';
import {
  defaultFilters,
  defaultEnergy,
  energyCostPer100km,
  defaultWeights,
  filterCars,
  fullName,
  configurationLabel,
  modelYearLabel,
  parseSharedState,
  priorityKeys,
  rankCars,
} from './domain';
import type { Filters, Weights } from './domain';
import { useShortlist } from './useShortlist';
import { useEnergySettings } from './useEnergySettings';
import type { EnergyInputs as Inputs } from './useEnergySettings';
import { parseBrowsingState, serializeViewState } from './browsing';
import type { SortOrder } from './browsing';
import { useBrowsingState } from './useBrowsingState';
import { CatalogFilters } from './CatalogFilters';
import { SourceLibrary } from './SourceLibrary';
import { AppHeader } from './AppHeader';
import { Comparison } from './Comparison';
import { Card } from './VehicleCard';
import { ShortlistDialog } from './ShortlistDialog';
import { Icon, currency, formatDate, reviewedDate } from './catalogView';

const cars = catalog.cars;
const makes = [...new Set(cars.map((car) => car.make))].sort((a, b) => a.localeCompare(b));
const years = [
  ...new Set(cars.map((car) => car.year).filter((year): year is number => year !== null)),
].sort((a, b) => b - a);
const unverifiedYearCount = cars.filter((car) => car.year === null).length;
const pageSize = 30;
const initialShared = parseSharedState(window.location.search, cars);
const initialBrowsing = parseBrowsingState(window.location.search, cars);

export function App() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const {
    state: browsing,
    restore: restoreBrowsing,
    setFilters,
    setSort,
    setScoredOnly,
    setRequestedPage,
    resetPage,
  } = useBrowsingState(initialBrowsing);
  const { filters, sort, scoredOnly, page: requestedPage } = browsing;
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
    [filters.make, filters.year],
  );
  const {
    energy,
    inputs: energyInputs,
    onInput: changeEnergyInput,
    setEnergy,
  } = useEnergySettings(initialShared.energy);
  const [weights, restoreWeights] = useState<Weights>(initialShared.weights);
  const setWeights: Dispatch<SetStateAction<Weights>> = (next) => {
    restoreWeights(next);
    resetPage();
  };
  const onEnergyInput = (key: keyof Inputs, value: string) => {
    changeEnergyInput(key, value);
    if (key !== 'kilometres') resetPage();
  };
  const [compareIds, setCompareIds] = useState<string[]>(initialShared.compare);
  const [referenceId, setReferenceId] = useState(
    initialShared.reference ?? initialShared.compare[0] ?? '',
  );
  useEffect(() => {
    if (!compareIds.includes(referenceId)) setReferenceId(compareIds[0] ?? '');
  }, [compareIds, referenceId]);
  const [comparisonOpen, setComparisonOpen] = useState(initialShared.compare.length >= 2);
  const { savedIds, storageWarning, setSaved, addMany, clearShortlist } = useShortlist(cars);
  const [shortlistOpen, setShortlistOpen] = useState(false);
  const [urlWarning, setUrlWarning] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [searchShareUrl, setSearchShareUrl] = useState('');
  const selected = compareIds
    .map((id) => cars.find((car) => car.id === id))
    .filter((car): car is Car => !!car);
  const reviewAge = Math.floor((Date.now() - Date.parse(catalog.reviewedAt)) / 86400000);

  useEffect(() => {
    const navigate = () => {
      const next = parseSharedState(window.location.search, cars);
      setCompareIds(next.compare);
      restoreWeights(next.weights);
      restoreBrowsing(parseBrowsingState(window.location.search, cars));
      setEnergy(next.energy ?? defaultEnergy);
      setReferenceId(next.reference ?? next.compare[0] ?? '');
      setComparisonOpen(next.compare.length >= 2);
      setShortlistOpen(false);
    };
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, []);

  const results = useMemo(() => {
    const ranked = rankCars(filterCars(cars, filters, savedIds), weights, energy);
    if (sort === 'price')
      ranked.sort(
        (a, b) =>
          (a.car.facts.msrpCad.value ?? Infinity) - (b.car.facts.msrpCad.value ?? Infinity) ||
          a.car.id.localeCompare(b.car.id),
      );
    if (sort === 'fuel')
      ranked.sort(
        (a, b) =>
          (energyCostPer100km(a.car, energy) ?? Infinity) -
            (energyCostPer100km(b.car, energy) ?? Infinity) || a.car.id.localeCompare(b.car.id),
      );
    return scoredOnly ? ranked.filter((result) => result.score !== null) : ranked;
  }, [
    filters,
    weights,
    savedIds,
    sort,
    scoredOnly,
    energy.fuelPrice,
    energy.electricityPrice,
    energy.electricFraction,
    energy.premiumPrice,
    energy.dieselPrice,
    energy.e85Price,
  ]);
  const scoredCount = results.filter((result) => result.score !== null).length;
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  useEffect(() => {
    const next = `${window.location.pathname}${serializeViewState({ compare: compareIds, weights, reference: referenceId, energy }, { ...browsing, page: currentPage })}${window.location.hash}`;
    try {
      if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
        window.history.replaceState(null, '', next);
      }
      setUrlWarning(null);
    } catch {
      setUrlWarning(
        'Your browser could not update the address bar. Use Copy comparison link to share these choices.',
      );
    }
    setShareUrl('');
    setSearchShareUrl('');
  }, [
    browsing,
    currentPage,
    compareIds,
    weights,
    referenceId,
    energy.kilometres,
    energy.fuelPrice,
    energy.electricityPrice,
    energy.electricFraction,
    energy.premiumPrice,
    energy.dieselPrice,
    energy.e85Price,
  ]);

  const startIndex = (currentPage - 1) * pageSize;
  const visibleResults = results.slice(startIndex, startIndex + pageSize);
  function changePage(page: number) {
    setRequestedPage(page);
    document
      .getElementById('catalog-results')
      ?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  function toggleCompare(id: string) {
    setCompareIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : previous.length < 4
          ? [...previous, id]
          : previous,
    );
  }
  function toggleSave(car: Car) {
    const wasSaved = savedIds.includes(car.id);
    setSaved(car.id, !wasSaved);
    setAnnouncement(
      `${car.make} ${car.model} ${wasSaved ? 'removed from' : 'added to'} your shortlist.`,
    );
  }
  async function shareComparison() {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = serializeViewState(
      { compare: compareIds, weights, reference: referenceId, energy },
      {
        ...browsing,
        page: currentPage,
        filters: { ...filters, savedOnly: false },
      },
    );
    try {
      await navigator.clipboard.writeText(url.toString());
      setAnnouncement('Comparison link copied.');
    } catch {
      setShareUrl(url.toString());
      setAnnouncement('Copy the comparison link from the text field.');
    }
  }
  async function shareSearch() {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = serializeViewState(
      { compare: [], weights, energy },
      {
        ...browsing,
        page: currentPage,
        filters: { ...filters, savedOnly: false },
      },
    );
    try {
      await navigator.clipboard.writeText(url.toString());
      setAnnouncement(
        filters.savedOnly
          ? 'Search link copied. The device-only shortlist filter is not included.'
          : 'Search link copied.',
      );
    } catch {
      setSearchShareUrl(url.toString());
      setAnnouncement(
        'Copy the search link from the text field. The device-only shortlist filter is not included.',
      );
    }
  }
  function resetFilters() {
    setFilters({ ...defaultFilters });
    setScoredOnly(false);
  }

  return (
    <>
      <a className="skip-link" href="#cars">
        Skip to cars
      </a>
      <AppHeader
        page="compare"
        savedCount={savedIds.length}
        savedOnly={filters.savedOnly}
        onShortlist={() => {
          setFilters((previous) => ({ ...previous, savedOnly: !previous.savedOnly }));
          document.getElementById('cars')?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
          });
        }}
      />
      <main>
        <section className="workspace-intro" aria-labelledby="workspace-title">
          <div>
            <h1 id="workspace-title">
              Compare <span>vehicles</span>
            </h1>
            <p>Canadian prices and specifications. Select up to four vehicles to compare.</p>
          </div>
        </section>
        <details className="catalog-coverage">
          <summary>
            Canadian catalog <span>Coverage in progress · details &amp; sources</span>
          </summary>{' '}
          <div className="trust-strip">
            <span>
              {cars.length.toLocaleString('en-CA')} catalog records · {makes.length} makes
            </span>
            <span>
              {years.length ? `${years[years.length - 1]}–${years[0]}` : 'Model years unverified'}
              {unverifiedYearCount > 0 && ` · ${unverifiedYearCount} year-unverified offers`} ·
              Canada · retail coverage in progress
            </span>
            <span>Reviewed {reviewedDate}</span>
            <a href="#sources">Sources & coverage ↗</a>
          </div>
        </details>
        {reviewAge > 90 && (
          <p className="notice stale-notice">
            This catalog was reviewed {reviewedDate}. Prices and specifications may have changed;
            check the linked manufacturer publications.
          </p>
        )}
        {storageWarning && (
          <p className="notice" role="status">
            {storageWarning}
          </p>
        )}
        {urlWarning && (
          <p className="notice" role="status">
            {urlWarning}
          </p>
        )}
        <section id="cars" className="catalog-section" aria-labelledby="catalog-title">
          <h2 id="catalog-title" className="sr-only">
            Vehicle catalog
          </h2>
          <div className="catalog-layout">
            <div className="results" id="catalog-results">
              <div className="results-toolbar">
                <label className="search-box">
                  <span className="sr-only">Search cars</span>
                  <Icon name="search" size={19} />
                  <input
                    type="search"
                    placeholder="Search make, model, trim or powertrain"
                    aria-describedby="vehicle-search-tip"
                    value={filters.query}
                    onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                    maxLength={100}
                  />
                </label>
                <label className="sort-control">
                  <span>Sort by</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortOrder)}
                  >
                    <option value="fit">Your best fit</option>
                    <option value="price">Lowest MSRP</option>
                    <option value="fuel">Lowest energy cost</option>
                  </select>
                </label>
              </div>
              <p className="search-tip" id="vehicle-search-tip">
                Search words in any order. Use quotes for an exact phrase.
              </p>
              <div className="discovery-shortcuts" role="group" aria-label="Quick views">
                <span>Start with</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setFilters({ ...defaultFilters, recordKind: 'retail-trim', pricedOnly: true });
                    setScoredOnly(false);
                  }}
                >
                  Priced retail vehicles
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setFilters({ ...defaultFilters, fuel: 'Electric' });
                    setScoredOnly(false);
                  }}
                >
                  Electric vehicles
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setFilters({
                      ...defaultFilters,
                      bodyStyle: 'SUV',
                      minSeats: 5,
                      recordKind: 'retail-trim',
                      pricedOnly: true,
                    });
                    setScoredOnly(false);
                  }}
                >
                  Family SUVs
                </button>
                <button
                  type="button"
                  className="text-button search-share"
                  onClick={() => void shareSearch()}
                >
                  <Icon name="link" size={16} /> Copy search link
                </button>
              </div>
              {searchShareUrl && (
                <label className="share-fallback">
                  Search link
                  <input
                    aria-label="Search link"
                    value={searchShareUrl}
                    readOnly
                    onFocus={(event) => event.target.select()}
                  />
                  {filters.savedOnly && (
                    <small>The device-only shortlist filter is not included.</small>
                  )}
                </label>
              )}
              <div className="catalog-primary-filters">
                <div className="catalog-field">
                  <label className="field-label" htmlFor="year">
                    Model year
                  </label>
                  <select
                    id="year"
                    value={filters.year}
                    onChange={(event) =>
                      setFilters({ ...filters, year: event.target.value, model: 'all' })
                    }
                  >
                    <option value="all">All model years</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                    {unverifiedYearCount > 0 && (
                      <option value="unverified">Year not verified</option>
                    )}
                  </select>
                </div>
                <div className="catalog-field">
                  <label className="field-label" htmlFor="make">
                    Make
                  </label>
                  <select
                    id="make"
                    value={filters.make}
                    onChange={(event) =>
                      setFilters({ ...filters, make: event.target.value, model: 'all' })
                    }
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
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  <Icon name="sliders" size={17} />
                  {filtersOpen ? 'Hide filters' : 'Filters & priorities'}
                </button>
                <button
                  type="button"
                  className="text-button filter-reset"
                  onClick={() => {
                    resetFilters();
                    setWeights({ ...defaultWeights });
                  }}
                >
                  Reset
                </button>
              </div>
              <CatalogFilters
                filtersOpen={filtersOpen}
                filters={filters}
                setFilters={setFilters}
                weights={weights}
                setWeights={setWeights}
                scoredOnly={scoredOnly}
                setScoredOnly={setScoredOnly}
                savedIds={savedIds}
                energyInputs={energyInputs}
                onEnergyInput={onEnergyInput}
              />
              <div className="results-caption">
                <p role="status">
                  {results.length}{' '}
                  {filters.recordKind === 'retail-trim'
                    ? results.length === 1
                      ? 'configuration'
                      : 'configurations'
                    : results.length === 1
                      ? 'record'
                      : 'records'}
                  {filters.savedOnly ? ' in your shortlist' : ' matching your filters'}
                </p>
                <span>
                  {sort === 'fit'
                    ? 'Sorted by your priorities'
                    : sort === 'price'
                      ? 'Lowest base MSRP first'
                      : 'Lowest estimated energy cost per 100 km first'}
                </span>
              </div>
              <div className="shortlist-catalog-tools">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setShortlistOpen(true)}
                >
                  Manage shortlist ({savedIds.length})
                </button>
                {filters.savedOnly && results.length < savedIds.length && (
                  <p>
                    {savedIds.length - results.length} saved configurations are hidden by your
                    filters.
                  </p>
                )}
              </div>
              <p className="ranking-coverage">
                {scoredCount.toLocaleString('en-CA')} of {results.length.toLocaleString('en-CA')}{' '}
                matching records have all the data needed for your priorities. Unknown values stay
                unscored.
              </p>
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
                    const labels: Record<string, string> = {
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
                    const label = `${labels[key]}${value === true ? '' : `: ${key === 'budget' ? currency.format(Number(value)) : String(value).replaceAll('-', ' ')}`}`;
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
                  <button
                    type="button"
                    className="filter-chip"
                    onClick={() => setScoredOnly(false)}
                  >
                    Has a fit score ×
                  </button>
                )}
              </div>
              {priorityKeys.every((key) => weights[key] === 0) && (
                <p className="notice">
                  Choose at least one priority to calculate fit scores. Cars are currently ordered
                  by MSRP when sorting by fit.
                </p>
              )}
              {results.length ? (
                <div className="card-grid">
                  {visibleResults.map(({ car }, index) => (
                    <Card
                      key={car.id}
                      car={car}
                      index={startIndex + index}
                      weights={weights}
                      energy={energy}
                      selected={compareIds.includes(car.id)}
                      saved={savedIds.includes(car.id)}
                      atLimit={compareIds.length >= 4}
                      onCompare={() => toggleCompare(car.id)}
                      onSave={() => toggleSave(car)}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Icon name="search" size={30} />
                  </span>
                  <h3>
                    {filters.savedOnly && savedIds.length === 0
                      ? 'Your shortlist starts with a favourite.'
                      : 'No fits with these filters.'}
                  </h3>
                  <p>
                    {filters.savedOnly && savedIds.length === 0
                      ? 'Save a car with the bookmark button to find it here later.'
                      : 'Try a higher budget, another powertrain, or a broader search.'}
                  </p>
                  <button type="button" className="button secondary" onClick={resetFilters}>
                    Show all cars <Icon name="arrow" size={18} />
                  </button>
                </div>
              )}
              {results.length > 0 && (
                <nav className="pagination" aria-label="Result pages">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={currentPage === 1}
                    onClick={() => changePage(currentPage - 1)}
                  >
                    Previous page
                  </button>
                  <span role="status">
                    Page {currentPage} of {totalPages} · Showing {startIndex + 1}–
                    {startIndex + visibleResults.length} of {results.length.toLocaleString('en-CA')}
                  </span>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={currentPage === totalPages}
                    onClick={() => changePage(currentPage + 1)}
                  >
                    Next page
                  </button>
                </nav>
              )}
              <p className="catalog-disclaimer">
                {catalog.pricingNote} This is a specification snapshot, not live inventory. Fit
                scores compare only the priorities shown; reliability, safety ratings and total
                ownership cost are not scored.
              </p>
            </div>
          </div>
        </section>
        <section
          id="methodology"
          className="methodology-section"
          aria-labelledby="methodology-title"
        >
          <div>
            <h2 id="methodology-title">How scoring works</h2>
            <p>
              The best car depends on what you need. Your fit score makes those tradeoffs explicit.
            </p>
          </div>
          <div className="methodology-content">
            <ol>
              <li>
                <span>01</span>
                <div>
                  <h3>You set the weights.</h3>
                  <p>Pick what matters from 0 to 5. A zero removes that metric from the score.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Every metric has a fixed scale.</h3>
                  <p>
                    Price: CAD $30k–$60k and energy cost: CAD $0–$24 per 100 km (lower is better).
                    Cargo, seats up: 500–1,200 L and rear legroom: 850–1,150 mm (higher is better).
                    Values outside a scale are capped at its ends. Energy cost uses your fuel and
                    electricity prices with published consumption for gas, hybrid, EV and plug-in
                    hybrid vehicles. The plug-in electric-mode share is an editable assumption.
                    Annual distance does not change the score. Spatial priorities start at zero
                    because their source coverage is limited; enable them when they matter to you.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>The score is a weighted average.</h3>
                  <p>
                    Each normalized metric × its share of your total weight, summed and rounded to
                    100. Filtering never changes the scales. Equal scores sort by lower MSRP, then
                    configuration ID. Missing an active metric? The car stays unscored.
                  </p>
                </div>
              </li>
            </ol>
            <p className="methodology-caveat">
              This is a decision aid, not a quality or safety rating. Cargo methods differ, and
              measurements cannot tell you how a seat feels. Use the shortlist to decide what to see
              in person.
            </p>
          </div>
        </section>
        <section id="sources" className="sources-section" aria-labelledby="sources-title">
          <div className="section-heading">
            <div>
              <h2 id="sources-title">Sources</h2>
            </div>
            <p>
              Manufacturer and NRCan publications; review dates appear below.
              <br />
              Catalog reviewed {reviewedDate}. Every numeric spec links back to its source.
            </p>
          </div>
          <SourceLibrary items={catalog.sources} formatDate={formatDate} />
          <p className="catalog-disclaimer">
            Contains information from Natural Resources Canada under the{' '}
            <a
              href="https://open.canada.ca/en/open-government-licence-canada"
              target="_blank"
              rel="noreferrer"
            >
              Open Government Licence – Canada
            </a>
            . Independent tool; no Government of Canada endorsement. Rating publication and retail
            availability are separate checks.
          </p>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-brand">
          oss<span>.</span>
        </div>
        <p>
          Independent comparison tool. No manufacturer affiliation.
          <br />
          Shortlists and garage records stay in this browser. No app accounts or analytics.
        </p>
        <a href="#privacy">Privacy & data</a>
        <details id="privacy">
          <summary>How your data works</summary>
          <p>
            Shortlist IDs are saved in local storage on this device. Clear your shortlist below or
            clear site data in your browser to remove them. Searches, filters, result pages,
            comparison IDs, priority weights and energy assumptions appear in the address bar and
            shareable URLs. Link recipients can see those choices, and URLs may appear in hosting
            access logs. The saved-only filter uses this browser’s shortlist and is omitted from
            copied links. The app has no analytics or account service. The hosting provider receives
            standard connection and access information when serving the site. External manufacturer
            links follow their own privacy policies. Garage vehicles, odometer readings, reminders
            and service history are also saved locally. Export a garage backup before clearing site
            data; clearing site data removes these records. Manage individual vehicles and backups
            on the Garage page.
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              const cleared = clearShortlist();
              setAnnouncement(
                cleared
                  ? 'Shortlist cleared from this device.'
                  : 'Shortlist cleared for this visit. Device storage could not be cleared.',
              );
            }}
          >
            Clear my shortlist
          </button>
        </details>
      </footer>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {shortlistOpen && (
        <ShortlistDialog
          cars={cars}
          ids={savedIds}
          compareIds={compareIds}
          warning={storageWarning}
          onClose={() => setShortlistOpen(false)}
          onSave={setSaved}
          onImport={addMany}
          onCompare={toggleCompare}
          onCompareNow={() => {
            setShortlistOpen(false);
            setComparisonOpen(true);
          }}
          onBrowse={() => {
            setFilters({ ...defaultFilters, savedOnly: true });
            setScoredOnly(false);
            setShortlistOpen(false);
            requestAnimationFrame(() =>
              document
                .getElementById('catalog-results')
                ?.scrollIntoView({ block: 'start', behavior: 'instant' }),
            );
          }}
        />
      )}
      {compareIds.length > 0 && (
        <div className="compare-tray" role="region" aria-label="Selected cars">
          <div className="tray-selection">
            <span className="tray-label">
              Your comparison <small>{selected.length}/4</small>
            </span>
            <ul className="selected-vehicles">
              {selected.map((car) => (
                <li key={car.id}>
                  <span className="selected-vehicle-copy" title={fullName(car)}>
                    <strong>
                      {car.make} {car.model}
                    </strong>
                    <small>
                      {modelYearLabel(car)} · {configurationLabel(car)}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${fullName(car)} from selection`}
                    onClick={() => toggleCompare(car.id)}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="tray-actions">
            <button type="button" className="text-button" onClick={() => setCompareIds([])}>
              Clear
            </button>
            <button
              type="button"
              className="button accent"
              disabled={compareIds.length < 2}
              onClick={() => setComparisonOpen(true)}
            >
              Compare {compareIds.length} {compareIds.length === 1 ? 'car' : 'cars'}{' '}
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      )}
      <Comparison
        selected={selected}
        weights={weights}
        energy={energy}
        inputs={energyInputs}
        onInput={onEnergyInput}
        open={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        onRemove={toggleCompare}
        onShare={() => void shareComparison()}
        shareUrl={shareUrl}
        referenceId={referenceId}
        onReferenceChange={setReferenceId}
      />
    </>
  );
}
