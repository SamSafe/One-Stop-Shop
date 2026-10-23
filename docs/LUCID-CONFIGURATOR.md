# Lucid Canadian factory and new-stock source contract

Reviewed 2026-10-23. This import adds 348 current factory equipment profiles and
73 additional observed stock profiles. It does not establish exhaustive Canadian
market coverage, national inventory, immediate delivery or unused condition.

## Public sources and explicit identity

- [Canadian overview](https://lucidmotors.com/en-ca) supplies the ordering menu.
- [Air builder](https://lucidmotors.com/en-ca/configure) and
  [Gravity builder](https://lucidmotors.com/en-ca/configure/gravity) supply the
  Canadian model year, trim lists, options, defaults and compatibility rules.
- [New inventory](https://lucidmotors.com/en-ca/available-vehicles) links its
  public read-only inventory application. Its client declares the public
  `buynow.lucidmotors.com/api/v4/en_ca/store/inventory/vehicles` route, with
  `/gravity` for Gravity. No account, cookies or authorization headers are used.
- The published configurator declares the public year-scoped
  `ext.cpq.lucidmotors.com/cpq/configurator/{version}/en-ca/{model}/{year}/`
  `prCodes`, `trimsDetails` and `specs` routes. Air uses v2; Gravity uses v1.

The current builder explicitly identifies model-year 2027. Its image paths can
contain 2025 or 2026; image names do not establish the vehicle model year. The
menu and builders reconcile Air Pure, Touring, Grand Touring and Sapphire, plus
Gravity Touring and Grand Touring. Five other Gravity menu entries are unpriced
placeholders, with a literal dash and `validPrice: 0`. They are recorded as gaps,
not free vehicles or confirmed retail offerings. `validPrice` is an amount,
not a boolean.

## Factory equipment expansion

The safe loader decodes JSON Flight packets, including UTF-8 byte-length `T`
frames that can be immediately followed by another frame. It does not execute
downloaded JavaScript. Required country, locale, model and model-year identities
must reconcile. Rich-text references and image data are not required for pricing.

Expansion follows the visible section lists and the actual selection events:
radio replacement, optional package toggles, package component resets,
simultaneous incompatibility replacement, forced equipment, default replacements
and the North-American Gravity GT wheel/appearance promotion pairing. It retains
forced-code history. Unknown rule semantics or a changed reviewed selection
client abort synchronization. Internal product codes are not independently
multiplied into phantom retail configurations.

The reviewed selection client is
`4184-2d364a1ebec51a1e.js`, SHA-256
`e07257d12d40b774355c165e90b8db0c54f28543a24a825e6e36e5847a3a406c`.
Isolated research compared every explored transition and price against that
published event function: 5,028 reachable states and 67,078 transitions matched.
Production synchronization does not execute the downloaded client.

| Model / trim          | Valid states | Explored transitions | Equipment profiles |
| --------------------- | -----------: | -------------------: | -----------------: |
| Air Pure              |            3 |                    6 |                  3 |
| Air Touring           |          144 |                1,184 |                 20 |
| Air Grand Touring     |           80 |                  608 |                  4 |
| Air Sapphire          |            1 |                    0 |                  1 |
| Gravity Touring       |        2,880 |               40,320 |                192 |
| Gravity Grand Touring |        1,920 |               24,960 |                128 |

Profiles retain variant, edition, drivetrain, roof, front/rear seating, named
packages, driver assistance, audio, comfort, suspension, technology and towing.
Paint stays at the zero-cost default. Compatible wheels, appearance and interiors
are explored and projected to the least expensive choice for each equipment
profile. Price notes name the chosen wheels, interior and appearance. This does
not claim every cosmetic combination has its own record or copy ranges across
wheel sizes. Stock retains its actual non-paint equipment.

Complete expansion runs during synchronization and compares serialized profiles,
counts and prices. Build preparation validates each stored selection, expected
profile key and price without rerunning all 67,078 transitions.

## Price basis and reconciliation

Each component requires an exact CAD/CA/trim/bundle/manufacturing-variant price
context and one active validity interval. `basePrice` must equal
`manufacturePrice`. Missing or ambiguous amounts cannot become zero.
Factory MSRP is the sum of explicit base components. The ordinary `value` sum
must equal that sum plus destination, documentation and AC charges.

| Current base vehicle  | Factory MSRP | Separate national charges | Published total |
| --------------------- | -----------: | ------------------------: | --------------: |
| Air Pure              |      $97,600 |                    $2,300 |         $99,900 |
| Air Touring           |     $110,500 |                    $2,300 |        $112,800 |
| Air Grand Touring     |     $158,900 |                    $2,300 |        $161,200 |
| Air Sapphire          |     $325,000 |                    $2,300 |        $327,300 |
| Gravity Touring       |     $110,700 |                    $2,800 |        $113,500 |
| Gravity Grand Touring |     $136,700 |                    $2,800 |        $139,500 |

Pure Stealth & Sound 19-inch adds $6,200 once; its component codes have zero
increment in that exact package context. The 20-inch package adds $8,700.
Gravity seven-passenger seating adds $4,000. Its Power Package and Technology
Package remain distinct selections and labels.

Gravity's marketing delivery footnote conflicts with the builder's explicit
delivery component. MSRP uses the published base amount, never a guessed
subtraction from a marketing total. Deposits, optional paint, discounts,
incentives and finance terms do not enter comparable MSRP. These national totals
do not establish provincial all-inclusive prices.

Older CPQ products also contain post-sale software upgrade metadata with
one-time and trial offers. Those alternate prices and trials do not replace the
vehicle's exact factory component prices or establish an ongoing software
entitlement for a particular stock vehicle.

## Observed remaining new stock

Thirteen public sample delivery points, one per province/territory, are queried
for each model with `type=new`, country CA, 5,000 km and no year/price/equipment
filter. Six additional Alberta variant partitions reconcile exactly to the two
broad Alberta result sets. All 32 searches remain below the 200-row request cap;
a response reaching the cap aborts import pending further partition review.

The capture has 1,414 response rows and 115 distinct vehicle references:
59 Air 2026, two Air 2025, 29 Gravity 2027 and 25 Gravity 2026. Regional searches
can return different identities despite the same row count. This is a sampled
union, not a nationwide physical vehicle count or proof of completeness.
Two new-titled display vehicles are included with their source category; the app
does not claim they have never been driven. Used, CPO and other title categories
are rejected. Canadian offered vehicles can be in US staging locations; physical
address alone does not override explicit Canadian offer country and currency.

The inventory browser's failed network requests can produce a misleading empty
UI. The declared anonymous GET succeeds and supplies actual stock. An empty or
failed page is not evidence that no vehicles are offered.

Each observed configuration uses its own model-year CPQ tables. Typed product
fields must agree with production codes. Legacy `air`/`gravity` bundle aliases
are replaced by the explicit typed trim; the 2025 Air table uses its reviewed
older model/bundle type. An unpriced legacy `L929` secondary-roof-colour marker
is explicitly excluded from the priced selection, rather than assigned zero.
Every complete configured total must still reconcile before discounts. Optional
paint is then removed for comparable factory MSRP. Compatible current matches
and paint-only duplicate stock merge; 73 additional equipment profiles remain.
Configuration identities do not depend on price. VINs, account fields, shortcodes
and session data are not stored in the tracked snapshot; hashed identities
reconcile the captured public source rows.

## Technical facts and remaining work

Exact Canadian model-year specification tables provide power in hp, joined by
variant, edition and drive code. Gravity's exact selected `5RSC`/`7RSC` products
explicitly specify passenger count. Front-seat adjustment counts are not seats.

Ranges remain unknown pending year/wheel/seat and footnote reconciliation:
Air includes manufacturer projections, Sapphire has a wheel-cover qualification,
and Gravity headlines do not establish every seating configuration. Maximum
storage figures do not establish a comparable rear cargo compartment with a
verified seat position. Width mirror conventions and other measurements remain
open. No EPA figure, sibling year or whole-model maximum fills these gaps.

Independent lineup/stock reconciliation, unobserved older years, the menu
placeholders, cosmetic alternatives and missing specifications remain in the
coverage report. The full-market completion gate remains false.

## Refresh and verification

`npm run catalog:sync:lucid` captures public sources, retains original response
hashes in ignored `data/raw/lucid`, validates the complete graph and exact stock
totals, then atomically replaces the tracked snapshot. Source failures, changed
client semantics, capped or inconsistent queries, lost current profiles or lost
older year/trim evidence abort live replacement for review.

`npm run catalog:sync:lucid -- --offline` checks original response hashes and
reconstructs the snapshot byte-for-byte without updating its retrieval date.
Reviewed same-day research captures can be used with
`-- --from-captures <manifest.json>`. This snapshot retains its original
2026-10-23 retrieval date; inventory reconciliation occurred later on that same
UTC day. Normal builds use the tracked snapshot and make no external requests.

Unit tests cover menu/stock coverage, UTF-8 framing, exact fee and package
arithmetic, dependencies, price-context failures, stock aliases, omissions,
stable identities and qualified unknowns. The browser journey covers package
prices, five/seven-seat comparisons, reloadable comparison URLs and older stock
with exact source links.
