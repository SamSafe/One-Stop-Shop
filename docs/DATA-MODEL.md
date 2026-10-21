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

Facts are base MSRP in CAD; city/highway/combined L/100 km; horsepower; seating;
cargo with seats up/down in litres; front/rear headroom and legroom in mm; and
published length, width and height in mm.

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

## Future Garage model

Garage, owned vehicles, mileage observations, service history, personalized
schedules and reminders remain app-specific future entities. A maintenance
implementation must define calendar-versus-distance deadlines, unknown service
history, severe-use schedules and source-version updates before shipping.
Neither maintenance data nor reminders are part of this release.
