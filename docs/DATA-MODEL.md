# Data contract

This describes the current contract, including the market expansion. The authoritative schema is
[packages/car-catalog/src/schema.ts](../packages/car-catalog/src/schema.ts).

## Shared catalog

The catalog contains schemaVersion, reviewedAt, scope, pricingNote, sources and
cars. Each car identifies make, model, model year, exact trim, Canadian market,
body style, powertrain and drivetrain with a stable ID.

Records distinguish retail-trim configurations from government fuel-rating
variants. A government variant carries its NRCan record ID, rated class, engine,
transmission and fuel type; it is not assigned a fictional retail trim, price or
body style. Availability has an explicit status, evidence source and check date.
Any status other than not-checked requires dated, referenced evidence. Ratings
alone do not prove today's retail availability.

A `manufacturer-offer` is a current Canadian manufacturer listing whose model
year is not established. It must have `year: null`, a visible `modelYearNote`,
dated manufacturer-listing evidence and a referenced source. It cannot carry an
exact government rating. Retail configurations and rating variants still require
a numeric year. Search, comparison headers and saved controls say “Year not
verified”; filters and coverage reports count these offers separately from retail
configurations and government variants. A published MSRP can be retained for an
offer with its year uncertainty, without assigning it to a particular model year.
VinFast's expired finance/lease examples, projected technical tables and image or
product identifiers do not establish current offer years or exact technical facts.

Facts are base MSRP in CAD; city/highway/combined L/100 km; horsepower; seating;
cargo with seats up/down in litres; front/rear headroom and legroom in mm; and
published length, width and height in mm.

An optional `publishedPrice` retains an official regional all-inclusive price in
CAD, before sales tax, with its province, source and explanatory note. It is
displayed separately and never substituted for base MSRP in ranking or budget
filters. Genesis uses its published vehicle amount, the least expensive compatible
colour/interior pair for the exact factory code, and all itemized Alberta fees.
Any unknown fee, preorder or zero placeholder leaves the regional price unknown.
The manufacturer's field name alone does not establish base MSRP: Genesis calls
its all-inclusive vehicle amount `msrp`.

Electric variants also carry combined kWh/100 km, electric-mode Le/100 km,
electric range and published recharge time. Plug-in hybrids preserve fuel burned
in electric operation separately from fuel-only operation. Tailpipe CO₂ is g/km.
EV gasoline consumption is null, rather than a fictional zero-cost fuel rating.
Facts may link to the exact vehicle report through a reviewed official source URL.

Manufacturer imports preserve the official configuration ID, model code and
transmission, plus a reviewed specification URL. The Subaru snapshot reconciles
current national-lineup IDs with each model's trim/transmission pricing records.
Base MSRP is taken from the explicit MSRP field, never a fee-inclusive header
selling price. A manufacturer-listed status identifies the national offering;
it does not assert dealer inventory or a delivery date. Older stock remains a
separate availability review.

Toyota/Lexus snapshots reconcile configured display years, factory model
references and visible packages. Package aliases resolve to their original
factory code while preserving the shared parent source. Retail identity includes
the manufacturer configuration ID so distinct factory packages remain distinct.
The published vehicle price already includes the package price; it is not added
again. Hidden prices, zero-filled dimensions and suppressed specification fields
remain unknown. Source response checksums support an offline reconstruction that
does not advance the review date.

Manufacturer body classifications are retained even when marketing labels differ.
An explicit AWD model description takes precedence over a generic 4WD technical
code. Third-row vehicles use cargo behind the third row for seats-up capacity.
EV/hydrogen fuel-equivalent fields are not liquid-fuel consumption; ambiguous
plug-in hybrid operating modes require further review before cost estimates.

Honda/Acura imports retain every model card, listed model year, retail trim and
transmission. Prices match exact trim IDs/keys and transmission IDs; presentation
suffixes can differ between the lineup and calculator. The calculator's MSRP
field is separate from fee-inclusive selling price, discounts and colour markups.
Calculator-only configurations and cards without a listed year are reported as
availability research gaps. Online-buildability is not a substitute for retail
availability: a low-inventory listing can have online building disabled.

The Honda specification adapter retains exact trim source URLs and measurement
qualifiers. It selects fuel ratings using explicit drivetrain evidence, prefers
combined hybrid power, uses cargo behind the third row for three-row seats-up
capacity, and leaves unresolved width/cargo alternatives unknown. Original CR-V
IDs remain stable while their MSRP is refreshed from the current calculator.

Ford/Lincoln imports reconcile Canadian retail showroom model years with every
model-selection trim/body variant and its default factory build. Future-only,
commercial-only and cargo-only exclusions retain their source identities and
reasons. Personal pickups and passenger vans are included. Exact selected WERS
codes preserve engine/transmission/drive and body identity, including composite
marketed-series codes. Available powertrain alternatives remain in the snapshot
for a further configuration expansion pass; they are not multiplied into invented
build combinations.

Ford MSRP uses the explicit Base + Options fields before fees, delivery allowances,
incentives, explicit package discounts and colour charges. The displayed Total
and TRIM_PRICE are not substituted for MSRP. Missing components or selected
accessories leave the price unverified. Generic 4x2/2-wheel-drive labels do not
establish front versus rear drive. BEV, FHEV and diesel are distinguished using
the selected configuration; absent energy or dimension facts remain unknown.

Mazda imports reconcile active build-tool model years, trim IDs, engine/transmission
variants and model-option packages. Package financial.msrp is the full configuration
price; protection and non-model add-ons are excluded. Shared GS/GT package metadata
does not replace a Kuro retail trim's identity. Exact model/option codes, model-year
identity and specification trim IDs must match at every stage. Source row kinds are
normalized for documented HEADER/Header, DATA/Data and FEATURE forms.

The Mazda adapter retains measurement units and qualifiers, including mirror
positions, roof alternatives, folded-seat heights and fuel grades. It leaves
contradictory rear/front cargo values unknown with an explanation, without silently
swapping them. Coming-soon flags on previous-year entries and older references
with building disabled remain explicit availability/inventory research gaps.

Rivian imports follow the Canadian builder's visible choices and exact model-year
rules. Paired wheel packages, All-Terrain equipment and underbody protection are
derived from those choices. Each equipment profile retains its least expensive
compatible wheel/interior selection; individual cosmetic alternatives and
accessory quantities remain outside that expansion. Factory MSRP excludes paint,
accessory products, delivery, taxes, fees and incentives. Older new-stock profiles
retain their own ruleset and stable identity independent of price. Sampled stock
configuration references do not establish a physical or exhaustive national count.
Current Captain's Chairs use an explicit six-seat description; older stock does
not inherit current-year seating or technical figures.

Porsche snapshots reconcile the Canadian model menu, exact-year detail metadata,
native factory initializers and completed transmission/rear-seat selections.
Unselected transmission placeholders do not become configured vehicles. Stable
identity includes the model year/code, selected transmission and rear-seat state.
Numeric base and option amounts remain separate from fees and taxes. Technical
rows join the selected transmission; combined power and ordinary EV maxima remain
separate from engine-only output and Launch Control overboost. Width excludes
mirrors, and height requires the standard suspension/roof context. A limited
menu-only model keeps unqualified technical tables, price and allocation unknown.

The checked-in NRCan snapshot preserves every selected record and per-page
response receipts. Build-time expansion joins reviewed retail configurations by
explicit NRCan IDs. Both Forester trims can share one rating; exact trim identities
and existing shortlist/link IDs remain stable. Missing or incompatible joins fail.

Each fact contains:

- value: a finite number within a field-specific range, or null.
- source: an official source ID; required for every known value.
- note: measurement method, price basis, trim caveat or missing-data explanation.
  Required when the value is null.

Sources contain a stable ID, title, publisher, HTTPS URL, field/table locator,
publishedAt (nullable) and reviewedAt. Only reviewed official domains are allowed.
Publication and review dates have different meanings. An undated source is not
assigned a fictional publication date. MSRP announcement dates remain visible.

Car IDs and exact configurations are unique. Every referenced source must exist.
Seat counts must be integers. Folded-seat cargo cannot be smaller than seats-up
cargo. Unknown values never become zero.

Measurements are manufacturer-published. Honda width has an unspecified mirror
position, Subaru uses body width and Mazda GX uses folded-mirror width. These
notes must accompany the values. Cargo measurement standards are not harmonized.

## OSS state

The complete source bibliography opens on request and supports publisher/model/
year search with 12 citations per page. Every numeric fact retains its direct
source link regardless of the bibliography's current filter or page. The full
source dataset remains available; closed or paginated views avoid constructing
an unbounded grid for every catalog interaction. Bibliography search and page
choices stay in memory and are excluded from shared comparison links.

- Filters: search, make, model year, NRCan vehicle class, record kind, availability, optional
  maximum base MSRP, powertrain, drivetrain and saved-only. No budget limit is
  active by default; an active limit excludes unknown prices. Results render in
  pages of 30 while selection and shortlists span the whole catalog.
- Priorities: integer weights 0–5 for purchase price, consumption, seats-up cargo
  and rear legroom. Fixed scales live in apps/oss/src/domain.ts.
- Shortlist: versioned local-storage record containing known catalog IDs only.
  Retired, duplicate and unknown IDs are filtered on read. Corrupt payloads and
  unknown record versions are preserved until the user explicitly clears them
  through Privacy & data; choices work in memory while storage is unavailable.
  Reads and cross-tab events never write back to storage. Explicit changes read
  the latest valid record before saving.
- Comparison: at most four known IDs and optional weights in URL parameters.
  A shared link restores the same cars and priorities. If browser history updates
  fail, comparison controls remain usable and Copy comparison link still derives
  a URL from the current choices.
- Fuel estimate: annual kilometres / 100 × combined L/100 km × CAD/litre.
  EV energy estimates use kWh/100 km × CAD/kWh. Plug-in hybrids split distance
  using an explicit electric-mode percentage and include fuel used in that mode.
  The default 50% is an assumption the user can edit. Session fees and ownership
  costs are excluded. Inputs remain in memory and are excluded from shared URLs.

There is no account database or server-side shortlist in v1. Comparison query
parameters are visible to link recipients and may appear in hosting access logs.

## Garage data on device

The garage uses a separate local-storage record, `oss-garage-v1`. The authoritative
owned-data validator and correction rules are in
[domain.ts](../apps/oss/src/garage/domain.ts). The comparison catalog remains
optional for owned-vehicle entry.

- The root stores version 1, a revision identifier and up to 50 owned vehicles.
- A vehicle stores its identity, optional nickname/powertrain and catalog reference,
  current integer kilometre reading, reading date, reminders and service records.
- A recurring reminder has a distance interval, calendar-month interval, or both,
  with an explicit last-completion baseline for each configured interval.
  Manufacturer attribution is accepted only for a matching reviewed vehicle,
  task and interval. User-defined intervals remain personal.
- A service record has a stable ID, task, date, odometer, notes and an optional
  reminder reference. Correcting a record retains its ID; removing a reminder
  detaches the reference while preserving the record.
- The next deadline uses applicable completion history and the explicit baseline.
  Calendar months clamp to the end of the target month. Distance and date deadlines
  use whichever occurs first. “Due soon” is an app display threshold of 30 days or
  1,000 km, not an additional manufacturer instruction. No elapsed distance is
  inferred between user-entered odometer updates.

Files and stored data share a 2 MB UTF-8 limit. Unknown formats and unreadable
saved data are preserved; session-only changes and export remain available.
Backup replacement requires an explicit user action after validation and review.
Vehicle removal requires confirmation. There is no cloud ownership database or
background notification service.

Corrections preserve attached history and unrelated newer changes. A vehicle
identity/powertrain change removes the former comparison reference. Invalidated
manufacturer intervals require explicit consent to remain as personal reminders.
Saving a stale editor rejects changes to the same vehicle details or service
record, including a record deleted in another tab. Local storage does not provide
transactional multi-user writes. See [correction behavior](GARAGE-CORRECTIONS.md)
and [maintenance sources](MAINTENANCE-SOURCES.md).
