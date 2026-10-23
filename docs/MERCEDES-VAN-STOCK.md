# Canadian Mercedes-Benz passenger and crew van stock

On **2026-10-23**, the manufacturer's public Canadian new-inventory service
returned **81 distinct vehicles** across **54 listed Canadian dealers**, 18
dealer groups and 19 pages. The query pages were captured from
18:43:38.429Z through 18:45:57.824Z. All captured vehicles are classified `NEW`,
available, non-demo and unreserved by that service. Title, physical condition,
selling price and delivery still require confirmation.

This pass adds five older bare-model profiles and model-level stock evidence to
eight existing base profiles. It does not expand all observed equipment into
priced retail configurations or establish complete national stock coverage.

## Published sources and request contract

- [Canadian vans inventory page](https://www.mercedes-benz-vans.ca/en/vehicles/inventory):
  explicit Canadian country/currency and public service endpoints.
- `https://nafta-service.mbvans.com/api/dl/ca/dealers?radius=all&brand=mb`:
  54 distinct dealer IDs with Canadian addresses. Postal codes come from the
  directory, not a user's location.
- `https://nafta-service.mbvans.com/api/inv/en_ca/new/initdata?brand=mb` and
  `https://nafta-service.mbvans.com/api/inv/en_ca/new/fp/config?brand=mb`:
  current inventory filters and archived factory references. Their union includes
  159 passenger/crew model-year references and 70 distinct model codes, covering
  2018–2026. Archived references alone are not current-offering evidence.
- The inventory page's published inventory and common clients define GET search,
  dealer/model filters, page semantics and response processing. Exact reviewed
  client hashes are pinned; a changed contract aborts synchronization.

Queries use the public `new/vehicles/search/v2` endpoint, groups of at most three
directory dealer IDs, all 70 passenger/crew model codes, `currentDealerOnly=true`,
`shared=true`, and a 12-row page capacity. No year, price or equipment restriction
is applied. Every listed dealer is represented once. Cargo-only vans,
cab/chassis and cargo eSprinter codes are outside this passenger query.

The request's `start` is a zero-based **page number**. The response's
`currentOffset` is a **row offset**. For the 19-result group, page `start=1`
returns offset 12 and seven rows. `currentCount=12` expresses capacity, even
when fewer rows are returned. Validation reconciles pages, returned rows,
group totals and distinct identities; it never silently accepts a first page.

Every returned vehicle's year, model code, passenger/crew body, powertrain and
Canadian dealer are joined explicitly. Hashes of vehicle identifiers preserve
distinctness without placing VINs in the tracked snapshot. Account data,
cookies, lead submissions, quotes, reservations and orders are not used.

## Older profiles and price basis

Thirteen model-year/code profiles appear in the captured stock. Five are older
2025 Sprinters absent from the current factory selectors:

| Model year/code | Bare-model MSRP |
| --------------- | --------------: |
| 2025/2CV144H    |      74,640 CAD |
| 2025/2CV144S    |      70,660 CAD |
| 2025/2P144A     |      93,730 CAD |
| 2025/2P144H     |      84,290 CAD |
| 2025/2P144S     |      80,200 CAD |

Each price comes directly from the public Canadian `en_ca/build/content/byo`
response with `brand=mb`, `valid=true` and the exact year/model/class/body.
Powertrain code must agree with observed stock. `msrp` is bare-model MSRP before
optional equipment, paint, freight/PDI, fees, levies, sales taxes and incentives.
It is not the configured listing amount or a dealer selling price.

The stock response's `msrp` and misleadingly named `priceBreakdown.baseMSRP`
can contain the configured vehicle amount. These are retained as observation
data, not normalized bare-model prices. No guessed subtraction of options or
fees is used. The older price-tree request contract remains unverified; this
pass consumes the explicit model MSRP, without deriving configured package prices.

Some stock vehicles have optional high roofs despite a standard-roof model
name. An older crew model's name also conflicts with its default-roof metadata.
Roof claims are omitted from the added profiles' visible labels; roof dimensions
and seating remain unknown. Stock seating/roof properties are not copied into
base profiles. Standard Output, High Output and AWD labels stay distinct.

The inventory filters contain a 2023 Metris passenger reference, but no matching
vehicle was returned in this capture. That is neither positive stock evidence
nor an independent nationwide absence determination. It is not imported as an
available vehicle or silently classified as discontinued.

## Refresh and limits

Run `npm run catalog:sync:mercedes-vans`. Reviewed original captures can use
`-- --from-captures <manifest.json>`; `-- --offline` checks source hashes and
requires exact normalized reconstruction, preserving original receipt timestamps.
All required sources must fall within a 24-hour capture window. The snapshot
date is the last actual required receipt, not the time of an offline rebuild.

Required-source failures, redirects, changed native clients, missing dealer or
model-code contexts, paging discrepancies, duplicate/conflicting identities,
foreign/used records, wrong archive years and changed powertrain joins abort
replacement. Losing an observed model-year offering or a dealer context requires
review. The tracked file is replaced atomically after validation.

All listed-dealer queries reconcile in this source capture. Independent dealer
offerings, missing manufacturer model references, passenger-car inventory,
configured equipment prices and additional technical facts remain open. The
broader [Canadian market objective](CANADIAN-MARKET-COVERAGE.md) is still active.
