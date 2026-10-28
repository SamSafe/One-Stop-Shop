import { useEffect, useMemo, useRef, useState } from 'react';
import type { Car } from '@oss/car-catalog';
import { fullName } from './domain';
import { Icon } from './catalogView';
import { downloadFile } from './download';
import { readShortlistBackup, shortlistBackup, shortlistFileLimit } from './shortlist';
import type { ShortlistImport } from './shortlist';

const pageSize = 10;

export function ShortlistDialog({
  cars,
  ids,
  compareIds,
  warning,
  onClose,
  onSave,
  onImport,
  onCompare,
  onCompareNow,
  onBrowse,
}: {
  cars: Car[];
  ids: string[];
  compareIds: string[];
  warning: string | null;
  onClose: () => void;
  onSave: (id: string, wanted: boolean) => void;
  onImport: (ids: string[]) => number;
  onCompare: (id: string) => void;
  onCompareNow: () => void;
  onBrowse: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const importHeading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [pending, setPending] = useState<ShortlistImport | null>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [requestedPage, setRequestedPage] = useState(1);
  const byId = useMemo(() => new Map(cars.map((car) => [car.id, car])), [cars]);
  const saved = ids.map((id) => byId.get(id)).filter((car): car is Car => !!car);
  const pages = Math.max(1, Math.ceil(saved.length / pageSize)),
    page = Math.min(requestedPage, pages);
  const start = (page - 1) * pageSize;
  const alreadySaved = pending?.recognized.filter((id) => ids.includes(id)).length ?? 0;
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    return () => {
      request.current++;
    };
  }, []);
  function close() {
    dialog.current?.close();
    onClose();
  }
  function focusResults() {
    requestAnimationFrame(() => {
      resultHeading.current?.focus({ preventScroll: true });
      resultHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
  function changePage(next: number) {
    setRequestedPage(next);
    focusResults();
  }
  async function readFile(file: File | undefined) {
    const token = ++request.current;
    setPending(null);
    setError('');
    setNotice('');
    if (!file) return;
    try {
      if (file.size > shortlistFileLimit)
        throw new Error('Choose a shortlist JSON backup smaller than 2 MB.');
      const next = readShortlistBackup(await file.text(), cars);
      if (token !== request.current) return;
      setPending(next);
      requestAnimationFrame(() => importHeading.current?.focus());
    } catch (error) {
      if (token === request.current)
        setError(error instanceof Error ? error.message : 'That shortlist could not be read.');
    }
  }
  return (
    <dialog
      className="comparison-dialog shortlist-dialog"
      ref={dialog}
      aria-labelledby="shortlist-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={onClose}
    >
      <div className="dialog-header">
        <h2 id="shortlist-title">Your shortlist</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close shortlist"
          autoFocus
          onClick={close}
        >
          <Icon name="close" size={24} />
        </button>
      </div>
      <p className="dialog-intro">
        All {saved.length} saved configurations, independent of catalog filters. Backups contain
        your choices; prices and specifications come from this catalog when reopened.
      </p>
      {warning && (
        <p className="shortlist-warning" role="alert">
          {warning} Export a backup to keep your choices.
        </p>
      )}
      <div className="shortlist-tools">
        <button
          type="button"
          className="button secondary"
          disabled={!saved.length}
          onClick={() => downloadFile(shortlistBackup(ids), 'oss-shortlist-backup.json')}
        >
          Export shortlist
        </button>
        <label className="button secondary shortlist-import">
          Choose shortlist backup
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label="Choose shortlist backup"
            onChange={(event) => {
              void readFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            dialog.current?.close();
            onBrowse();
          }}
        >
          Show entire shortlist in catalog
        </button>
      </div>
      <p className="shortlist-fine">
        Backups stay on your device until you choose to share the file. Imports add to your
        shortlist and keep existing choices. They do not change your active comparison.
      </p>
      {error && (
        <p className="shortlist-warning" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <section className="shortlist-import-preview" aria-labelledby="shortlist-import-title">
          <h3 id="shortlist-import-title" ref={importHeading} tabIndex={-1}>
            Review shortlist import
          </h3>
          <p>
            {pending.recognized.length}{' '}
            {pending.recognized.length === 1 ? 'configuration is' : 'configurations are'} available
            in this catalog. {alreadySaved} {alreadySaved === 1 ? 'is' : 'are'} already saved.
          </p>
          {pending.recognized.length > 0 && (
            <ul>
              {pending.recognized.slice(0, 5).map((id) => (
                <li key={id}>{fullName(byId.get(id)!)}</li>
              ))}
              {pending.recognized.length > 5 && (
                <li>And {pending.recognized.length - 5} more configurations.</li>
              )}
            </ul>
          )}
          {pending.unavailable.length > 0 && (
            <p>
              {pending.unavailable.length}{' '}
              {pending.unavailable.length === 1 ? 'configuration is' : 'configurations are'}{' '}
              unavailable in this catalog and will not be added. Keep the original file to retain
              those choices.
            </p>
          )}
          <div className="shortlist-tools">
            <button
              type="button"
              className="button primary"
              disabled={!pending.recognized.length}
              onClick={() => {
                const count = onImport(pending.recognized);
                setPending(null);
                setRequestedPage(1);
                setNotice(
                  `${count} ${count === 1 ? 'configuration added' : 'configurations added'}. Existing choices were kept.`,
                );
                focusResults();
              }}
            >
              Add imported configurations
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setPending(null);
                fileInput.current?.focus();
              }}
            >
              Cancel import
            </button>
          </div>
        </section>
      )}
      <p className="shortlist-fine" role="status">
        {notice}
      </p>
      <h3 className="shortlist-result-title" ref={resultHeading} tabIndex={-1}>
        Saved configurations{saved.length > pageSize && ` · Page ${page} of ${pages}`}
      </h3>
      {!saved.length ? (
        <p>
          No saved configurations yet. Save vehicles with their bookmark buttons or import a
          shortlist backup.
        </p>
      ) : (
        <ul className="shortlist-list">
          {saved.slice(start, start + pageSize).map((car) => (
            <li key={car.id}>
              <h4>{fullName(car)}</h4>
              <div className="shortlist-tools">
                <label className="matching-filter">
                  <input
                    type="checkbox"
                    checked={compareIds.includes(car.id)}
                    disabled={!compareIds.includes(car.id) && compareIds.length >= 4}
                    onChange={() => onCompare(car.id)}
                    aria-label={`Compare ${fullName(car)}`}
                  />
                  Compare
                </label>
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Remove ${fullName(car)} from shortlist`}
                  onClick={() => {
                    onSave(car.id, false);
                    setNotice(`${fullName(car)} removed from your shortlist.`);
                    focusResults();
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav className="pagination" aria-label="Shortlist pages">
          <button
            type="button"
            className="button secondary"
            disabled={page === 1}
            onClick={() => changePage(page - 1)}
          >
            Previous saved vehicles
          </button>
          <span>
            Page {page} of {pages} · {start + 1}–{Math.min(start + pageSize, saved.length)} of{' '}
            {saved.length}
          </span>
          <button
            type="button"
            className="button secondary"
            disabled={page === pages}
            onClick={() => changePage(page + 1)}
          >
            Next saved vehicles
          </button>
        </nav>
      )}
      <p className="shortlist-fine">Choose two to four configurations to compare.</p>
      <div className="shortlist-tools">
        <button
          type="button"
          className="button primary"
          disabled={compareIds.length < 2}
          onClick={() => {
            dialog.current?.close();
            onCompareNow();
          }}
        >
          Compare {compareIds.length} cars
        </button>
        <button type="button" className="button secondary" onClick={close}>
          Done
        </button>
      </div>
    </dialog>
  );
}
