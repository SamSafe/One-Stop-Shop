# One Stop Shop — OSS

A Canadian car comparison app that explains how each configuration fits your
priorities. The first release covers five verified 2026 compact SUV configurations
across Honda, Subaru and Mazda. Prices are CAD base MSRP, fuel consumption is
L/100 km, cargo is litres and dimensions are millimetres.

Browse and filter, set priority weights, compare 2–4 cars, estimate annual fuel
costs, share a comparison URL and save a shortlist on your device. Every published
numeric specification has an official source. This is a dated research catalog;
it does not claim live inventory, current dealer prices, reliability ratings or
complete market coverage.

## Run locally

Requires Node 22.12+ or Node 24; CI and Docker use Node 22.22.2.

    npm ci
    npm run dev

The development server runs at http://127.0.0.1:5173.

## Verify and serve the release

    npm run check
    npx playwright install chromium firefox webkit
    npm run test:e2e
    npm audit --audit-level=moderate
    npm start

The production server defaults to port 8080; configure PORT and HOST as needed.
It serves the built dist directory with security headers, gzip and safe cache
policies. Put it behind HTTPS. Use the production server for release checks;
Vite's preview command is a development convenience.

To create a standalone local release archive from a clean, committed checkout:

    npm run package:release

The archive, checksums and source receipt are written under artifacts/. Extract
it and run node scripts/serve.mjs; no npm install is needed for the release.
External publication is awaiting explicit approval; see the release report.

To test the container:

    docker build -t oss:local .
    docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges -p 127.0.0.1:8080:8080 oss:local

## Architecture

- apps/oss: React/TypeScript UI and app-specific filtering, ranking, URL state
  and device persistence.
- packages/car-catalog: versioned Canadian data, runtime schema, field-level
  provenance, units and validation. It never imports an application.
- apps/garage: future maintenance product; documentation only.
- scripts: catalog and boundary checks plus a dependency-free production server.
- tests/e2e: real browser journeys, accessibility and HTTP production checks.

A static catalog is bundled at build time. There is no runtime database,
application account service, third-party analytics or secret configuration.
Shortlists use local storage; comparisons and weights use URL parameters.
Garage remains independent and will reuse the catalog when it is implemented.

## Operating the project

- [Release scope](docs/RELEASE-PLAN.md)
- [Deployment, monitoring and rollback](docs/OPERATIONS.md)
- [Verified catalog research and sources](docs/CATALOG-RESEARCH.md)
- [Implemented data contract](docs/DATA-MODEL.md)
- [Decisions](docs/DECISIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Release verification](docs/RELEASE-REPORT.md)

CI checks package boundaries, unit tests, catalog freshness, types, production
build, dependencies and browser journeys, then smoke-tests a non-root container.
Weekly scheduled runs catch stale data and new advisories. Dependency updates
are proposed through Dependabot.
