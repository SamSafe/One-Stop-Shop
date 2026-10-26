import { useEffect, useMemo, useRef, useState } from 'react';
import { catalog, metricDefinitions, governmentRatingCount, ratingUrl } from '@oss/car-catalog';
import type { Car, Fact, Metric } from '@oss/car-catalog';
import {
  annualEnergyCost,
  defaultFilters,
  defaultWeights,
  filterCars,
  fullName,
  modelYearLabel,
  parseSharedState,
  priorityDefinitions,
  priorityKeys,
  rankCars,
  scoreCar,
  serializeSharedState,
} from './domain';
import type { Filters, Weights } from './domain';
import { useShortlist } from './useShortlist';
import { SourceLibrary } from './SourceLibrary';

const cars = catalog.cars;
const makes = [...new Set(cars.map((car) => car.make))].sort((a, b) => a.localeCompare(b));
const years = [
  ...new Set(cars.map((car) => car.year).filter((year): year is number => year !== null)),
].sort((a, b) => b - a);
const unverifiedYearCount = cars.filter((car) => car.year === null).length;
const vehicleClasses = [
  ...new Set(
    cars
      .map((car) => car.governmentRating?.vehicleClass)
      .filter((value): value is string => !!value),
  ),
].sort();
const fuels = [...new Set(cars.map((car) => car.fuel))].sort();
const pageSize = 30;
const sources = new Map(catalog.sources.map((source) => [source.id, source]));
const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});
const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
const reviewedDate = formatDate(catalog.reviewedAt);
const metricKeys = Object.keys(metricDefinitions) as Metric[];
const initialShared = parseSharedState(window.location.search, cars);

function Icon({
  name,
  size = 20,
}: {
  name: 'arrow' | 'save' | 'search' | 'close' | 'check' | 'link' | 'sliders' | 'garage';
  size?: number;
}) {
  const paths = {
    arrow: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    save: <path d="M6 4h12v17l-6-4-6 4V4Z" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    link: (
      <>
        <path d="m9 15 6-6m-7 2-2 2a4 4 0 0 0 6 6l2-2m-4-10 2-2a4 4 0 0 1 6 6l-2 2" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h16M4 17h16M9 4v6m6 4v6" />
      </>
    ),
    garage: (
      <>
        <path d="M3 21V9l9-6 9 6v12H3Zm4 0V10h10v11M7 14h10M7 18h10" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function CarArt({ make }: { make: string }) {
  return (
    <svg
      className={`car-art car-${make.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
      viewBox="0 0 420 180"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="212" cy="149" rx="164" ry="9" fill="currentColor" opacity=".09" />
      <path
        d="M37 119 48 91l41-13 43-41h124l64 40 43 11 19 28-4 24h-28a33 33 0 0 0-66 0H132a33 33 0 0 0-66 0H40l-3-21Z"
        className="car-body"
      />
      <path d="m103 78 38-33h108l53 33H103Z" fill="#263d43" />
      <path d="m144 48-33 28h73V48h-40Zm49 0v28h95l-43-28h-52Z" fill="#d1dfdc" opacity=".8" />
      <path
        d="M49 102h37m247-6 28 9M194 87v42m-90-43 17 15m103-14h14m-91 0h14M45 125h29m271 0h29"
        stroke="#263d43"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".6"
      />
      <path d="M87 79h232M122 39h134" stroke="#263d43" strokeWidth="3" opacity=".4" />
      {[99, 317].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="139" r="25" fill="#203032" />
          <circle cx={cx} cy="139" r="15" fill="#dce1df" />
          <circle cx={cx} cy="139" r="6" fill="#6e7c7a" />
          <path d={`M${cx} 125v28m-14-14h28`} stroke="#9aa8a4" strokeWidth="3" />
        </g>
      ))}
      <path d="m366 105 10 12h-22v-12h12ZM46 99h17v9H43l3-9Z" fill="#fff9e3" />
    </svg>
  );
}

function displayFact(metric: Metric, fact: Fact): string {
  if (fact.value === null) return 'Not verified';
  if (metric === 'msrpCad') return currency.format(fact.value);
  return `${fact.value.toLocaleString('en-CA', { maximumFractionDigits: 1 })} ${metricDefinitions[metric].unit}`;
}

function SourcedFact({ metric, fact }: { metric: Metric; fact: Fact }) {
  const source = fact.source ? sources.get(fact.source) : null;
  return (
    <>
      {source ? (
        <a
          className="fact-link"
          href={fact.sourceUrl ?? source.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${metricDefinitions[metric].label}: ${displayFact(metric, fact)}. Source: ${source.publisher} (opens in new tab)`}
        >
          {displayFact(metric, fact)} <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <span>{displayFact(metric, fact)}</span>
      )}
      {fact.note && <small className="fact-note">{fact.note}</small>}
    </>
  );
}

const publishedCurrency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function PublishedPrice({ car }: { car: Car }) {
  const price = car.publishedPrice;
  if (!price) return <span>Not verified</span>;
  const source = sources.get(price.source)!;
  return (
    <>
      <a
        className="fact-link"
        href={source.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Published all-inclusive price: ${publishedCurrency.format(price.value)} CAD, ${price.province}, before sales tax. Source: ${source.publisher} (opens in new tab)`}
      >
        {publishedCurrency.format(price.value)} <span aria-hidden="true">↗</span>
      </a>
      <small className="fact-note">
        {price.province} · before sales tax. {price.note}
      </small>
    </>
  );
}

function Card({
  car,
  index,
  weights,
  selected,
  saved,
  atLimit,
  onCompare,
  onSave,
}: {
  car: Car;
  index: number;
  weights: Weights;
  selected: boolean;
  saved: boolean;
  atLimit: boolean;
  onCompare: () => void;
  onSave: () => void;
}) {
  const ranking = scoreCar(car, weights);
  const [expanded, setExpanded] = useState(false);
  const largest = [...ranking.contributions].sort((a, b) => b.points - a.points)[0];
  return (
    <article
      className={`car-card ${selected ? 'is-selected' : ''}`}
      aria-labelledby={`title-${car.id}`}
    >
      <div className="card-top">
        <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
        <span className={`fuel-tag ${car.fuel === 'Hybrid' ? 'hybrid' : ''}`}>
          {car.fuel} {car.drivetrain !== 'Not verified' && `· ${car.drivetrain}`}
        </span>
        <button
          type="button"
          className={`icon-button save-button ${saved ? 'is-saved' : ''}`}
          aria-label={`${saved ? 'Unsave' : 'Save'} ${fullName(car)}`}
          aria-pressed={saved}
          onClick={onSave}
        >
          <Icon name="save" />
        </button>
      </div>
      <div className="car-illustration">
        <CarArt make={car.make} />
        <span>Illustration · not model-specific</span>
      </div>
      <div className="card-content">
        <p className="car-make">
          {modelYearLabel(car)} {car.make}
        </p>
        <h3 id={`title-${car.id}`}>{car.model}</h3>
        <p className="car-trim">
          {car.recordKind === 'government-rating'
            ? `${car.governmentRating?.engineLitres ? `${car.governmentRating.engineLitres} L · ` : ''}${car.governmentRating?.transmission}`
            : `${car.trim} · ${car.drivetrain}`}
          {car.variant && ` · ${car.variant}`}
        </p>
        <p className="record-status">
          {car.recordKind === 'government-rating'
            ? 'NRCan rating · retail trim not checked'
            : car.recordKind === 'manufacturer-offer'
              ? 'Manufacturer offer · model year unverified'
              : 'Retail configuration'}
          {car.availability.status === 'manufacturer-listed' && ' · manufacturer-listed'}
          {car.availability.status === 'not-checked' && ' · current availability not checked'}
          {car.availability.status === 'announced' &&
            ' · coming-soon source flag · availability needs review'}
          {car.availability.status === 'discontinued' && ' · manufacturer discontinued'}
        </p>
        {car.modelYearNote && <p className="record-status">{car.modelYearNote}</p>}
        <div className="price-row">
          <div>
            <strong>
              {car.facts.msrpCad.value === null
                ? 'Not verified'
                : currency.format(car.facts.msrpCad.value)}
            </strong>
            <span>base MSRP · CAD</span>
          </div>
          <div className="fit-score">
            <strong>
              {ranking.score === null ? '—' : ranking.score}
              <span>/100</span>
            </strong>
            <span>your fit score</span>
          </div>
        </div>
        {car.publishedPrice && (
          <p className="published-price">
            <strong>{publishedCurrency.format(car.publishedPrice.value)}</strong> all-inclusive ·{' '}
            {car.publishedPrice.province} · before sales tax
          </p>
        )}
        <dl className="quick-specs">
          <div>
            <dt>
              {car.fuel === 'Electric' || car.fuel === 'Plug-in hybrid'
                ? 'Electric mode'
                : 'Combined fuel'}
            </dt>
            <dd>
              {car.fuel === 'Electric' || car.fuel === 'Plug-in hybrid' ? (
                <>
                  {car.facts.electricCombinedKwh100km.value ?? '—'} <small>kWh/100 km</small>
                </>
              ) : (
                <>
                  {car.facts.fuelCombinedL100km.value ?? '—'} <small>L/100 km</small>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Cargo, seats up</dt>
            <dd>
              {car.facts.cargoSeatsUpL.value ?? '—'} <small>L</small>
            </dd>
          </div>
          <div>
            <dt>Rear legroom</dt>
            <dd>
              {car.facts.rearLegroomMm.value ?? '—'} <small>mm</small>
            </dd>
          </div>
        </dl>
        <p className="fit-reason">
          {ranking.reason ?? (
            <>
              Largest score contribution:{' '}
              <strong>
                {largest ? priorityDefinitions[largest.priority].label.toLowerCase() : ''}
              </strong>
              .
            </>
          )}
        </p>
        <div className="card-actions">
          <label className={`compare-checkbox ${atLimit && !selected ? 'is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={selected}
              disabled={atLimit && !selected}
              onChange={onCompare}
              aria-label={`Compare ${fullName(car)}`}
            />
            <span>Compare</span>
          </label>
          <button
            type="button"
            className="text-button"
            aria-expanded={expanded}
            aria-controls={`specs-${car.id}`}
            onClick={() => setExpanded(!expanded)}
          >
            Specs & sources <span aria-hidden="true">{expanded ? '−' : '+'}</span>
          </button>
        </div>
        {expanded && (
          <div id={`specs-${car.id}`} className="expanded-specs">
            <a className="text-button" href={`/garage?vehicle=${encodeURIComponent(car.id)}`}>
              Add to your garage →
            </a>
            <h4>Published specifications</h4>
            {car.manufacturerConfiguration && (
              <p>
                Manufacturer code: {car.manufacturerConfiguration.code}.{' '}
                {car.manufacturerConfiguration.transmission}.{' '}
                {car.manufacturerConfiguration.specificationsUrl && (
                  <a
                    href={car.manufacturerConfiguration.specificationsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Manufacturer specifications ↗
                  </a>
                )}
              </p>
            )}
            {car.governmentRating && (
              <p>
                NRCan class: {car.governmentRating.vehicleClass}. Fuel:{' '}
                {car.governmentRating.fuelType}.{' '}
                <a href={ratingUrl(car.governmentRating.recordId)} target="_blank" rel="noreferrer">
                  Exact NRCan vehicle report ↗
                </a>
              </p>
            )}
            <p>{car.availability.note}</p>
            <dl>
              {car.publishedPrice && (
                <div>
                  <dt>Published all-inclusive price</dt>
                  <dd>
                    <PublishedPrice car={car} />
                  </dd>
                </div>
              )}
              {metricKeys.map((metric) => (
                <div key={metric}>
                  <dt>{metricDefinitions[metric].label}</dt>
                  <dd>
                    <SourcedFact metric={metric} fact={car.facts[metric]} />
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              Review dates appear on each linked source. Cargo measurement methods can differ.
              Published width may use different mirror conventions. {catalog.pricingNote}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function Comparison({
  selected,
  weights,
  open,
  onClose,
  onRemove,
  onShare,
  shareUrl,
}: {
  selected: Car[];
  weights: Weights;
  open: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
  onShare: () => void;
  shareUrl: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kilometres, setKilometres] = useState('15000');
  const [gas, setGas] = useState('1.60');
  const [electricity, setElectricity] = useState('0.15');
  const [electricShare, setElectricShare] = useState('50');
  const fuelInputsValid =
    kilometres.trim() !== '' &&
    gas.trim() !== '' &&
    Number.isFinite(Number(kilometres)) &&
    Number(kilometres) >= 0 &&
    Number(kilometres) <= 200000 &&
    Number.isFinite(Number(gas)) &&
    Number(gas) > 0 &&
    Number(gas) <= 5;
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="comparison-dialog"
      aria-labelledby="comparison-title"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="dialog-header">
        <div>
          <p className="eyebrow">THE SIDE-BY-SIDE</p>
          <h2 id="comparison-title">See the tradeoffs.</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close comparison"
          autoFocus
        >
          <Icon name="close" size={24} />
        </button>
      </div>
      <p className="dialog-intro">
        Canadian retail configurations and government rating variants. Check each record's status; a
        fuel rating does not establish current retail availability. Click a spec for its source.
        Verified prices exclude freight/PDI, taxes and fees.
      </p>
      <div className="comparison-tools">
        <button type="button" className="button secondary" onClick={onShare}>
          <Icon name="link" size={17} />
          Copy comparison link
        </button>
        <span>Includes these cars and your priority weights.</span>
      </div>
      {shareUrl && (
        <label className="share-fallback">
          Comparison link
          <input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
      {selected.length < 2 ? (
        <div className="empty-state">
          <h3>Add another car to compare.</h3>
          <p>Select at least two configurations from the catalog.</p>
          <button type="button" className="button primary" onClick={onClose}>
            Back to cars
          </button>
        </div>
      ) : (
        <>
          <div
            className="table-scroll"
            role="region"
            aria-label="Car specifications comparison; scroll horizontally for more cars"
            tabIndex={0}
          >
            <table>
              <caption className="sr-only">
                Published Canadian vehicle specifications and rating variants
              </caption>
              <thead>
                <tr>
                  <th scope="col">The details</th>
                  {selected.map((car) => (
                    <th scope="col" key={car.id}>
                      <span className="car-make">
                        {car.make} · {modelYearLabel(car)}
                      </span>
                      <strong>{car.model}</strong>
                      <span>
                        {car.trim} · {car.drivetrain}
                        {car.variant && ` · ${car.variant}`}
                      </span>
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`Remove ${fullName(car)} from comparison`}
                        onClick={() => onRemove(car.id)}
                      >
                        Remove ×
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Record and availability</th>
                  {selected.map((car) => (
                    <td key={car.id}>
                      {car.recordKind === 'government-rating'
                        ? 'Government rating; retail trim not specified.'
                        : car.recordKind === 'manufacturer-offer'
                          ? 'Manufacturer offer; model year not verified.'
                          : 'Retail configuration.'}{' '}
                      {car.modelYearNote && `${car.modelYearNote} `}
                      {car.availability.note}
                    </td>
                  ))}
                </tr>
                <tr className="score-table-row">
                  <th scope="row">Your fit score</th>
                  {selected.map((car) => (
                    <td key={car.id}>
                      <strong>{scoreCar(car, weights).score ?? 'Unscored'}</strong>
                      {scoreCar(car, weights).score !== null && ' / 100'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Powertrain</th>
                  {selected.map((car) => (
                    <td key={car.id}>
                      {car.fuel} · {car.drivetrain}
                    </td>
                  ))}
                </tr>
                {metricKeys.map((metric) => (
                  <tr key={metric}>
                    <th scope="row">{metricDefinitions[metric].label}</th>
                    {selected.map((car) => (
                      <td key={car.id}>
                        <SourcedFact metric={metric} fact={car.facts[metric]} />
                      </td>
                    ))}
                  </tr>
                ))}
                {selected.some((car) => car.publishedPrice) && (
                  <tr>
                    <th scope="row">Published all-inclusive price</th>
                    {selected.map((car) => (
                      <td key={car.id}>
                        <PublishedPrice car={car} />
                      </td>
                    ))}
                  </tr>
                )}
                <tr>
                  <th scope="row">Estimated annual energy</th>
                  {selected.map((car) => {
                    const cost =
                      kilometres.trim() !== '' &&
                      ((car.fuel !== 'Electric' && car.fuel !== 'Plug-in hybrid') ||
                        electricity.trim() !== '') &&
                      (car.fuel !== 'Plug-in hybrid' || electricShare.trim() !== '') &&
                      (car.fuel === 'Electric' || gas.trim() !== '')
                        ? annualEnergyCost(
                            car,
                            Number(kilometres),
                            Number(gas),
                            Number(electricity),
                            Number(electricShare) / 100,
                          )
                        : null;
                    return (
                      <td key={car.id}>
                        {cost === null ? 'Not available' : currency.format(cost)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <fieldset className="fuel-calculator">
            <legend>Make energy costs yours</legend>
            <label>
              Annual kilometres
              <input
                type="number"
                min="0"
                max="200000"
                step="100"
                inputMode="numeric"
                value={kilometres}
                onChange={(event) => setKilometres(event.target.value)}
                aria-describedby="fuel-note"
                aria-invalid={!fuelInputsValid}
              />
            </label>
            <label>
              Gas price / fuel price · CAD / litre
              <input
                type="number"
                min="0.01"
                max="5"
                step="0.01"
                inputMode="decimal"
                value={gas}
                onChange={(event) => setGas(event.target.value)}
                aria-describedby="fuel-note"
                aria-invalid={!fuelInputsValid}
              />
            </label>
            <label>
              Electricity · CAD / kWh
              <input
                type="number"
                min="0"
                max="2"
                step="0.01"
                inputMode="decimal"
                value={electricity}
                onChange={(event) => setElectricity(event.target.value)}
                aria-describedby="fuel-note"
              />
            </label>
            <label>
              Plug-in electric-mode driving · %
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                inputMode="numeric"
                value={electricShare}
                onChange={(event) => setElectricShare(event.target.value)}
                aria-describedby="fuel-note"
              />
            </label>
            <p id="fuel-note">
              {fuelInputsValid
                ? 'Estimate = distance × published consumption × your energy prices. EVs use kWh; plug-in hybrids use your electric-mode distance share and include any fuel burned in that mode. Use the appropriate regular, premium or diesel price and your actual charging electricity rate. Charging session fees are excluded. The default 50% plug-in share is an assumption, not a driving prediction. Inputs stay in this visit and are excluded from shared links. Maintenance, insurance and depreciation are excluded.'
                : 'Enter 0–200,000 annual kilometres and a gas price above $0 and at most $5.'}
            </p>
          </fieldset>
        </>
      )}
      <p className="comparison-footnote">
        Reviewed {reviewedDate}. Cargo measurement methods and width conventions can differ between
        manufacturers; confirm real-world fit before buying. Engine versus total-system power
        depends on each source; check field notes. Fit scores reflect only your selected priorities.
      </p>
    </dialog>
  );
}

export function App() {
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const [weights, setWeights] = useState<Weights>(initialShared.weights);
  const [compareIds, setCompareIds] = useState<string[]>(initialShared.compare);
  const [comparisonOpen, setComparisonOpen] = useState(initialShared.compare.length >= 2);
  const { savedIds, storageWarning, setSaved, clearShortlist } = useShortlist(cars);
  const [urlWarning, setUrlWarning] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [sort, setSort] = useState('fit');
  const [requestedPage, setRequestedPage] = useState(1);
  useEffect(() => setRequestedPage(1), [filters, sort, weights, savedIds]);
  const selected = compareIds
    .map((id) => cars.find((car) => car.id === id))
    .filter((car): car is Car => !!car);
  const reviewAge = Math.floor((Date.now() - Date.parse(catalog.reviewedAt)) / 86400000);

  useEffect(() => {
    const next = `${window.location.pathname}${serializeSharedState({ compare: compareIds, weights })}${window.location.hash}`;
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
  }, [compareIds, weights]);
  useEffect(() => {
    const navigate = () => {
      const next = parseSharedState(window.location.search, cars);
      setCompareIds(next.compare);
      setWeights(next.weights);
      setComparisonOpen(next.compare.length >= 2);
    };
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, []);

  const results = useMemo(() => {
    const ranked = rankCars(filterCars(cars, filters, savedIds), weights);
    if (sort === 'price')
      ranked.sort(
        (a, b) =>
          (a.car.facts.msrpCad.value ?? Infinity) - (b.car.facts.msrpCad.value ?? Infinity) ||
          a.car.id.localeCompare(b.car.id),
      );
    if (sort === 'fuel')
      ranked.sort(
        (a, b) =>
          (a.car.facts.fuelCombinedL100km.value ?? Infinity) -
            (b.car.facts.fuelCombinedL100km.value ?? Infinity) || a.car.id.localeCompare(b.car.id),
      );
    return ranked;
  }, [filters, weights, savedIds, sort]);
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
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
    url.search = serializeSharedState({ compare: compareIds, weights });
    try {
      await navigator.clipboard.writeText(url.toString());
      setAnnouncement('Comparison link copied.');
    } catch {
      setShareUrl(url.toString());
      setAnnouncement('Copy the comparison link from the text field.');
    }
  }
  function resetFilters() {
    setFilters({ ...defaultFilters });
  }

  return (
    <>
      <a className="skip-link" href="#cars">
        Skip to cars
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="OSS — One Stop Shop home">
          <span className="brand-mark">
            <Icon name="garage" size={26} />
          </span>
          <span>
            oss<span className="brand-dot">.</span>
          </span>
          <span className="brand-full">
            ONE STOP
            <br />
            SHOP
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#cars">Find your fit</a>
          <a href="#methodology">How it works</a>
          <a className="garage-nav" href="/garage">
            Garage
          </a>
          <button
            type="button"
            className="shortlist-nav"
            onClick={() => {
              setFilters((previous) => ({ ...previous, savedOnly: !previous.savedOnly }));
              document.getElementById('cars')?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                  ? 'auto'
                  : 'smooth',
              });
            }}
            aria-pressed={filters.savedOnly}
          >
            <Icon name="save" size={18} />
            Shortlist <span>{savedIds.length}</span>
          </button>
        </nav>
      </header>
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> THE RIGHT CAR STARTS WITH YOU
            </p>
            <h1 id="hero-title">
              Less scrolling.
              <br />
              <span>More certainty.</span>
            </h1>
            <p className="hero-description">
              Your next car, without the rabbit hole. Compare the details that matter and find the
              fit for your everyday.
            </p>
            <a className="button primary" href="#cars">
              Find your fit <Icon name="arrow" />
            </a>
            <p className="hero-proof">Official sources. Your priorities. No app account needed.</p>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <span className="visual-coordinate">YOUR LIFE ↗ YOUR CAR</span>
            <CarArt make="Honda" />
            <div className="visual-label">
              <span className="visual-check">✓</span>
              <div>
                <strong>A little more clarity.</strong>
                <span>A lot less second-guessing.</span>
              </div>
            </div>
            <span className="visual-index">01 / FIND YOUR FIT</span>
          </div>
        </section>
        <div className="trust-strip">
          <span>
            <Icon name="check" size={16} />
            {cars.length.toLocaleString('en-CA')} catalog records · {makes.length} makes
          </span>
          <span>
            {years.length ? `${years[years.length - 1]}–${years[0]}` : 'Model years unverified'}
            {unverifiedYearCount > 0 && ` · ${unverifiedYearCount} year-unverified offers`} · Canada
            · retail coverage in progress
          </span>
          <span>Reviewed {reviewedDate}</span>
          <a href="#sources">Meet the sources ↗</a>
        </div>
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
          <div className="section-heading">
            <div>
              <p className="eyebrow">A SHORTLIST STARTS HERE</p>
              <h2 id="catalog-title">Find what fits.</h2>
            </div>
            <p>
              Explore Canadian vehicles across makes and powertrains.
              <br />
              Start with your needs, then get into the details.
            </p>
          </div>
          <div className="catalog-layout">
            <aside className="filters" aria-label="Filters and priorities">
              <div className="filter-heading">
                <h3>
                  <Icon name="sliders" size={18} />
                  Make it yours
                </h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    resetFilters();
                    setWeights({ ...defaultWeights });
                  }}
                >
                  Reset
                </button>
              </div>
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
              <label className="field-label" htmlFor="make">
                Make
              </label>
              <select
                id="make"
                value={filters.make}
                onChange={(event) => setFilters({ ...filters, make: event.target.value })}
              >
                <option value="all">All makes</option>
                {makes.map((make) => (
                  <option key={make} value={make}>
                    {make}
                  </option>
                ))}
              </select>
              <label className="field-label" htmlFor="year">
                Model year
              </label>
              <select
                id="year"
                value={filters.year}
                onChange={(event) => setFilters({ ...filters, year: event.target.value })}
              >
                <option value="all">All model years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
                {unverifiedYearCount > 0 && <option value="unverified">Year not verified</option>}
              </select>
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
                {[25000, 35000, 50000, 75000, 100000, 150000, 250000, 500000, 1000000].map(
                  (value) => (
                    <option key={value} value={value}>
                      {currency.format(value)}
                    </option>
                  ),
                )}
              </select>
              <p className="field-hint">
                A price limit includes only verified CAD base MSRP. Unknown prices are not treated
                as free.
              </p>
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
              <label className="saved-filter">
                <input
                  type="checkbox"
                  checked={filters.savedOnly}
                  onChange={(event) => setFilters({ ...filters, savedOnly: event.target.checked })}
                />
                Only my shortlist <span>{savedIds.length}</span>
              </label>
              <fieldset className="priorities">
                <legend>What matters most?</legend>
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
                      onChange={(event) =>
                        setWeights({ ...weights, [key]: Number(event.target.value) })
                      }
                      aria-valuetext={`${weights[key]} out of 5`}
                    />
                  </div>
                ))}
                <a href="#methodology" className="methodology-link">
                  How your fit score works ↗
                </a>
              </fieldset>
              <div className="scope-note">
                <strong>Coverage is expanding.</strong>
                <p>
                  {governmentRatingCount.toLocaleString('en-CA')} government ratings are imported.
                  Retail trim, price and current availability reviews are still in progress. NRCan
                  groups some conventional and hybrid variants together. A rating is not a live
                  inventory listing.
                </p>
              </div>
            </aside>
            <div className="results" id="catalog-results">
              <div className="results-toolbar">
                <label className="search-box">
                  <span className="sr-only">Search cars</span>
                  <Icon name="search" size={19} />
                  <input
                    type="search"
                    placeholder="Search make, model or trim"
                    value={filters.query}
                    onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                    maxLength={100}
                  />
                </label>
                <label className="sort-control">
                  <span>Sort by</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value)}>
                    <option value="fit">Your best fit</option>
                    <option value="price">Lowest MSRP</option>
                    <option value="fuel">Fuel economy</option>
                  </select>
                </label>
              </div>
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
                  {filters.savedOnly ? ' in your shortlist' : ' for your consideration'}
                </p>
                <span>
                  {sort === 'fit'
                    ? 'Ranked around you'
                    : sort === 'price'
                      ? 'Lowest base MSRP first'
                      : 'Lowest combined L/100 km first'}
                </span>
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
            <p className="eyebrow">NOT A MYSTERY NUMBER</p>
            <h2 id="methodology-title">
              Your priorities.
              <br />
              Our working, shown.
            </h2>
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
                    Price: CAD $30k–$60k and combined consumption: 4–12 L/100 km (lower is better).
                    Cargo, seats up: 500–1,200 L and rear legroom: 850–1,150 mm (higher is better).
                    Values outside a scale are capped at its ends. Fuel economy uses liquid-fuel
                    L/100 km; plug-in hybrids use fuel-only operation. EVs stay unscored while that
                    priority is active. Electric consumption is shown separately in kWh/100 km.
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
              <p className="eyebrow">CHECK OUR WORK</p>
              <h2 id="sources-title">Good decisions need good sources.</h2>
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
          <small>FIND YOUR FIT.</small>
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
            clear site data in your browser to remove them. Comparison IDs and priority weights
            appear in shareable URLs, so anyone with a link can see those choices. We do not collect
            search, priority or fuel-cost inputs. The hosting provider receives standard connection
            and access information when serving the site. External manufacturer links follow their
            own privacy policies. Garage vehicles, odometer readings, reminders and service history
            are also saved locally. Export a garage backup before clearing site data; clearing site
            data removes these records. Manage individual vehicles and backups on the Garage page.
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
      {compareIds.length > 0 && (
        <div className="compare-tray" aria-label="Selected cars">
          <div className="tray-copy">
            <span className="tray-count">
              {compareIds.length}
              <small>/4</small>
            </span>
            <div>
              <strong>{compareIds.length === 4 ? 'Comparison full' : 'Your comparison'}</strong>
              <span>
                {compareIds.length === 1
                  ? 'Choose at least one more car'
                  : selected.map((car) => `${car.make} ${car.model}`).join(' · ')}
              </span>
            </div>
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
              Compare {compareIds.length} cars <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      )}
      <Comparison
        selected={selected}
        weights={weights}
        open={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        onRemove={toggleCompare}
        onShare={() => void shareComparison()}
        shareUrl={shareUrl}
      />
    </>
  );
}
