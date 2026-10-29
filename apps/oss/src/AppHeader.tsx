import { ThemePicker } from './ThemePicker';
import { useLayoutEffect, useRef } from 'react';
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
  const header = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = header.current;
    if (!element) return;
    const measure = () =>
      document.documentElement.style.setProperty(
        '--site-header-height',
        `${Math.ceil(element.getBoundingClientRect().height)}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <header ref={header} className="site-header workspace-header">
      <a className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 20V9l8-5 8 5v11H4Zm4 0V11h8v9M8 15h8" />
          </svg>
        </span>
        <span className="brand-word">
          oss<span className="brand-dot">.</span>
        </span>
        <span className="brand-name">
          ONE STOP
          <br />
          SHOP
        </span>
      </a>
      <nav className="workspace-nav" aria-label="Main navigation">
        <a href="/" aria-current={page === 'compare' ? 'page' : undefined}>
          Compare vehicles
        </a>
        <a href="/garage" aria-current={page === 'garage' ? 'page' : undefined}>
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
