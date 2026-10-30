# Project status — 30 October 2026

This is the current implementation summary. Earlier release and review reports describe their dated checkpoints.

## One set of filters — 30 October

The buying brief has been removed. It repeated the catalog filters (budget,
seats, body style, drivetrain) and ran a second fit score beside the first. Its
unique parts moved into **Filters & priorities**: minimum horsepower and rear
legroom limits, a horsepower priority with a Performance preset, an option to
keep vehicles whose figures are unverified (each card names the limit to check),
and hiding vehicles ruled out after a test drive. Limits and weights are in the
URL. The test-drive journal is unchanged and opens from the results bar. Saved
data and backups from earlier versions still load; a stored brief is dropped.
See [limits, priorities and the test-drive journal](TEST-DRIVE-JOURNAL.md).

## Every importer refreshes again — 30 October

The nine importers the first live health run flagged now refresh:

- **Hyundai.** The lineup endpoint takes `lang=en` instead of `language=en`.
  Every model specification table responds again.
- **Mercedes-Benz.** A menu card for the AMG GLC 53 lost its identity and is kept
  as a placeholder for review. Three GLC entries still say 2026 while their model
  pages state 2027; the page year is used and each card notes the difference.
- **BMW.** The earlier schema failure did not recur; prices are unchanged.
- **MINI.** Stock search sorts have ties, so paging repeated some vehicles and
  skipped others. Stock is now read in further sort orders until every vehicle
  is seen. Sixteen priced 2027 John Cooper Works and Countryman Untamed
  configurations were added.
- **Aston Martin, Lucid, McLaren, Porsche, Rivian.** Site deploys renamed or
  rebuilt the pinned configurator scripts. Each was compared with its reviewed
  version, and the request contract the importer relies on was unchanged. Aston
  Martin added the Valhalla Spider, recorded as a hybrid from its own page.
  Rivian's guard now retires stock that left searches that succeeded again,
  instead of blocking every refresh after a sale.

[Catalog sources](CATALOG-SOURCES.md#when-a-pinned-client-changes) describes how
to review a changed client. The Garage owner directory was rebuilt.

## Source health, GM prices and maintenance — 30 October

`npm run catalog:health` reports the age of every source snapshot. Its `--replay`
mode rebuilds each snapshot from local captures, and `--live` runs every importer
against its live source in a temporary sandbox. A weekly workflow runs the live
check. See [catalog sources and refresh](CATALOG-SOURCES.md).

The first live run, one week after the latest refreshes, found that 9 of 25
manufacturer importers can no longer refresh. Aston Martin, Lucid, McLaren,
Porsche and Rivian changed the public clients their importers verify. BMW and
Mercedes-Benz responses fail schema validation, Hyundai's API returns HTTP 400
and MINI's stock counts no longer reconcile. Tracked snapshots were unaffected,
and all nine were fixed the same day (above). Replay also found that
the Garage owner directory was missing the 2027 BRZ 輝 Kagayaki Edition added by
the 27 October Subaru refresh. It has been rebuilt.

GM's rate-limited build calculations were retried slowly against the reviewed
22 October trim matrices. Verified GM base MSRP rose from 376 to 1,194 of 1,230
configurations, and catalog-wide from 2,634 to 3,452 of 3,544 retail
configurations. Most of the remaining unverified retail prices are deliberate:
Genesis publishes only all-inclusive prices, Infiniti's selector includes
freight, McLaren hides prices and a few records have source conflicts.

The production server now sends Brotli or gzip files written at build time.
With the GM prices the catalog is 6.2 MB raw; it transfers as 738 KB with Brotli
instead of 1,027 KB with the previous streamed gzip, and the owner directory as
119 KB instead of 185 KB. The comparison page's top-level component was split into
focused components and a results hook, and the stylesheet into area files
imported in the original order (the built CSS is byte-identical). The README was
rewritten; per-manufacturer refresh notes moved to the catalog sources page.

## Fit explanations and reviewed specifications — 29 October

Cards and comparison score cells now expose **Why this fits**: requirement outcomes,
actual values, active importance weights, targets, earned points and maximum
shares, plus excluded priorities and all missing inputs. Explanations use the
existing ranking result and respond to energy settings and brief changes.
Incomplete fit totals withhold earned points. Test-drive ratings remain separate.

A targeted official-source review fills 682 missing numeric facts and six unknown
drivetrains across 100 exact configurations. Six conflicting Sienna front-headroom
values are withheld with both sources retained. The catalog still has 6,083
records and 3,544 retail configurations, with 1,360 official sources. Existing
prices, identities, source records, availability dates and untargeted facts are
preserved. The [review report](FIT-AND-SPECIFICATION-REVIEW.md) documents source
scope, capture receipts, validation and the unresolved ambiguities where this
pass stops. The interface review below describes the earlier checkpoint.

The final check passes 415 unit cases across 43 files. All 556 distinct browser
cases pass across desktop/mobile Chromium, desktop Firefox and mobile WebKit;
the 32 affected fit checks were rerun after the final fit-panel presentation cleanup.
Expanded light/dark accessibility and responsive geometry checks pass. All 21
release artifacts verify against source fingerprint
`6a0aae48a270737d25abef0dfbd21f642d70778f9118404b534112733cbf7861`.
The local app and Garage serve the current build on port 8080. The
[review report](FIT-AND-SPECIFICATION-REVIEW.md) retains the exact validation scope.

## Interface review — 29 October

The comparison app and Garage now share control sizing, field typography, corners,
page alignment and semantic colours in light and dark appearances. Navigation
keeps the same order and alignment as the header wraps. Long buying, journal and shortlist
dialogs retain their actions while scrolling and reveal focused fields above
their footers. Garage forms reveal active fields, return focus on cancellation
and reveal newly saved vehicles. Backup previews reject superseded file reads.

Scoring and source explanations expand on request. Labels are consistent across
energy settings, and empty results provide actions appropriate to an active buying
brief. App and generated-catalog explanations use direct wording while preserving
price, measurement, missing-data and maintenance qualifications. The review covers
all application components and the generated catalog's explanatory prose.

All 6,083 records retain their numeric facts, identities, source references and
review dates; all 1,337 source records retain their protected provenance fields.
The final build verifies all 21 artifacts against source fingerprint
`9506684919848e6d3f154c8791e71aac7fdd05b65bccf6923a8a8cc43e593207`.
The layout review covers 120 primary screen/width/theme combinations and 40
additional recovery and confirmation views without horizontal overflow; the
targeted accessibility scans pass. The full unit run passes 398 cases across 41
files. All 524 browser cases pass on the final build: 393 across desktop/mobile
Chromium and desktop Firefox, followed by all 131 mobile WebKit cases. No automatic
retries or increased timeouts were needed. The [interface review](INTERFACE-REVIEW.md)
records the retained evidence, run details and final confirmation checks. See the
[design conventions](DESIGN-SYSTEM.md) for the shared UI rules.

## Buying brief and test drives — 28 October

The optional buying brief now separates requirements from preferences. It supports
budget, seats, preferred/required body styles and drivetrain, horsepower and rear
legroom targets, cargo goals and seven adjustable preference weights. It can be
edited, paused and resumed. Requirements filter eligibility before personal fit
is calculated; unverified requirements are counted and can be included explicitly
for checking, while remaining unscored. Presets do not infer a buyer's age or
family structure. Published horsepower is not a driving-enjoyment rating.

The new test-drive journal stores multiple dated visits per configuration, with
personal enjoyment, comfort, rear-space and visibility ratings, verdicts and notes.
Reviews can be searched, edited, removed and compared with catalog facts. The
latest verdict can optionally hide ruled-out vehicles. Buying backups export and
merge the entire brief and history while preserving existing versions. Device
storage failures retain an exportable session; stale edits and removals reject
newer changes. Buying data is separate from the shortlist and Garage and is
excluded from shared URLs. See [the behavior and privacy contract](TEST-DRIVE-JOURNAL.md).

Feature validation:

- The full `npm run check` passed 397 unit tests, package boundaries, catalog
  validation, TypeScript and production build. A subsequent backup-size regression
  brought the total to 398 distinct unit cases; all 11 buying/journal cases passed
  after that correction, followed by another successful production build and type
  check. Near-limit exported backups round-trip within the same byte limit used
  for imports.
- All 492 distinct browser cases passed: 369 host cases across desktop Chromium,
  mobile Chromium and desktop Firefox (8.6 minutes), and 123 mobile WebKit cases in
  the isolated Ubuntu container (5.8 minutes). After the final backup correction
  and expanded personal comparison details, all 27 affected host buying cases
  passed again. The WebKit run used that final build. No retries or timeout
  increases were needed. An initial WebKit attempt used an empty browser cache;
  the completed run used the installed `/tmp/oss-browsers` cache.
- Formatting and Git whitespace checks pass. All 21 built artifacts verify against
  source fingerprint `a386d3c811afdc9c07edb465640541a58f79ffd2e231f3cb8db21d1b7ad5bc06`.
  Catalog and owner-directory assets remain unchanged.
- Automated light/dark accessibility checks pass for the new flows. Desktop and
  mobile brief/questionnaire and journal screens were inspected; the final views
  have no page errors or document/dialog horizontal overflow. The disposable test
  container was returned to its stopped state. The local app and Garage return
  HTTP 200 at port 8080.

## Autonomous-pass handoff — 27 October

The autonomous quality pass is complete at the comparison-context cleanup, with
final verification recorded below. Subsequent changes will follow individual
feature requests. The core discovery, comparison, shortlist and local Garage workflows
are implemented. Further broad additions now depend more on product priorities
and coverage choices than routine fixes.

Full Canadian market coverage and broader exact-vehicle maintenance plans remain
open, as detailed below. This handoff does not claim those larger backlogs are
complete. The working source and prepared local build are the reviewable result.

## Working product

The Canadian comparison catalog has 6,083 records across 48 makes: 3,544 year-qualified retail configurations, 25 year-unverified manufacturer offers and 2,514 standalone government variants. All 2,518 NRCan IDs remain represented. Base MSRP is known for 2,634 records. Forty-seven retail configurations carry exact reviewed rating links, including 24 additional Honda and 18 additional Subaru joins. Existing record IDs and known facts retain their provenance; review dates advance only for refreshed sources.

Subaru’s nine specification pages now enrich all 41 current factory configurations with exact-column dimensions, cargo, room, powertrain and published energy facts. The refreshed lineup adds the 2027 BRZ Kagayaki Edition at $39,995 base MSRP. Up-to electric range stays visibly qualified even when source notes are hidden. WRX GT unit conflicts, Outback Touring cylinder evidence and missing EV consumption remain explicit gaps. See [the source review](SUBARU-SPECIFICATIONS.md).

Default ranking uses verified base MSRP and estimated energy cost at editable fuel/electricity prices and plug-in electric-mode share. Cargo and rear legroom start disabled and can be enabled through custom weights or the family-space preset. Scores remain absent whenever an active input is missing; the results display scoring coverage. Energy prices and annual driving assumptions are included in comparison URLs. Efficiency scores depend on cost per 100 km, not annual distance. Plug-in estimates require only the operating modes selected by the electric-driving share. Unused comparison fields are disabled and described, and error/help text does not change their accessible labels.

Energy inputs now offer optional premium gasoline, diesel and E85 prices. Blank overrides use the shared fuel price. Exact rating labels or a verified Diesel powertrain select the matching price; unverified grades retain an explicitly labelled shared assumption. Cards and comparisons show the fuel type, applied unit price and shared/specific basis. Overrides affect costs, ranking and sorting and survive valid search/comparison URLs. Unused prices do not block EVs or unused plug-in modes. A rating fuel label does not establish a manufacturer's octane requirement.

Cards now preview estimated CAD energy cost per 100 km. Comparisons show separate fuel litres/cost and electricity kWh/cost, including fuel burned during plug-in electric operation. Missing active consumption and invalid used prices give specific explanations without partial totals. Per-distance costs and efficiency scores remain available when only annual distance is invalid. Calculations and input enablement share active-mode rules. Hydrogen cost estimates remain unsupported.

Empty fields that do not apply to a powertrain display “Not applicable”; applicable unknowns retain “Not verified” and their source explanations. Equivalent inapplicable fields can be hidden as matching specifications, while mixed applicability and missing applicable facts stay visible. These presentation rules preserve all catalog values and provenance.

Discovery includes priced-retail, EV and family-SUV quick views; body-style, verified seating and price filters; removable filter chips; score-availability filtering; and energy-cost sorting across powertrains. Precise NRCan classes remain distinct from broad body-style browsing. Search, filters, sort and result page now survive reloads and garage round trips through validated URLs. Copy search link shares that view while omitting the device shortlist filter and active comparison. Search accepts reordered words, normalized model punctuation and quoted phrases; completed terms distinguish XL from XLT and numeric model boundaries distinguish CX-5 from CX-50.

Manage shortlist shows every saved configuration independently of active filters, ten per page, with individual removal and direct comparison selection. JSON export covers the full saved list. Imports preview recognized configurations, duplicates and unavailable choices, then add recognized IDs to the latest cross-tab list while retaining existing choices and active comparisons. Invalid/oversized files and superseded asynchronous reads cannot apply changes. Unreadable device originals stay preserved, and session choices remain exportable if storage fails. Files contain IDs rather than copied prices/specifications; the current catalog supplies facts when reopened. The entire current catalog round-trips as a 201,192-byte backup.

The independent garage includes historical vehicle lookup, manual fallback, actual service history, corrections, odometer updates, automatic selected manufacturer tasks, personal reminders, backups and calendar-date export. Service records now include optional CAD amounts and providers. Search, inclusive dates and chronological/cost ordering operate across the complete history, with ten visible records per page. Totals state how many amounts are known; blank amounts remain unknown and explicit zeros remain known. CSV export covers every matching page; editable data still uses JSON backup/restore. Expense fields and pending deletions participate in stale-record checks. Data remains in the browser. Calendar exports contain the next known dates only; tasks without date history and mileage-only tasks are omitted. They are snapshots, with notifications controlled by the calendar app. Existing version 1 backups remain readable; newer optional expense fields are preserved in the updated app. Older clients may refuse these extensions and should preserve the original saved data.

The garage maintenance overview prioritizes due/overdue work across vehicles, followed by tasks due soon and reminders needing actual service history. Vehicle and status filters narrow the view, with six reminders per page. Review moves keyboard focus to the exact reminder without changing the address. Overview and history pagination focus and reveal the next results. The overview and vehicle cards share the current local day and refresh after midnight or service entered in another tab.

Personal reminder names, intervals and starting completion details can be corrected in place. IDs, linked receipts and calendar identities remain intact; clearing starting history does not erase actual work. Stale edits and pending removals reject reminders changed or removed in another tab while preserving newer service and odometer updates. Reviewed manufacturer intervals keep their source-verified values. Add, edit and completion forms reset correctly even when imported reminder/record IDs overlap, preventing historical dates, notes and expenses from carrying into new work.

Comparison tables now keep vehicle headings and specification labels visible during vertical and horizontal scrolling. Mobile columns fit the measured viewport beside the labels; the close control remains visible. Headings also follow the visible table as the outer dialog scrolls, releasing near its end while preserving final totals and unobstructed energy controls. Keyboard navigation from those controls brings a clipped table back into view. Keyboard source navigation reveals a complete column and keeps the focused link unobstructed. Removing a vehicle focuses the next remaining vehicle control, or Back to cars when only one remains. Scrolling and focus do not change selected IDs or source facts.

The UI is split into comparison cards, comparison dialog, shortlist manager, filter panel, shared fact presentation, garage vehicle cards, service forms, history review and maintenance overview components. No backend, account service or deployment migration is needed for these changes.

## Measured coverage at this increment

| Measure                                                       | Before | Current |
| ------------------------------------------------------------- | -----: | ------: |
| Records scorable with default priorities                      |    252 |     643 |
| Electric retail configurations scorable by default            |      0 |      36 |
| Retail configurations with exact reviewed rating links        |      5 |      47 |
| Priced retail SUVs reachable with the broad body-style filter |      — |   1,236 |

The default scoring criteria changed from four mandatory metrics to price and energy cost; spatial criteria remain available explicitly. These counts measure usable coverage under those defaults, not newly verified complete specifications for every record. The family-SUV quick view additionally requires at least five verified seats and currently exposes 791 configurations.

## Coverage limits

Manufacturer imports remain absent for 18 makes in the rating baseline. Full Canadian retail combinations, exact technical specifications and current sale availability remain incomplete. A published rating is not a current-stock claim. Source snapshots are dated research, not live prices.

Reviewed fixed maintenance coverage remains six selected tasks for the Canadian 2016 Elantra sedan and a general Toyota 2025 visit cadence. Selected Honda guidance is dashboard-driven. No complete universal maintenance plan or background notification service is claimed. Coverage is shown for each owned vehicle.

## Verification of the 27 October checkpoint

Current increment:

- All 387 unit tests pass across 40 files, including scoring, validated browsing URLs, quoted/reordered search, active-mode plug-in estimates, shared assumptions, exact rating joins, actual maintenance history, exact-cent expenses, CSV safety, cross-vehicle prioritization and reminder edit/removal guards. Shortlist tests cover portable IDs, duplicate/unavailable classification, unsupported input and UTF-8/entry limits. Fuel-price tests cover verified type selection, unverified grades, invalid used/unused overrides, scoring and optional URL fields. Energy tests cover mixed-mode components, active requirements, invalid prices/distance, known free charging, unknown consumption, hydrogen and field applicability. Subaru tests cover exact trim columns, optional equipment, source conflicts, stale audit evidence and range qualifiers. All 6,083 current IDs also round-trip through the backup parser in a direct catalog check; the longest current ID is 56 characters.
- All 456 browser cases pass: 114 each for desktop Chromium, mobile Chromium, desktop Firefox and mobile WebKit. Coverage includes comparison/browsing continuity, market records, source access, Garage corrections and backups, unknown history, stale actions, concurrent service/mileage, form resets and WebKit date clearing. Shortlist checks cover all-page exports, direct comparison, focus return, light/dark accessibility, import preview/cancellation, duplicates/unavailable choices, concurrent merges, preserved active comparisons, unreadable originals, write failures and superseded file reads. The 342 Chromium/Firefox cases ran on the host; WebKit's 114 cases ran in the existing disposable Ubuntu test container because the host lacks its browser libraries. The container was stopped after verification. Fuel-price checks cover regular/premium/diesel/E85 assumptions, displayed price basis, clearing overrides, URL/reload restoration, copied searches, live result ordering, unverified grades, invalid used/unused prices and plug-in electric-mode fuel. Context checks also cover outer-dialog clipping, readable final totals, unobstructed energy inputs and keyboard return from those inputs. They cover pinned headings/labels at 320, 390, 820 and 1440 px, native arrow-key scrolling, touch gestures, complete keyboard column visibility, unobstructed focus, pointer source activation and removal focus. Energy checks cover separate fuel/electricity quantities and costs, electric-mode fuel, invalid and zero annual distance, specific missing-data explanations, live card previews, mixed applicability, source retention and light/dark accessibility. Subaru checks cover the added BRZ price and manual/automatic ratings, preserved standalone links, visible up-to range with notes hidden, light/dark accessibility and explicit source conflicts.
- The final regression run passed without automatic retries or increased timeouts: 342 host cases with two workers (8.3 minutes), followed by 114 isolated WebKit cases with one worker (5.5 minutes). Browser jobs ran after unit/build work and without competing catalog probes. Earlier load-investigation results and the sequential workflow are recorded in OPERATIONS.md.
- Catalog validation, strict TypeScript, package boundaries, formatting and production build pass. Git diff whitespace checks pass.
- All 20 built artifacts and the current source fingerprint verify. Source fingerprint: `6b86aab892d696f429e2c360876e08c52139bcf5891be6bcb1b9728bfd564a8c`. The catalog asset remains `catalog-DHWTyixT.json` (4,978,033 bytes); both catalog and owner-directory data assets are unchanged by the outer comparison context increment.
- Outer-dialog heading transitions, final totals, narrow-screen labels and keyboard return from the energy controls were inspected on desktop and mobile in light/dark appearances. The final views have no page errors or horizontal document overflow at 320, 390, 820 or 1440 px. The current browser suite also covers catalog cards, pinned comparisons, source access, shortlist/import views, Garage flows, keyboard focus and accessibility.

Run `npm run check`, `npm run format:check` and `npm run test:e2e` to reproduce the local gates. Browser installations need the libraries described in OPERATIONS.md. These checks establish behavior and data consistency, not complete market or maintenance coverage.

## Future validation

Future work will be chosen through individual feature requests. Useful validation includes observing a few Canadian buyers forming and explaining a shortlist, including an EV/gas comparison and a family-space scenario. Observe an owner adding actual service history and using the next due date. Use missing facts and failed tasks from those sessions to prioritize additional source review and workflows.
