# Comparison interface

Vehicle comparison is the current product and interface priority. The garage remains a separate section at `/garage`; further ownership features are deferred. Comparison browsing and specification details do not lead into garage setup.

## Comparison page and theme

Search and year/make/model selection lead into vehicle rows with aligned prices and essential specifications. Other filters, shortlist filtering and ranking weights share one panel, closed initially on every screen size. Model choices follow the selected make/year and reset when those change. Coverage receipts and catalog counts are available through a separate disclosure; incomplete coverage remains explicit.

Pages use neutral backgrounds, ordinary controls, restrained link colour and separators. Light/dark/system appearance persists on this device and follows OS changes in system mode. Garage navigation is secondary on the comparison page. Existing garage records and their independent adding flow remain compatible.

## Choosing and comparing

The comparison tray identifies each selected configuration by make, model, year and trim/variant, with individual removal controls. Selections remain available while browsing other results. Two to four configurations open the comparison table; shared links retain the selected IDs and ranking weights.

The table shows published values and source links first. **Show source notes** reveals full publication and measurement notes for known values. Explanations for unknown values, record types, model-year caveats and availability status remain visible. Expanded vehicle specifications retain the full notes and ranking explanation.

**Hide matching specs** hides a metric only when at least two vehicles have the same known numeric value and identical qualification notes across the entire selection. Different measurement notes and unknown values stay visible. Individual publication IDs can differ without changing the measurement. Matching known fuel/drivetrain rows can also be hidden. These are view controls; all data can be restored immediately and neither changes the catalog or saved garage data.

## Adding an owned vehicle

1. Choose model year, make and model from the Canadian owner directory.
2. Optionally choose a published engine/transmission or an existing verified catalog configuration.
3. Enter the current odometer. Canadian trim and nickname can be left unknown or filled in by the owner.
4. Review available manufacturer guidance, then add actual service history or completion baselines for reminders.

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
