# Full Canadian market expansion

Objective: cover every new passenger vehicle currently offered for sale in
Canada, including pickups and vans, every make/model/retail trim, all powertrains
and overlapping model years. Used listings and commercial-only chassis/heavy
commercial vehicles are outside this passenger-vehicle scope. Personal-use
pickups remain included, including unrated heavy-duty pickup variants. This
objective is still in progress.

## Evidence required for completion

- Reconcile the current Canadian lineups of all manufacturers against the app.
  A government rating alone is not proof of today's retail availability.
- Include current model years, including 2027 where already offered, and older
  model years still offered new. Do not silently substitute US configurations.
- Identify retail trims separately from government fuel-rating variants. One
  rating can serve multiple trims; engine, transmission, wheels and drivetrain
  can also create several ratings within a trim.
- Preserve official provenance for Canadian prices, specifications and energy
  consumption. Unknown facts stay unknown and visible, not fabricated or zero.
- Support EV, plug-in hybrid, hybrid, gasoline, diesel and other available fuels
  with correct units, honest scoring and appropriate cost estimates.
- Make the full catalog usable through search, make/year/class/powertrain filters,
  bounded rendering, saved shortlists and shareable comparisons.
- Publish a repeatable coverage report identifying remaining availability,
  trim, pricing and specification gaps. Completion requires closing the gaps,
  rather than passing a test that only counts imported rows.

## Government baseline

NRCan's public fuel-consumption search includes 2027 records not yet present in
the downloadable 2026 CSV. Its public search endpoint supplies separate paged
counts for conventional/hybrid, battery-electric and plug-in hybrid records.
The importer must reconcile every page and unique record ID with those counts.

Sources inspected on 2026-10-20:

- https://fcr-ccc.nrcan-rncan.gc.ca/en/Search
- https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64
- https://open.canada.ca/en/open-government-licence-canada
- https://www.ford.ca/ (2027 vehicles already listed)

The official data are attributed to Natural Resources Canada under the Open
Government Licence – Canada. The app is independent and is not endorsed by the
Government of Canada. A rating snapshot is not a live inventory feed or a
complete retail-trim catalog. OEM lineup and retail-trim reconciliation remains
necessary after this baseline is imported.

## Import status

The first validated snapshot contains 2,518 unique NRCan records across 47 makes:
1,644 conventional/hybrid, 743 battery-electric and 131 plug-in hybrid records.
There are 1,036 model-year 2025, 947 model-year 2026 and 535 model-year 2027
records. These are rating variants, not a count of verified retail trims.

Refresh with `npm run catalog:sync -- 2025 2026 2027`. The script checks each
powertrain's pages, totals, selected years and unique IDs before atomically
replacing packages/car-catalog/data/nrcan.json. Raw responses remain in ignored
data/raw/nrcan; the tracked snapshot records response hashes and attribution.
Refreshes are explicit; ordinary builds never require external network access.

## Application baseline verified

The initial baseline milestone exposed all 2,518 rating IDs, with five matched retail configurations
representing four of those IDs, for 2,519 displayed records. Make, model-year,
NRCan class, record-type, powertrain and drivetrain filters work across the whole
catalog. Rendering is limited to 30 records per page; selection and shortlists
span pages. Unknown prices remain visible with no budget cap and are excluded
when a maximum price is applied.

EV consumption uses kWh/100 km. Plug-in estimates use an explicit electric-mode
distance share and include the published fuel burned in that mode. Retail trim
and availability labels distinguish the baseline from an audited retail catalog.
The original five shortlist/link IDs remain stable.

Validation passed: 64 unit tests and 64 browser checks without retries across
desktop/mobile Chromium, Firefox and mobile WebKit. The suite covers the larger
catalog, pagination, filters, EV/PHEV estimates and the existing comparison,
storage, keyboard, accessibility and server checks. These checks verify the
implementation; they do not prove full market or retail-trim coverage.

Generate the gap report with `npm run catalog:coverage`. The optional
`-- --require-complete` exits unsuccessfully while full coverage remains unproven.
Legitimately unpublished specification values may remain null with an explanation;
retail identity and current-offering evidence still require reconciliation.

## Subaru retail lineup imported

The next manufacturer pass captured all 40 exact configurations across the nine
models in Subaru Canada's currently published lineup: 2026 Forester, Impreza,
Outback and WRX, and 2027 BRZ, Crosstrek, Solterra, Trailseeker and Uncharted.
The importer reconciles the lineup's manufacturer IDs against every pricing page,
checks model year/range identity and uses Transmissions.MSRP rather than the
header's fee-inclusive selling price. Each source response has a checksum.

These records include base MSRP, seating and explicit manufacturer powertrain
flags, plus factory codes, transmission names and direct specification links.
Other specifications remain unverified until their exact source/variant joins
are reviewed. Existing Forester IDs and their reviewed facts are preserved.

At this milestone the app had 2,557 records: 43 retail configurations with verified
prices and 2,514 rating variants. Forty retail records have dated evidence of
current manufacturer listing. The remaining 2,517 records require current-offering
checks; this includes rating variants and the original Honda/Mazda configurations.
The count is a progress report, not a completed-market claim.

Refresh with `npm run catalog:sync:subaru`. Subaru's older model-year dealer stock
and variants omitted from the current national lineup still require reconciliation.
This pass does not claim every new Subaru in Canadian inventory is covered.

After the merge, all 69 unit tests and all 64 cross-browser checks passed without
retries. MSRP provenance, source parsing, complete trim/model reconciliation and
preserved Forester IDs have regression coverage.

## Toyota and Lexus factory configurations imported

The next pass adds 209 Toyota and 119 Lexus configurations from their Canadian
build-and-price tools. The capture reconciles 50 displayed series, 157 current
factory model references and every visible package. Archived factory records are
excluded using the configured display years, even when their internal status
still says active. Current overlapping display years remain included.

Some visible packages share a parent model's source record while specifying a
different original factory model code. The importer resolves those aliases back
to their actual factory identity, including RZ 450e and TX 350 F SPORT variants.
All references reconcile; no internal source gaps remain in this capture. This
does not establish that all new dealer inventory is represented.

Configuration MSRP includes the package price once, using the manufacturer's
vehiclePrice field. Hidden prices and zero-filled specification placeholders
remain unknown. Fuel-equivalent values for EVs and hydrogen vehicles never become
gasoline consumption. Ambiguous plug-in hybrid fuel modes remain unverified.

After this pass the app had 2,885 records: 371 priced retail configurations and 2,514 government
rating variants. Of these, 368 have dated manufacturer-listing evidence. The
other 2,517 records still require current-offering review. Forty-four makes in the
NRCan baseline lack a current manufacturer import; manufacturers outside that
baseline and older new inventory also remain within the objective.

Refresh with `npm run catalog:sync:tci`. Raw response checksums, configured model
years, factory identities, package membership and visibility rules are retained.
The `-- --offline` option rebuilds from verified raw captures and preserves their
original retrieval date. Ordinary application builds use the tracked snapshot.

Validation passed: 78 unit tests and 68 browser checks without retries across the
four browser projects. The browser checks include the two current Corolla LE CVT
packages, their distinct MSRP values, manufacturer-listing filter and exact
official source links. Full Canadian market coverage remains unproven.

## Honda and Acura current retail configurations imported

The next capture adds 64 Honda and 14 Acura configurations. Honda's public
Canadian lineup currently lists overlapping 2026/2027 years for Civic Sedan,
Civic Hatchback, CR-V, Passport, Odyssey and Prelude. Every listed model, year,
trim and transmission must reconcile; only taking a model's default year would
lose current offerings. The Type R remains included with its LOW INVENTORY label
even though online building is disabled. Acura's distinct Integra automatic and
manual configurations remain separate.

The public calculator's Transmission.Msrp is matched by exact trim key/ID and
transmission ID. Its presentation suffix sometimes differs from the lineup's
transmission name, such as Default versus e-CVT; both identities are preserved.
SellingPrice, levies, freight/PDI, colour markups and discounted prices are not
used as base MSRP. The two original CR-V IDs retain their links and now show the
current calculator MSRP, rather than the initial price announcement.

Exact trim specification responses provide published dimensions, seating, power,
cargo and energy facts. Optional AWD wording does not establish a configuration's
drivetrain. Where a trim contains both fuel rows, explicit configuration evidence
selects the matching row. Hybrid total-system power takes precedence over engine
power. Cargo behind the third row represents all seats upright; ambiguous cargo
maximums, paired widths and missing EV consumption remain unknown. Metric and
imperial values published together are not mixed.

Two calculator-only 2027 Sport-L entries remain unresolved: Civic Sedan and Civic
Hatchback. They are absent from the current public model/trim lineup. Acura TLX
and ZDX model cards have no current year. These cases are in the coverage report;
they require current-offering or remaining-new-inventory evidence before the
full-market objective can be considered complete. They are not silently treated
as discontinued or as confirmed current listings.

After this pass the catalog had 2,961 records, including 447 priced retail
configurations and 2,514 government rating variants. There are 446 dated
manufacturer-listed configurations; 2,515 records still require current-offering
review. Forty-two makes in the rating baseline lack a current manufacturer
import, and makes outside that baseline remain in scope.

Refresh with `npm run catalog:sync:honda`. The snapshot retains source hashes,
configuration identities and selected specification fields; full responses remain
in ignored data/raw/honda. The `-- --offline` option verifies those hashes and
reconstructs the snapshot without changing its original retrieval date.

Validation passed: all 88 unit tests and all 72 production browser checks without
retries across desktop/mobile Chromium, Firefox and mobile WebKit. Checks include
2027 CR-V drivetrain/MSRP/fuel filtering, separate Integra automatic/manual
configurations, the existing comparison/shortlist journeys, accessibility and
server integrity. Formatting, types, catalog validation and build checks passed.
The local preview's health, index and current application bundle returned HTTP 200.
These results verify this implementation milestone, not full-market completion.

## Ford and Lincoln default factory configurations imported

The current Canadian retail showrooms identify 15 Ford and six Lincoln model-year
entries. The import reconciles every listed trim/body variant with its exact
default factory build: 212 configurations, including 92 Super Duty pickup variants
and 16 Transit Passenger Van variants across 2026–2027. Pickups absent from the
fuel-rating baseline are not excluded merely because no NRCan row exists.

The source separates future-only and commercial-only showroom entries. Transit
model-selection pages also mix passenger and cargo-only vans; 42 cargo-only
variants are retained as explicit exclusions from the passenger-vehicle scope.
Future-only classification does not prove that older new inventory is unavailable.

Factory configuration IDs, selected engine/transmission/drive features, cab/box/
roof/body codes and available powertrain choices are preserved. Published aliases
such as broncosport/bronco-sport and composite marketed-series codes reconcile
against the actual source. Unpublished consumption and dimensions stay unknown;
no unrelated rating or nameplate marketing maximum is assigned to a build.

Displayed starting prices can contain freight, levies, package discounts and
delivery allowances. The MSRP adapter uses explicit Base and Options components,
removing selected colour charges and explicit package discounts. For example,
the captured F-150 XL Regular Cab 8-foot-box build displays TRIM_PRICE of $48,235,
but its MSRP before these discounts/fees is $52,690. The exact build URL and price
basis accompany the app's fact. Price components must be present; missing values
are never interpreted as zero.

After this pass the app contained 3,173 records: 659 priced retail configurations, 2,514
government rating variants and 210 official sources. There are 658 dated
manufacturer-listed retail configurations. Forty makes in the baseline still
lack a current manufacturer import. Additional Ford/Lincoln engine, drive,
equipment and other relevant selections, older inventory and manufacturers
outside the rating baseline remain in scope. Default-build coverage does not
establish every configuration for either brand.

Refresh with `npm run catalog:sync:ford`; add `-- --offline` to reconstruct the
snapshot from checksum-verified source responses without advancing its date.
The coverage report explicitly lists the remaining per-model configuration
expansion. See [the source contract and next enumeration pass](FORD-CONFIGURATOR.md).

Validation passed: all 98 unit tests and all 76 production browser checks without
retries in the final run across desktop/mobile Chromium, Firefox and mobile
WebKit. Checks include the exact F-150 cab/box MSRP and source link, unrated F-450
pickups, passenger vans, Lincoln hybrid variants and existing accessibility,
comparison, shortlist and server-integrity journeys. Formatting, types, catalog
validation, build and offline source reconstruction passed. The local preview's
health endpoint, page and current application bundle returned HTTP 200. These
checks verify this milestone; full market/configuration coverage remains unproven.

## Mazda factory model/option configurations imported

The next capture reconciles 12 active build-tool model-year entries, every trim,
engine/transmission variant and factory model-option package: 68 configurations.
This includes distinct manual/automatic MX-5 variants, Mazda3 and Mazda3 Sport,
gasoline, mild/full hybrid and plug-in hybrid configurations. The original CX-5 GX
ID and its exact NRCan join remain stable while its MSRP and reviewed specification
provenance are refreshed from the manufacturer tool.

The importer follows ModelYears → Trims → EngineModels → Packages and requests
specifications for each exact model/option code. Mazda's current public client
identifies the production API host; its source URL and checksum are retained.
Package financial.msrp is a complete configuration price, not a surcharge added
to the base price. Freight/PDE, fees, taxes, colours, incentives, protection and
non-model add-ons are separate from this MSRP.

Shared metadata aliases retain the retail identity: GS Kuro and GT Kuro package
metadata can refer to their GS/GT parent while the exact factory option code and
specification trim ID still identify the configured vehicle. Specification rows
use several documented header/data/feature case variants; all are read without
silently losing the published tables. Ambiguous fuel-grade power, roof alternatives,
plug-in operating modes and unpublished cargo measurements remain unknown.

Two 2025 CX-50 entries are still flagged coming soon by the source, despite being
previous-model-year listings. Their eight configurations are labeled with that
source flag and require availability reconciliation. Eight other older model-year
references have building disabled and remain in the inventory-review ledger;
neither condition is treated as proof of discontinuation or absence of new stock.

Five CX-50 gasoline configurations also have contradictory published cargo
measurements: 1,595 L behind rear seats and 889 L behind front seats. Both app
values remain unverified, with the original numbers and conflict explained. The
adapter does not silently swap them. These field conflicts are in the gap report.

At the Mazda milestone the catalog had 3,240 records: 726 priced retail configurations,
2,514 government rating variants and 222 official sources. There are 718 dated
manufacturer-listed configurations and eight with a coming-soon source flag.
Thirty-nine makes in the rating baseline lack a current manufacturer import;
makes outside that baseline, older new inventory and outstanding variant/field
reconciliation remain within the full objective.

Refresh with `npm run catalog:sync:mazda`. The `-- --offline` option checks the
public client and every response hash and reconstructs the snapshot without
advancing its retrieval date. See [the exact source contract](MAZDA-CONFIGURATOR.md).

Validation passed: all 108 unit tests and all 80 production browser checks without
retries across desktop/mobile Chromium, Firefox and mobile WebKit. The suite
covers Mazda package MSRP/source links, visible coming-soon and cargo conflicts,
existing comparison/shortlist journeys, accessibility and server integrity.
Formatting, types, catalog validation, build and checksum-verified offline
reconstruction passed. The running preview's health endpoint, page and current
application bundle returned HTTP 200. Full Canadian coverage remains unproven.

## Hyundai factory trims and packages imported

The next capture reconciles 18 current model/year references, 55 parent trims
and all 80 factory subtrims/packages in Hyundai Canada's build tool. Gas, hybrid
and plug-in cards sometimes share a model ID; all trims of that model are
imported once. Overlapping 2026/2027 years, manual/DCT Elantra N configurations,
factory packages and seven/eight-passenger Palisade variants remain distinct.

The exact trim calculator's msrp is used with includeDestination=false. Delivery,
fees, taxes, incentives and financing are separate. The captured 2026 Kona N Line
AWD with Ultimate Package has a $39,699 parent-option estimate versus $39,399 in
the exact-trim calculator. The app retains this discrepancy in the source note
and coverage report and uses the explicit exact-trim MSRP field.

Exact-trim feature responses provide explicit drivetrain, transmission and
seating evidence where published. An explicit seven/eight-passenger factory trim
name can also establish seating. Missing features remain unverified. Seventeen
model specification tables returned HTTP 503/504 after bounded retries; a captured
Tucson table still needs its shared HEV/PHEV columns reconciled to exact factory
IDs. Dimensions, power, cargo and energy facts are not guessed from those tables.

At the Hyundai milestone the catalog had 3,320 records: 806 priced retail configurations,
2,514 government rating variants and 240 official sources. There are 798 dated
manufacturer-listed configurations and eight Mazda configurations with a
coming-soon source flag. Thirty-eight makes in the rating baseline still lack a
current manufacturer import. Makes outside that baseline, older new inventory,
Ford option expansion and outstanding source/field reviews remain in scope.

Refresh with `npm run catalog:sync:hyundai`; `-- --offline` reconstructs the snapshot
from checksum-verified raw responses without advancing its capture date. The
initial import preserves valid responses captured before Hyundai's subsequent
backend outage; normal application builds have no runtime dependency on it.
See [the source and reproduction contract](HYUNDAI-CONFIGURATOR.md).

Validation passed: all 115 unit tests and all 84 production browser checks without
retries across desktop/mobile Chromium, desktop Firefox and mobile WebKit.
Hyundai package prices/source links, plug-in filtering, the visible Kona source
conflict and separate Palisade seating choices have regression coverage. Formatting,
package boundaries, types, catalog validation, build and checksum-verified offline
reconstruction passed. The restarted preview's health endpoint, page and current
bundle returned HTTP 200. The JavaScript bundle is 4,705.89 kB raw / 394.05 kB gzip;
Vite's large-chunk warning remains an outstanding performance improvement.
Full Canadian market/configuration coverage remains unproven.

## Kia factory trims and packages imported

The next capture reconciles 24 model/powertrain/year references from both Kia
Canada's current lineup and build tool. Twenty-three passenger entries supply
126 factory trim/package configurations, including current 2025 Telluride/EV6
offerings and overlapping 2026/2027 model years. The 2027 EV4 is absent from the
grouped family list but is independently confirmed by its exact official model
page data. Two PV5 Basic/Plus trims are excluded with primary evidence identifying
that model as a dedicated two-seat commercial cargo vehicle. Passenger Carnival
minivans remain included.

Each package retains its own factory code, complete MSRP and specifications;
neither its price nor its missing fields are borrowed from the parent. Explicit
package names, transmission configuration and powertrain feature labels can
establish drive when the main drivetrain field is absent. A 2027 EV4 Wind Premium
AWD package has a conflicting Wind source label; its exact parent relationship
resolves the displayed identity while the original alias remains in the gap report.

Captured dictionary labels establish hp, liquid-fuel L/100km, electric-range km
and Level 2 charging units. Combined hybrid output is taken directly, without
adding engine and motor ratings. Gasoline-equivalent EV energy never becomes
gasoline consumed. Plug-in operating modes, cargo-floor alternatives, generic
minimum/maximum volumes and roof-qualified headroom remain unverified until
their exact applicability is reconciled. Twenty-six records retain multiple FSC
aliases whose ordering/equipment significance still requires review.

At the Kia milestone the catalog had 3,446 records: 932 priced retail configurations,
2,514 government rating variants and 263 official sources. There are 924 dated
manufacturer-listed configurations and eight Mazda configurations with a
coming-soon source flag. Thirty-seven baseline makes still need a manufacturer
import. Makes absent from that baseline, omitted models and older new inventory,
Ford option expansion and outstanding source/field reviews remain in scope.

Refresh with `npm run catalog:sync:kia`; `-- --offline` verifies raw source hashes
and reconstructs the same snapshot with its original date. Required-source or
identity failures prevent replacement. Ordinary builds and the running app use
the tracked snapshot without runtime manufacturer requests. See
[the Kia source contract](KIA-CONFIGURATOR.md).

Validation passed: all 123 unit tests and all 88 production browser checks without
retries across desktop/mobile Chromium, desktop Firefox and mobile WebKit. Kia
AWD packages, exact MSRP/source links, the independently confirmed 2027 EV4,
Carnival drivetrain and combined hybrid output, overlapping years and the
passenger/commercial distinction have regression coverage. Formatting, package
boundaries, types, catalog validation, build and checksum-verified offline
reconstruction passed. The restarted preview's health endpoint, page and current
bundle returned HTTP 200. The JavaScript bundle is 4,973.46 kB raw / 415.74 kB gzip;
the large-chunk performance warning remains outstanding. Full Canadian coverage
and exhaustive ordering/equipment-variant reconciliation remain unproven.

## Chevrolet, GMC, Buick and Cadillac factory matrices imported

The next capture reconciles 83 Canadian model/year/body references and every
published trim-matrix option against its nested trim configuration. Seventy-nine
passenger/pickup entries supply 1,230 distinct style/body/drive/engine/transmission/
axle/battery/propulsion combinations. The 2026 Silverado 1500 alone has 121
combinations across 35 styles. Current and selectable previous years remain
included. Two Equinox references omitted by the generic build selector are also
confirmed by their official model pages.

Four separately identified Express/Savana Cargo entries, totaling 32 combinations,
are excluded as cargo-only bodies. Their Passenger counterparts retain all 48
combinations, and personal HD pickups remain included. These exclusions are not
applied to an entire make, van family or truck weight class.

Exact configuration responses must match every factory identity component.
Factory MSRP is the standard vehicle price plus selected equipment, reconciled
to the published subtotal, with paid colours, dealer products and accessories
removed. Freight, fees, taxes and incentives are separate. The 2026 Envista
Preferred's $29,749 base MSRP is distinct from its $32,883 charged display. A
Silverado WT V8 configuration includes its required differential and has $52,744
factory MSRP, rather than the $56,278 charged total.

The public calculator began returning 403 for many requests; several new
combinations returned 422. Captured responses and exactly matching default GET
calculations establish 376 MSRP values. The other 854 remain explicitly unverified,
including unmatched defaults and unresolved pricing components. None use a
fee-inclusive matrix amount as a substitute. Exact calculator horsepower and
explicit Canadian city/highway L/100km can be shown; dimensional, cabin, cargo
and other energy tables still need exact variant/option joins. Additional
equipment/package combinations beyond the published matrix remain in the report.

At the GM milestone the catalog had 4,676 records: 2,162 retail configurations, of which
1,308 have verified MSRP, plus 2,514 government rating variants and 342 official
sources. There are 2,154 dated manufacturer-listed configurations and eight Mazda
configurations with a coming-soon source flag. Thirty-three baseline makes still
need a manufacturer import. The objective continues to include makes outside
that baseline, older new inventory and outstanding configuration/field reviews.

Reconstruct GM with `npm run catalog:sync:gm -- --offline`, or import a new reviewed
manifest with `-- --from-captures <manifest.json>`. Both preserve the source date
and verify captured bytes. Ordinary builds and the running app make no runtime
manufacturer requests. Serialized states without a usable calculation are kept
in the raw captures rather than the browser payload; verified builds retain exact
source links. See [the source contract](GM-CONFIGURATOR.md).

Validation passed: all 133 unit tests and all 92 production browser checks without
retries across desktop/mobile Chromium, desktop Firefox and mobile WebKit.
Regression coverage includes complete matrix joins, rejected/default substitutions,
component/subtotal MSRP reconciliation, unavailable-price filtering, passenger vans,
exact factory source links and existing comparison/accessibility/server journeys.
Formatting, boundaries, types, catalog validation, build and checksum-verified
offline reconstruction passed. The running preview's health endpoint, page and
current bundle returned HTTP 200. Removing unnecessary serialized states reduced
the JavaScript bundle from 912.26 kB to 603.98 kB gzip (6,343.48 kB raw); the
large-chunk warning remains an outstanding performance improvement. Full Canadian
market and exhaustive configuration coverage remain unproven.

## Nissan and Infiniti factory versions imported

The next capture reconciles 20 Nissan and five Infiniti Canadian model years,
including both listed 2026 and 2027 offerings. Every one of the 99 selector
versions is included. Factory suffixes preserve Frontier Luxury SWB/LWB packages
and the 2027 Z's distinct six-speed manual and nine-speed automatic versions.
Two separately offered $4,200 Tech Packages on exact 2027 QX60/QX65 AUTOGRAPH
versions add two more configurations. Zero-cost Graphite Interior colour choices
are retained in source metadata rather than counted as additional retail trims.

Exact version, grade, year and Canadian source paths establish 56 specification
joins. The other 45 configurations retain their own identities and prices where
verified; redirected/superseded pages and the Rogue Hybrid specification route's
404 are explicit gaps. Measurements from a different model year are not copied.
Rogue S and SV Moonroof retain their different cargo and headroom values.

All 84 Nissan MSRP values use the selector's explicitly fee-excluded retail
field. Infiniti's retail disclaimer says freight/PDI and charges are included,
while its regional field contains a different amount. The 17 Infiniti prices,
including the two Tech Package configurations, remain unknown pending independent
reconciliation. Neither regional prices nor a plausible-looking retail number
are silently used as base MSRP.

Metric/imperial pairs must agree within rounding tolerance. Bare values under
dual-unit labels, incompatible pairs, ranges, mirror/bracket alternatives and
unresolved roof choices remain unknown. EV Le/100km stays energy equivalence;
generic plug-in fuel values do not establish an operating mode. The 2027 Rogue
Hybrid PLATINUM grade's combined value falls outside its city/highway interval;
all three values remain unknown with a source-conflict explanation.

The new-inventory selectors reference 35 additional 2024/2025 model years absent
from the current build selectors, including Versa, Altima, GT-R, Kicks Play, Q50,
QX50 and QX55. They remain in the coverage ledger for actual new-stock and
configuration reconciliation. Selector metadata alone does not establish stock,
and absence from the current build tool does not establish discontinuation.

At the Nissan/Infiniti milestone the catalog had 4,777 records: 2,263 retail configurations, of which 1,392 had
verified MSRP, plus 2,514 government rating variants and 381 official sources.
There are 2,255 dated manufacturer-listed configurations and eight Mazda entries
with a coming-soon flag. Thirty-one baseline makes still need a manufacturer
import; makes outside that baseline and outstanding inventory/configuration/
source reviews remain in scope. Full Canadian coverage remains unproven.

Refresh with `npm run catalog:sync:nissan`, or reconstruct with `-- --offline`.
Reviewed captures can be imported with `-- --from-captures <manifest.json>`.
Checksummed bytes and original retrieval dates are preserved. Ordinary builds
and the running app make no runtime manufacturer requests. See
[the source contract](NISSAN-CONFIGURATOR.md).

Validation passed: 142 unit tests and 96 production browser checks without retries
across desktop/mobile Chromium, desktop Firefox and mobile WebKit. The import
checks exact package/year/version joins, independent selector version references,
metric/imperial consistency, price conflicts, EV/PHEV units and source mismatches.
Browser checks include Nissan EV pricing/sources, pickups, Infiniti equipment
packages, unverified-price filtering and existing accessibility/server journeys.
Formatting, boundaries, types, catalog validation and checksum-verified offline
reconstruction passed. The preview health endpoint, page and current bundle
returned HTTP 200. JavaScript is 6,867.97 kB raw / 649.21 kB gzip; the large-chunk
performance warning remains open. The full-market completeness gate correctly
continues to fail while availability, inventory, pricing and coverage work remains.

## Volkswagen factory configurations imported

The next capture reconciles the Canadian model overview and build selector against
the public configurator's Canadian VISO catalogue. Thirty-two listed trims contain
33 exact model/year/version references across 12 model years. Listed 2026 Taos,
Jetta and Jetta GLI remain included even though the build selector excludes them
from online configuration. The GLI's six-speed manual and seven-speed automatic
retain separate factory codes and their own fuel-consumption values.

Factory model prices are CAD and exclude VAT. They are the model base prices used
by the configurator, before regional charges, optional paint/accessories and
incentives. All 33 MSRP values are verified. The Golf R Black Edition retains its
complete model identifier with encoded factory packages and its $54,595 complete
model price; no package is removed or added twice. Regional selling prices can
include large incentives, so subtracting apparent fees is not a valid MSRP method.

The passenger ID. Buzz is kept despite VW's internal commercial category. Its
RWD seven-seat and AWD six-seat versions remain distinct, with explicit electric
consumption, range and combined-system hp. Manufacturer category labels alone do
not exclude passenger vans. kWh is not treated as gasoline, and several published
AC charging powers do not become one arbitrarily selected recharge time.

Dimensions, power, seating and explicit cargo arrangements use exact model
technical fields. Decimal-comma fuel values are normalized without confusing
them with thousands separators. Different sunroof headroom alternatives remain
unknown unless the values agree. Width excludes mirrors; cargo behind the third
row represents all seats upright in three-row vehicles.

The current overview also includes a 2026 Atlas virtual card with no exact
trim/engine references. It remains an explicit family/retail/inventory gap,
rather than becoming an invented default trim. Navigation cards for the SUVW
family and previous-model information are kept separate. Additional factory
equipment, older new stock and models outside the current overview, including
ID.4 availability and retail reconciliation, remain in scope.

At the Volkswagen milestone the catalog had 4,810 records: 2,296 retail configurations, of which 1,425 had
verified MSRP, plus 2,514 government rating variants and 395 official sources.
There are 2,288 dated manufacturer-listed configurations and eight Mazda entries
with a coming-soon flag. Thirty baseline makes still need a manufacturer import;
makes outside the baseline and unresolved inventory/configuration/source reviews
remain part of the objective. Full Canadian coverage remains unproven.

Refresh with `npm run catalog:sync:volkswagen`; `-- --offline` reconstructs the
snapshot from original checksum-verified bytes without advancing its date.
`-- --from-captures <manifest.json>` imports reviewed captures with their original
date. Required-source, reference or country/identity failures prevent replacement.
Ordinary builds and the running app make no runtime manufacturer requests. See
[the source contract](VOLKSWAGEN-CONFIGURATOR.md).

Validation passed: all 150 unit tests and all 100 production browser checks
without retries across desktop/mobile Chromium, desktop Firefox and mobile
WebKit. Coverage includes complete factory reference sets, wrong country/year/
package rejection, factory MSRP, manual/automatic fuel distinctions, passenger
van seating, EV energy units, roof/charger uncertainty and existing comparison,
accessibility and server behavior. Formatting, package boundaries, types, catalog
validation, build and checksum-verified offline reconstruction passed. The
preview health endpoint, page and current bundle returned HTTP 200. JavaScript
is 7,024.69 kB raw / 662.41 kB gzip; the large-chunk performance warning remains
open. The full-market completeness gate continues to fail while coverage and
source reconciliation are unfinished.

## Mitsubishi factory trims and additional inventory years imported

The Canadian build-start page, configurator active-code lists and exact factory
queries reconcile all 32 current trims across six model years. Both 2026/2027 RVR
years remain included, alongside 2026 Outlander, Outlander PHEV and Eclipse Cross
and the two 2027 Eclipse Sportback EV configurations. Matching official
specification tables establish exact trim ID/code/name and model-year joins.

The national new-inventory feed independently references nine model/year groups.
It adds 2025 Outlander, RVR and Eclipse Cross beyond the current build selector.
Their public Canadian factory queries establish another 17 exact trims and MSRP
values. Those records remain availability unchecked: a family-level inventory
count does not confirm every trim. The feed also references 2027 Outlander, but
its factory query returns “Vehicle not found.” That model year remains a gap,
rather than inheriting another year's identities, prices or measurements.

All 49 prices use the exact model's positive MSRP base value, with returned price
and separate fee components reconciled in CA/CAD context. Optional colours,
packages, accessories, discounts, taxes and delivery are not substituted into
base MSRP. Current 2026 Outlander ES is $36,398; the separately retained 2025
factory model is $35,598 and has different engine/powertrain evidence.

The 2026 Outlander's 48 V BSG engine is identified as a mild hybrid in the app.
PHEV, battery-electric and gasoline configurations retain separate identities.
PHEV engine/motor figures do not become an invented net-system output, and generic
fuel/equivalence fields do not establish operating-mode splits. Electric range is
72 km for the PHEV, distinct from total hybrid range. The Eclipse Sportback EV's
454 km range and combined 2.1 Le/100km remain distinct from liquid fuel and kWh.
Two different AC charging windows do not become one arbitrary recharge time.

Metric/imperial pairs must agree within rounding tolerance. Explicit cargo behind
the third row represents all seats upright; generic cargo labels and unpublished
head/legroom remain unverified. Older-year technical fields are not copied from
current pages. The report retains these fields, additional ordering/equipment
work and exact older-trim stock checks.

At this milestone the catalog had 4,859 records: 2,345 retail configurations, of which 1,474 had
verified MSRP, plus 2,514 government rating variants and 410 official sources.
There are 2,320 dated manufacturer-listed configurations, eight Mazda entries with
a coming-soon flag and 2,531 availability-unchecked records, including the 17
older Mitsubishi trims. Twenty-nine baseline makes still need manufacturer
imports; makes absent from that baseline remain in scope.

Direct build-selector downloads for Chrysler, Dodge, Jeep, Ram and FIAT returned
HTTP 403. A standard browser request to Jeep's model page was rejected too.
These are dated source-access research gaps, recorded with response hashes in
[the access review](catalog-source-access.json) and the generated coverage report.
Indexed official model pages remain discoverable; the errors do not establish
absence of current Canadian offerings or complete any manufacturer's coverage.

Refresh with `npm run catalog:sync:mitsubishi`, reconstruct original bytes/date
with `-- --offline`, or import reviewed captures with `-- --from-captures
<manifest.json>`. Exact current references and all inventory model years must
reconcile. Required source, country, year, trim or checksum failures prevent
replacement. Ordinary builds and the running app make no runtime manufacturer
requests. See [the source contract](MITSUBISHI-CONFIGURATOR.md).

Validation passed 158 unit tests and 104 browser checks across desktop/mobile
Chromium, Firefox and WebKit. Formatting, package boundaries, types, catalog
validation, build and checksum-verified offline reconstruction passed. The
preview health endpoint, page and current bundle returned HTTP 200. JavaScript
is 7,127.92 kB raw / 674.12 kB gzip; the large-chunk performance warning remains
open. The full-market completeness gate continues to fail while manufacturer,
inventory, ordering and field reconciliation remain unfinished.

## Polestar factory options and equipped new stock imported

The Canadian home/configure selectors and each public factory initializer agree
on three current models. CA/CAD/en-CA context, exact model year/structure week,
motor code/name and equipped PNO reconcile. Every exposed motor, pack and single
option transition is followed to closure: one Polestar 2, two Polestar 3 and
eleven Polestar 4 configurations. Compatibility changes returned by the source
are preserved, including additional packs or motor changes required by roof and
Performance selections.

The initial public new-stock retailer query listed six Canadian retailers. All 18
retailer/model combinations and reported ten-record pages were captured using
the normal browser's DeliveryDate/Asc sorting. There were 489 reported rows and
112 distinct equipped model-year/structure-week/PNO identities. Five retailer
feeds repeated Polestar 4 identities across pages, preventing proof that all
distinct configurations were retrieved. Their counts remained explicit coverage
gaps pending the partition reconciliation below.
These are configuration observations, not VIN quantities or delivery guarantees.

Six exact factory/stock overlaps merge, yielding 120 retail configurations. Seven
are 2026 Polestar 4 stock configurations absent from the current 2027 factory
selector. Their own prices, hp and EPA-labelled range remain included; current
factory dimensions, consumption and charging fields are not copied into them.
Additional colours, wheels, upholstery, accessories and older new stock remain
within the full objective and require further ordering/availability reconciliation.

Prices are the undiscounted equipped vehicle amount before delivery, taxes,
extras and incentives. Factory car and delivery components reconcile to the
grand total. Polestar 2 is $69,900 and Polestar 3 Dual motor/Performance are
$105,000/$120,000. Polestar 4 Rear motor is $64,900; its separately returned
Plus/Performance and roof/moulding combinations retain their complete price.
Lower discounted cash or checkout totals are not substituted into MSRP.

The app uses explicitly EPA-labelled range and kWh/100 km fields, retaining
manufacturer preliminary-data caveats. Conflicting generic Electric range
values remain recorded, and an energy-consumption interval does not become one
arbitrary number. Manufacturer hp is not converted from kW, charging windows
remain explicit and published width includes mirrors. Missing cabin/cargo and
other stock-specific facts remain unverified.

The catalog now has 4,979 records: 2,465 retail configurations, 1,594 verified
prices, 2,514 government rating variants and 417 official sources. There are
2,440 manufacturer-listed configurations and 2,531 availability-unchecked
records. Twenty-eight baseline makes still need manufacturer imports; makers
absent from the baseline and unresolved source/configuration gaps remain in scope.

Volvo's direct pages and a normal browser build-selector request returned HTTP 403. Audi's direct Canadian model selector returned HTTP 403. Their dated source
hashes join the access ledger; indexed official pages remain discoverable and
neither error establishes absence or complete coverage. BMW's public selector
and build shell respond, but a full factory-data import remains pending.

Refresh with `npm run catalog:sync:polestar`, reconstruct the original bytes/date
with `-- --offline`, or import reviewed captures with `-- --from-captures
<manifest.json>`. Required identity, transition, page count, checksum and catalog
adapter failures prevent replacement. The app makes no manufacturer requests at
runtime. See [the source contract](POLESTAR-CONFIGURATOR.md).

Validation passed all 166 unit tests and 108 browser checks in desktop
Chromium/Firefox and mobile Chromium/WebKit. Formatting, package boundaries,
types, catalog validation, build and checksum-verified offline reconstruction
passed. The refreshed preview health endpoint, page and current bundle returned
HTTP 200. JavaScript is 8,397.37 kB raw / 733.19 kB gzip; the large-chunk performance
warning remains open. The full-market completeness gate continues to fail while
manufacturer, inventory, ordering and field reconciliation remain unfinished.

## Polestar listed-retailer inventory reconciled with single-page partitions

All 18 retailer/model groups now reconcile using source-declared disjoint
filters. Colour, motor, model year, upholstery and wheel choices progressively
split large results until each leaf fits on a single ten-record page. Every
declared value is queried. Leaf identities must be unique; children must be
disjoint, sum to their parent total and retain every observed parent identity.
Missing branches, overlaps, stale totals and unresolved pagination fail refresh.
The five previously reported pagination gaps are resolved for these listed feeds.

The refreshed sources report 485 retailer/configuration references to 112
shared equipped identities. The catalog still has 120 Polestar configurations
after six exact factory overlaps merge; all seven 2026 stock configurations
remain included. Source-reference counts describe configurations rather than VIN
quantities or delivery guarantees. Other retailers, unlisted older new offerings,
additional factory equipment and missing technical fields still need review.

Snapshot schema 2 stores each stock configuration once while preserving every
retailer's delivery label and exact leaf receipt. Conflicting shared evidence,
missing vehicles or unmatched references prevent replacement. The normalized
snapshot shrank from 2,084,704 to 1,297,602 bytes without dropping represented
configurations. Offline reconstruction retains the source date and verifies all
request/response hashes and partition proofs.

At this milestone BMW research had established the Canadian public vehicle-tree endpoint through
the client settings linked by its official configurator. The dated tree supplies
48 exact current references, but price, specification, transmission/ordering and
independent lineup/older-stock reconciliation remain pending. These research
references had not yet been treated as imported retail configurations.

Validation passed 167 unit tests and all 108 browser checks in desktop
Chromium/Firefox and mobile Chromium/WebKit. Formatting, package boundaries,
types, catalog validation, build and checksum-verified offline reconstruction
passed. The refreshed preview health endpoint, page and current bundle returned
HTTP 200. JavaScript is 8,011.35 kB raw / 736.09 kB gzip: the audit proofs add
compressed metadata even as shared stock data reduces the raw bundle. The
large-chunk performance warning remains open. Full Canadian market coverage
remains unverified, with 28 baseline make imports and other inventory/ordering/
specification gaps still outstanding.

## BMW observed retail years and exact factory profiles imported

The Canadian overview, official configurator settings and both public BMW/BMW i
vehicle trees are captured. There are 55 overview cards, including two concepts,
and 49 distinct current tree codes after duplicate marketing references merge.
The official national new-stock page supplies explicit model-year/VG/AG identities
across 2025–2027. Years are not inferred from code prefixes, and the default
configurator year does not replace older new stock.

All 196 reported 48-record stock pages were captured. They contain 9,386 returned
rows and 8,970 distinct vehicle identities, yielding 110 observed model/year/AG
groups. Repeated pages leave exhaustive stock coverage unproven; the coverage
report retains this discrepancy. VINs are used only in local source reconciliation
and do not appear in the normalized catalog. Six current tree codes without an
exact observed year remain gaps, alongside unmatched overview/AG placeholders and
additional older offerings. Concept cards do not establish vehicles for sale.

All 110 observed profiles are represented. Exact rule-solver VG identities,
classified transmissions and selected equipment are retained where available.
107 CAD/RRP_NET prices are verified before fees, freight, levies, taxes, incentives
and discretionary equipment. A selected transmission option is included when
applicable. The 2027 228 xDrive Gran Coupe Essential Edition is $50,900, rather
than the calculator's $55,095 gross amount. Separate BMW i service context is used
for iX pricing. Dealer/supplier base prices are not substituted for the three
unsupported 2025 factory prices.

51 profiles lack current ordering data and retain explicit restrictions. Published
bare-model RRP does not price unverified optional transmission or equipment
combinations. Older M2 stock lists manual and automatic variants requiring further
reconciliation. Factory package and selection expansion remains open across BMW.

59 exact technical joins retain configured AG/options, combined BHP, seating and
paired metric dimensions. Published width includes mirrors. The 2026 M340i's
classified 48 V system establishes a mild hybrid and 386 combined BHP, distinct
from 375 engine-only hp. EV/PHEV identities remain separate. The Canadian client
uses a technical country group named us; unresolved Canadian energy modes,
charging, head/legroom and cargo arrangements remain unknown. Older-year technical
fields and unverified hybrid subtypes are not filled from another configuration.

The catalog now has 5,089 records: 2,575 retail configurations, 1,701 verified
prices, 2,514 government rating variants and 587 official sources. There are
2,550 dated manufacturer-listed configurations and 2,531 availability-unchecked
records. Twenty-seven baseline makes still need imports; makers absent from that
baseline and unresolved configuration/source gaps remain within the full goal.

Refresh through the public anonymous stock capture followed by factory sync;
offline reconstruction verifies hashes and retains source dates. Required source,
identity, context and adapter errors prevent replacement. See
[the source contract](BMW-CONFIGURATOR.md).

Validation passed 176 unit tests, package boundaries, catalog validation, types,
build, formatting and checksum-verified offline reconstruction. Browser coverage
passed all 112 checks across desktop Chromium/Firefox and mobile Chromium/WebKit:
106 passed in the full run, and six passed focused reruns after correcting BMW
search-count assumptions and resolving browser runtime/timeouts. The app retains
both matching M340i and iX3 identities. Local WebKit uses the same downloaded
browser with isolated runtime libraries because Docker became unavailable.

The refreshed preview health endpoint and current JavaScript return HTTP 200;
the release fingerprint matches the current source. JavaScript remains 9,018.74 kB
raw / 848.83 kB gzip, with the large-chunk performance warning open. The complete
market gate still fails as expected: missing makes, factory selections, stock
reconciliation and specification evidence remain work toward the full objective.

## MINI Canadian source research milestone

At this checkpoint MINI's published Canadian configurator supplied 23 active exact model codes across
2026–2027 and 90 model/line/style combinations. The cleared national new-stock
search reconciles 1,553 distinct vehicles across all 44 reported pages, adding
older 2025 stock and special editions beyond the carousel. There are 37 distinct
codes across both sources. This research had not yet added MINI retail records or
reduced the 27 makes awaiting import.

Three older technical tables conflict with observed stock transmissions; one
Paul Smith AG identity conflicts across sources; a Countryman JCW Edition pricing
source returns HTTP 500. Supplier price discrepancies and optional equipment also
require reconciliation. See [the research contract](MINI-CONFIGURATOR.md) before
implementing the importer; model counts alone do not establish complete coverage.

## MINI factory line/style/package selections and observed new stock imported

The import represents all 37 observed Canadian code/year identities. All 23 active
carousel codes reconcile against the independently linked overview families;
duplicate electric Countryman references merge. Exact equipment lines, style IDs,
90 selection-context responses and the published package rules produce 175
current model/line/style/named-package selections. Fourteen additional code/year
profiles remain observed new-stock base profiles, including older 2025 vehicles
and Icon, JCW, Victory, Heritage and Elementary editions.

The public anonymous national search captures all 44 reported pages with photo,
mileage, province/retailer, geographic and year/price restrictions cleared. All
1,553 rows are distinct new, non-demo passenger vehicles. A second capture using
the production script independently reconciles the same total. VINs and session
headers are excluded from the normalized snapshot. Changing totals, repeated
identities, unexpanded stock AG/transmission/fuel/drive variants and missing
selector/line/style identities prevent replacement.

There are 189 added retail profiles and 185 verified prices. MSRP combines the
exact factory base, line, style and selected named-package increments before fees,
paint, taxes and incentives. The 2027 Cooper C 3 door PREMIER+ with Piano Black
Favoured style is $39,240. The 2027 Countryman S ALL4 PREMIER+ with Piano Black
Favoured style and both named packages is $53,890. Dealer/supplier price fields
and all-inclusive totals do not replace factory MSRP. Stock-base RRP is explicitly
separate from equipped-stock selling price and unverified ordering.

Three 2025 manual-transmission technical tables conflict with observed automatic
stock; their technical data and automatic-configuration MSRP remain unknown.
27HP's carousel/stock AG conflict quarantines its technical fields while retaining
independently verified exact-code pricing. The 27YQ pricing request returns HTTP
500, and its technical response reports an invalid CACode; its observed stock
identity remains present with unknown facts. Only the exact reviewed failed
response can replay from captures. Live source failures abort rather than erase
previously verified data.

Thirty-two model-code technical joins remain usable. Explicit hp, metric/mirror
dimensions, luggage arrangements and full AC recharge at 9.6 kW retain their
source basis. Unitless legacy values, ambiguous colon durations, DC partial-charge
times, consumption cycles, seating and cabin fields are not copied into other
metrics. Individual wheel/equipment-specific dimensions remain unverified.

The catalog now contains 5,278 records: 2,764 retail profiles, 1,886 verified
prices, 2,514 government rating variants and 795 official sources. There are
2,739 dated manufacturer-listed configurations and 2,531 availability-unchecked
records. Twenty-six baseline makes still need imports. Older equipped stock,
additional individual options, source conflicts, independent market review and
missing measurements remain in the full objective. See
[the MINI source contract](MINI-CONFIGURATOR.md).

Validation passed 185 unit tests and all 116 production browser checks across
desktop Chromium/Firefox and mobile Chromium/WebKit. Formatting, package
boundaries, catalog validation, types, build, checksum-verified offline
reconstruction and the production stock-capture script passed. The refreshed
preview health endpoint and current bundle return HTTP 200; its release
fingerprint matches the source. JavaScript is 9,237.39 kB raw / 874.57 kB gzip,
with the large-chunk performance warning still open. The complete-market gate
continues to fail as expected; this is progress toward the full objective.

## Genesis exact factory trims and provincial pricing imported

The Canadian overview and all 14 latest-model families reconcile against explicit
2026–2027 year dictionaries and 40 unique trim GUIDs. Compatible colour/interior
pairs expose 41 factory HSC profiles, including both 2026 GV70 Sport 3.5T interior
variants. Editions sharing a default HSC retain their separate trim identities.
All expected family, year, trim and mapped-HSC identities must reconcile before
replacement. Older new-stock and additional equipment review remain incomplete.

Genesis explicitly calls its vehicle amount all-inclusive, despite naming the
source field msrp. All 41 fee-exclusive base MSRP values remain unknown. A separate
price contract displays 39 published Alberta component totals before sales tax;
they never replace base MSRP in budget filtering or ranking. For example, 2027
G70 Advanced 2.5T is $57,131.88 all-inclusive in Alberta. The exact compatible
colour/interior charges and every itemized provincial fee are included, with
incentives excluded. 2027 Electrified GV70 has null fee components and no regional
total; 2027 GV60 Magma is a zero-price preorder marked announced. Neither becomes
a fictional zero-price vehicle.

Thirteen exact Canadian technical tables join usable model/year/trim identities.
Eleven responses have production-year metadata conflicting with their current
selector labels and remain quarantined. Older brochures, EPA/AWD values without
Canadian units, unspecified cargo seating arrangements, EV motor/boost values
and unresolved mirror conventions do not become unqualified facts. Exact-year
factory key features remain usable where explicit. See
[the Genesis source contract](GENESIS-CONFIGURATOR.md).

The catalog now has 5,319 records: 2,805 retail profiles, 1,886 verified base prices,
39 separate regional all-inclusive prices, 2,514 government rating variants and
890 official sources. There are 2,779 manufacturer-listed configurations and
2,531 availability-unchecked records. Twenty-five baseline makes still need
manufacturer imports, alongside makers outside that baseline and unresolved
ordering, stock, equipment and measurement gaps. The complete-market gate still
fails as expected.

Validation passed 196 unit tests and all 120 production browser checks across
desktop Chromium/Firefox and mobile Chromium/WebKit. Package boundaries, catalog
validation, types, build and checksum-verified offline reconstruction passed.
The preview health endpoint and current bundle return HTTP 200; the release
fingerprint matches the source. JavaScript is 9,568.05 kB raw / 918.68 kB gzip,
with the large-chunk performance warning open. Live refresh also refuses lost
offerings, verified specification downgrades and lost regional prices pending
review; source failures cannot silently erase previously verified data.

## Rivian visible factory choices and observed older new stock imported

The Canadian overview and anonymous builder reconcile R1S and R1T ordering with
explicit 2027 Canadian model-year rules. Expansion follows the actual UI events:
trim, drive system, Power Upgrade, wheel, interior, Sound + Vision and Captain's
Chairs. All-Terrain, wheel packages and underbody protection derive from their
paired selections. Internal options are not independently multiplied into
combinations the builder does not offer.

The final graph has 290 valid states, with all 2,420 explored transitions and
state prices matching the published engine during isolated research. Equipment
projection retains 46 R1S and 23 R1T current profiles, each using its least
expensive compatible wheel/interior choice. Exact native MSRP reconciles before
the separate $3,117 fee breakdown. R1S Premium is $151,990; Long Range with the
actual All-Terrain wheel/package selection is $169,390, or $175,290 with the
six-seat Captain's Chairs/Sound + Vision bundle. R1T Premium is $144,990. Stale
marketing fields, discounts and fee-inclusive totals do not replace factory MSRP.

Thirteen sample delivery points were queried for each model. Eight successful
AB/BC/ON/QC searches return 132 rows and 45 distinct new-stock configuration
references across 2026–2027. The other sampled points return NO_DC, which
establishes a limitation at those points rather than province-wide absence.
Physical vehicle counts and exhaustive national inventory are unverified.
Four exact model/version stock rulesets reconcile. Four paint-only duplicate
references merge, and four matching 2027 configurations merge with current profiles.
Thirty-seven additional 2026 equipment profiles remain, for 106 Rivian profiles.
All have verified factory MSRP, with paint, accessory products, fees and
incentives excluded. Wheel and interior names explain stock price differences;
stock identities remain stable when prices change.

Two omitted charging-adapter codes are tolerated only at zero effective price
under their exact rules; the adapter does not claim those products accompany a
stock vehicle. Current model seating and explicit six-seat descriptions retain
their own sources. Older seating, unjoined technical figures, EPA estimates and
ambiguous charging/cargo arrangements remain unknown. R2 reservations and R3
ordering identities remain explicit research gaps. See
[the Rivian source contract](RIVIAN-CONFIGURATOR.md).

The catalog now contains 5,425 records: 2,911 retail profiles, 1,992 verified base
prices, 39 separate regional all-inclusive prices, 2,514 government rating
variants and 906 official sources. There are 2,885 manufacturer-listed
configurations and 2,531 availability-unchecked records. Twenty-four baseline
makes still need manufacturer imports, alongside makers outside that baseline
and unresolved ordering, stock, equipment and measurement gaps. The full-market
completion check continues to fail as expected; the goal remains active.

Validation passed 206 unit tests, package boundaries, catalog validation, types,
build and checksum-verified offline reconstruction. All 124 production browser
checks passed across desktop Chromium/Firefox and mobile Chromium/WebKit; four
focused Rivian journeys then passed again after clarifying equipment names and
price notes. The refreshed preview health endpoint and current bundle return
HTTP 200, and the release fingerprint matches the source. JavaScript is
9,797.12 kB raw / 944.52 kB gzip; the large-chunk performance warning remains open.

## Lucid factory equipment and exact-year new stock imported

The Canadian menu and builders reconcile six priced model-year 2027 trims:
four Air trims and two Gravity trims. Five unpriced Gravity menu placeholders
remain ordering gaps. The importer decodes byte-framed UTF-8 Flight JSON without
executing downloaded code. Explicit model years take precedence over older
render-image paths.

Factory expansion follows the published visible selection events, including
Pure package component resets, forced equipment and the Gravity GT
wheel/appearance pairing. All 67,078 explored transitions and prices match the
published function across 5,028 reachable states during isolated research.
Projection retains 28 Air and 320 Gravity equipment profiles with minimum
compatible wheels/interiors; cosmetic alternatives remain a coverage limitation.
Full expansion runs during synchronization, while application startup validates
each stored selection, expected profile key and price.

Explicit CAD/CA/trim/variant base and manufacturing prices agree, and configured
totals reconcile to separate destination, documentation and AC charges. Pure
starts at $97,600 factory MSRP; Stealth & Sound adds $6,200 or $8,700 once.
Gravity Touring starts at $110,700; seven-passenger seating adds $4,000.
Marketing delivery-charge conflicts do not become guessed price subtractions.
Regional all-inclusive totals, discounted stock prices, trials and post-sale
software upgrades do not replace factory MSRP.

Thirty-two new-stock queries cover thirteen public sample delivery points and
six Alberta variant partitions. Their 1,414 response rows reconcile to 115
distinct vehicle references, including two new-titled display vehicles. The
sampled union contains 59 Air 2026, two Air 2025, 29 Gravity 2027 and 25 Gravity
2026 references. Equal regional counts can contain different vehicles. Every
original configured total reconciles against its own model-year CPQ components.
Legacy bundle/roof-colour markers are reviewed explicitly; missing prices never
become zero. Paint-only duplicates and compatible current matches merge, leaving
73 additional stock profiles, for 421 Lucid retail profiles. Stock identities
remain stable under price changes. These observations do not establish a
national physical inventory count, delivery promise or exhaustive market coverage.

Exact year/variant/drive/edition power and Gravity passenger counts retain their
sources. Projected or unjoined ranges, wheel-cover qualifications, ambiguous
maximum storage and mirror conventions remain visible unknowns. See
[the Lucid source contract](LUCID-CONFIGURATOR.md).

The catalog now has 5,846 records: 3,332 retail profiles, 2,413 verified base
prices, 39 separate regional all-inclusive prices, 2,514 government rating
variants and 950 official sources. There are 3,306 manufacturer-listed
configurations and 2,531 availability-unchecked records. Twenty-three baseline
makes still need manufacturer imports, alongside makers outside that baseline
and unresolved ordering, inventory, equipment and measurement gaps. The
complete-market check continues to fail as expected; the goal remains active.

Validation passed 217 unit tests and all 128 production browser checks across
desktop Chromium/Firefox and mobile Chromium/WebKit. Two initial unbounded unit
runs hit existing Rivian test timeouts under concurrent catalog loading;
limiting Vitest to two workers produced a clean complete run without increasing
test timeouts. Package boundaries, catalog validation, types, build, formatting,
and checksum-verified offline reconstruction passed. The refreshed preview
health endpoint and current bundle return HTTP 200, and the source fingerprint
matches the build. JavaScript is 10,601.77 kB raw / 1,013.27 kB gzip; startup load
and the large-chunk warning remain open production-readiness work.
