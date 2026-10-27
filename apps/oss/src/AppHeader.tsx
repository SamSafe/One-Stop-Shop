import { ThemePicker } from './ThemePicker';
export function AppHeader({
  page,
  savedCount,
  onShortlist,
  savedOnly = false,
}: {
  page: 'compare' | 'garage';
  savedCount?: number;
  onShortlist?: () => void;
  savedOnly?: boolean;
}) {
  return (
    <header className="site-header workspace-header">
      <a className="brand" href="/">
        <span className="brand-word">OSS</span>
        <span className="brand-name">One Stop Shop</span>
      </a>
      <nav className="workspace-nav" aria-label="Main navigation">
        <a href="/" aria-current={page === 'compare' ? 'page' : undefined}>
          Compare vehicles
        </a>
        <a
          href="/garage"
          className={page === 'compare' ? 'secondary-nav-link' : undefined}
          aria-current={page === 'garage' ? 'page' : undefined}
        >
          My garage
        </a>
      </nav>
      <div className="header-tools">
        {onShortlist && (
          <button
            type="button"
            className="shortlist-nav"
            aria-pressed={savedOnly}
            onClick={onShortlist}
          >
            Shortlist <span>{savedCount ?? 0}</span>
          </button>
        )}
        <ThemePicker />
      </div>
    </header>
  );
}
