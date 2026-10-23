# Rivian Canada source and import contract

Reviewed 2026-10-23 UTC. The import adds 106 retail profiles with verified factory
MSRP: 69 current 2027 profiles and 37 additional 2026 new-stock equipment profiles.
Forty-five distinct stock configuration references reconcile across eight
successful sampled delivery searches. These are configuration references, not
physical vehicle counts or proof of exhaustive national inventory.

## Canadian ordering and factory identities

The [Canadian home page](https://rivian.com/en-CA) links current R1S and R1T ordering
and separately links R2 reservations. Its anonymous Next data declares `en-CA`.
The linked [R1S builder](https://rivian.com/en-CA/configurations/builder?MODEL=R1S)
and [R1T builder](https://rivian.com/en-CA/configurations/builder?MODEL=R1T) redirect
to the shared configurations application while retaining explicit Canadian data.
The public React Router loader declares country CA, CAD, locale en-CA, generation
2 and model year 2027. No model year is inferred from a release calendar or a code.

The importer decodes only the anonymous loader's JSON reference table. It never
executes downloaded JavaScript. Authentication, changed streaming formats,
unsupported typed references and cyclic/invalid references abort the import.
Rules retain their exact version, model, base price, groups, options and selection
conditions. Unknown conditions, groups and option references require review.

Current Premium, Performance and Quad builds reconcile for both models. Premium
has distinct ordinary/Long Range drive systems and a Power Upgrade. The actual
wheel and interior selectors expose required packages, Sound + Vision and
six-seat Captain's Chairs. All-Terrain, wheel packages, underbody protection,
motors, batteries, roof and audio are derived where the published rules require
them; they are not independently multiplied into imaginary selections.

The builder currently links `/configurations/assets/DK3-89Ks.js`. Its reviewed
wheel/interior UI contract is pinned by its SHA-256 receipt. A changed module or
an unlinking from the current builder aborts live refresh pending review. The UI
selects wheel codes, with paired packages derived by rules; its interior cards
offer BUND-AR01, BUND-AR02 and SEAT-CAPT. Applying the lower-level engine to every
nominally visible internal option would overcount All-Terrain combinations.

Exploration follows visible trim, drivetrain, Power Upgrade, bundle, seating,
wheel and interior events, respecting required/disabled/hidden/future flags. The
final graph has 184 valid R1S states and 106 R1T states. All 2,420 explored
transitions and all 290 state prices match the unmodified published engine in
isolated research. The shipped interpreter is repo code. Equipment projection
retains 46 R1S and 23 R1T profiles, choosing the least expensive compatible wheel/
interior selection for each. Cosmetic alternatives sharing an equipment profile,
autonomy products, spare tires and accessory quantities remain outside this
expansion and within the coverage gap report.

## Factory prices and seating

Factory MSRP is base vehicle plus the active selected factory increments before
paint, accessory products, delivery, provincial charges and incentives. Native
build-pricing MSRP independently reconciles for every parent build. Its $3,117 fee
total is separate: $2,695 destination, $300 documentation, $100 air-conditioning
and $22 regulatory recovery. That fee total is not substituted for base MSRP or
claimed as a verified all-inclusive Alberta price.

2027 R1S Premium is $151,990, Performance $181,990 and Quad $202,990. R1T is
$144,990, $172,990 and $193,990 respectively. Long Range adds $9,000 and Power
Upgrade adds $7,400. R1S Long Range with the actual All-Terrain wheel/package
selection is $169,390. Adding the Captain's Chairs/Sound + Vision bundle yields
$175,290. The corresponding R1T All-Terrain profile is $161,290. Active package
price overrides prevent double charging the bundled wheels and All-Terrain code.
Stale marketing-card price fields do not replace current native factory pricing.

The [Canadian model FAQ](https://rivian.com/en-CA/r2) establishes default R1S
seven-passenger and R1T five-passenger layouts. Canadian builder descriptions at
`/configurations/locales/en-CA/common.json` explicitly establish six passengers for
BUND-AR02 and SEAT-CAPT. These arrangements join the current factory model year;
older 2026 stock does not inherit a current-year seating fact. Unjoined hp,
charging, dimensions, cabin/cargo arrangements and Canadian energy/range evidence
remain unknown. EPA estimates and gasoline-equivalent values are not Canadian
electricity consumption or ordinary gasoline consumption.

## Observed new stock and regional limits

The [Canadian inventory](https://rivian.com/en-CA/configurations/list) uses public
read-only POSTs to `/configurations/api/v1/shop/search`. The published request
contains `filters: []`, one model, a postal code, `shopType: NEW_VEHICLE_CONFIG`,
`transferFeesFilter: ALL_MATCHES` and no discount-only restriction. A no-postal
request returns NO_POSTAL_CODE. Native browser research reached the postal form;
its Continue button remained disabled with the sampled input. The same published
read request with its explicit postal-code field succeeds anonymously. No
authentication, challenge or access restriction was bypassed.

Thirteen public sample delivery points, one per province/territory, were queried
for each model. Alberta and B.C. each return 24 R1S and eight R1T references;
Ontario and Quebec each return 23 R1S and 11 R1T references. The 132 rows reconcile
to 45 distinct configuration hashes across 2026–2027. The other nine sampled
points return the explicit NO_DC business result. That establishes a delivery
limitation at those points; it does not prove an entire province has no new
offerings or that every inventory area is covered. A source total proving national
exhaustiveness is not available. Cursor or nonempty similar-result responses must
be reconciled before replacement rather than ignored.

Each stock reference retains its exact year and ruleset. The published client
reads `/configurations/api/v1/vehicle-ruleset` with country CA, SKU and version.
VEHICLE_SHOP_33.0 covers the observed 2026 vehicles; 34.0 covers 2027. All four
model/version reads reconcile. Paint-only references merge; an exactly matching
current configuration merges only when factory MSRP also agrees. Thirty-seven
additional profiles remain, all 2026. Stock identity does not depend on price, so
a later price correction preserves comparison/shortlist links.
Stock variants and price notes identify their actual wheel and interior selections
so equipment price differences remain understandable.

Forty-four of the 45 raw selected factory component totals equal their listing
price. One 2026 R1S lists $139,290 while its factory components total $139,990;
its final $139,607 includes the separate $3,117 charges and $2,800 discount.
The adjusted listing and final amount do not replace factory MSRP. Optional paint
and accessories are excluded from the comparison's stock equipment price.

Stock marketing serialization omits J1772/CCS charging-adapter codes required by
the factory rules. Only the two reviewed ACCESSORIES codes are tolerated, and
only when their exact active price is zero. Missing paid or meaningful vehicle
requirements still fail. The importer neither adds these accessories to the
stock record nor promises they accompany a specific vehicle. Config IDs are
hashed for reconciliation; VINs, cookies and headers are not normalized data.

## Refresh, reconstruction and remaining scope

`npm run catalog:sync:rivian` captures public sources, reconciles every required
identity and validates the resulting catalog before replacement. HTTP/schema/
checksum/identity failures abort. Only the explicit, parsed NO_DC stock business
result is accepted as a delivery limitation. Lost factory years/profiles, older
stock references or a previously served search context require reviewed
reconciliation instead of silent retirement.

`-- --from-captures <manifest.json>` compiles reviewed bytes with their original
date. `-- --offline` verifies original request/response bytes and exact normalized
reconstruction without advancing review. Receipts and raw bytes remain under
ignored `data/raw/rivian/`. Ordinary builds require no manufacturer requests.

The [Canadian R2 page](https://rivian.com/en-CA/r2) says Coming 2027 and offers
reservations; that calendar year alone is not a model-year trim identity. A linked
R2 builder request failed during research and was not used as absence evidence.
The [R3 page](https://rivian.com/en-CA/r3) and gallery are captured, with exact
Canadian ordering identity still unresolved. Both remain explicit research gaps.
Independent market/stock reconciliation, older unobserved years, individual
options and exact technical evidence remain part of the full-market objective.
