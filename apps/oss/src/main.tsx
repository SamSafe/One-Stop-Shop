import { Component, StrictMode, Suspense, lazy } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const garageRoute = /^\/garage\/?$/.test(window.location.pathname);
const App = lazy(() =>
  garageRoute
    ? import('./garage/Garage').then(({ Garage }) => ({ default: Garage }))
    : import('./App').then(({ App }) => ({ default: App })),
);

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('OSS could not render.', error, info.componentStack);
  }
  render() {
    if (this.state.failed)
      return (
        <main className="error-page">
          <p className="eyebrow">ONE STOP SHOP</p>
          <h1>Something took a wrong turn.</h1>
          <p>Reload to try again. Your saved shortlist and garage stay on this device.</p>
          <a className="button primary" href={garageRoute ? '/garage' : '/'}>
            Reload OSS
          </a>
        </main>
      );
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense
        fallback={
          <main className="error-page" role="status">
            <p className="eyebrow">ONE STOP SHOP</p>
            <h1>{garageRoute ? 'Opening your garage…' : 'Loading Canadian vehicles…'}</h1>
            <p>
              {garageRoute
                ? 'Preparing your vehicles and service history.'
                : 'Preparing comparisons and sources.'}
            </p>
          </main>
        }
      >
        <App />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
);
