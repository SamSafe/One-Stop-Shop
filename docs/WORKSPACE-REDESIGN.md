# Comparison interface

Vehicle comparison remains the main product flow. The garage is a separate section at `/garage` and now automatically adds reviewed maintenance tasks. Comparison browsing and specification details do not lead into garage setup.

## Comparison page and theme

Search and year/make/model selection lead into framed vehicle cards with prices and essential specifications. Other filters, shortlist filtering and ranking weights share one panel, closed initially on every screen size. Model choices follow the selected make/year and reset when those change. Coverage receipts and catalog counts are available through a separate disclosure; incomplete coverage remains explicit.

The design returns to the original ivory background, forest-green text/actions, rust accents, wordmark, larger typography and rounded vehicle/garage cards. The simpler search flow and comparison tools remain. Light/dark/system appearance persists on this device and follows OS changes in system mode. Garage navigation is secondary on the comparison page. Existing garage records and their independent adding flow remain compatible.

## Choosing and comparing

The comparison tray identifies each selected configuration by make, model, year and trim/variant, with individual removal controls. Government variants include their engine/transmission and NRCan record identity. Selections remain available while browsing other results. Two to four configurations open the comparison table; shared links retain selected IDs, ranking weights and the chosen reference vehicle.

**Key differences** explains base-price, seating, cargo and rear-legroom changes relative to that reference. Missing facts remain unknown. Cargo across differing or unverified seating layouts and spatial figures with different qualification notes are flagged for context rather than presented as directly comparable gains. The summary distinguishes identical published figures from established equipment equivalence. Estimated annual energy-cost changes use the same current inputs and calculation as the full table; valid inputs are now retained in comparison links and restored on reload.

The table shows published values and source links first. **Show source notes** reveals full publication and measurement notes for known values. Explanations for unknown values, record types, model-year caveats and availability status remain visible. Expanded vehicle specifications retain the full notes and ranking explanation.

**Hide matching specs** hides a metric only when at least two vehicles have the same known numeric value and identical qualification notes across the entire selection. Different measurement notes and unknown values stay visible. Individual publication IDs can differ without changing the measurement. Matching known fuel/drivetrain rows can also be hidden. These are view controls; all data can be restored immediately and neither changes the catalog or saved garage data.

## Adding an owned vehicle

1. Choose model year, make and model from the Canadian owner directory.
2. Optionally choose a published engine/transmission or an existing verified catalog configuration.
3. Enter the current odometer. Canadian trim and nickname can be left unknown or filled in by the owner.
4. Review available manufacturer guidance, then add actual service history or completion baselines for reminders.

Reviewed maintenance tasks now appear automatically for supported vehicles, including six tasks for the 2016 Canadian Elantra sedan. Due thresholds follow actual history; empty plans display **Needs history**. Removals persist until explicitly restored, and vehicle corrections protect real service records. See [automatic maintenance](AUTOMATIC-MAINTENANCE.md) for exact coverage and migration behaviour.

The owner directory covers published model-year entries from 1995–2027 across 66 makes. It includes 2016 Elantra 1.8/2.0 L automatic/manual choices. Fuel-rating identities do not establish every Canadian retail trim, and the app does not map a GL to a U.S. SE. A known model is also distinct from a complete reviewed maintenance schedule.

Only personal details such as mileage and service history must come from the owner. They cannot be inferred from a model year or generic specification. Selecting an exact catalog configuration retains its specifications reference; selecting a historical powertrain does not fabricate one.

If lookup fails, the year/model is missing, or the owner prefers direct entry, **Vehicle or year not listed? Enter details manually** remains available. A failed browser address update does not lose a saved vehicle. Existing version 1 garage backups and stored records remain compatible.

## Data and future enrichment

The separate [owner directory](OWNER-VEHICLE-DIRECTORY.md) is based on official Canadian sources and existing retail records. Its packed download is about 192 kB gzip and is loaded only when opening the finder. The full comparison catalog is not needed for this flow.

VIN lookup is future work. Any decoder must be checked against Canadian market identity and equipment; U.S. trim names must not silently become Canadian trim facts. Broader OEM trim lists, exact engine/manual matching and more reviewed schedules are also unfinished. Manufacturer documents remain cached by revision/profile rather than downloaded again for each owned vehicle.

Full Canadian sale coverage and complete maintenance coverage remain open. The current review focuses on the comparison flow.

## Comparison interface verification

- All 41 domain tests pass, including four new checks for matching known values, differing measurement notes, unknown values and agreement across all selected vehicles.
- Browser coverage verifies 272 cases across desktop Chromium, mobile Chromium, desktop Firefox and mobile WebKit: 268 passed the full run, and four passed their complete scenario rerun after updating an assertion for the singular “Compare 1 car” label. The new controls also passed a separate nine-case Chromium check.
- Strict types, formatting, source boundaries and the production build pass. Release integrity covers 20 artifacts; source, decoded data and served-byte parity checks pass for the unchanged comparison catalog and owner directory. The main page, garage and health endpoint respond successfully.
- Visual checks cover comparison and browsing at 320, 390, 820, 1000, 1440 and 1920 px without document overflow, with light/dark accessibility covered by the browser suite.

## Earlier reference layout

The earlier reference layout established neutral typography and specification rows. The current comparison interface further reduces visible controls and separates garage work.

The draft passes 40 focused browser cases across desktop Chromium, mobile Chromium, desktop Firefox and mobile WebKit. These cover light/dark accessibility, comparisons, keyboard focus, dependent filters, appearance persistence, vehicle entry, service reminders and fallback paths. Visual checks cover 320, 390, 1000 and 1920 px widths without document overflow. Strict types, formatting and the production build pass; release sources and both served data assets match the validated build.

## Original directory and finder verification

- All 313 unit tests pass across 33 files.
- All 264 browser cases pass across desktop Chromium, mobile Chromium, desktop Firefox and mobile WebKit. These include existing comparisons, sources, shortlist persistence, garage corrections, reminders, backups and storage recovery. A final 28-case workspace pass also verifies the built manual-fallback correction in all four configurations.
- New browser coverage checks dependent model filtering, appearance persistence, system preferences, historical Elantra selection, manual fallback, lookup failure and unavailable address updates. WCAG AA checks cover the dark comparison dialog and guided finder, with no document overflow at 320 px.
- Strict types, formatting, source boundaries and the production build pass. The release manifest covers 20 artifacts. Both packed data assets decode to the validated sources, and served bytes match the build; the main page, garage and health endpoint respond successfully.
- The captured owner directory reconstructs exactly with the offline sync command. Manual fallback preserves selected historical details without labelling them as a comparison-catalog import.

Preview locally at `http://localhost:8080` and `http://localhost:8080/garage` after starting the production server as described in the root README. Garage data and appearance preferences remain local to the browser/device.

## Comparison and ownership quality pass — 27 October

Price-and-energy default priorities support gas, hybrid, EV and plug-in hybrid shopping, with shared editable energy inputs. Family-space and price-only presets remain explicit; missing active metrics stay unscored. Score coverage, priced-retail/EV/family-SUV quick views, removable filter chips, broad body-style filtering and verified minimum seating improve discovery across the existing catalog. Twenty-four audited Honda rating joins improve class/emissions coverage while preserving existing IDs.

Comparison cards, modal, filter panel and source-value presentation are separate components. Garage vehicle cards and service forms are separate from page orchestration. Each vehicle makes reviewed maintenance coverage explicit, and known next service dates can be exported to a calendar snapshot. See [current project status](PROJECT-STATUS.md) for validation and remaining scope.

## Browsing continuity

Search, filters, sorting and result pages now remain in validated URLs and survive reloads or a garage round trip. Copy search link shares the public view with clipboard fallback, omitting the device-only saved filter and selected comparison IDs. Comparison links also retain browsing context. Search supports reordered words, normalized model punctuation, final-word typing ahead and exact quoted phrases. Completed trims and numeric model boundaries remain distinct.

Plug-in calculations require only the modes used by the chosen electric-driving share. Irrelevant comparison fields are disabled with explanations. Labels remain stable while error and help text changes. The current verification receipt is in PROJECT-STATUS.md.

## Service history and recorded expenses

Garage records support optional CAD amounts and service providers without inventing unknown costs. Totals count known zero amounts and state how many unknown amounts are excluded. Search, inclusive dates and date/cost order cover all service records; ten records render per page. CSV exports every matching page, with editable data still transferred through JSON backup/restore.

Expense fields participate in stale-editor checks. Pending deletions retain the original record snapshot and cannot silently delete a record corrected in another tab. Cost changes do not alter maintenance thresholds; removing actual linked history recalculates due status from remaining work. Existing backup records stay readable, while older clients can reject new optional fields and preserve their originals. See PROJECT-STATUS.md for the executed validation.

## Comparison context while scrolling

The comparison table now has its own bounded vertical and horizontal scroll
region. Vehicle headings remain at the top; specification labels remain at the
left, with an opaque corner cell. Mobile columns use the actual available width
so a complete vehicle column fits beside its labels, including browser scrollbar
space. The table retains native column/row header semantics and its source links.
A short hint explains scrolling and the focusable region supports arrow keys.

The dialog close control remains visible as the outer content scrolls. The
measured header heights supply scroll padding so keyboard focus is not hidden
under the pinned headings. Keyboard source navigation reveals the entire focused
column when it fits the viewport. Pointer source activation retains normal link
behavior. Removing a vehicle focuses the next remaining removal control, or Back
to cars when only one vehicle remains. Shared comparison IDs retain their order.

## Outer-dialog comparison context

Vehicle headings now follow the visible part of the table when its outer dialog
scrolls toward the energy controls. The heading offset accounts for the fixed
close bar and releases near the table's end, preserving space for the final
totals. Headings remain clipped to the table and cannot cover the inputs below.
Keyboard entry from those controls brings a partly clipped table into view before
revealing the focused column. Pointer source activation retains normal behavior.

Position updates use one animation frame per outer scroll update and no React
state changes. The same measured offset supplies focus scroll padding. Listeners,
resize observers and pending frame callbacks are cleaned up together on close
or when fewer than two comparison vehicles remain.
