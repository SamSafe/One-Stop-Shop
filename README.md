# One Stop Shop — OSS

A Canadian car comparison app that explains how each configuration fits your
priorities. Market expansion is in progress: the working catalog includes 2,518
NRCan rating records for 2025–2027 across 47 makes, plus 2,575 retail configurations
(1,701 with verified prices), including 40 currently listed Subaru configurations and
328 Toyota/Lexus factory packages, 78 Honda/Acura configurations and 212 default
Ford/Lincoln factory configurations, 68 Mazda model/option configurations and
80 Hyundai factory trims/packages, 126 Kia factory trims/packages and 1,230
Chevrolet/GMC/Buick/Cadillac factory matrix configurations and 101 Nissan/Infiniti
versions and equipment packages, 33 Volkswagen factory configurations and 49
Mitsubishi factory trims, 120 Polestar factory/equipped new-stock configurations and
110 BMW stock/factory model-year profiles. BMW retains observed 2025–2027 years;
107 exact factory MSRP values and 59 configured technical joins are verified.
Polestar includes 14 current motor/pack/option configurations and seven older-year
stock configurations. Disjoint source-declared filters reconcile all six listed
retailers' feeds; additional factory equipment and independent market reconciliation remain open.
Seventeen Mitsubishi trims belong to older model-year
families referenced in new inventory; their individual availability remains unchecked. Additional Ford/Lincoln
and GM equipment selections remain in progress; unavailable GM calculations leave
854 MSRP values unverified. Conflicting Infiniti price definitions leave another
17 MSRP values unverified; three older BMW prices also remain unverified.
Five retail configurations also retain the initial manufacturer specification
review. Matching ratings are merged with those retail
configurations instead of duplicating them. The app currently displays 5,089
records, including gasoline/hybrid, diesel, flex-fuel, electric and plug-in hybrid
variants, cars, SUVs, pickups and vans.

This is not yet a complete list of everything currently for sale. Government
rating variants are labeled separately from retail trims. Current availability,
exact trim coverage, prices and specifications still need manufacturer review.
See [the full-market coverage objective and evidence](docs/CANADIAN-MARKET-COVERAGE.md)
and run `npm run catalog:coverage` for the current gaps.

Browse and filter, set priority weights, compare 2–4 cars, estimate annual fuel
costs, share a comparison URL and save a shortlist on your device. Every published
numeric specification has an official source. Prices are CAD base MSRP; liquid
fuel is L/100 km, electricity is kWh/100 km, cargo is litres and dimensions are
millimetres. Unknown prices remain searchable until a budget limit is applied.
Missing active scoring metrics leave a record unscored. This is a dated research catalog;
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
It verifies the built dist directory against its checksum manifest before
starting, then serves it with security headers, gzip and safe cache policies.
Put it behind HTTPS. Use the production server for release checks;
Vite's preview command is a development convenience.

To create a standalone local release archive from a clean, committed checkout:

    npm run package:release

The archive, checksums and source receipt are written under artifacts/. Packaging
rejects stale or altered builds and uses a unique, content-based archive name.
Extract it and run node scripts/serve.mjs; no npm install is needed for the release.
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

The NRCan baseline is attributed under the Open Government Licence – Canada.
Refresh it explicitly with `npm run catalog:sync -- 2025 2026 2027`; ordinary builds
use the checked-in snapshot and require no data-source network access. All pages,
totals and unique record IDs must reconcile before the snapshot is replaced.
Refresh Subaru's published lineup and base MSRP with `npm run catalog:sync:subaru`.
Refresh Toyota/Lexus with `npm run catalog:sync:tci`. That importer reconciles the
current display years, factory models and visible packages for both brands.
Use `npm run catalog:sync:tci -- --offline` to reconstruct the existing snapshot
from checksum-verified raw captures without advancing its review date.
Refresh Honda/Acura with `npm run catalog:sync:honda`; `-- --offline` reconstructs
that capture from verified raw responses. Lineup years, trims and transmissions
must reconcile with exact pricing identities. Calculator-only configurations and
model cards without a current year remain explicit availability research gaps.
Refresh Ford/Lincoln with `npm run catalog:sync:ford`; `-- --offline` verifies and
rebuilds the capture without changing its date. Model-year, trim and body variants
must reconcile with their exact default builds. MSRP excludes fees, delivery
allowances, explicit package discounts and colour charges. See
[the configurator data contract and remaining selections](docs/FORD-CONFIGURATOR.md).
Refresh Mazda with `npm run catalog:sync:mazda`; `-- --offline` checks the source
captures and rebuilds without advancing their date. Factory package prices are
complete configuration MSRP. Conflicting coming-soon flags and cargo measurements
remain explicit gaps; see [the Mazda source contract](docs/MAZDA-CONFIGURATOR.md).

Refresh Hyundai with `npm run catalog:sync:hyundai`; `-- --offline` verifies its
captured source hashes and original date. Every current model/year, parent trim
and factory subtrim/package reconciles. Exact calculator MSRP excludes delivery
and fees. Unavailable model specification endpoints, ambiguous shared columns
and a Kona price-source conflict remain explicit gaps. See
[the Hyundai source contract](docs/HYUNDAI-CONFIGURATOR.md).

Refresh Kia with `npm run catalog:sync:kia`; `-- --offline` verifies source hashes
and preserves the capture date. Both grouped and flat model lists reconcile,
including separate 2027 EV4 evidence and current 2025 offerings. Factory packages
retain their own MSRP and specifications. Commercial-only PV5 cargo variants are
excluded with official evidence; FSC aliases and ambiguous measurements remain
in the gap report. See [the Kia source contract](docs/KIA-CONFIGURATOR.md).

Reconstruct GM from reviewed captures with `npm run catalog:sync:gm -- --offline`.
Its Canadian selectors reconcile every body/trim/engine/transmission/axle/battery/
propulsion tuple. Exact calculator component/subtotal checks separate factory
MSRP from fees, colours and dealer products. Rejected or mismatched calculations
remain unknown. A new reviewed capture can be imported with `-- --from-captures
<manifest.json>` while preserving its original date; this command does not claim
a fresh live retrieval. See [the GM source contract](docs/GM-CONFIGURATOR.md).

Refresh Nissan/Infiniti with `npm run catalog:sync:nissan`; `-- --offline` verifies
captured source hashes and preserves the retrieval date. Both selector years and
all factory versions reconcile; exact specification joins keep roof, transmission
and equipment variants distinct. Superseded pages, ambiguous units, Infiniti price
definitions and 35 older inventory-selector references remain explicit gaps. See
[the Nissan/Infiniti source contract](docs/NISSAN-CONFIGURATOR.md).

Refresh Volkswagen with `npm run catalog:sync:volkswagen`; `-- --offline` verifies
source hashes and preserves their date. The model overview and build selector
reconcile against exact Canadian catalogue models, including non-default
transmissions, encoded factory packages and passenger ID. Buzz variants.
MSRP uses model prices before regional charges and incentives. Virtual model
cards, roof/charger alternatives, additional equipment and older new inventory
remain explicit gaps. See [the Volkswagen source contract](docs/VOLKSWAGEN-CONFIGURATOR.md).

Refresh Mitsubishi with `npm run catalog:sync:mitsubishi`; `-- --offline` verifies
the original response and request hashes without advancing the date. Current
active codes, exact Canadian trim prices and specification tables reconcile.
Additional inventory model years retain their own factory records and unchecked
trim availability. A 2027 Outlander inventory reference without factory data,
ambiguous PHEV power/modes and charging windows remain open. See
[the Mitsubishi source contract](docs/MITSUBISHI-CONFIGURATOR.md).

Refresh Polestar with `npm run catalog:sync:polestar`; `-- --offline` verifies
original request/response hashes and reconstructs the dated snapshot. Current
motor/pack/single-option transitions and every listed retailer/model's distinct
stock configurations reconcile with single-page filter partitions. Discounts and delivery are separate from configured
MSRP. Additional equipment, independent retailer/market review, missing technical fields
and generic/EPA range conflicts remain explicit gaps. See
[the Polestar source contract](docs/POLESTAR-CONFIGURATOR.md).

Capture BMW's public new-stock feed with `npm run catalog:capture:bmw-stock`
(Playwright Chromium required), then refresh factory data with
`npm run catalog:sync:bmw`. The stock capture must have the same source date.
`-- --offline` verifies exact request/response reconstruction; reviewed factory
captures can be imported with `-- --from-captures <manifest.json>`.
Repeated inventory pages, six current codes without an explicit year mapping,
older ordering restrictions and additional equipment/transmission choices remain
open. RRP excludes fees and incentives; technical country-group fields do not
establish Canadian fuel/energy cycles. See [the BMW source contract](docs/BMW-CONFIGURATOR.md).

Manufacturer listings establish a current offering, not dealer stock or delivery
dates; older model-year inventory and additional specifications still need review.

## Operating the project

- [Release scope](docs/RELEASE-PLAN.md)
- [Deployment, monitoring and rollback](docs/OPERATIONS.md)
- [Verified catalog research and sources](docs/CATALOG-RESEARCH.md)
- [Implemented data contract](docs/DATA-MODEL.md)
- [Decisions](docs/DECISIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Release verification](docs/RELEASE-REPORT.md)

CI checks package boundaries, unit tests, catalog freshness, types, production
build, dependencies and browser journeys, packages the verified release, then
smoke-tests a non-root container.
Weekly scheduled runs catch stale data and new advisories. Dependency updates
are proposed through Dependabot.
