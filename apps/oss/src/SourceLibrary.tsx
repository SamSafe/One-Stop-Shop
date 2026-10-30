import { useMemo, useState } from 'react';
import type { Source } from '@oss/car-catalog';

const pageSize = 12;
export function SourceLibrary({
  items,
  formatDate,
}: {
  items: readonly Source[];
  formatDate: (date: string) => string;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('en-CA');
    return text
      ? items.filter((source) =>
          `${source.publisher} ${source.title} ${source.locator}`
            .toLocaleLowerCase('en-CA')
            .includes(text),
        )
      : items;
  }, [items, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    current = Math.min(page, pages - 1),
    start = current * pageSize;
  return (
    <details
      className="source-library"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Browse {items.length.toLocaleString('en-CA')} official sources</summary>
      {open && (
        <>
          <label className="field-label" htmlFor="source-search">
            Search sources
          </label>
          <input
            id="source-search"
            className="source-search"
            type="search"
            placeholder="Publisher, model or year"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
          <p className="source-results" role="status">
            {filtered.length
              ? `Showing ${(start + 1).toLocaleString('en-CA')}–${Math.min(start + pageSize, filtered.length).toLocaleString('en-CA')} of ${filtered.length.toLocaleString('en-CA')} ${filtered.length === 1 ? 'source' : 'sources'}`
              : 'No sources match that search.'}
          </p>
          <div className="source-grid">
            {filtered.slice(start, start + pageSize).map((source) => (
              <div className="source-entry" key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  <span>
                    {source.publisher}
                    <span aria-hidden="true">↗</span>
                  </span>
                  <strong>{source.title}</strong>
                  <small>Reviewed {formatDate(source.reviewedAt)} · opens in new tab</small>
                </a>
                <details>
                  <summary>Publication details</summary>
                  <p>{source.locator}</p>
                </details>
              </div>
            ))}
          </div>
          <nav className="pagination" aria-label="Source pages">
            <button
              className="text-button"
              type="button"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous sources
            </button>
            <span>
              Page {current + 1} of {pages.toLocaleString('en-CA')}
            </span>
            <button
              className="text-button"
              type="button"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              Next sources
            </button>
          </nav>
        </>
      )}
    </details>
  );
}

export function SourcesSection({
  items,
  reviewedDate,
  formatDate,
}: {
  items: readonly Source[];
  reviewedDate: string;
  formatDate: (date: string) => string;
}) {
  return (
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
      <SourceLibrary items={items} formatDate={formatDate} />
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
  );
}
