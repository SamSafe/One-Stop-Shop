# car-catalog — shared backend

The shared, canonical source of per-model/trim car data. Treated as a product in
its own right; OSS and the garage app are two consumers of it. **It must never
know what a "shortlist", "reminder", or "garage" is** — those are app concerns.

## Responsibilities

- Canonical `Car` records (model / trim) with deep structured data:
  - Specs OSS needs: dimensions, seating config, leg/head room, boot space,
    power/torque, drivetrain, technology/infotainment, running costs.
  - Maintenance schedules the garage app needs: oil, belts, brakes, fluids,
    wear items, seasonal items — keyed by mileage / time.
- Sourcing pipeline (same problem for both apps):
  - find specs
  - download & parse schedules / manuals (mostly PDFs)
  - normalize into our own schema
  - store in a DB
- A read API, e.g. `GET /cars`, `/cars/:id/specs`, `/cars/:id/maintenance-schedule`.

## Sourcing options (easiest → hardest)

1. Manufacturer brochures / spec PDFs — public, rich, parseable (deep specs).
2. Owner's manuals — where service schedules live; harder per model/trim.
3. APIs / datasets (e.g. NHTSA vPIC for US VIN decoding, paid spec APIs) —
   coverage of leg/head-room-level detail is patchy.

Realistically: scrape + parse PDFs + normalize. That normalized schema is the
moat — nobody else bothers, which is why comparison sites stay shallow.

## Boundary rule (enforce in CI)

`car-catalog` depends on nothing app-specific. Apps depend on `car-catalog`,
never the reverse, never each other. Keep this clean and splitting the catalog
into its own repo later is a ~30-minute job instead of a painful untangle.
