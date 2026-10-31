import { Icon } from './catalogView';

export function EmptyResults({
  emptyShortlist,
  onReset,
  onRestoreShortlist,
}: {
  emptyShortlist: boolean;
  onReset: () => void;
  onRestoreShortlist: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name="search" size={30} />
      </span>
      <h3>{emptyShortlist ? 'Your shortlist is empty.' : 'No vehicles match these filters.'}</h3>
      <p>
        {emptyShortlist
          ? 'Save a car with the bookmark button to find it here later.'
          : 'Try a higher budget, another powertrain, or a broader search.'}
      </p>
      <div className="empty-actions">
        <button type="button" className="button secondary" onClick={onReset}>
          Show all cars <Icon name="arrow" size={18} />
        </button>
        {emptyShortlist && (
          <button type="button" className="text-button" onClick={onRestoreShortlist}>
            Restore from a backup
          </button>
        )}
      </div>
    </div>
  );
}

export function ResultsPagination({
  page,
  totalPages,
  firstIndex,
  shown,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  firstIndex: number;
  shown: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Result pages">
      <button
        type="button"
        className="button secondary"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        Previous page
      </button>
      <span role="status">
        Page {page} of {totalPages} · Showing {firstIndex + 1}–{firstIndex + shown} of{' '}
        {total.toLocaleString('en-CA')}
      </span>
      <button
        type="button"
        className="button secondary"
        disabled={page === totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next page
      </button>
    </nav>
  );
}
