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
import { useBuyingWorkspace } from './useBuyingWorkspace';
import { BuyingBriefDialog } from './BuyingBriefDialog';
import { TestDriveJournal } from './TestDriveJournal';
import { matchesBrief, latestReview, assessRequirements } from './buying';
import './buying.css';
import { ScoringMethodology } from './ScoringMethodology';

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
  const buying = useBuyingWorkspace();
  const activeBrief = buying.workspace.brief?.enabled ? buying.workspace.brief : null;
  const [briefOpen, setBriefOpen] = useState(false);
  const [journal, setJournal] = useState<{ carId: string | null } | null>(null);
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
      setBriefOpen(false);
      setJournal(null);
    };
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, []);

  const results = useMemo(() => {
    const eligible = filterCars(cars, filters, savedIds).filter(
      (car) => !activeBrief || matchesBrief(car, activeBrief, buying.workspace.reviews),
    );
    const ranked = rankCars(eligible, weights, energy, activeBrief);
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
    activeBrief,
    buying.workspace.reviews,
    energy.fuelPrice,
    energy.electricityPrice,
    energy.electricFraction,
    energy.premiumPrice,
    energy.dieselPrice,
    energy.e85Price,
  ]);
  const scoredCount = results.filter((result) => result.score !== null).length;
  const requirementGaps = useMemo(
    () =>
      activeBrief
        ? filterCars(cars, filters, savedIds).filter((car) => {
            const needs = assessRequirements(car, activeBrief);
            return !needs.failed.length && needs.unknown.length > 0;
          }).length
        : 0,
    [activeBrief, filters, savedIds],
  );
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
        <section className="buying-hub" aria-labelledby="buying-title">
          <div>
            <h2 id="buying-title">Your buying brief</h2>
            <p>
              {activeBrief
                ? 'Showing vehicles for your saved brief. Search and filters narrow this list.'
                : 'Set your budget, seating needs and other priorities.'}{' '}
              <span className="buying-storage">Saved on this device.</span>
            </p>
            {activeBrief && (
              <p className="buying-brief-summary">
                {activeBrief.budget
                  ? `Up to ${currency.format(activeBrief.budget)} base MSRP · `
                  : ''}
                {activeBrief.minSeats ? `${activeBrief.minSeats}+ seats · ` : ''}
                {activeBrief.bodies.length
                  ? `${activeBrief.bodies.join(', ')} ${activeBrief.bodyRequired ? 'only' : 'preferred'} · `
                  : ''}
                {activeBrief.drive !== 'Any'
                  ? `${activeBrief.drive} ${activeBrief.driveRequired ? 'required' : 'preferred'} · `
                  : ''}
                {activeBrief.powerRequired || activeBrief.weights.power > 0
                  ? `${activeBrief.horsepower} hp ${activeBrief.powerRequired ? 'minimum' : 'target'} · `
                  : ''}
                {activeBrief.includeUnverified
                  ? 'Unverified requirements shown for checking'
                  : 'Verified requirements only'}
              </p>
            )}
          </div>
          <div className="buying-actions">
            <button
              type="button"
              className="button primary"
              onClick={() => {
                buying.clearError();
                setBriefOpen(true);
              }}
            >
              {buying.workspace.brief ? 'Edit buying brief' : 'Create buying brief'}
            </button>
            {buying.workspace.brief && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  const brief = buying.workspace.brief!;
                  if (buying.saveBrief(brief, { ...brief, enabled: !brief.enabled })) resetPage();
                }}
              >
                {activeBrief ? 'Pause buying brief' : 'Use buying brief'}
              </button>
            )}
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                buying.clearError();
                setJournal({ carId: null });
              }}
            >
              Test-drive journal ({buying.workspace.reviews.length})
            </button>
          </div>
          {buying.warning && (
            <p className="notice" role="status">
              {buying.warning}
            </p>
          )}
          {buying.error && !briefOpen && !journal && (
            <p className="notice" role="alert">
              {buying.error}
            </p>
          )}
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
                  {activeBrief ? 'Reset catalog' : 'Reset'}
                </button>
              </div>
              <CatalogFilters
                briefActive={!!activeBrief}
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
                    ? activeBrief
                      ? 'Sorted by your buying brief'
                      : 'Sorted by your priorities'
                    : sort === 'price'
                      ? 'Lowest base MSRP first'
                      : 'Lowest estimated energy cost per 100 km first'}
                </span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setShortlistOpen(true)}
                >
                  Manage shortlist ({savedIds.length})
                </button>
              </div>
              {filters.savedOnly && results.length < savedIds.length && (
                <p className="ranking-coverage">
                  {savedIds.length - results.length} saved configurations are hidden by your
                  filters.
                </p>
              )}
              <p className="ranking-coverage">
                {scoredCount.toLocaleString('en-CA')} of {results.length.toLocaleString('en-CA')}{' '}
                matching records have all the data needed for your priorities. Unknown values stay
                unscored.
              </p>
              {activeBrief && requirementGaps > 0 && (
                <p className="panel-note brief-gap-notice">
                  {requirementGaps.toLocaleString('en-CA')} matching records have unverified
                  requirements.
                  {activeBrief.includeUnverified ? (
                    ' They are included for checking and remain unscored.'
                  ) : (
                    <>
                      {' '}
                      Include them below to review the missing facts.{' '}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          if (
                            buying.saveBrief(activeBrief, {
                              ...activeBrief,
                              includeUnverified: true,
                            })
                          )
                            resetPage();
                        }}
                      >
                        Include candidates needing checks
                      </button>
                    </>
                  )}
                </p>
              )}
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
              {!activeBrief && priorityKeys.every((key) => weights[key] === 0) && (
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
                      brief={activeBrief}
                      review={latestReview(buying.workspace.reviews, car.id)}
                      onTestDrive={() => {
                        buying.clearError();
                        setJournal({ carId: car.id });
                      }}
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
                      ? 'Your shortlist is empty.'
                      : activeBrief
                        ? 'No vehicles match your criteria.'
                        : 'No vehicles match these filters.'}
                  </h3>
                  <p>
                    {filters.savedOnly && savedIds.length === 0
                      ? 'Save a car with the bookmark button to find it here later.'
                      : activeBrief
                        ? 'Review your buying brief or broaden the catalog filters.'
                        : 'Try a higher budget, another powertrain, or a broader search.'}
                  </p>
                  <div className="empty-actions">
                    {activeBrief && (
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => {
                          buying.clearError();
                          setBriefOpen(true);
                        }}
                      >
                        Edit requirements
                      </button>
                    )}
                    <button type="button" className="button secondary" onClick={resetFilters}>
                      {activeBrief ? 'Reset catalog filters' : 'Show all cars'}{' '}
                      <Icon name="arrow" size={18} />
                    </button>
                  </div>
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
                Prices are CAD base MSRP before freight/PDI, taxes and fees. Use the linked
                manufacturer publications to confirm current prices and equipment. Fit scores
                summarize your selected priorities.
              </p>
            </div>
          </div>
        </section>
        <ScoringMethodology />
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
          Independent Canadian vehicle comparison.
          <br />
          Your saved vehicles, notes and service history stay in this browser.
        </p>
        <a href="#privacy">Privacy & data</a>
        <details id="privacy">
          <summary>How your data works</summary>
          <p>
            Your shortlist, buying brief, test-drive reviews and Garage records are saved in this
            browser on this device. Export backups before moving devices or clearing site data.
            Manage buying backups in the journal and vehicle backups in Garage.
          </p>
          <p>
            Searches, filters, result pages, comparison IDs, ranking weights and energy settings
            appear in the address bar and copied links. Recipients can see those choices, and URLs
            may appear in hosting access logs. Buying briefs, reviews and the saved-only filter stay
            local; copied links use the catalog controls.
          </p>
          <p>
            OSS uses local storage for personal records and runs without app accounts or analytics.
            The host receives connection and access information when serving the app. Manufacturer
            links open external sites with their own privacy policies.
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
      {briefOpen && (
        <BuyingBriefDialog
          store={buying}
          onClose={() => setBriefOpen(false)}
          onApply={() => {
            setSort('fit');
            resetPage();
          }}
        />
      )}
      {journal && (
        <TestDriveJournal
          store={buying}
          cars={cars}
          initialCarId={journal.carId}
          onClose={() => setJournal(null)}
        />
      )}
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
          onTestDrive={(id) => {
            setShortlistOpen(false);
            buying.clearError();
            setJournal({ carId: id });
          }}
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
        brief={activeBrief}
        reviews={buying.workspace.reviews}
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
