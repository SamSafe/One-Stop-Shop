# Porsche Canadian model years and native selections

The October 26, 2026 UTC capture (October 25 in Edmonton) covers all 74 model
cards in the [Canadian model menu](https://www.porsche.com/canada/en/models/),
including overlapping 2025–2027 years. Seventy-three have linked public
configurators. Their explicit transmission and rear-seat choices resolve to
93 factory profiles. One limited model remains a menu-only listing with an
unverified price, allocation and exact-year technical data. This is progress
toward full coverage; other equipment and remaining new inventory are incomplete.

## Identity and source replay

Required sources span 2026-10-26T00:39:43.301Z–01:15:36.709Z. The snapshot keeps
original timestamps, URLs and SHA-256 receipts. It includes the menu, all 74
linked detail pages, 73 factory initializers, 22 additional completed selections
and four reviewed public client modules. All required responses are HTTP 200;
redirects and missing captures abort replacement. No account, saved build,
Porsche Code, quote, order, lead or reservation was created.

The menu's Astro data identifies exact model code/year, body family, drive,
seating label and native links. Detail technical tables must reconcile the same
code/name and Canadian year metadata. Two pages use their explicit Canadian
model visualizer metadata when the usual country/model footer is absent.
The limited 911 GT3 90 F. A. Porsche has no configurator or verifiable exact-year
detail identity. Its unqualified technical table is not copied into known facts.
Its menu card directly verifies 2027, two seats and 502 hp; those facts retain the
menu as their source without establishing factory availability or allocation.

The configurator embeds a JSON reference table in a React Router stream. The
importer decodes only the Canadian loader, with bounded references/depth, reviewed
null/undefined and Set encodings, and rejection of cycles or unsafe keys. It
never executes downloaded JavaScript. Four linked selection/query modules are
pinned by URL and checksum. A changed client or an initializer no longer linking
the reviewed route module requires renewed review. On 30 October a site deploy
replaced all four. The query contract the import relies on is unchanged: the
same `options`, `optionAdded` and `optionRemoved` names and `.` separators, with
new feasibility-dialog and financing parameters added. The refreshed import
reproduced every configuration and price, and the new modules are pinned. A live
import compares against the previous snapshot's shape only, since that snapshot
was reviewed against the clients of its own date.

Run `npm run catalog:sync:porsche` for live public reads, or append `-- --offline`
for exact reconstruction from checksummed ignored raw responses in
`data/raw/porsche`. Reviewed captures can use `-- --from-captures <manifest.json>`.
During initial research, `--capture-missing` with that option permits explicitly
missing public sources to be fetched; original cached timestamps remain intact.
Offline mode never advances the review date. Replacement is atomic and rejects
lost menu/model years, resolved profiles or a backwards evidence date. Sources
must fit a 24-hour capture window. Ordinary builds require no external requests.

## Transmission, seats and price

The published query parser accepts `options` separated by dots, plus `optionAdded`
and `optionRemoved`. Each reviewed selection initializes that public URL and
checks the returned selected codes, exact model/year, transmission and option
price. All supported transmission/rear-seat pairs must reconcile; a failed source
is not silently omitted or treated as incompatible equipment.

Two 2025 Style Edition initializers (Cayman and Boxster) leave both transmissions unselected. The import
does not assign a default: both offered transmissions are explicitly resolved.
The 2025 Cayman publishes 79,500 CAD and the Boxster 81,900 CAD for the captured
PDK and manual choices. The manual entry explicitly includes Sport Chrono.
Transmission codes and seating state form stable configuration IDs; price does
not determine identity.

Nine models offer no-cost 3UG rear seats. Their base selections delete the rear
seats despite the menu's 2+2 label. The source describes 3UG as a two-seat rear
arrangement; completed profiles therefore distinguish two and four passengers.
The GT3 Touring's two transmissions and rear-seat choices produce four profiles.
An unselected no-cost option is not standard equipment.

MSRP is the native numeric base amount plus selected transmission/rear-seat
increments once. Their total must equal the explicit native option amount.
Destination, dealer fees, air/tire/green levies, luxury tax, incentives and quoted
totals remain separate. The 2027 Carrera's 144,900 CAD base is not its 161,182 CAD
fee/tax-inclusive total. Some displayed tax components round fractional dollars;
the numeric component is retained without guessing a base-price adjustment.

## Technical qualifications

Technical attributes join the selected transmission suffix. Body width excludes
mirrors. Height requires the standard equipment's suspension and roof-rail
context; lowered, off-road and optional arrangements are not substituted.
Dimensions do not propagate into unexpanded wheels, roofs or suspension options.

Combined system output takes precedence over engine-only/motor-only power for
hybrids. Macan 4's 382 hp non-overboost maximum is kept separate from its 402 hp
Launch Control overboost. The Carrera GTS uses 532 hp combined output rather than
478 hp engine output; Panamera 4 E-Hybrid uses 463 hp rather than 300 hp engine
output. Manufacturer qualifiers remain visible. Factory mild-hybrid flags and
exact-model AC charging tables distinguish mild hybrids from plug-in hybrids.

Canadian energy/range cycle joins, compatible full-charge equipment, cabin
measurements and cargo seat positions remain open. Front/rear luggage and open
storage behind front seats are different scopes. Partial DC charging and
unqualified storage figures do not become full-recharge or seats-up cargo facts.

## Remaining market coverage

The limited 90-unit GT3 listing does not establish remaining Canadian allocations
or order acceptance. Additional factory packages, other seating/suspension
arrangements, cosmetic compatibility, independent offerings and all remaining
older new stock still need reconciliation. An ordinary public Canadian finder GET returned
HTTP 429 again on October 26 at 01:32:11.623Z (response SHA-256
`0bc5d132b03323d0a90f014ba6d83e7ce11b1c146ec86eddabc6f84520c0e770`).
No access boundary was bypassed, and this does not establish that stock is absent. Full Porsche and Canadian market
coverage remain unverified.
