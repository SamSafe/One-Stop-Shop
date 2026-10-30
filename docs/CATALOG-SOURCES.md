# Catalog sources and refresh

Every catalog record comes from a checked-in snapshot of an official Canadian
source. Ordinary builds read those snapshots and make no network requests. This
page covers how to check the snapshots and importers and how to refresh each
source. Each linked source contract defines what an import must reconcile before
it may replace a snapshot.

## Checking source health

`npm run catalog:health` lists every snapshot with its retrieval date and age.
It reads only tracked files and is safe to run anywhere.

| Command                              | What it verifies                                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run catalog:health`             | Snapshot age. Add `--fail-on-stale` to exit non-zero past `--max-age-days` (45 by default).                                                                |
| `npm run catalog:health -- --replay` | Each importer rebuilds its snapshot from the local, checksum-verified captures in `data/raw` (`--offline` mode). A failure means parsing code has drifted. |
| `npm run catalog:health -- --live`   | Each importer runs against its live source. Changes are summarised by field and array entries. A failure means the source changed shape.                   |

Replay and live runs work in a temporary copy of the scripts and catalog
package, so tracked snapshots and `data/raw` are never modified. Use
`--only kia,honda` to limit the run and `--report file.json` for the full
result. A live result of `changed` shows that a refresh is available; it does not
apply one. Refresh deliberately with the commands below and review the diff.

The weekly [Catalog source health](../.github/workflows/catalog-health.yml)
workflow runs the live check with `--fail-on-stale`, uploads the JSON report and
adds a summary table to the run. A failed run means an importer needs review. GM
and Land Rover import only reviewed captures, so the live check skips them.
New importers must be registered in
[scripts/lib/catalog-sources.ts](../scripts/lib/catalog-sources.ts); a unit test
fails if a `sync-*` or `capture-*` script is missing from the registry.

The Garage owner directory joins catalog configurations. Rebuild it with
`npm run garage:sync:directory` after any manufacturer refresh; a replay check
fails while it is out of date.

## Importers

| Source                               | Refresh                                                             | Contract                                                |
| ------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------- |
| NRCan ratings                        | `npm run catalog:sync -- 2025 2026 2027`                            | [Canadian market coverage](CANADIAN-MARKET-COVERAGE.md) |
| Aston Martin                         | `npm run catalog:sync:aston-martin`                                 | [Aston Martin](ASTON-MARTIN-CONFIGURATOR.md)            |
| BMW                                  | `catalog:capture:bmw-stock`, then `catalog:sync:bmw`                | [BMW](BMW-CONFIGURATOR.md)                              |
| Ford and Lincoln                     | `npm run catalog:sync:ford`                                         | [Ford](FORD-CONFIGURATOR.md)                            |
| Genesis                              | `npm run catalog:sync:genesis`                                      | [Genesis](GENESIS-CONFIGURATOR.md)                      |
| GM (Chevrolet, GMC, Buick, Cadillac) | Reviewed captures only; `scripts/retry-gm-calculations.ts`          | [GM](GM-CONFIGURATOR.md)                                |
| Honda and Acura                      | `npm run catalog:sync:honda`                                        | [Source notes](#source-notes)                           |
| Hyundai                              | `npm run catalog:sync:hyundai`                                      | [Hyundai](HYUNDAI-CONFIGURATOR.md)                      |
| Kia                                  | `npm run catalog:sync:kia`                                          | [Kia](KIA-CONFIGURATOR.md)                              |
| Land Rover                           | Reviewed captures only: `catalog:sync:landrover -- --from-captures` | [Land Rover](LAND-ROVER-SOURCES.md)                     |
| Lucid                                | `npm run catalog:sync:lucid`                                        | [Lucid](LUCID-CONFIGURATOR.md)                          |
| Mazda                                | `npm run catalog:sync:mazda`                                        | [Mazda](MAZDA-CONFIGURATOR.md)                          |
| McLaren                              | `catalog:capture:mclaren`, then `catalog:sync:mclaren`              | [McLaren](MCLAREN-RESEARCH.md)                          |
| Mercedes-Benz                        | `npm run catalog:sync:mercedes`                                     | [Mercedes-Benz](MERCEDES-CONFIGURATOR.md)               |
| Mercedes-Benz vans                   | `npm run catalog:sync:mercedes-vans`                                | [Mercedes-Benz van stock](MERCEDES-VAN-STOCK.md)        |
| MINI                                 | `catalog:capture:mini-stock`, then `catalog:sync:mini`              | [MINI](MINI-CONFIGURATOR.md)                            |
| Mitsubishi                           | `npm run catalog:sync:mitsubishi`                                   | [Mitsubishi](MITSUBISHI-CONFIGURATOR.md)                |
| Nissan and Infiniti                  | `npm run catalog:sync:nissan`                                       | [Nissan](NISSAN-CONFIGURATOR.md)                        |
| Polestar                             | `npm run catalog:sync:polestar`                                     | [Polestar](POLESTAR-CONFIGURATOR.md)                    |
| Porsche                              | `npm run catalog:sync:porsche`                                      | [Porsche](PORSCHE-CONFIGURATOR.md)                      |
| Rivian                               | `npm run catalog:sync:rivian`                                       | [Rivian](RIVIAN-CONFIGURATOR.md)                        |
| Subaru                               | `catalog:sync:subaru`, then `catalog:sync:subaru-specifications`    | [Subaru specifications](SUBARU-SPECIFICATIONS.md)       |
| Toyota and Lexus                     | `npm run catalog:sync:tci`                                          | [Source notes](#source-notes)                           |
| VinFast                              | `npm run catalog:sync:vinfast`                                      | [VinFast](VINFAST-PRICING.md)                           |
| Volkswagen                           | `npm run catalog:sync:volkswagen`                                   | [Volkswagen](VOLKSWAGEN-CONFIGURATOR.md)                |
| Garage owner directory               | `garage:capture:directory`, then `garage:sync:directory`            | [Owner directory](OWNER-VEHICLE-DIRECTORY.md)           |

Most importers accept `-- --offline` to rebuild the tracked snapshot from local
captures without advancing its date, and several accept
`-- --from-captures <manifest.json>` for a reviewed capture. Raw captures live in
the ignored `data/raw/<source>` directories, keyed by SHA-256.

## Source notes

### NRCan fuel-consumption ratings

The NRCan baseline is attributed under the Open Government Licence – Canada.
Refresh it explicitly with `npm run catalog:sync -- 2025 2026 2027`; ordinary builds
use the checked-in snapshot and require no data-source network access. All pages,
totals and unique record IDs must reconcile before the snapshot is replaced.

### Subaru

Refresh Subaru's published lineup and base MSRP with `npm run catalog:sync:subaru`.

### Toyota and Lexus

Refresh Toyota/Lexus with `npm run catalog:sync:tci`. That importer reconciles the
current display years, factory models and visible packages for both brands.
Use `npm run catalog:sync:tci -- --offline` to reconstruct the existing snapshot
from checksum-verified raw captures without advancing its review date.

### Honda and Acura

Refresh Honda/Acura with `npm run catalog:sync:honda`; `-- --offline` reconstructs
that capture from verified raw responses. Lineup years, trims and transmissions
must reconcile with exact pricing identities. Calculator-only configurations and
model cards without a current year remain explicit availability research gaps.

### Ford and Lincoln

Refresh Ford/Lincoln with `npm run catalog:sync:ford`; `-- --offline` verifies and
rebuilds the capture without changing its date. Model-year, trim and body variants
must reconcile with their exact default builds. MSRP excludes fees, delivery
allowances, explicit package discounts and colour charges. See
[the configurator data contract and remaining selections](FORD-CONFIGURATOR.md).

### Mazda

Refresh Mazda with `npm run catalog:sync:mazda`; `-- --offline` checks the source
captures and rebuilds without advancing their date. Factory package prices are
complete configuration MSRP. Conflicting coming-soon flags and cargo measurements
remain explicit gaps; see [the Mazda source contract](MAZDA-CONFIGURATOR.md).

### Hyundai

Refresh Hyundai with `npm run catalog:sync:hyundai`; `-- --offline` verifies its
captured source hashes and original date. Every current model/year, parent trim
and factory subtrim/package reconciles. Exact calculator MSRP excludes delivery
and fees. Unavailable model specification endpoints, ambiguous shared columns
and a Kona price-source conflict remain explicit gaps. See
[the Hyundai source contract](HYUNDAI-CONFIGURATOR.md).

### Kia

Refresh Kia with `npm run catalog:sync:kia`; `-- --offline` verifies source hashes
and preserves the capture date. Both grouped and flat model lists reconcile,
including separate 2027 EV4 evidence and current 2025 offerings. Factory packages
retain their own MSRP and specifications. Commercial-only PV5 cargo variants are
excluded with official evidence; FSC aliases and ambiguous measurements remain
in the gap report. See [the Kia source contract](KIA-CONFIGURATOR.md).

### GM (Chevrolet, GMC, Buick, Cadillac)

Reconstruct GM from reviewed captures with `npm run catalog:sync:gm -- --offline`.
Its Canadian selectors reconcile every body/trim/engine/transmission/axle/battery/
propulsion tuple. Exact calculator component/subtotal checks separate factory
MSRP from fees, colours and dealer products. Rejected or mismatched calculations
remain unknown. A new reviewed capture can be imported with `-- --from-captures
<manifest.json>` while preserving its original date; this command does not claim
a fresh live retrieval. Calculations the public calculator rejected for rate
limiting can be retried with `node --import tsx scripts/retry-gm-calculations.ts`,
which writes a review manifest for that import. See [the GM source contract](GM-CONFIGURATOR.md).

### Nissan and Infiniti

Refresh Nissan/Infiniti with `npm run catalog:sync:nissan`; `-- --offline` verifies
captured source hashes and preserves the retrieval date. Both selector years and
all factory versions reconcile; exact specification joins keep roof, transmission
and equipment variants distinct. Superseded pages, ambiguous units, Infiniti price
definitions and 35 older inventory-selector references remain explicit gaps. See
[the Nissan/Infiniti source contract](NISSAN-CONFIGURATOR.md).

### Volkswagen

Refresh Volkswagen with `npm run catalog:sync:volkswagen`; `-- --offline` verifies
source hashes and preserves their date. The model overview and build selector
reconcile against exact Canadian catalogue models, including non-default
transmissions, encoded factory packages and passenger ID. Buzz variants.
MSRP uses model prices before regional charges and incentives. Virtual model
cards, roof/charger alternatives, additional equipment and older new inventory
remain explicit gaps. See [the Volkswagen source contract](VOLKSWAGEN-CONFIGURATOR.md).

### Mitsubishi

Refresh Mitsubishi with `npm run catalog:sync:mitsubishi`; `-- --offline` verifies
the original response and request hashes without advancing the date. Current
active codes, exact Canadian trim prices and specification tables reconcile.
Additional inventory model years retain their own factory records and unchecked
trim availability. A 2027 Outlander inventory reference without factory data,
ambiguous PHEV power/modes and charging windows remain open. See
[the Mitsubishi source contract](MITSUBISHI-CONFIGURATOR.md).

### Polestar

Refresh Polestar with `npm run catalog:sync:polestar`; `-- --offline` verifies
original request/response hashes and reconstructs the dated snapshot. Current
motor/pack/single-option transitions and every listed retailer/model's distinct
stock configurations reconcile with single-page filter partitions. Discounts and delivery are separate from configured
MSRP. Additional equipment, independent retailer/market review, missing technical fields
and generic/EPA range conflicts remain explicit gaps. See
[the Polestar source contract](POLESTAR-CONFIGURATOR.md).

### BMW

Capture BMW's public new-stock feed with `npm run catalog:capture:bmw-stock`
(Playwright Chromium required), then refresh factory data with
`npm run catalog:sync:bmw`. The stock capture must have the same source date.
`-- --offline` verifies exact request/response reconstruction; reviewed factory
captures can be imported with `-- --from-captures <manifest.json>`.
Repeated inventory pages, six current codes without an explicit year mapping,
older ordering restrictions and additional equipment/transmission choices remain
open. RRP excludes fees and incentives; technical country-group fields do not
establish Canadian fuel/energy cycles. See [the BMW source contract](BMW-CONFIGURATOR.md).

### MINI

Reconstruct MINI with `npm run catalog:sync:mini -- --offline`; hashes and source
dates must match the reviewed capture. Capture its normal anonymous national
new-stock session with `npm run catalog:capture:mini-stock` (Playwright Chromium
required), then refresh factory data with `npm run catalog:sync:mini`. Required
source failures abort replacement. A dated 27YQ HTTP 500 response is accepted only
by checksum-matched reviewed capture replay; live failures still abort. Use
`-- --from-captures <manifest.json>` for a reviewed capture. Older stock equipment,
AG/transmission conflicts, additional options and missing specifications remain
explicit gaps. See [the MINI source contract](MINI-CONFIGURATOR.md).

### Genesis

Refresh Genesis with `npm run catalog:sync:genesis`; `-- --offline` verifies exact
request/response hashes and reconstructs the dated capture. Reviewed captures
can be imported with `-- --from-captures <manifest.json>`. Exact trim/year and
mapped factory codes reconcile against the overview, selector and compatible
colour/interior choices. Required failures, lost offerings, lost verified
specifications or lost regional prices abort a live replacement. Regional
all-inclusive pricing, preorder placeholders, year conflicts and older new-stock
research remain explicit. See [the Genesis source contract](GENESIS-CONFIGURATOR.md).

### Rivian

Refresh Rivian with `npm run catalog:sync:rivian`; `-- --offline` verifies the
original request/response hashes and reconstructs the dated snapshot. Reviewed
captures can use `-- --from-captures <manifest.json>`. Canadian model-year rules,
visible wheel/package dependencies, native MSRP/fee breakdowns and sampled
new-stock identities must reconcile. A changed reviewed UI contract, required
source failure or lost offering/served search context aborts a live replacement.
R2/R3 ordering identities, independent national stock review, individual options
and exact technical measurements remain open. See
[the Rivian source contract](RIVIAN-CONFIGURATOR.md).

### Lucid

Refresh Lucid with `npm run catalog:sync:lucid`; `-- --offline` verifies response
hashes and reconstructs the dated snapshot. Reviewed captures can use
`-- --from-captures <manifest.json>`. Menu, factory graph, exact Canadian
model-year price components and sampled new-stock identities must reconcile.
Full graph expansion runs during synchronization; build preparation validates
each stored selection and price. Changed selection semantics, capped/inconsistent
queries, lost current profiles and lost older year/trim evidence abort live
replacement. See [the Lucid source contract](LUCID-CONFIGURATOR.md).

### Mercedes-Benz

Refresh the initial Mercedes-Benz base profiles with
`npm run catalog:sync:mercedes`; `-- --offline` verifies response hashes and exact
reconstruction. Current menu identities, all published model/build pages and
both Sprinter passenger/crew selectors must reconcile before atomic replacement.
Package combinations, older new stock, the Maybach EQS SUV menu placeholder and
one withheld C 300 price conflict remain open. This import does not establish
complete Mercedes-Benz coverage. See
[the Mercedes-Benz source contract](MERCEDES-CONFIGURATOR.md).

### Mercedes-Benz vans

Refresh Canadian Mercedes passenger/crew van new-stock evidence with
`npm run catalog:sync:mercedes-vans`. All directory dealer groups, page totals,
distinct identities and older exact-year bare-model MSRP must reconcile. The
`-- --offline` option checks original receipt hashes and exact reconstruction.
Stock equipment and configured selling prices remain separate from base profiles.
See [the van-stock source contract](MERCEDES-VAN-STOCK.md).

### VinFast

Refresh VinFast's public Canadian Eco/Plus price cards with
`npm run catalog:sync:vinfast`; `-- --offline` verifies response hashes and exact
reconstruction without advancing source dates. The public BC/ON/QC preference
views must all reconcile. Three offers retain an unverified model year; only the
VF 9 ECO has an exact current cash-price/model-year join. Login redirects,
expired finance examples and preliminary specifications remain explicit gaps.
See [the VinFast source contract](VINFAST-PRICING.md).

### Porsche

Refresh Porsche with `npm run catalog:sync:porsche`; `-- --offline` reconstructs
all dated sources exactly. The Canadian menu, exact-year technical tables and
completed transmission/rear-seat selections reconcile before replacement.
Other packages, the limited menu-only allocation and remaining older new stock
remain open. See [the Porsche source contract](PORSCHE-CONFIGURATOR.md).

## What a listing means

Manufacturer listings establish a current offering, not dealer stock or delivery
dates; older model-year inventory and additional specifications still need review.
