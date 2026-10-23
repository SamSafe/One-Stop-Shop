# car-catalog

The shared, app-independent data contract. It combines sourced Canadian retail
profiles and separately labeled government rating variants. Full market
reconciliation remains in progress; see
[the coverage report](../../docs/CANADIAN-MARKET-COVERAGE.md).

- data/catalog.json contains numeric facts, explicit units through the schema,
  source references, review dates and source-specific notes.
- src/schema.ts validates identities, sources, ranges, dates and cargo consistency.
- src/index.ts exports the validated catalog and types.
- src/schema.test.ts tests the data-quality rules.

Run npm run validate:catalog from the repository root. Sources older than 180
days fail the build; the UI warns after 90 days. A refreshed source must actually
be reviewed before its date is advanced.

The package imports no app, ranking, shortlist, garage or reminder concepts.
CI enforces the dependency direction. Consumers import @oss/car-catalog.

Every known numeric fact requires a reviewed official source. Unknown facts use
null plus a reason. Published width and cargo measurement conventions must remain
visible; similarly named fields are not necessarily measured the same way.

Manufacturer importers retain explicit source receipts and validated snapshots.
Raw captures stay outside the tracked package; ordinary builds require no
external source requests.

See [research](../../docs/CATALOG-RESEARCH.md),
[data model](../../docs/DATA-MODEL.md) and
[refresh procedure](../../docs/OPERATIONS.md).

## Lucid Canadian source

Lucid factory equipment, explicit model-year pricing, qualified technical facts
and observed new stock follow [the reviewed source contract](../../docs/LUCID-CONFIGURATOR.md).
Use `npm run catalog:sync:lucid`; offline reconstruction preserves source hashes
and the original retrieval date. Complete-market coverage remains in progress.
