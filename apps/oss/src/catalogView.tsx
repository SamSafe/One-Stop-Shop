import { catalog, metricDefinitions } from '@oss/car-catalog';
import type { Car, Fact, Metric } from '@oss/car-catalog';
import { nonApplicableReason } from './specifications';
const sources = new Map(catalog.sources.map((source) => [source.id, source]));
export const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
export const reviewedDate = formatDate(catalog.reviewedAt);
export const metricKeys = Object.keys(metricDefinitions) as Metric[];

export function Icon({
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

function displayFact(metric: Metric, fact: Fact): string {
  if (fact.value === null) return 'Not verified';
  if (metric === 'msrpCad') return currency.format(fact.value);
  return `${fact.qualifier === 'up-to' ? 'Up to ' : ''}${fact.value.toLocaleString('en-CA', { maximumFractionDigits: 1 })} ${metricDefinitions[metric].unit}`;
}

export function SourcedFact({
  metric,
  car,
  showNotes = true,
  showUnknownNotes = true,
}: {
  metric: Metric;
  car: Car;
  showNotes?: boolean;
  showUnknownNotes?: boolean;
}) {
  const fact = car.facts[metric];
  const notApplicable = nonApplicableReason(car, metric);
  if (notApplicable)
    return (
      <>
        <span>Not applicable</span>
        <small className="fact-note" hidden={!showNotes}>
          {notApplicable}
        </small>
      </>
    );
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
      {fact.note && (
        <small className="fact-note" hidden={fact.value === null ? !showUnknownNotes : !showNotes}>
          {fact.note}
        </small>
      )}
    </>
  );
}

export const publishedCurrency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export function PublishedPrice({ car, showNotes = true }: { car: Car; showNotes?: boolean }) {
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
      <small className="fact-note" hidden={!showNotes}>
        {price.province} · before sales tax. {price.note}
      </small>
    </>
  );
}
