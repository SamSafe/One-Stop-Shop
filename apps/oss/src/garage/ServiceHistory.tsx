import { useId, useMemo, useRef, useState } from 'react';
import type { OwnedVehicle, ServiceRecord } from './domain';
import { today } from './domain';
import { Field } from './fields';
import { download } from './download';
import { focusAndReveal } from './focus';
import { vehicleName } from './vehicleName';
import {
  historyPageSize,
  historyRangeError,
  selectServiceHistory,
  serviceCostSummary,
  serviceCurrency,
  serviceHistoryCsv,
} from './history';
import type { HistoryFilters, HistorySort } from './history';

const number = new Intl.NumberFormat('en-CA');
const emptyFilters = (): HistoryFilters => ({ query: '', from: '', to: '' });

export function ServiceHistory({
  vehicle,
  onEdit,
  onDelete,
}: {
  vehicle: OwnedVehicle;
  onEdit: (record: ServiceRecord) => void;
  onDelete: (record: ServiceRecord) => boolean;
}) {
  const [filters, setFilters] = useState(emptyFilters),
    [sort, setSort] = useState<HistorySort>('newest');
  const [requestedPage, setRequestedPage] = useState(1);
  const [removing, setRemoving] = useState<ServiceRecord | null>(null);
  const summary = useRef<HTMLElement>(null);
  const results = useRef<HTMLHeadingElement>(null);
  const rangeErrorId = useId();
  const records = useMemo(
    () => selectServiceHistory(vehicle.records, filters, sort),
    [vehicle.records, filters, sort],
  );
  const costs = serviceCostSummary(records),
    error = historyRangeError(filters);
  const totalPages = Math.max(1, Math.ceil(records.length / historyPageSize));
  const page = Math.min(requestedPage, totalPages),
    start = (page - 1) * historyPageSize;
  function changeFilter(key: keyof HistoryFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setRequestedPage(1);
    setRemoving(null);
  }
  function reset() {
    setFilters(emptyFilters());
    setSort('newest');
    setRequestedPage(1);
    setRemoving(null);
  }
  function changePage(next: number) {
    setRequestedPage(next);
    setRemoving(null);
    requestAnimationFrame(() => focusAndReveal(results.current));
  }
  return (
    <details className="garage-history">
      <summary ref={summary}>Service history ({vehicle.records.length})</summary>
      {!vehicle.records.length ? (
        <p>No service records yet.</p>
      ) : (
        <section aria-label={`Service history for ${vehicleName(vehicle)}`}>
          <div className="garage-history-controls">
            <Field label="Search service history">
              {(id) => (
                <input
                  id={id}
                  type="search"
                  value={filters.query}
                  maxLength={100}
                  placeholder="Work, provider, notes, date or odometer"
                  onChange={(event) => changeFilter('query', event.target.value)}
                />
              )}
            </Field>
            <Field label="From service date">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={filters.from}
                  max={today()}
                  onChange={(event) => changeFilter('from', event.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? rangeErrorId : undefined}
                />
              )}
            </Field>
            <Field label="To service date">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={filters.to}
                  max={today()}
                  onChange={(event) => changeFilter('to', event.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? rangeErrorId : undefined}
                />
              )}
            </Field>
            <Field label="History order">
              {(id) => (
                <select
                  id={id}
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value as HistorySort);
                    setRequestedPage(1);
                    setRemoving(null);
                  }}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="cost">Highest recorded cost</option>
                </select>
              )}
            </Field>
          </div>
          {error && (
            <p className="garage-notice" role="alert" id={rangeErrorId}>
              {error}
            </p>
          )}
          <div className="garage-history-toolbar">
            <p className="garage-fine" aria-live="polite">
              {records.length} of {vehicle.records.length} service records match.
            </p>
            <div className="garage-actions">
              <button type="button" className="text-button" onClick={reset}>
                Reset history filters
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={!records.length || !!error}
                onClick={() =>
                  download(
                    serviceHistoryCsv(vehicle, records),
                    'oss-service-history.csv',
                    'text/csv;charset=utf-8',
                  )
                }
              >
                Export matching history (CSV)
              </button>
            </div>
          </div>
          {records.length > 0 && (
            <div
              className="garage-history-costs"
              role="group"
              aria-label="Costs for matching service records"
            >
              <strong>
                {costs.known
                  ? serviceCurrency.format(costs.totalCents / 100) + ' CAD recorded'
                  : 'No amounts recorded'}
              </strong>
              <p>
                {costs.known} of {records.length} matching records{' '}
                {costs.known === 1 ? 'has' : 'have'} an amount.{' '}
                {costs.unknown > 0 &&
                  `${costs.unknown} unknown ${costs.unknown === 1 ? 'amount is' : 'amounts are'} excluded.`}{' '}
                These are recorded service costs, not total ownership costs.
              </p>
            </div>
          )}
          {!records.length && !error && <p>No service records match these filters.</p>}
          {records.length > 0 && (
            <h3 className="garage-results-title" ref={results} tabIndex={-1}>
              Service records · Page {page} of {totalPages}
            </h3>
          )}
          {records.slice(start, start + historyPageSize).map((record) => (
            <div className="garage-record" key={record.id}>
              <h4>{record.title}</h4>
              <p>
                {record.on} · {number.format(record.km)} km
              </p>
              <p className="garage-record-cost">
                {record.costCents === undefined
                  ? 'Amount not recorded'
                  : `${serviceCurrency.format(record.costCents / 100)} CAD`}
                {record.provider && ` · ${record.provider}`}
              </p>
              {record.note && <p className="garage-record-note">{record.note}</p>}
              <div className="garage-actions">
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Edit record: ${record.title} on ${record.on}`}
                  onClick={() => onEdit(structuredClone(record))}
                >
                  Edit record
                </button>
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Delete record: ${record.title} on ${record.on}`}
                  onClick={() => setRemoving(structuredClone(record))}
                >
                  Delete
                </button>
              </div>
              {removing?.id === record.id && (
                <div className="garage-confirm">
                  <p>
                    Delete this record? Its reminder will be recalculated from the remaining
                    history.
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      if (onDelete(removing)) {
                        setRemoving(null);
                        requestAnimationFrame(() => summary.current?.focus());
                      }
                    }}
                  >
                    Delete record
                  </button>
                  <button type="button" className="text-button" onClick={() => setRemoving(null)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
          {totalPages > 1 && (
            <nav
              className="garage-history-pages"
              aria-label={`Service history pages for ${vehicleName(vehicle)}`}
            >
              <button
                type="button"
                className="button secondary"
                disabled={page === 1}
                onClick={() => changePage(page - 1)}
              >
                Previous history page
              </button>
              <span>
                Page {page} of {totalPages} · {start + 1}–
                {Math.min(start + historyPageSize, records.length)} of {records.length}
              </span>
              <button
                type="button"
                className="button secondary"
                disabled={page === totalPages}
                onClick={() => changePage(page + 1)}
              >
                Next history page
              </button>
            </nav>
          )}
          <p className="garage-fine">
            CSV exports include all matching records across pages. Use a garage JSON backup to
            restore or transfer editable data.
          </p>
        </section>
      )}
    </details>
  );
}
