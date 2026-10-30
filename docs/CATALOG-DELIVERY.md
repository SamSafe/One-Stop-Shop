# Validated catalog delivery

At the delivery measurement milestone the catalog contained 5,846 records and
950 sources. Loading every
manufacturer's source tables and validators in the browser made startup costly.
Build preparation now supplies the complete comparison catalog as a separate
hashed data asset. Numeric facts, unknown notes, source links, optional fields,
record order, IDs and dates remain unchanged.

## Preparation and delivery

1. The normal source catalog and all manufacturer validators run in Node.
2. `scripts/prepare-runtime-catalog.ts` encodes the resulting catalog, decodes it
   again and requires exact JSON equality before returning a result.
3. The Vite plugin emits a hashed catalog asset and a small browser module.
   The production module fetches the local asset and decodes its data. A build
   gate rejects source snapshots, schemas or manufacturer ingestion modules in
   browser chunks; only metrics, rating URLs and the runtime decoder are allowed.
4. The UI loader shows progress immediately. Download or decoding failures reach
   the existing error boundary, which offers reload while preserving local data.

The format interns repeated values and object field layouts. It retains every
normalized catalog field, rather than choosing a smaller subset of vehicles or
facts. Decoding checks format version, field layouts, bounded tables and backward
references. Shared objects and arrays are frozen to prevent one profile's edits
from changing other vehicles. Full source validation remains a preparation/build
responsibility; the browser does not rerun factory graph expansion.

The JSON asset participates in release hashes, startup integrity checks, readiness
checks and immutable caching. The build writes Brotli and gzip siblings, which
the static server sends according to Accept-Encoding; Brotli reduces the catalog
transfer by about 28% compared with the previous streamed gzip. Deploy the
complete release artifact so script and data hashes remain consistent. The app
requires no runtime manufacturer service, account or database.

## Development

`npm run dev` prepares fresh data in a separate Node/tsx process, keeping Vite
configuration independent of manufacturer TypeScript/JSON loading. The process
uses its own temporary result file and removes it after loading. Preparation
failures stop startup instead of serving a partial catalog.

During development the same lossless payload is embedded in a virtual module.
Changes under the catalog's source/data directories or to the preparation script
restart the development server and rebuild the payload in a fresh process. The
production preview continues using its own immutable build. Normal builds read
tracked snapshots and require no external source requests.

The preparation script is included in the release source fingerprint. The
canonical Node package still exports the complete validated catalog for import
tools, coverage reports and tests. Its browser-facing exports use the prepared
data, metrics, rating URL helper and government rating count.

## Measurements

Measured on this WSL host with three fresh Chromium contexts per build, using
the local production server and waiting for the first vehicle card:

| Measurement                             |                       Previous build | Prepared catalog build |
| --------------------------------------- | -----------------------------------: | ---------------------: |
| JavaScript, raw total                   |                         10,601.77 kB |              266.02 kB |
| JavaScript, gzip total reported by Vite |                          1,013.27 kB |               83.29 kB |
| Separate catalog asset, raw / gzip      | Included in JavaScript source tables |   4,547.33 / 703.19 kB |
| Largest JavaScript chunk, raw           |                         10,601.77 kB |              213.97 kB |
| Median time to first vehicle card       |                             3,962 ms |                 591 ms |

Previous runs: 4,156 / 3,934 / 3,962 ms. New runs: 626 / 554 / 591 ms.
Both builds exposed the same catalog and recorded no page errors in these
measurements. These are local Chromium measurements, not a mobile-network
benchmark. Data transfer remains material as the market expands; further
partitioning or delivery changes need equivalent provenance and coverage checks.
The JavaScript large-chunk warning is resolved without raising its threshold.

## Regression checks

Codec tests require whole-catalog parity, stable ordering and immutable shared
facts, and reject unsupported versions, unsafe/ambiguous layouts, cycles and
invalid references. Browser tests hold the catalog response to inspect loading
feedback, fail the response to check reload recovery and device-data preservation,
and run the existing comparison, filtering, source, accessibility and integrity
journeys against the prepared catalog.
