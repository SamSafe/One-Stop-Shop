# car-catalog

The shared, app-independent data contract. Current coverage is a curated snapshot
of five Canadian-market 2026 compact SUV configurations.

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

The original sourcing pipeline and maintenance API are future work. This release
uses manual curation to establish a trustworthy contract before automating it.

See [research](../../docs/CATALOG-RESEARCH.md),
[data model](../../docs/DATA-MODEL.md) and
[refresh procedure](../../docs/OPERATIONS.md).
