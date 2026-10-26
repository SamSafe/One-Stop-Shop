# Review milestone — 26 October 2026

This is the requested stopping point for feedback on the expanded app. It is not a claim that every Canadian offering or every maintenance schedule has been verified. The older v1.0.1 release report describes an earlier, much smaller release.

## What to try

Run `npm run build` and `npm start`, then open `http://localhost:8080`. The garage is at `http://localhost:8080/garage`.

1. Add a 2016 Hyundai Elantra manually; GL can be entered in the optional powertrain field. Enter your own odometer.
2. Read the Canadian manual guidance and open the maintenance/specifications chapters.
3. Set up the severe-use oil/filter reminder using your actual last change date and odometer.
4. Update the odometer, mark a service completed, and check that the next date/distance uses the actual completion.
5. Export the garage. Choose that backup to inspect the explicit restore confirmation. Removing a vehicle also requires confirmation.
6. Try the comparison catalog, shortlist, shareable comparison and the card’s “Add to your garage” link under specifications.

The garage loads independently of the comparison catalog. Owned data stays in this browser; export is needed to keep a separate copy or transfer devices. Reminders are displayed in the app on visits, with calendar rollover refreshed while open. No account, cloud sync or background notification service is implemented.

## Catalog checkpoint

6,082 records across 48 makes: 3,543 year-qualified retail configurations, 25 year-unverified manufacturer offers, and 2,514 standalone government rating variants. All 2,518 source NRCan IDs remain represented, including merged records. There are 2,633 known base prices and 1,328 official sources. Land Rover adds 42 visible Canadian configurations, including 13 whose model year remains unverified.

18 makes in the government baseline still lack a current manufacturer import. Canadian lineup reconciliation, all equipment combinations, older new stock and exact-year technical facts remain incomplete. The additional-make ledger also tracks manufacturers outside that baseline. Run `npm run catalog:coverage` for the current evidence and gaps.

## Maintenance checkpoint

The 2016 Elantra sedan has Canadian severe-use oil/filter reminders and selected manual specifications. Its GL designation is not mapped to a U.S. trim. The exact engine/transmission is not inferred. Toyota guidance covers 2025 general maintenance visits; supported Honda models show Maintenance Minder guidance without a made-up distance interval.

The two indexed Elantra chapters are retrieved on demand, stored by checksum and conditionally refreshed. Publisher changes require review. Complete task extraction, other manufacturer providers, one-time service milestones and more vehicle-specific schedules remain open. See [maintenance source review](MAINTENANCE-SOURCES.md).

## Feedback to prioritize next

Verify the Elantra’s displayed source guidance against your own manual, then assess entry, reminder setup, service logging and the browsing flow. Editing identity/history, distance forecasts, additional schedules and accounts can be prioritized from actual use after this checkpoint.

## Implementation commits

- `e04af0c`: visible Canadian Land Rover configurations with exact product prices and explicit year uncertainty.
- `5a1879a`: working garage, Canadian Elantra manual guidance, document caching, backups and browser regression coverage.

## Verification at this checkpoint

- Full unit run: 299 tests passed. After the final UTF-8 backup-size correction, all 9 focused garage tests passed, including the new Unicode byte-limit case.
- Final production browser run: 212 checks passed without retries across desktop/mobile Chromium, Firefox and mobile WebKit. This includes garage entry, the Canadian Elantra plan, service completion, backup/restore, storage denial, newer-format preservation, cross-tab changes, catalog handoff and automated accessibility checks.
- Catalog validation, strict TypeScript, package boundaries, formatting and production build passed.
- All 16 release artifacts and source fingerprint verify. The complete runtime catalog matches its validated source representation; the preview serves exactly those catalog bytes and passes health checks.
- Both indexed Hyundai chapters passed original checksum verification, live publisher retrieval and subsequent HTTP 304 conditional refresh. No complete manual library is downloaded or bundled.
- Desktop and mobile garage screenshots were reviewed, including a 320 px viewport without document overflow.

The local preview remains running for feedback. These checks verify this milestone's implementation, not complete Canadian market or maintenance coverage.
