# Full Canadian market expansion

Objective: cover every new passenger vehicle currently offered for sale in
Canada, including pickups and vans, every make/model/retail trim, all powertrains
and overlapping model years. Used listings and commercial/heavy-duty vehicles
are outside the user-confirmed scope. This objective is still in progress.

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

The working app now has 2,557 records: 43 retail configurations with verified
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

The app now has 2,885 records: 371 priced retail configurations and 2,514 government
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
