import { useEffect, useRef, useState } from 'react';
import type { Car } from '@oss/car-catalog';
import { fullName } from './domain';
import {
  buyingFileLimit,
  buyingBackup,
  readBuyingWorkspace,
  reviewDimensions,
  verdictLabels,
} from './buying';
import type { BuyingWorkspace, ReviewDimension, TestDriveReview } from './buying';
import type { BuyingStore } from './useBuyingWorkspace';
import { downloadFile } from './download';
import { Icon } from './catalogView';
import { useDialogLayout } from './useDialogLayout';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function newReview(car: Car): TestDriveReview {
  return {
    id: crypto.randomUUID(),
    carId: car.id,
    vehicleName: fullName(car),
    date: today(),
    createdAt: new Date().toISOString(),
    verdict: 'unsure',
    ratings: { enjoyment: null, comfort: null, rearSpace: null, visibility: null },
    notes: '',
  };
}
export function TestDriveSummary({ review }: { review: TestDriveReview | undefined }) {
  if (!review) return <span>No test-drive review yet.</span>;
  return (
    <span>
      {verdictLabels[review.verdict]} · {review.date}
      {review.ratings.enjoyment !== null && ` · Enjoyment ${review.ratings.enjoyment}/5`}
    </span>
  );
}
export function TestDriveDetails({ review }: { review: TestDriveReview | undefined }) {
  return (
    <>
      <p>
        <TestDriveSummary review={review} />
      </p>
      {review && (
        <>
          <dl className="review-ratings">
            {(Object.keys(reviewDimensions) as ReviewDimension[]).map((key) => (
              <div key={key}>
                <dt>{reviewDimensions[key]}</dt>
                <dd>
                  {review.ratings[key] === null ? 'Not assessed' : `${review.ratings[key]}/5`}
                </dd>
              </div>
            ))}
          </dl>
          {review.notes && (
            <details>
              <summary>Read test-drive notes</summary>
              <p className="review-notes">{review.notes}</p>
            </details>
          )}
        </>
      )}
    </>
  );
}
export function TestDriveJournal({
  store,
  cars,
  initialCarId,
  onClose,
}: {
  store: BuyingStore;
  cars: Car[];
  initialCarId: string | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    editorHeading = useRef<HTMLHeadingElement>(null),
    request = useRef(0);
  const [carId, setCarId] = useState(initialCarId ?? ''),
    [query, setQuery] = useState(''),
    [requestedPage, setPage] = useState(1);
  useDialogLayout(dialog);
  const [editor, setEditor] = useState<{
    original: TestDriveReview | null;
    draft: TestDriveReview;
  } | null>(() => {
    const car = cars.find((c) => c.id === initialCarId);
    return car && !store.workspace.reviews.some((r) => r.carId === car.id)
      ? { original: null, draft: newReview(car) }
      : null;
  });
  const [removing, setRemoving] = useState<TestDriveReview | null>(null),
    [clearing, setClearing] = useState<string | null>(null);
  const [pending, setPending] = useState<BuyingWorkspace | null>(null),
    [fileError, setFileError] = useState(''),
    [notice, setNotice] = useState('');
  const reviews = store.workspace.reviews
    .filter(
      (r) =>
        (!carId || r.carId === carId) &&
        `${r.vehicleName} ${r.notes}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id),
    );
  const pages = Math.max(1, Math.ceil(reviews.length / 10)),
    page = Math.min(requestedPage, pages);
  const reviewedCars = [
    ...new Map(store.workspace.reviews.map((r) => [r.carId, r.vehicleName])).entries(),
  ];
  if (initialCarId && !reviewedCars.some(([id]) => id === initialCarId)) {
    const car = cars.find((c) => c.id === initialCarId);
    if (car) reviewedCars.push([car.id, fullName(car)]);
  }
  const car = cars.find((c) => c.id === carId);
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      request.current++;
    };
  }, []);
  useEffect(() => {
    if (editor)
      requestAnimationFrame(() => {
        editorHeading.current?.focus({ preventScroll: true });
        editorHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
  }, [editor?.draft.id, editor?.original?.id]);
  function close() {
    dialog.current?.close();
    onClose();
  }
  function focusList() {
    requestAnimationFrame(() => {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
  function edit(original: TestDriveReview | null, draft: TestDriveReview) {
    store.clearError();
    setEditor({ original, draft: structuredClone(draft) });
  }
  async function readFile(file: File | undefined) {
    const token = ++request.current;
    setPending(null);
    setFileError('');
    if (!file) return;
    try {
      if (file.size > buyingFileLimit)
        throw new Error('Choose a buying JSON backup smaller than 2 MB.');
      const data = readBuyingWorkspace(await file.text());
      if (token === request.current) setPending(data);
    } catch (e) {
      if (token === request.current)
        setFileError(e instanceof Error ? e.message : 'Backup could not be read.');
    }
  }
  return (
    <dialog
      ref={dialog}
      className="comparison-dialog buying-dialog managed-dialog"
      aria-labelledby="journal-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="dialog-header">
        <div>
          <h2 id="journal-title">Test-drive journal</h2>
          {store.error && (
            <p className="form-error" role="alert">
              {store.error}
            </p>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close journal"
          autoFocus
          onClick={close}
        >
          <Icon name="close" size={24} />
        </button>
      </div>
      <p className="dialog-intro">
        Keep notes and ratings for each drive. Choose Test-drive notes on a vehicle card to record a
        visit.
      </p>
      {store.warning && (
        <p className="notice" role="status">
          {store.warning}
        </p>
      )}
      {editor ? (
        <form
          id="test-drive-form"
          className="buying-form review-editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (store.saveReview(editor.original, editor.draft)) {
              setEditor(null);
              setNotice('Test-drive review saved.');
              focusList();
            }
          }}
        >
          <h3 ref={editorHeading} tabIndex={-1} className="journal-results">
            {editor.original ? 'Edit test-drive review' : 'Record a test drive'}
          </h3>
          <p>{editor.draft.vehicleName}</p>
          <div className="buying-fields">
            <label>
              Test-drive date
              <input
                type="date"
                required
                max={today()}
                value={editor.draft.date}
                onChange={(e) =>
                  setEditor({ ...editor, draft: { ...editor.draft, date: e.target.value } })
                }
              />
            </label>
            <label>
              Your verdict
              <select
                value={editor.draft.verdict}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    draft: {
                      ...editor.draft,
                      verdict: e.target.value as TestDriveReview['verdict'],
                    },
                  })
                }
              >
                {Object.entries(verdictLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {(Object.keys(reviewDimensions) as ReviewDimension[]).map((key) => (
              <label key={key}>
                {reviewDimensions[key]}
                <select
                  value={editor.draft.ratings[key] ?? ''}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      draft: {
                        ...editor.draft,
                        ratings: {
                          ...editor.draft.ratings,
                          [key]: e.target.value ? Number(e.target.value) : null,
                        },
                      },
                    })
                  }
                >
                  <option value="">Not assessed</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} / 5{n === 1 ? ' · poor for me' : n === 5 ? ' · excellent for me' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label>
            Your test-drive notes
            <textarea
              rows={5}
              maxLength={4000}
              value={editor.draft.notes}
              placeholder="Steering feel, getting in and out, road noise, child-seat checks, things to try again…"
              onChange={(e) =>
                setEditor({ ...editor, draft: { ...editor.draft, notes: e.target.value } })
              }
            />
          </label>
        </form>
      ) : (
        <>
          <div className="buying-fields">
            <label>
              Journal vehicle
              <select
                value={carId}
                onChange={(e) => {
                  setCarId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All reviewed vehicles</option>
                {reviewedCars.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search test-drive notes
              <input
                type="search"
                value={query}
                maxLength={100}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
          {car && (
            <button
              type="button"
              className="button primary"
              onClick={() => edit(null, newReview(car))}
            >
              Record another test drive
            </button>
          )}
        </>
      )}
      <div hidden={!!editor}>
        <h3 ref={heading} tabIndex={-1} className="journal-results">
          Saved test drives ({reviews.length})
        </h3>
        <p role="status">{notice}</p>
        {!reviews.length && <p>No test-drive reviews match this view.</p>}
        <ul className="journal-list">
          {reviews.slice((page - 1) * 10, page * 10).map((review) => (
            <li key={review.id}>
              <h4>{review.vehicleName}</h4>
              <p>
                <TestDriveSummary review={review} />
              </p>
              {!cars.some((c) => c.id === review.carId) && (
                <p>
                  This configuration is unavailable in the current catalog. Your review is retained.
                </p>
              )}
              <dl className="review-ratings">
                {(Object.keys(reviewDimensions) as ReviewDimension[]).map((key) => (
                  <div key={key}>
                    <dt>{reviewDimensions[key]}</dt>
                    <dd>
                      {review.ratings[key] === null ? 'Not assessed' : `${review.ratings[key]}/5`}
                    </dd>
                  </div>
                ))}
              </dl>
              {review.notes && <p className="review-notes">{review.notes}</p>}
              <div className="shortlist-tools">
                <button type="button" className="text-button" onClick={() => edit(review, review)}>
                  Edit review
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    store.clearError();
                    setRemoving(review);
                  }}
                >
                  Remove review
                </button>
              </div>
              {removing?.id === review.id && (
                <div className="notice">
                  <p>Remove this test-drive review?</p>
                  <div className="confirmation-actions">
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => {
                        if (store.removeReview(removing)) {
                          setRemoving(null);
                          setNotice('Review removed.');
                        }
                      }}
                    >
                      Confirm remove review
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setRemoving(null)}
                    >
                      Keep review
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {pages > 1 && (
          <nav className="pagination" aria-label="Test-drive pages">
            <button
              type="button"
              className="button secondary"
              disabled={page === 1}
              onClick={() => {
                setPage(page - 1);
                focusList();
              }}
            >
              Previous test drives
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              type="button"
              className="button secondary"
              disabled={page === pages}
              onClick={() => {
                setPage(page + 1);
                focusList();
              }}
            >
              Next test drives
            </button>
          </nav>
        )}
        <details className="buying-backups">
          <summary>Buying backups &amp; device data</summary>
          <p>
            Your brief and all reviews stay in this browser, independently of the shortlist and
            Garage. Back them up before clearing site data or changing devices. Copied catalog links
            do not contain this data.
          </p>
          <div className="shortlist-tools">
            <button
              type="button"
              className="button secondary"
              onClick={() => downloadFile(buyingBackup(store.workspace), 'oss-buying-backup.json')}
            >
              Export buying backup
            </button>
            <label className="button secondary shortlist-import">
              Choose buying backup
              <input
                aria-label="Choose buying backup"
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  void readFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          {fileError && (
            <p className="notice" role="alert">
              {fileError}
            </p>
          )}
          {pending && (
            <section className="notice" aria-label="Buying import preview">
              <p>
                {pending.reviews.length} {pending.reviews.length === 1 ? 'review' : 'reviews'} in
                this backup. New reviews will be added. Your current brief and saved reviews will be
                kept. Keep the original file if it contains changes to a saved review.
              </p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  if (store.merge(pending)) {
                    setPending(null);
                    setNotice('Buying backup merged. Existing data was kept.');
                  }
                }}
              >
                Merge buying backup
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  request.current++;
                  setPending(null);
                }}
              >
                Cancel buying import
              </button>
            </section>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              store.clearError();
              setClearing(store.workspace.revision);
            }}
          >
            Clear buying brief and reviews
          </button>
          {clearing && (
            <div className="notice">
              <p>
                Remove your buying brief and all test-drive reviews from this device? Export a
                backup first.
              </p>
              <div className="confirmation-actions">
                <button
                  type="button"
                  className="button danger"
                  onClick={() => {
                    if (store.clear(clearing)) {
                      setClearing(null);
                      setEditor(null);
                      setNotice('Buying brief and reviews cleared.');
                    }
                  }}
                >
                  Confirm clear buying data
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setClearing(null)}
                >
                  Keep buying data
                </button>
              </div>
            </div>
          )}
        </details>
      </div>
      {editor && (
        <div className="dialog-actions">
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setEditor(null);
              focusList();
            }}
          >
            Cancel review
          </button>
          <button className="button primary" type="submit" form="test-drive-form">
            Save test-drive review
          </button>
        </div>
      )}
    </dialog>
  );
}
