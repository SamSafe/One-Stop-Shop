# Data contract

This describes the implemented v1 contract. The authoritative schema is
[packages/car-catalog/src/schema.ts](../packages/car-catalog/src/schema.ts).

## Shared catalog

The catalog contains schemaVersion, reviewedAt, scope, pricingNote, sources and
cars. Each car identifies make, model, model year, exact trim, Canadian market,
body style, powertrain and drivetrain with a stable ID.

Facts are base MSRP in CAD; city/highway/combined L/100 km; horsepower; seating;
cargo with seats up/down in litres; front/rear headroom and legroom in mm; and
published length, width and height in mm.

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

- Filters: search, maximum base MSRP, powertrain, drivetrain and saved-only.
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
  Inputs remain in memory and are excluded from shared URLs.

There is no account database or server-side shortlist in v1. Comparison query
parameters are visible to link recipients and may appear in hosting access logs.

## Future Garage model

Garage, owned vehicles, mileage observations, service history, personalized
schedules and reminders remain app-specific future entities. A maintenance
implementation must define calendar-versus-distance deadlines, unknown service
history, severe-use schedules and source-version updates before shipping.
Neither maintenance data nor reminders are part of this release.
