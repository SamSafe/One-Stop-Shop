# Data contract

This describes the current contract, including the market expansion. The authoritative schema is
[packages/car-catalog/src/schema.ts](../packages/car-catalog/src/schema.ts).

## Shared catalog

The catalog contains schemaVersion, reviewedAt, scope, pricingNote, sources and
cars. Each car identifies make, model, model year, exact trim, Canadian market,
body style, powertrain and drivetrain with a stable ID.

Records distinguish retail-trim configurations from government fuel-rating
variants. A government variant carries its NRCan record ID, rated class, engine,
transmission and fuel type; it is not assigned a fictional retail trim, price or
body style. Availability has an explicit status, evidence source and check date.
Any status other than not-checked requires dated, referenced evidence. Ratings
alone do not prove today's retail availability.

A `manufacturer-offer` is a current Canadian manufacturer listing whose model
year is not established. It must have `year: null`, a visible `modelYearNote`,
dated manufacturer-listing evidence and a referenced source. It cannot carry an
exact government rating. Retail configurations and rating variants still require
a numeric year. Search, comparison headers and saved controls say “Year not
verified”; filters and coverage reports count these offers separately from retail
configurations and government variants. A published MSRP can be retained for an
offer with its year uncertainty, without assigning it to a particular model year.
VinFast's expired finance/lease examples, projected technical tables and image or
product identifiers do not establish current offer years or exact technical facts.

Facts are base MSRP in CAD; city/highway/combined L/100 km; horsepower; seating;
cargo with seats up/down in litres; front/rear headroom and legroom in mm; and
published length, width and height in mm.

An optional `publishedPrice` retains an official regional all-inclusive price in
CAD, before sales tax, with its province, source and explanatory note. It is
displayed separately and never substituted for base MSRP in ranking or budget
filters. Genesis uses its published vehicle amount, the least expensive compatible
colour/interior pair for the exact factory code, and all itemized Alberta fees.
Any unknown fee, preorder or zero placeholder leaves the regional price unknown.
The manufacturer's field name alone does not establish base MSRP: Genesis calls
its all-inclusive vehicle amount `msrp`.

Electric variants also carry combined kWh/100 km, electric-mode Le/100 km,
electric range and published recharge time. Plug-in hybrids preserve fuel burned
in electric operation separately from fuel-only operation. Tailpipe CO₂ is g/km.
EV gasoline consumption is null, rather than a fictional zero-cost fuel rating.
Facts may link to the exact vehicle report through a reviewed official source URL.

Manufacturer imports preserve the official configuration ID, model code and
transmission, plus a reviewed specification URL. The Subaru snapshot reconciles
current national-lineup IDs with each model's trim/transmission pricing records.
Base MSRP is taken from the explicit MSRP field, never a fee-inclusive header
selling price. A manufacturer-listed status identifies the national offering;
it does not assert dealer inventory or a delivery date. Older stock remains a
separate availability review.

Toyota/Lexus snapshots reconcile configured display years, factory model
references and visible packages. Package aliases resolve to their original
factory code while preserving the shared parent source. Retail identity includes
the manufacturer configuration ID so distinct factory packages remain distinct.
The published vehicle price already includes the package price; it is not added
again. Hidden prices, zero-filled dimensions and suppressed specification fields
remain unknown. Source response checksums support an offline reconstruction that
does not advance the review date.

Manufacturer body classifications are retained even when marketing labels differ.
An explicit AWD model description takes precedence over a generic 4WD technical
code. Third-row vehicles use cargo behind the third row for seats-up capacity.
EV/hydrogen fuel-equivalent fields are not liquid-fuel consumption; ambiguous
plug-in hybrid operating modes require further review before cost estimates.

Honda/Acura imports retain every model card, listed model year, retail trim and
transmission. Prices match exact trim IDs/keys and transmission IDs; presentation
suffixes can differ between the lineup and calculator. The calculator's MSRP
field is separate from fee-inclusive selling price, discounts and colour markups.
Calculator-only configurations and cards without a listed year are reported as
availability research gaps. Online-buildability is not a substitute for retail
availability: a low-inventory listing can have online building disabled.

The Honda specification adapter retains exact trim source URLs and measurement
qualifiers. It selects fuel ratings using explicit drivetrain evidence, prefers
combined hybrid power, uses cargo behind the third row for three-row seats-up
capacity, and leaves unresolved width/cargo alternatives unknown. Original CR-V
IDs remain stable while their MSRP is refreshed from the current calculator.

Ford/Lincoln imports reconcile Canadian retail showroom model years with every
model-selection trim/body variant and its default factory build. Future-only,
commercial-only and cargo-only exclusions retain their source identities and
reasons. Personal pickups and passenger vans are included. Exact selected WERS
codes preserve engine/transmission/drive and body identity, including composite
marketed-series codes. Available powertrain alternatives remain in the snapshot
for a further configuration expansion pass; they are not multiplied into invented
build combinations.

Ford MSRP uses the explicit Base + Options fields before fees, delivery allowances,
incentives, explicit package discounts and colour charges. The displayed Total
and TRIM_PRICE are not substituted for MSRP. Missing components or selected
accessories leave the price unverified. Generic 4x2/2-wheel-drive labels do not
establish front versus rear drive. BEV, FHEV and diesel are distinguished using
the selected configuration; absent energy or dimension facts remain unknown.

Mazda imports reconcile active build-tool model years, trim IDs, engine/transmission
variants and model-option packages. Package financial.msrp is the full configuration
price; protection and non-model add-ons are excluded. Shared GS/GT package metadata
does not replace a Kuro retail trim's identity. Exact model/option codes, model-year
identity and specification trim IDs must match at every stage. Source row kinds are
normalized for documented HEADER/Header, DATA/Data and FEATURE forms.

The Mazda adapter retains measurement units and qualifiers, including mirror
positions, roof alternatives, folded-seat heights and fuel grades. It leaves
contradictory rear/front cargo values unknown with an explanation, without silently
swapping them. Coming-soon flags on previous-year entries and older references
with building disabled remain explicit availability/inventory research gaps.

Rivian imports follow the Canadian builder's visible choices and exact model-year
rules. Paired wheel packages, All-Terrain equipment and underbody protection are
derived from those choices. Each equipment profile retains its least expensive
compatible wheel/interior selection; individual cosmetic alternatives and
accessory quantities remain outside that expansion. Factory MSRP excludes paint,
accessory products, delivery, taxes, fees and incentives. Older new-stock profiles
retain their own ruleset and stable identity independent of price. Sampled stock
configuration references do not establish a physical or exhaustive national count.
Current Captain's Chairs use an explicit six-seat description; older stock does
not inherit current-year seating or technical figures.

Porsche snapshots reconcile the Canadian model menu, exact-year detail metadata,
native factory initializers and completed transmission/rear-seat selections.
Unselected transmission placeholders do not become configured vehicles. Stable
identity includes the model year/code, selected transmission and rear-seat state.
Numeric base and option amounts remain separate from fees and taxes. Technical
rows join the selected transmission; combined power and ordinary EV maxima remain
separate from engine-only output and Launch Control overboost. Width excludes
mirrors, and height requires the standard suspension/roof context. A limited
menu-only model keeps unqualified technical tables, price and allocation unknown.

The checked-in NRCan snapshot preserves every selected record and per-page
response receipts. Build-time expansion joins reviewed retail configurations by
explicit NRCan IDs. Both Forester trims can share one rating; exact trim identities
and existing shortlist/link IDs remain stable. Missing or incompatible joins fail.

Each fact contains:

- value: a finite number within a field-specific range, or null.
- source: an official source ID; required for every known value.
- note: measurement method, price basis, trim caveat or missing-data explanation.
  Required when the value is null.
- qualifier: optional `up-to`, accepted only for a known electric range. It remains
  visible when source notes are hidden and participates in matching-spec checks.

Sources contain a stable ID, title, publisher, HTTPS URL, field/table locator,
publishedAt (nullable) and reviewedAt. Only reviewed official domains are allowed.
Publication and review dates have different meanings. An undated source is not
assigned a fictional publication date. MSRP announcement dates remain visible.

Car IDs and exact configurations are unique. Every referenced source must exist.
Seat counts must be integers. Folded-seat cargo cannot be smaller than seats-up
cargo. Unknown values never become zero.

Measurements are manufacturer-published. Honda width has an unspecified mirror
position, Subaru uses body width and Mazda GX uses folded-mirror width. These
notes must accompany the values. Cargo measurement standards are not harmonized.

## OSS state

The complete source bibliography opens on request and supports publisher/model/
year search with 12 citations per page. Every numeric fact retains its direct
source link regardless of the bibliography's current filter or page. The full
source dataset remains available; closed or paginated views avoid constructing
an unbounded grid for every catalog interaction. Bibliography search and page
choices stay in memory and are excluded from shared comparison links.

- Filters: search, make, model year, body style, verified minimum seats, optional verified-price-only and score availability, NRCan vehicle class, record kind, availability, optional
  maximum base MSRP, powertrain, drivetrain and saved-only. No budget limit is
  active by default; an active limit excludes unknown prices. Results render in
  pages of 30 while selection and shortlists span the whole catalog.
- Priorities: integer weights 0–5 for purchase price, estimated energy cost, seats-up cargo and rear legroom. Default weights are 3/3/0/0; presets support family space and price alone. Energy uses CAD/100 km at the shared fuel/electricity inputs and plug-in electric-mode share. Annual distance does not change the score. Fixed scales live in apps/oss/src/domain.ts; missing active metrics remain unscored rather than renormalized away.
- Shortlist: versioned local-storage record containing known catalog IDs only.
  Retired, duplicate and unknown IDs are filtered on read. Corrupt payloads and
  unknown record versions are preserved until the user explicitly clears them
  through Privacy & data; choices work in memory while storage is unavailable.
  Reads and cross-tab events never write back to storage. Explicit changes read
  the latest valid record before saving.
  Manage shortlist renders ten saved configurations per page independently of filters and can select the active comparison. JSON backups use `{ version: 1, ids: string[] }` and export every saved page. Import accepts at most 2 MB of UTF-8, 20,000 entries and 256 characters per ID; unsupported keys/versions and malformed entries are rejected. File duplicates are removed in order. Recognized configurations are previewed before merging with the latest device list; unavailable IDs are reported and excluded from the merge, with the original file retained by its owner. An older asynchronous file read cannot supersede a newer selection. Imports preserve the active comparison and existing storage-failure/read-only recovery behavior. Facts and prices are read from the catalog, not embedded in the backup.
- Comparison: at most four known IDs, optional weights and an optional selected
  reference ID in URL parameters. A reference outside the selection is ignored;
  the first vehicle is the default. A shared link restores the same cars,
  priorities, reference and valid energy assumptions. If browser history updates
  fail, comparison controls remain usable and Copy comparison link still derives
  a URL from the current choices.
- Fuel estimate: annual kilometres / 100 × combined L/100 km × CAD/litre.
  EV energy estimates use kWh/100 km × CAD/kWh. Plug-in hybrids split distance
  using an explicit electric-mode percentage and include fuel used in that mode.
  The default 50% is an assumption the user can edit. Session fees and ownership
  costs are excluded. Valid energy inputs are retained in shared URLs and restored on reload. Empty or invalid inputs show unavailable estimates; malformed shared inputs fall back to documented defaults.

There is no account database or server-side shortlist in v1. Comparison query
parameters are visible to link recipients and may appear in hosting access logs.

## Garage data on device

The garage uses a separate local-storage record, `oss-garage-v1`. The authoritative
owned-data validator and correction rules are in
[domain.ts](../apps/oss/src/garage/domain.ts). The comparison catalog remains
optional for owned-vehicle entry.

- The root stores version 1, a revision identifier and up to 50 owned vehicles.
- A vehicle stores its identity, optional nickname/powertrain and catalog reference,
  current integer kilometre reading, reading date, reminders and service records.
  Optional `suppressedMaintenance` keys retain explicit removals of reviewed tasks.
- A recurring reminder has a distance interval, calendar-month interval, or both,
  with known or unknown completion baselines for each configured interval.
  Manufacturer attribution is accepted only for a matching reviewed vehicle,
  task and interval. User-defined intervals remain personal.
  Supported tasks are added automatically and idempotently; unknown history stays
  unknown until entered or explicitly linked to actual service records.
- A service record has a stable ID, task, date, odometer, notes and an optional
  reminder reference. Correcting a record retains its ID; removing a reminder
  detaches the reference while preserving the record.
- The next deadline uses applicable completion history and the explicit baseline.
  Calendar months clamp to the end of the target month. Distance and date deadlines
  use whichever occurs first. “Due soon” is an app display threshold of 30 days or
  1,000 km, not an additional manufacturer instruction. No elapsed distance is
  inferred between user-entered odometer updates.
  Missing required history displays **Needs history** unless an already known
  threshold establishes that service is due. No baseline is inferred from vehicle
  addition, model year, unlinked receipt text or a default zero. See
  [automatic scheduling](AUTOMATIC-MAINTENANCE.md).

Files and stored data share a 2 MB UTF-8 limit. Unknown formats and unreadable
saved data are preserved; session-only changes and export remain available.
Backup replacement requires an explicit user action after validation and review.
Vehicle removal requires confirmation. There is no cloud ownership database or
background notification service.

Corrections preserve attached history and unrelated newer changes. A vehicle
identity/powertrain change removes the former comparison reference. Invalidated
manufacturer intervals require explicit consent to remain as personal reminders.
Personal reminder corrections retain the reminder ID, linked receipts and calendar event identity. Starting history can be corrected or cleared independently of actual service records. Reviewed manufacturer intervals stay fixed. Stale reminder edits and pending removals check the original reminder while preserving concurrent service and odometer additions.
Saving a stale editor rejects changes to the same vehicle details, reminder or service
record, including an item deleted in another tab. Local storage does not provide
transactional multi-user writes. See [correction behavior](GARAGE-CORRECTIONS.md)
and [maintenance sources](MAINTENANCE-SOURCES.md).

## Owner lookup and appearance

The shared owner directory identifies published Canadian year/make/model and
powertrain choices from 1995 onward, with additional existing retail references.
It is separate from current retail availability and pricing. No historical price,
trim equivalence, odometer or service history is inferred from a model match.
The finder loads a losslessly packed asset on demand; manual entry remains
available when a year/vehicle is absent or lookup fails. See
[the directory contract](OWNER-VEHICLE-DIRECTORY.md).

Appearance uses a separate `oss-appearance-v1` preference (`system`, `light` or
`dark`). It follows system changes when selected and synchronizes across pages
and browser tabs. Storage denial leaves the chosen appearance usable for the
visit. It does not change or migrate garage records or comparison state.

## Additional reviewed rating links

`data/reviewed-rating-links.json` adds 24 exact Canadian Honda CR-V, HR-V and Odyssey joins and 18 Subaru joins to the original five retail links. The audit retains captured engine evidence, retail drivetrain/transmission identities and expected rating metadata. Honda checks reconcile all three city/highway/combined consumption values. Subaru checks bind exact CarID/model-code standard engine, cylinder-layout, transmission and drivetrain rows, fuel type, year/model and city/highway figures; a reviewed NRCan rating can then supply missing combined consumption. No combined figure is calculated from city/highway. TrailSport Hybrid remains distinct. These are explicit reviewed mappings, not fuzzy model-name matching. See [Subaru source evidence and unresolved conflicts](SUBARU-SPECIFICATIONS.md).

Known manufacturer facts and specific unknown explanations are retained; government facts fill only genuinely missing values. Existing standalone rating IDs remain available so saved links and shortlists continue to resolve. The original four previously merged rating IDs remain represented through their retail configurations. Source review dates are not advanced by this local join review.

Body-style browsing uses published manufacturer styles and broad unambiguous NRCan classes (SUV, pickup, wagon, minivan and van). Unknown government sedan/hatchback shapes are not inferred from a generic size class. The precise NRCan class filter remains separate and explains its linked-rating coverage.

Garage calendar export produces RFC 5545 all-day events for actual next known date thresholds, with stable event IDs and distance context. Unknown dates and distance-only tasks are omitted. The file is a snapshot with no recurrence or automatic completion assumptions. Text is escaped and UTF-8 content lines are folded at 75 octets.

## Browsing continuity and search

`browsing.ts` validates URL search, make/model/year, price, body/seating, powertrain, drivetrain, record/availability/class, saved/score filters, sort and page. Values are checked against the current catalog; a model must match the selected make and year. Search is bounded at 100 characters and the URL parser at 4,096. Invalid enum/numeric values revert to defaults. Custom valid budget amounts remain visible as an explicit select option. Result pages clamp to the available count, and changing filter or ranking criteria returns to page one. A restored URL keeps its page.

The address preserves the current local view. Copied search and comparison links omit the device-only saved filter; search links also omit selected comparison IDs. Searches, filters and energy assumptions in URLs are visible to recipients and hosting access logs. Shortlist and garage contents are not added to these links.

Text search matches reordered terms across the displayed identity, powertrain, drivetrain and broad body style. Completed terms match whole words; only the final in-progress term accepts prefixes. Quoted phrases require consecutive whole words. Diacritics and model hyphens/apostrophes are normalized. Numeric model boundaries keep CX-5 distinct from CX-50; completed trim names keep XL distinct from XLT. Search does not invent a retail trim or a rating join.

Plug-in scenarios validate only the operating modes used: zero electric share needs no electricity fields; full electric-mode share needs no fuel-only consumption. Published electric-mode fuel remains required whenever that mode is used, including a confirmed zero. Invalid inputs used by the calculation still leave the estimate unknown; unused comparison fields are disabled with explanatory text.

## Recorded service expenses and history review

A service record may include `costCents` (an integer from 0 through 100,000,000, CAD cents) and a nonempty `provider` of at most 100 characters. Absence means unknown; zero means a known zero amount. The form parses decimal CAD text into cents without binary multiplication/rounding, supports at most two decimal places and rejects exponent notation. An amount is scoped to that service record, including tax; owners should not duplicate a whole invoice across several records.

The reader accepts older version 1 records without adding default amounts and retains the optional expense fields through edits, storage, cross-tab events and JSON backup/restore. Invalid fields and unsupported extensions cause preservation/rejection rather than silent removal. Older clients can reject newer optional fields and should preserve their original data. Expense/provider comparisons are included in stale record edit and delete guards.

History filters, date ranges, order and page stay in memory and are excluded from public URLs. Search covers work, provider, notes, date and odometer; date bounds are inclusive. Sorting never mutates stored records. Ten matching rows render per page; totals and CSV export use every match across pages. Totals sum exact integer cents and report excluded unknown amounts. They are recorded service expenses, not inferred ownership costs.

CSV contains vehicle context, actual date/mileage/work, provider, CAD amount and notes. Unknown amounts export as blank and known zero exports as `0.00`. Cells are quoted, embedded quotes escaped, text is UTF-8 with a BOM and rows use CRLF. Owner-entered formula-like spreadsheet cells receive a literal-text prefix; the JSON backup preserves the original editable text. CSV is not a restore format.

## Energy estimates and field applicability

`apps/oss/src/energy.ts` is the shared calculation behind ranking, cost sorting,
card previews and comparison estimates. Per-100-km quantities/costs retain fuel
and electricity components. Plug-in fuel includes the fuel-only distance share
and any published fuel burned during electric operation. Unused modes require
no consumption or unit price; a verified zero electric-mode fuel value is
different from an unknown value. Missing active consumption or invalid used
prices produces explanations without a partial total. Known electric consumption
can use a zero charging rate; unknown consumption never becomes a free estimate.
Hydrogen estimates remain unsupported. Required fuel prices are $0.01–$5/L.

Annual distance is validated separately and affects annual totals only. Cost per
100 km and efficiency scoring remain available when only annual distance is
invalid. Currency and quantities are rounded for display; annual totals retain
the existing nearest-dollar presentation. These are energy estimates, excluding
charging session fees and other ownership expenses.

`specifications.ts` determines presentation applicability from the explicit
powertrain, only for empty facts. Inapplicable liquid-fuel or plug-in fields show
“Not applicable” instead of “Not verified”. Published values and the underlying
catalog, notes and provenance remain intact. Equivalent inapplicable fields can
be hidden as matches; mixed applicability and unknown applicable facts remain
visible. Applicability is not numeric zero and supplies no new source fact.

## Comparison scroll and focus state

Comparison scrolling is presentation state only; no record IDs, facts, ranking
inputs or stored state change. The focusable table region retains native scoped
row/column headings. A ResizeObserver measures its viewport and headings for
mobile column sizing and focus scroll padding. Observers disconnect when the
table closes or fewer than two vehicles remain. Equivalent selections retain
their original order. Removal focus follows the next remaining vehicle control,
or the empty-state return action when fewer than two remain.

## Fuel-specific price assumptions

Energy settings optionally include `premiumPrice`, `dieselPrice` and `e85Price`
in CAD per litre. Each permits $0.01–$5. Blank UI fields omit that override and
use `fuelPrice`; older links and default settings retain their shared assumption.
Valid overrides are included in both search and comparison URLs, including an
explicit override equal to the shared price. Invalid URL values are ignored.
An invalid nonempty UI override leaves estimates unavailable only where used.

Exact NRCan fuel labels select regular gasoline, premium gasoline, diesel or
Ethanol (E85) pricing. A verified Diesel powertrain can select diesel without a
rating link. Make, model, trim names and a generic flex-fuel designation do not
establish a premium/E85 price type. Unknown grades retain the shared price and
are labelled explicitly. A rating fuel label describes the fuel used by the
consumption record; it does not establish a manufacturer's required octane.

The shared calculation applies the selected unit price to all liquid fuel,
including fuel burned during plug-in electric operation. Price type, applied
unit price and shared/specific basis accompany every available fuel estimate.
Unused overrides do not block EVs or unused plug-in operating modes. Comparison
inputs share these requirements, disabling prices irrelevant to the selected
vehicles; the general fuel input is unused when all liquid-fuel vehicles use
nonempty matching overrides. These are editable scenario assumptions and do
not alter catalog facts, source receipts, record IDs or device data.

The comparison heading offset also follows the outer dialog's scroll position.
It is clamped to the table and leaves room for the final row. This offset is
presentation state only and is reused for focus scroll padding. Outer scroll
updates are batched in requestAnimationFrame; closing the dialog removes the
listener, disconnects observers and cancels a pending frame. Keyboard entry
centres a clipped table before revealing the focused column, while pointer
activation keeps its native behavior.
