import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { catalog } from '@oss/car-catalog';
import type { Car } from '@oss/car-catalog';
import {
  defaultFilters,
  defaultEnergy,
  defaultWeights,
  parseSharedState,
  priorityKeys,
  uncheckedLimits,
} from './domain';
import type { Weights } from './domain';
import { useShortlist } from './useShortlist';
import { useEnergySettings } from './useEnergySettings';
import type { EnergyInputs as Inputs } from './useEnergySettings';
import { parseBrowsingState, serializeViewState } from './browsing';
import type { SortOrder } from './browsing';
import { useBrowsingState } from './useBrowsingState';
import { useCatalogResults } from './useCatalogResults';
import { CatalogFilters } from './CatalogFilters';
import { ActiveFilters, DiscoveryShortcuts, PrimaryFilters } from './CatalogControls';
import { SourcesSection } from './SourceLibrary';
import { AppHeader } from './AppHeader';
import { Comparison } from './Comparison';
import { CompareTray } from './CompareTray';
import { Card } from './VehicleCard';
import { EmptyResults, ResultsPagination } from './ResultsNavigation';
import { ShortlistDialog } from './ShortlistDialog';
import { SiteFooter } from './SiteFooter';
import { Icon, formatDate, reviewedDate } from './catalogView';
import { useBuyingWorkspace } from './useBuyingWorkspace';
import { TestDriveJournal } from './TestDriveJournal';
import { latestReview } from './buying';
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
      setJournal(null);
    };
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, []);

  const { results, scoredCount, ruledOutCount, uncheckedHidden } = useCatalogResults({
    cars,
    filters,
    savedIds,
    weights,
    energy,
    sort,
    scoredOnly,
    reviews: buying.workspace.reviews,
  });
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
  // Copied links omit the device-only shortlist filter. When the clipboard is
  // unavailable, the link is shown in a text field instead.
  async function copyLink(
    compare: string[],
    reference: string | undefined,
    copied: string,
    fallback: (url: string) => void,
  ) {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = serializeViewState(
      { compare, weights, ...(reference === undefined ? {} : { reference }), energy },
      { ...browsing, page: currentPage, filters: { ...filters, savedOnly: false } },
    );
    try {
      await navigator.clipboard.writeText(url.toString());
      setAnnouncement(copied);
    } catch {
      fallback(url.toString());
    }
  }
  const shareComparison = () =>
    copyLink(compareIds, referenceId, 'Comparison link copied.', (url) => {
      setShareUrl(url);
      setAnnouncement('Copy the comparison link from the text field.');
    });
  const shareSearch = () =>
    copyLink(
      [],
      undefined,
      filters.savedOnly
        ? 'Search link copied. The device-only shortlist filter is not included.'
        : 'Search link copied.',
      (url) => {
        setSearchShareUrl(url);
        setAnnouncement(
          'Copy the search link from the text field. The device-only shortlist filter is not included.',
        );
      },
    );
  function openJournal(carId: string | null) {
    buying.clearError();
    setJournal({ carId });
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
        {buying.warning && (
          <p className="notice" role="status">
            {buying.warning}
          </p>
        )}
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
              <DiscoveryShortcuts
                onQuickView={(next) => {
                  setFilters(next);
                  setScoredOnly(false);
                }}
                onShareSearch={() => void shareSearch()}
              />
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
              <PrimaryFilters
                cars={cars}
                makes={makes}
                years={years}
                unverifiedYearCount={unverifiedYearCount}
                filters={filters}
                setFilters={setFilters}
                filtersOpen={filtersOpen}
                onToggleFilters={() => setFiltersOpen(!filtersOpen)}
                onReset={() => {
                  resetFilters();
                  setWeights({ ...defaultWeights });
                }}
              />
              <CatalogFilters
                filtersOpen={filtersOpen}
                filters={filters}
                setFilters={setFilters}
                weights={weights}
                setWeights={setWeights}
                scoredOnly={scoredOnly}
                setScoredOnly={setScoredOnly}
                savedIds={savedIds}
                ruledOutCount={ruledOutCount}
                energyInputs={energyInputs}
                onEnergyInput={onEnergyInput}
              />
              <div className="results-caption">
                <p role="status">
                  {results.length.toLocaleString('en-CA')}{' '}
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
                {(savedIds.length > 0 || storageWarning) && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setShortlistOpen(true)}
                  >
                    Manage shortlist ({savedIds.length})
                  </button>
                )}
                {buying.workspace.reviews.length > 0 && (
                  <button type="button" className="text-button" onClick={() => openJournal(null)}>
                    Test-drive journal ({buying.workspace.reviews.length})
                  </button>
                )}
              </div>
              {filters.savedOnly && results.length < savedIds.length && (
                <p className="ranking-coverage">
                  {savedIds.length - results.length} saved configurations are hidden by your
                  filters.
                </p>
              )}
              {results.length > 0 && (
                <p className="ranking-coverage">
                  {scoredCount.toLocaleString('en-CA')} of {results.length.toLocaleString('en-CA')}{' '}
                  matching records have all the data needed for your priorities. Unknown values stay
                  unscored.
                </p>
              )}
              {uncheckedHidden > 0 && (
                <p className="panel-note unchecked-notice">
                  {uncheckedHidden.toLocaleString('en-CA')} more{' '}
                  {uncheckedHidden === 1 ? 'record has' : 'records have'} no verified figure for
                  your limits.{' '}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setFilters({ ...filters, includeUnverified: true })}
                  >
                    Show them to check
                  </button>
                </p>
              )}
              <ActiveFilters
                filters={filters}
                setFilters={setFilters}
                scoredOnly={scoredOnly}
                onClearScoredOnly={() => setScoredOnly(false)}
              />
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
                      unchecked={filters.includeUnverified ? uncheckedLimits(car, filters) : []}
                      review={latestReview(buying.workspace.reviews, car.id)}
                      onTestDrive={() => openJournal(car.id)}
                      selected={compareIds.includes(car.id)}
                      saved={savedIds.includes(car.id)}
                      atLimit={compareIds.length >= 4}
                      onCompare={() => toggleCompare(car.id)}
                      onSave={() => toggleSave(car)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyResults
                  emptyShortlist={filters.savedOnly && savedIds.length === 0}
                  onReset={resetFilters}
                  onRestoreShortlist={() => setShortlistOpen(true)}
                />
              )}
              {results.length > 0 && (
                <ResultsPagination
                  page={currentPage}
                  totalPages={totalPages}
                  firstIndex={startIndex}
                  shown={visibleResults.length}
                  total={results.length}
                  onPage={changePage}
                />
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
        <SourcesSection
          items={catalog.sources}
          reviewedDate={reviewedDate}
          formatDate={formatDate}
        />
      </main>
      <SiteFooter
        onClearShortlist={() => {
          const cleared = clearShortlist();
          setAnnouncement(
            cleared
              ? 'Shortlist cleared from this device.'
              : 'Shortlist cleared for this visit. Device storage could not be cleared.',
          );
        }}
      />
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
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
            openJournal(id);
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
        <CompareTray
          selected={selected}
          count={compareIds.length}
          onRemove={toggleCompare}
          onClear={() => setCompareIds([])}
          onCompare={() => setComparisonOpen(true)}
        />
      )}
      <Comparison
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
