# GM Canadian source contract

This snapshot contains 1,230 passenger factory matrix configurations across
Chevrolet, GMC, Buick and Cadillac. It reconciles 83 model/year/body references:
79 retained passenger/pickup entries and four separately identified cargo-only
Express/Savana entries. The 32 cargo combinations are documented exclusions;
48 Express/Savana Passenger configurations and personal HD pickups remain included.
Matrix coverage does not establish every optional equipment package, dealer
ordering combination or older vehicle still offered new.

## Canadian lineup and factory identity

- https://www.chevrolet.ca/en/build-and-price
- https://www.gmccanada.ca/en/build-and-price
- https://www.buick.ca/en/build-and-price
- https://www.cadillaccanada.ca/en/build-and-price

Read the actual Canadian configurator links, including selectable current and
previous-year panes. A previous pane can be hidden until selected; gb-hide alone
is not an exclusion. Ignore unused templates and reference text hidden at every
responsive breakpoint. Country, brand and official hostname must agree. Do not
treat an accessible old build URL as proof of a current listing.

The Equinox and 2026 Equinox EV references omitted by the generic selector are
also confirmed on their current official model pages:

- https://www.chevrolet.ca/en/suvs/equinox
- https://www.chevrolet.ca/en/electric/equinox-ev

The public BYO client exposes api/v3/trim-matrix/en/CA/{brand}/{carline}/{year}/
{bodyStyle}?postalCode=T2P1J9. The Alberta postal code is a source-query parameter,
not a user-location assumption or quote. Reconcile options against every nested
trim.configuration using style ID, body ID, drive, model/equipment code, engine,
transmission, axle, battery, propulsion and serialized factory state. Battery and
propulsion codes are nested objects in some trim rows and flat strings in options.
The 2026 Silverado 1500 has 35 styles but 121 matrix configurations; importing only
one build per style would lose source-listed powertrains and axle choices.

Model pages expose JSON assigned to window.appResources. Parse the JSON without
executing scripts, and verify Canadian country/language and exact brand/model/
body/year identity. Published matrix references remain retained when optional
identity/specification pages are unavailable; their missing evidence stays explicit.

## Exact calculations and MSRP

The client's retrieve-configuration POST is a read-only build calculation with
style:en/CA/{model-path}/{styleId}, ss:the matrix's serialized state and postalCode.
It submits no quote, order, customer or contact data. Retain a checksum of the
exact request as well as the response. The fully-configured GET route can supply
an alternative response, but accept it only when every factory identity component
matches the requested configuration. A default engine is not an alternative price
for a different engine, transmission, axle, battery or propulsion system.

The returned selected style must match the matrix, including body ID and equipment
code. Non-selected styles may legitimately have null styleConfig; the selected
style must have a complete identity. A mismatch remains a source gap.

The trim matrix's msrp.amount can include freight and fees. For example, the
captured 2026 Envista Preferred display is $32,883, while standardVehiclePrice is
$29,749 before its separate charges. Use standardVehiclePrice plus selected
factory component prices, reconciling their full sum to vehicleOptionsTotal.
Exclude paid colours, dealer-installed products and accessories; do not include
freight, dealer fees, taxes, incentives or finance prices. Unpriced components,
negative prices, package cash/discount fields, non-Actual pricing or an unmatched
subtotal leave MSRP unknown rather than guessed.

A captured Silverado WT 5.3L V8 combination has $49,299 standard vehicle price,
$2,995 engine and $450 required locking differential: $52,744 factory MSRP. Its
$56,278 charged total is not used. The explicit factory components are included
once, independently of the default engine's price.

During capture the public calculator began rejecting many requests with 403;
some new combinations also returned 422. Valid earlier responses and exactly
matching GET calculations are retained. Of the 1,230 records, 376 have reconciled
MSRP and 854 remain unverified. A published fee-inclusive amount is never used to
hide a rejected calculation. The application has no runtime dependency on GM's
services, so a source outage does not prevent local browsing.

## Specifications and remaining work

Exact calculator key attributes can establish horsepower and explicitly labelled
Canadian city/highway L/100km. Engine versus system output remains source-specific;
ratings are not added, combined fuel consumption is not synthesized and EV energy
equivalence is not gasoline consumption. E-Ray and ZR1X hybrid classifications
follow their [Canadian E-Ray](https://www.chevrolet.ca/en/performance/corvette-eray)
and [ZR1X](https://www.chevrolet.ca/en/performance/corvette-zr1x) product descriptions.
EN0 electric configurations and explicitly described diesel engines remain distinct.
Generic 2WD does not establish front versus rear drive.

Captured features-specs/comparison tables still need exact style/powertrain and
option joins before measurements or operating-mode facts are applied. Default
seating, cabin/cargo measurements or energy values are not copied to a different
combination. Optional equipment/package expansion, current inventory and source
conflicts remain in the coverage report. Manufacturer-listed means listed in the
national tool; it does not promise stock or a delivery date.

## Reproduction

Raw bytes are retained in ignored data/raw/gm, keyed by SHA-256. The reviewed
capture manifest identifies source URLs, response hashes, POST request hashes,
the original date and failed calculation receipts. Import a reviewed manifest
with `npm run catalog:sync:gm -- --from-captures <manifest.json>`. This is a capture
import, not a fresh live refresh. No command advances the capture date implicitly.

`npm run catalog:sync:gm -- --offline` reconstructs the tracked snapshot from the
original manifest and verifies every consumed response hash and expected set.
Ordinary builds use the checked-in normalized snapshot and never fetch sources.
Required lineup, matrix, identity or checksum failures prevent replacement.
