# Canadian Mercedes-Benz base profiles

Reviewed on **2026-10-23**, this first Mercedes-Benz import adds **77 base
model-year profiles**: 66 explicit current passenger-car/SUV menu identities and
11 Sprinter passenger/crew model codes. These are base configurations, not an
exhaustive expansion of packages or new inventory. Full Mercedes-Benz and
Canadian market coverage remain unverified.

## Sources and scope

- [Canadian passenger-car menu](https://www.mercedes-benz.ca/en/home): explicit
  model year, model code/path, body/class, fuel flags, availability flags and
  model/builder links. Duplicate PHEV and EV family cards are reconciled.
- All 66 linked exact-year model pages supply positive metadata MSRP and labeled
  specifications. Forty-eight also publish a current factory-builder link.
  The 18 entries without one remain listed with an ordering/inventory gap.
- [Sprinter passenger selector](https://www.mercedes-benz-vans.ca/en/vehicles/build/sprinter/passenger-van)
  and [crew selector](https://www.mercedes-benz-vans.ca/en/vehicles/build/sprinter/crew-van)
  identify five and six explicit 2026 model codes respectively. Every linked
  builder is captured. Commercial-only cargo vans, eSprinter cargo and cab/chassis
  are outside this passenger-vehicle import.

Every required HTML response is HTTP 200, on the exact reviewed Canadian URL,
with explicit `country=ca` and `currency=CAD`. The snapshot retains 128 source
receipts with SHA-256 hashes and the original capture date. Original response
bytes remain in ignored `data/raw/mercedes`, separate from the factual snapshot.
No account, quote, saved build, order or lead operation is used.

## Price basis and configuration identity

Main builders use CCS equipment defaults but explicitly disable CCS pricing.
The reviewed native selector uses `MODEL_BUILD_OPTIONTREE` for prices and
`MODEL_BUILD_DEF_OPTIONS_CCS` for defaults when nonempty and no line override
exists; otherwise it uses the legacy defaults. Van builders use legacy data.
The importer validates that price mode, exact year/model and positive base MSRP.
All 59 captured defaults have zero option surcharge against the active tree.

`MODEL_BUILD_DEF_OPTIONS_CCS` can contain a different model-level amount. For
example, the GLC 300 source contains 64,050 there while its active legacy MSRP,
content, model page and native initial total are **61,000 CAD**. The inactive
default-model amount is not substituted or adjusted by guessed fees.

Comparable MSRP excludes paint, optional packages, freight/PDI, dealer fees,
levies, sales taxes and incentives. One exact conflict is retained but withheld:

| Model year/code | Canadian model-page MSRP | Canadian builder MSRP | Comparable MSRP |
| --------------- | -----------------------: | --------------------: | --------------- |
| 2026/C300W4     |               51,650 CAD |            62,250 CAD | Unverified      |

Only that reviewed pair is accepted as a known conflict. A changed pair or new
conflict aborts refresh. It is visible in the app and coverage report; neither
candidate becomes a normalized price.

The price parser handles singleton and array XML-JSON option children and counts
included package components once. Price arithmetic alone does not establish
compatible or orderable packages. No package combinations are imported yet.
Native CCS decisions, local rules, optional seating and dependencies still need
reconciliation before expanding them.

## Technical facts

Only exact-year labeled metric dimensions, standard passenger capacity and
explicit hp ratings are imported. Body width explicitly excludes mirrors.
Temporary boost is not the base power rating. PHEV power without an explicit
combined-output qualification remains unknown. Mild hybrid engine text, explicit
PHEV codes and electric flags distinguish powertrains.

Optional seating is not selected in a base profile. Sprinter passenger seating is
joined through the same-year wheelbase and roof filters (12 or 15 passengers).
Crew capacity remains unknown because generic landing-page copy mixes years and
seating contexts. Non-AWD van drive type is not inferred from the model code.

Unlabeled cargo ranges, unspecified seat positions, range estimates, partial
charging intervals, TBD values and imperial-only measurements stay unknown.
Measurements are not copied into unreviewed package/wheel/roof arrangements.

## Open coverage

The Maybach EQS SUV family card has no explicit active model/year reference.
Its image filename and `-1` menu price do not establish model year or MSRP.
The linked family class and selector pages also returned HTTP 200 without an
explicit active model/year identity during review. New inventory and independent
offering evidence still need reconciliation.

On 2026-10-23 the published car inventory initdata endpoint
`https://nafta-service.mbusa.com/api/inv/v1/en_ca/new/initdata` returned HTTP 500,
with an upstream inventory error. Receipt SHA-256:
`129c6266f7147d827f2ff15104a9fb15e252d3e8fc2ab55c84160c70f12c1c41`.
That failure is not proof of no inventory. Car/van national new-stock coverage,
older years, delivery timing and independent offering reconciliation remain open.
The normal sync does not query inventory or establish that an old failure persists.

The separate vans initializer is accessible at
`https://nafta-service.mbvans.com/api/inv/en_ca/new/initdata?brand=mb`:
HTTP 200, SHA-256
`51e5ade7deeaa612b51d1d344fe87137b9f2c549b310decd3497cbbdb9b3246a`,
captured 2026-10-23T18:33:50.957Z and matching the normal browser's request.
Omitting its required `brand` query parameter
causes a parameter error, not a stock-availability result. Its model/year filter
tree and price ranges alone do not prove actual available vehicles. The native
search request, distinct listings and exact older-year price components still
need reconciliation before importing additional stock profiles.

A subsequent [passenger/crew van stock pass](MERCEDES-VAN-STOCK.md) reconciles
all 54 published Canadian dealer contexts and adds five observed older base
profiles. It keeps bare-model MSRP separate from configured stock amounts.
The car stock, package and independent full-market gaps above remain open.

## Refresh and validation

Run `npm run catalog:sync:mercedes`. Reviewed original captures can be imported
with `-- --from-captures <manifest.json>`. `-- --offline` verifies every required
response checksum and requires byte-identical normalized reconstruction without
changing the review date. Ordinary builds use the tracked snapshot offline.

Refresh validates current menu keys, all model pages/builders, both van selectors,
exact identities, price mode, defaults, sources and known conflicts before an
atomic replacement. Losing a previously represented model-year identity aborts
replacement pending new-stock or reviewed-removal reconciliation. Failed sources,
redirects, new price modes and inconsistent prices do not produce a partial file.

Tests cover source extraction without JavaScript evaluation, source/identity
failures, omissions, duplicate records, active MSRP/default selection, included
package pricing, unknown prices, the C 300 conflict, powertrain classification,
qualified dimensions/power and passenger seating. Browser checks exercise the
published entries, comparison, source links and unknown-price budget filtering.
