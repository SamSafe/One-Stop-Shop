# OSS v1 release contract

This records the initial release. The active expansion objective is every new
passenger vehicle currently offered for sale in Canada, including pickups and
vans. Its completion criteria are in
[CANADIAN-MARKET-COVERAGE.md](CANADIAN-MARKET-COVERAGE.md).

Status: implemented; release verification and publication are recorded in
[RELEASE-REPORT.md](RELEASE-REPORT.md).

## Product decisions

- First product: OSS. Garage remains planned and has no runtime dependency.
- First market: Canada (confirmed by the user). Prices are CAD, fuel consumption
  is L/100 km, cargo is litres and dimensions are millimetres.
- Catalog: model-year 2026 compact SUV configurations, curated from manufacturer
  publications. This is a dated specification/MSRP snapshot, not live inventory,
  a used-car valuation, a dealer quote, or comprehensive market coverage.
- Stack: TypeScript, React, Vite; static production deployment. Catalog data is
  validated at build time and bundled with the application. No runtime database,
  API keys, accounts, third-party tracking, or backend operations are necessary
  for this release. This deliberately reduces operating complexity.
- Save shortlists on the user's device. Share comparisons through URLs.
  There is no application database or cloud shortlist sync; URL parameters are
  visible to recipients and may appear in host access logs.

## Required behavior

- Browse and search a small, verified catalog; filter budget, fuel and drivetrain.
- Rank using explicit price, efficiency, cargo and rear-legroom weights.
- Explain the scoring formula, its limits and the underlying facts.
- Compare 2–4 exact configurations; share and reload a comparison URL.
- Save a shortlist across reloads; recover from corrupt or unavailable storage.
- Show provenance, units, missing values, review date and MSRP exclusions.
- Support keyboard navigation and small screens, including the comparison table.

## Release gates

- Locked reproducible installation and a clean production build/typecheck.
- Catalog validation rejects duplicate identities, unreferenced sources, invalid
  units/ranges, unreviewed facts and known values without provenance.
- Unit tests cover ranking, filtering, unknown data, URLs and storage recovery.
- Browser tests cover complete comparison/shortlist journeys, mobile layout,
  keyboard interaction and automated accessibility checks.
- CI runs the above gates and enforces package import boundaries.
- Static deployment has security headers, cache policy, health/readiness guidance
  and a documented rollback procedure.
- Dependency audit is reviewed; remaining issues and verification limits are
  recorded rather than hidden behind a production-ready label.

## Deferred

Garage, maintenance advice, automated scraping, reliability ratings, dealer
listings, purchase transactions, financing, account sync and monetization.
Add these only with their own acceptance criteria and trustworthy input data.
