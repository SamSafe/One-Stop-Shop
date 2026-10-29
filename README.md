# One Stop Shop — OSS

Current implementation, coverage limits and verification: [project status](docs/PROJECT-STATUS.md).

Layout, theme, control and copy conventions: [design system](docs/DESIGN-SYSTEM.md).
The [interface review](docs/INTERFACE-REVIEW.md) covers the comparison and Garage screens.

An optional [buying brief and test-drive journal](docs/BUYING-BRIEF.md) separates
must-haves from weighted preferences, including body styles, seats, drivetrain,
horsepower and rear legroom. Save personal test-drive ratings, verdicts and notes
against exact configurations, with local persistence and portable backups. The
brief and reviews stay on this device and are excluded from copied catalog links.

A Canadian vehicle comparison tool. Search and year/make/model selection lead
into specification rows and side-by-side comparisons. Additional filters and
ranking controls open on demand; priced retail, electric and family-SUV quick views help narrow the catalog; matching specifications and source notes can
be toggled in the comparison table. Vehicle headings and row labels stay visible
while scrolling, with mobile columns sized to fit and keyboard focus kept in view. Key differences explain trade-offs relative
to a shareable reference vehicle. The original ivory, green and rust design
language applies across comparison and the separate garage.

A Canadian car comparison app that explains how each configuration fits your
priorities. The working catalog contains 6,083 records across 48 makes: 3,544
year-qualified retail configurations, 25 manufacturer offers with unverified
model years, and 2,514 standalone government rating variants. All 2,518 NRCan
rating IDs for 2025–2027 remain represented; 47 retail configurations carry reviewed exact-rating links; matched ratings are merged into
retail configurations. Manufacturer listings include overlapping 2024–2027 years.

Base MSRP is verified for 2,618 year-qualified retail profiles and published for
16 of the year-unverified offers. Genesis supplies 39 separately labeled Alberta
all-inclusive prices. Unknown facts retain their reasons; preliminary technical
figures, configured stock prices and expired finance examples do not become
exact-year base facts. Manufacturer-listed profiles and observed new stock carry
dated source evidence, without promising delivery or exhaustive national inventory.

Full Canadian market coverage remains in progress. Eighteen makes in the
rating baseline still lack a current manufacturer import. McLaren now has five
explicit 2027 Canadian factory profiles outside that baseline; its remaining
lineup/stock checks and Karma's Canadian retailer evidence remain in the
reconciliation ledger. Independent lineup checks, equipment combinations,
older new stock, exact model years, prices and
technical specifications remain open across the market. Government rating
variants and year-unverified manufacturer offers are labeled separately from
retail configurations. See [the coverage evidence and milestones](docs/CANADIAN-MARKET-COVERAGE.md)
and run `npm run catalog:coverage` for the current gaps.

Browse and filter, set priority weights, compare 2–4 cars, estimate annual fuel
costs, share search or comparison URLs and save a shortlist on your device. Search, filters, sorting and result pages survive reloads; copied links omit the device-only shortlist filter. Searches and filters in URLs are visible to link recipients and may appear in host access logs. Every published
numeric specification has an official source. Scored and budget-filtered prices
are CAD base MSRP. Separately labeled regional all-inclusive prices retain their
own basis and do not replace unknown base MSRP. Liquid
fuel is L/100 km, electricity is kWh/100 km, cargo is litres and dimensions are
millimetres. Unknown prices remain searchable until a budget limit is applied.
Cards preview estimated CAD energy cost per 100 km; comparisons split fuel and electricity costs and explain unavailable estimates. Inapplicable energy fields stay distinct from unverified facts. Optional premium, diesel and E85 prices apply to verified fuel types, with explicit shared-price fallback for unverified grades. Valid price assumptions are included in shared search and comparison links. Default fit scores use verified base price and estimated energy cost across gas, hybrid, EV and plug-in hybrid vehicles. Cargo and rear-legroom priorities are optional. Missing active scoring metrics leave a record unscored; the results show how many records can be scored. Energy inputs are editable and included in shared comparison links. This is a dated research catalog;
it does not claim live inventory, current dealer prices, reliability ratings or
complete market coverage.

The garage at `/garage` starts with a guided Canadian vehicle finder: year, make,
model and optional configuration, then odometer and personal details. Its separate
owner directory covers published model-year entries from 1995–2027 across 66 makes.
Unlisted vehicles can be entered manually. Reviewed manufacturer tasks are
scheduled automatically, with due dates and mileage calculated from actual
service history. The Canadian 2016 Elantra plan contains six sourced tasks;
unreviewed vehicles do not receive invented manufacturer intervals. See
[automatic maintenance coverage](docs/AUTOMATIC-MAINTENANCE.md). Vehicle details and service history
remain editable, with recurring reminders and backup export/restore. Service records support optional CAD amounts and providers, searchable paged history, inclusive date filters and CSV export. Unknown amounts stay explicit; recorded expense totals exclude them. Canadian 2016 Elantra
sedan oil/filter guidance and manual specifications are verified; selected Toyota
and Honda guidance is also available. Unsupported schedules remain unset.
The maintenance overview prioritizes reminders across vehicles, with vehicle/status filters and direct keyboard navigation to the matching task. Overview and history pages move focus and the viewport to new results.
Personal reminders can be corrected without losing linked receipts. Changed or removed reminders reject stale edits and pending removals; newer actual service and odometer readings remain intact.
Garage records stay in this browser. See [maintenance sources](docs/MAINTENANCE-SOURCES.md)
and the [workspace redesign](docs/WORKSPACE-REDESIGN.md). Lookup sources and refresh
commands are documented in [the owner directory contract](docs/OWNER-VEHICLE-DIRECTORY.md).

## Run locally

Requires Node 22.12+ or Node 24; CI and Docker use Node 22.22.2.

    npm ci
    npm run dev

The development server runs at http://127.0.0.1:5173. Open `/garage` for owned vehicles.

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
- apps/oss/src/garage: independent garage page, owned vehicles, local service history,
  reminders and backup/restore. apps/garage documents its product boundary.
- scripts: catalog and boundary checks plus a dependency-free production server.
- tests/e2e: real browser journeys, accessibility and HTTP production checks.

Build preparation validates the complete source catalog and produces a lossless,
hashed data asset. Browsers load comparison data separately from the small UI;
manufacturer importers and their source snapshots run in Node during preparation.
Loading and download-recovery states preserve the device shortlist. See
[catalog delivery and startup measurements](docs/CATALOG-DELIVERY.md).
There is no runtime database, application account service, third-party analytics
or secret configuration.
Shortlists use local storage; browsing context, comparisons, weights and energy assumptions use URL parameters.
Manage shortlist shows all saved configurations independently of filters and supports direct comparison, complete JSON export and previewed import/merge. Backups contain configuration IDs and go only where you choose to save or share the file. Imports keep existing choices and the active comparison; unavailable configurations are reported explicitly.
Garage loads independently and requests comparison specifications only when needed. Known service dates can be exported as a calendar snapshot; background notifications depend on the chosen calendar app.

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

Reconstruct MINI with `npm run catalog:sync:mini -- --offline`; hashes and source
dates must match the reviewed capture. Capture its normal anonymous national
new-stock session with `npm run catalog:capture:mini-stock` (Playwright Chromium
required), then refresh factory data with `npm run catalog:sync:mini`. Required
source failures abort replacement. A dated 27YQ HTTP 500 response is accepted only
by checksum-matched reviewed capture replay; live failures still abort. Use
`-- --from-captures <manifest.json>` for a reviewed capture. Older stock equipment,
AG/transmission conflicts, additional options and missing specifications remain
explicit gaps. See [the MINI source contract](docs/MINI-CONFIGURATOR.md).

Refresh Genesis with `npm run catalog:sync:genesis`; `-- --offline` verifies exact
request/response hashes and reconstructs the dated capture. Reviewed captures
can be imported with `-- --from-captures <manifest.json>`. Exact trim/year and
mapped factory codes reconcile against the overview, selector and compatible
colour/interior choices. Required failures, lost offerings, lost verified
specifications or lost regional prices abort a live replacement. Regional
all-inclusive pricing, preorder placeholders, year conflicts and older new-stock
research remain explicit. See [the Genesis source contract](docs/GENESIS-CONFIGURATOR.md).

Refresh Rivian with `npm run catalog:sync:rivian`; `-- --offline` verifies the
original request/response hashes and reconstructs the dated snapshot. Reviewed
captures can use `-- --from-captures <manifest.json>`. Canadian model-year rules,
visible wheel/package dependencies, native MSRP/fee breakdowns and sampled
new-stock identities must reconcile. A changed reviewed UI contract, required
source failure or lost offering/served search context aborts a live replacement.
R2/R3 ordering identities, independent national stock review, individual options
and exact technical measurements remain open. See
[the Rivian source contract](docs/RIVIAN-CONFIGURATOR.md).

Refresh Lucid with `npm run catalog:sync:lucid`; `-- --offline` verifies response
hashes and reconstructs the dated snapshot. Reviewed captures can use
`-- --from-captures <manifest.json>`. Menu, factory graph, exact Canadian
model-year price components and sampled new-stock identities must reconcile.
Full graph expansion runs during synchronization; build preparation validates
each stored selection and price. Changed selection semantics, capped/inconsistent
queries, lost current profiles and lost older year/trim evidence abort live
replacement. See [the Lucid source contract](docs/LUCID-CONFIGURATOR.md).

Refresh the initial Mercedes-Benz base profiles with
`npm run catalog:sync:mercedes`; `-- --offline` verifies response hashes and exact
reconstruction. Current menu identities, all published model/build pages and
both Sprinter passenger/crew selectors must reconcile before atomic replacement.
Package combinations, older new stock, the Maybach EQS SUV menu placeholder and
one withheld C 300 price conflict remain open. This import does not establish
complete Mercedes-Benz coverage. See
[the Mercedes-Benz source contract](docs/MERCEDES-CONFIGURATOR.md).

Refresh Canadian Mercedes passenger/crew van new-stock evidence with
`npm run catalog:sync:mercedes-vans`. All directory dealer groups, page totals,
distinct identities and older exact-year bare-model MSRP must reconcile. The
`-- --offline` option checks original receipt hashes and exact reconstruction.
Stock equipment and configured selling prices remain separate from base profiles.
See [the van-stock source contract](docs/MERCEDES-VAN-STOCK.md).

Refresh VinFast's public Canadian Eco/Plus price cards with
`npm run catalog:sync:vinfast`; `-- --offline` verifies response hashes and exact
reconstruction without advancing source dates. The public BC/ON/QC preference
views must all reconcile. Three offers retain an unverified model year; only the
VF 9 ECO has an exact current cash-price/model-year join. Login redirects,
expired finance examples and preliminary specifications remain explicit gaps.
See [the VinFast source contract](docs/VINFAST-PRICING.md).

Refresh Porsche with `npm run catalog:sync:porsche`; `-- --offline` reconstructs
all dated sources exactly. The Canadian menu, exact-year technical tables and
completed transmission/rear-seat selections reconcile before replacement.
Other packages, the limited menu-only allocation and remaining older new stock
remain open. See [the Porsche source contract](docs/PORSCHE-CONFIGURATOR.md).

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
