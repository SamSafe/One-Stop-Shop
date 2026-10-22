# Nissan and Infiniti Canadian source contract

Reviewed on 2026-10-22. This milestone adds 101 configurations: 84 Nissan and
17 Infiniti, across 25 listed model years. It does not establish full market,
dealer-inventory or unrestricted equipment-combination coverage.

## Official public sources

- [Nissan Canadian build selector](https://www.nissan.ca/shopping-tools/build-price)
- [Infiniti Canadian build selector](https://www.infiniti.ca/shopping-tools/build-price)
- [Nissan new-inventory selector](https://www.nissan.ca/shopping-tools/search-inventory)
- [Infiniti new-inventory selector](https://www.infiniti.ca/shopping-tools/search-inventory)
- [Nissan Rogue specifications](https://www.nissan.ca/vehicles/crossovers-suvs/rogue/specs.html)
- [Infiniti QX60 specifications and packages](https://www.infiniti.ca/vehicles/crossovers-suvs/qx60/specs.html)

The public Next.js selector embeds `selectPageProps` in React Flight data.
`market.region=ca`, `brand`, `application=configurator` and `lang=en` must match.
`vehicles` and `vehicleData` model and version references reconcile. Every `otherModelYears`
reference must resolve to a listed model/year. Current and previous years are
included, rather than taking only default-year cards or filtered `allTrims`.

The shared Flight parser reads JSON/text rows, UTF-8 byte lengths and references.
It does not evaluate remote JavaScript. Ford retains its existing parser interface
and tests through the same shared implementation.

## Exact factory identities

Each version preserves `modelCode`, `versionCode`, `eimCode`, `packageCode`,
`nstConfigCode`, grade identity and the published build path. Model, year, version
and country must agree. Composite IDs preserve suffixes such as Frontier
`4CVG77-CS00` versus `4CPG77-CS00`; they are not reduced to the parent engine or
grade. The 2027 Z retains all six versions, including NISMO manual and automatic.

Static specification pages publish `HELIOS.components.c059E` with nested
`grades[gradeCode].versions[versionKey]`. The importer reads this balanced JSON
assignment without evaluating scripts. Model code, grade, exact version key and
`/en_CA/cars/{year}-{modelSlug}/` source path must agree before facts are joined.

The current capture establishes 56 exact joins. Forty-five versions cannot yet
be joined: some older-year routes now serve 2027, the 2027 Sentra route still
serves 2026, and Rogue Hybrid's route returns 404. Both requested and returned
identities remain in the snapshot. These failures do not remove listed versions
or justify copying another model year's measurements.

The two $4,200 optional Tech Packages explicitly attached to 2027 QX60 and QX65
AUTOGRAPH become separate configurations with the exact parent/package composite
identity. Their source package key, name, surcharge and features remain stored.
No new NST calculator token is invented. Zero-cost Graphite Interior choices are
retained in package metadata; they do not create additional comparison rows.
Future multiple-package compatibility and other optional arrangements still need
source reconciliation before claiming every possible ordering combination.

## Price basis and source conflicts

Nissan's exact-version `priceList.retail` explicitly identifies Manufacturer's
Suggested Retail Price and says freight/PDI, levies and dealer charges must be
added. All 84 Nissan versions therefore have verified base MSRP. Optional paint,
accessories, regional totals, taxes and incentives are excluded. A factory package
already encoded in a version suffix is not added twice.

Infiniti's retail and regional amounts differ, but the retail disclaimer says
the shown price includes freight/PDI and fees. The apparent retail numbers may
be base MSRP, but that inference does not resolve the published contradiction.
All 17 Infiniti configuration prices remain null with this explanation, including
the two independently verified Tech Package surcharges. A budget cap excludes
them; without a cap the records remain visible.

The public client exposes read-only `getDetailedVersion` and `getConfigSummary`
queries at `https://www.nissan.ca/graphql`. Ordinary POST and GET detail requests
returned 403 during this review. No private credentials or access-control
workarounds were attempted. The official static pages provide the current data;
an unavailable API is not treated as proof of a complete live refresh.

## Measurements and energy

Explicit technical labels establish units. A metric/imperial pair must agree
within rounding tolerance; the first number is not blindly selected. Examples
requiring review include Z cargo `241 (6.9)` under L/cu.ft., PHEV bare `30.8` under
a dual-unit cargo label, and Armada bare inch-sized headroom under mm/inches.
Ranges, mirror-open/folded and license-bracket alternatives remain unknown.
Unqualified cargo volume does not establish an all-seats-upright arrangement.
Roof-specific values use only the exact version's non-N/A applicable fields.

Horsepower must explicitly say hp; engine and motor ratings are not summed.
The PHEV's 248 hp source explicitly says hybrid system net power. Infiniti's
exact QX80 technical 4WD terminology takes precedence over broad AWD marketing
filters. The source wording remains available in the snapshot.

EV Le/100km is gasoline-equivalent energy, never liquid fuel consumption or an
invented kWh value. Published range and Level 2 charging windows remain explicit.
Generic PHEV fuel values cannot establish electric/blended/fuel-only modes.
ICE/hybrid fuel fields require L/100km labels. Combined consumption outside the
city/highway interval is a source conflict: all three values remain unverified.
This currently affects the 2027 Rogue Hybrid PLATINUM grade.

## Remaining new inventory and reproduction

The national inventory pages embed normalized Apollo selector metadata. Their
model/year references include 35 entries absent from the current build selectors.
Those references remain in the coverage ledger, including 2024/2025 discontinued
or superseded families. They need actual new-stock and trim reconciliation;
metadata alone is not proof of stock or a reason to exclude them.

`npm run catalog:sync:nissan` explicitly refreshes the public selectors, inventory
metadata and specification routes. Required lineup failures prevent replacement.
`-- --offline` verifies every consumed raw SHA256 and reconstructs the tracked
snapshot without changing its date. `-- --from-captures <manifest.json>` imports
reviewed captured bytes with their original date. Responses, status codes and
manifest are retained under ignored `data/raw/nissan/`; source receipts and
normalized records are tracked. Normal builds use the snapshot without network
access. Unavailable fields, older inventory, body classifications and additional
ordering arrangements remain part of the full-market objective.
