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

## Sourcing pipeline (planned stages)

1. **Fetch** — pull source docs (brochures, spec PDFs, manuals, dataset rows)
   for a target model/trim, recording where each came from.
2. **Parse** — extract structured fields from PDFs/HTML.
3. **Normalize** — map into our schema; standardize units, enums, naming.
4. **Validate** — sanity-check ranges, flag missing/low-confidence fields.
5. **Store** — persist with provenance (source + fetched-at + confidence).
6. **Refresh** — re-run periodically to keep data current.

Start with a **narrow seed set** (one market, ~20–50 popular models) to prove
the data shape end to end before scaling coverage.

## API surface (planned, read-only)

- list/filter cars (by body style, fuel, price, seats, size, ...)
- get a trim's full spec set
- get a model/trim's maintenance schedule

## Boundary rule (enforce in CI)

`car-catalog` depends on nothing app-specific. Apps depend on `car-catalog`,
never the reverse, never each other. Keep this clean and splitting the catalog
into its own repo later is a ~30-minute job instead of a painful untangle.

See `docs/DATA-MODEL.md` for the full entity/field breakdown.
