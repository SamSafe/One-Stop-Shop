# Polestar Canadian factory and equipped new-stock contract

Reviewed 2026-10-22. The import retains 120 distinct Canadian retail configurations:
14 current motor/pack/single-option combinations and 112 observed equipped stock
identities, with six exact overlaps merged. Seven stock configurations are 2026
Polestar 4 models omitted from the current 2027 build selector. This does not yet
establish every ordering combination or exhaustive Canadian stock coverage.

## Canadian lineup and identities

The [Canadian home page](https://www.polestar.com/en-ca/) and independent
[configure selector](https://www.polestar.com/en-ca/configure/) link the same
three buildable model slugs: `polestar-2`, `polestar-3`, `polestar-4-coupe`.
Each public `initconfig` response independently lists the same available models
and establishes CA, CAD, English and en-CA context. Navigation/footer references
to other models, including Polestar 5, do not establish Canadian ordering
availability; additional new offerings remain in scope for reconciliation.

For example, [Polestar 2's public cash configurator data](https://www.polestar.com/en-ca/polestar-2/configurator/api/v2/initconfig?productType=Cash&customerType=B2C&customerSubtype=None&markdown=true&excludePrice=false)
contains the exact model year, structure week, motor code, full equipped PNO,
feature choices, price breakdown, technical fields and product disclaimers.
Public state tokens describe car/finance selections; no account, private API
credential, order creation or purchase action is needed.

The importer follows every exposed Engine, Packages and SingleOptions transition
until the selected-feature graph closes. Returned model/year/structure-week,
selected engine code/name and PNO must reconcile. Required transitions cannot
disappear silently. These paths yield one Polestar 2, two Polestar 3 and eleven
Polestar 4 configurations. Choosing a Polestar 4 roof or Performance pack can
also add Plus and switch the motor, upholstery or wheels. The returned complete
configuration establishes identity and price; incompatible selections are not
multiplied into an invented Cartesian product.

Colours, upholstery, independent wheels and accessories still need exhaustive
factory compatibility expansion. Currently captured stock configurations retain
their actual equipped PNO rather than inheriting default equipment.

## MSRP, discounts and fees

Factory `cpsPriceBreakdown.car.carTotalBasicPrice` is the undiscounted configured
vehicle price. It must equal the car total before separate delivery and reconcile
to the grand total after adding delivery. The returned default colour/interior,
selected packs and single options are included. Extras, delivery, taxes and
incentives are excluded. Configured MSRP includes selected factory equipment;
it is not an inferred minimum price for the bare retail motor version.

Polestar 2 is $69,900; Polestar 3 Dual motor/Performance are $105,000/$120,000.
Polestar 4 Rear motor starts at $64,900; Plus is $71,700. Dual motor with
Plus/Performance is $82,500, rising to $85,700 with the captured roof and mouldings.
Discounted cash/checkout amounts can be much lower and do not become MSRP.

Stock prices use the exact equipped vehicle's Canadian
`cashPriceData.listPrice.totals.car.carTotalBasicPrice`. Its car total must agree
and the payment total must not be smaller. Discounted prices and delivery totals
are separate. Exact factory/stock overlaps merge only when their prices agree;
conflicting same-identity price/technical evidence prevents replacement.

## New stock and pagination limits

The [Canadian new-stock selector](https://www.polestar.com/en-ca/stock-cars/)
uses public GraphQL at `https://pc-api.polestar.com/eu-north-1/preconfigured-cars/`.
Its `FetchAllDealers` query lists six Canadian retailers. Each retailer and each
of the three model codes is queried with `source: Preconfigured`, CA-market
context, the exact model filter, private-customer pricing, ten-record pages and
the normal browser's `DeliveryDate`/`Asc` sorting. Pre-owned queries are separate.
Reported totals and every returned page must reconcile; GraphQL errors fail even
with HTTP 200. Request-body and response hashes are retained.

The capture contains 489 reported rows and 112 distinct year/structure-week/PNO
identities across the retailer results. Five Polestar 4 retailer feeds repeat
identities across pages despite explicit sorting. These are observations, not
489 different cars or proof of exhaustive stock coverage. The coverage report
retains each affected retailer's reported/distinct counts. Filtered partitions
or an independent listing reconciliation are still needed to prove completeness.
Observed 2026 configurations remain included with their own evidence.

Availability means a dated manufacturer listing. Future or “Announced later on”
delivery estimates remain visible and do not become an immediate-stock promise.

## Technical units and unresolved fields

Only exact configured technical data or that exact stock record establishes
facts. Explicit EPA-labelled km figures take precedence over a generic Electric
range field whose test cycle is not established. Polestar 2 publishes 447 km EPA
alongside a generic 596 km; Polestar 3 has analogous disagreements. These conflicts
remain recorded. Manufacturer disclaimers identify some performance/EPA fields
as preliminary; the app does not represent them as certified NRCan ratings.

Polestar 2's 21.1–21.7 kWh/100 km range remains unknown as a single consumption
fact. No midpoint, minimum or conversion from gasoline equivalents is invented.
Explicit manufacturer hp is retained without converting kW or adding motor power.
Published width includes mirrors. AC 0–100% at the stated kW supply is separate
from DC 10–80% time. Unpublished seats/cabin/cargo remain unknown; technical data
from current factory defaults is not copied into older or differently equipped
stock vehicles.

## Reproduction

Run `npm run catalog:sync:polestar` for an explicit refresh. `-- --offline`
verifies original request and response bytes, retains the original date and
requires identical reconstruction. `-- --from-captures <manifest.json>` imports
reviewed captures. Raw data lives under ignored `data/raw/polestar/`; normalized
records and source receipts are tracked. Required source, identity, transition,
count or adapter-validation failures prevent snapshot replacement. Ordinary
builds and the running application make no manufacturer requests.
