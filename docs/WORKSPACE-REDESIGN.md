# Workspace redesign

The interface now reflects two jobs: compare published vehicle specifications, and maintain a vehicle you own. Comparison is the main page; the garage is a first-class navigation destination.

## Comparison page and theme

Search, year/make/model filters, the shortlist and side-by-side comparison are the main interface. Vehicles appear in rows with identity, price and specifications aligned for scanning. Model choices follow the selected make/year and reset when those change. Technical record, NRCan class and availability controls live under **More filters**. Mobile filters are collapsed until requested.

Both areas share simple text navigation and light/dark/system appearance. Pages use neutral backgrounds, ordinary controls, restrained link colour and separators. Promotional slogans, decorative badges, repeated bordered cards and shadows have been removed. The garage uses service-record sections and an inline summary. The preference persists on this device; system mode follows OS changes. Search, priorities, sources, data uncertainty, comparison links, keyboard navigation and garage records remain functional parts of the app. The redesign does not claim that current market coverage is complete.

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

This is the next review point for the revised interface and adding flow. Full Canadian sale coverage and complete maintenance coverage remain open.

## Reference layout draft

The simpler reference layout is a reviewable draft. Visual direction remains open while ownership, vehicle research and comparison concepts are considered.

The draft passes 40 focused browser cases across desktop Chromium, mobile Chromium, desktop Firefox and mobile WebKit. These cover light/dark accessibility, comparisons, keyboard focus, dependent filters, appearance persistence, vehicle entry, service reminders and fallback paths. Visual checks cover 320, 390, 1000 and 1920 px widths without document overflow. Strict types, formatting and the production build pass; release sources and both served data assets match the validated build.

## Original directory and finder verification

- All 313 unit tests pass across 33 files.
- All 264 browser cases pass across desktop Chromium, mobile Chromium, desktop Firefox and mobile WebKit. These include existing comparisons, sources, shortlist persistence, garage corrections, reminders, backups and storage recovery. A final 28-case workspace pass also verifies the built manual-fallback correction in all four configurations.
- New browser coverage checks dependent model filtering, appearance persistence, system preferences, historical Elantra selection, manual fallback, lookup failure and unavailable address updates. WCAG AA checks cover the dark comparison dialog and guided finder, with no document overflow at 320 px.
- Strict types, formatting, source boundaries and the production build pass. The release manifest covers 20 artifacts. Both packed data assets decode to the validated sources, and served bytes match the build; the main page, garage and health endpoint respond successfully.
- The captured owner directory reconstructs exactly with the offline sync command. Manual fallback preserves selected historical details without labelling them as a comparison-catalog import.

Preview locally at `http://localhost:8080` and `http://localhost:8080/garage` after starting the production server as described in the root README. Garage data and appearance preferences remain local to the browser/device.
