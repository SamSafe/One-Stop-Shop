# Mitsubishi Canadian factory and new-inventory contract

Reviewed on 2026-10-22. This capture adds 49 exact factory trims across nine model
years: 32 current build-selector entries and 17 older-year trims whose families
appear in new inventory. Individual availability of the 17 older trims remains
unchecked. This does not establish full Mitsubishi inventory/ordering coverage.

## Public sources and Canadian identities

- [Build-start page](https://www.mitsubishi-motors.ca/en/buy/configure-your-mitsubishi)
- [Configurator](https://www.mitsubishi-motors.ca/en/buy/configure-your-mitsubishi/configurator)
- [National new-inventory model groups](https://clickshop.mitsubishi-motors.ca/api/quickshop/inventory/models/?condition=New&page=1&sort=availability)
- [2026 Outlander specifications](https://www.mitsubishi-motors.ca/en/vehicles/outlander/specs)
- [2026 Outlander PHEV specifications](https://www.mitsubishi-motors.ca/en/vehicles/outlander-phev/specs)
- [2027 Eclipse Sportback specifications](https://www.mitsubishi-motors.ca/en/vehicles/eclipse-sportback/specs)

Public pages embed `window.__PRELOADED_STATE__` and normalized
`window.__APOLLO_STATE__`. A shared parser reads balanced JSON assignments without
executing manufacturer scripts. ID and JSON references resolve as data; missing
or cyclic references fail. The source must establish CA, CAD, metric units,
English, live-app context and the reviewed public GraphQL endpoint.

The configurator's `retiredVehicleInfo.latestVehicleInfo` supplies current vehicle
GUIDs, listed years and exact `activeModelCodes`. The build-start page supplies an
independent set of vehicle-GUID/year links. Both complete sets must reconcile.
Every declared year and code is retained, including both RVR years and the two
2027 EV codes. A default year, engine or trim is not used for other configurations.

The client uses the public read-only `getModelsSelector` query at:

    https://www-graphql.prod.mipulse.co/prod/graphql

Requests specify CA/English context, the exact vehicle GUID/year and a
configuration URL, with empty model/colour/fabric/package/accessory selections.
The URL is a required source input; omitting it produces a GraphQL error even
with HTTP 200. Country, returned vehicle code/year, every factory model code and
the MSRP label must match. HTTP success alone is insufficient. Source receipts
retain both request-body and response SHA256 values.

## Current versus additional inventory years

The current selector lists six model years and 32 trims. The national new-inventory
model endpoint is checked with `condition=New`; used and CPO rows are rejected.
All pages, counts and unique model/year groups must reconcile. Its nine groups
include three 2025 families absent from the current selector: Outlander, RVR and
Eclipse Cross. The public factory query still supplies 6/6/5 exact Canadian trims.

These 17 records retain their own model-year identities, prices and seating. Their
individual trim availability stays `not-checked`, even though the family appears
in new inventory. Current-year specifications are not copied into them. The
inventory feed's 2027 Outlander reference has no returned factory model data and
remains an explicit gap. Its presence cannot justify substituting the 2026 model.
All inventory groups must appear either in a matched model/year or in the gap
ledger; missing an entire older family is a validation error.

The inventory group counts are source observations, rather than a guarantee of
available stock or delivery. Exact VIN/trim stock, omitted older new offerings and
additional factory packages/compatibility still need reconciliation.

## Price and specification basis

The factory response explicitly labels MSRP. Its positive `price.baseValue` must
reconcile with `price.value` and separately returned fees. Canadian context
establishes CAD. All 49 current captured prices reconcile; no regional all-in
price, incentive or optional colour/accessory price is substituted. These are
published factory model-year prices and are not current dealer quotes.

Credential-free GET links reproduce the same public query for source inspection,
including the older year. They avoid the public site's frontend redirect from
retired years while preserving the actual requested Canadian factory response.
No private credential or user account is needed.

Official specification pages contain `SpecificationsModel` tables. The entire
model-code set, exact ID/name, parent model and year must match before applying
fields. All 32 current trims have exact joins; the other 17 retain explicit
technical-data gaps. The selector MSRP takes precedence if a static page's price
differs, with any conflict retained for review.

Published dimensions and cargo use paired metric/imperial values. They must agree
within rounding tolerance; ranges, mismatches and ambiguous units remain unknown.
Cargo behind the third row establishes all-seats-upright volume for three-row
vehicles. A generic cargo label does not establish that arrangement. The source
does not establish a mirror convention for its published width. Unpublished
head/legroom is not inferred from another model or year.

## Hybrid power and energy modes

The 2026 Outlander's exact engine description states `48V BSG`; its technical
table identifies the belt starter-generator. The app classifies it as Hybrid
and displays “48 V mild hybrid” alongside its transmission. It retains the
manufacturer's 174 hp and 8.7 L/100km combined values without adding BSG power.
The 2025 Outlander retains its separate gasoline-engine evidence.

The PHEV's engine hp, front/rear motor ratings and maximum POWER-mode motor field
do not unambiguously establish net combined-system power. Power remains unknown
with those source values and basis visible; the ratings are not summed. Generic
city/highway/combined fuel and gas-plus-electric Le values do not establish an
operating-mode split. The 72 km EV range is distinct from 690 km total driving
range. Its approximate 240 V/15 A charging time retains the unspecified window.

The battery-electric Eclipse Sportback publishes 454 km range and combined
2.1 Le/100km, which remains gasoline-equivalent energy. No L/100km or kWh/100km
consumption is invented. Its 240 V/30 A AC times use different state-of-charge
windows; one is not selected arbitrarily. DC fast-charge times are separate.

## Reproduction

`npm run catalog:sync:mitsubishi` explicitly refreshes the public selectors,
inventory groups, exact factory queries and current specification pages. Required
source/identity failures prevent replacement. A missing factory query for an
additional inventory family remains a recorded gap rather than removing it.

`-- --offline` verifies the consumed hashes and reconstructs the original dated
snapshot. `-- --from-captures <manifest.json>` imports reviewed captured bytes
without advancing their retrieval date. Original responses and request bodies
remain under ignored `data/raw/mitsubishi/`; normalized records and receipts are
tracked. The ordinary build and running app use the snapshot without runtime
manufacturer requests.
