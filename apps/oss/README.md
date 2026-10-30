# OSS

The active Canadian vehicle comparison app and independent ownership garage. See the root [project status](../../docs/PROJECT-STATUS.md) for current coverage and verification.

Shared interface tokens, controls, dialog behavior and wording follow the
[design system](../../docs/DESIGN-SYSTEM.md). Buying, shortlist and journal actions
stay visible in long dialogs. Source locators and scoring details expand on request.

Comparison supports search, year/make/model, body style, verified seating, price, powertrain and availability filters. Quick views open priced retail vehicles, electric vehicles or family SUVs. Active filters can be removed individually. Results are paged; saved and compared vehicles remain selected across pages. Search terms can be reordered and common model punctuation is normalized. Completed words match complete terms, the last word supports typing ahead, and quoted phrases provide precise matching. The address retains filters, ordering and page through reloads or a garage round trip. Copy search link shares that view while omitting the device-only shortlist filter.

Default fit scores use verified base MSRP and estimated energy cost per 100 km. Gas, hybrid, EV and plug-in hybrid estimates share editable fuel/electricity prices and plug-in electric-mode assumptions. Cargo and legroom can be enabled through custom priorities or the family-space preset. Missing active facts remain unscored, and score coverage is shown explicitly. Costs exclude maintenance, insurance, depreciation and charging-session fees.

Comparisons support 2–4 exact configurations, source links, reference-based differences, matching-spec hiding and URL sharing. Links preserve browsing context, priorities and energy assumptions. Searches and filters appear in the URL and can be visible to recipients and hosting access logs. Shortlists remain local, with cross-tab synchronization and recovery for unavailable or unreadable storage.

Manage shortlist shows all saved configurations independently of filters, ten per page. Remove individual choices, select comparison vehicles, or show the entire shortlist in the catalog. JSON export includes every saved page. Imports preview recognized, duplicate and unavailable choices, then merge with the latest device list without replacing existing choices or the active comparison. Unsupported files, oversized files and superseded reads cannot mutate the shortlist. Storage failures and unreadable saved originals retain the session-only workflow and export. Backup files contain configuration IDs; pricing, specs and source reviews come from the current catalog when reopened.

The garage at `/garage` supports historical vehicle lookup, manual entry, odometer updates, service records, selected reviewed manufacturer tasks, personal reminders, corrections, optional service costs/providers, searchable paged history, CSV export, backups and calendar-date export. Coverage limits are shown for each vehicle. Garage loads without the comparison catalog; no account or cloud sync is required.

Run and verify from the repository root. UI components are split between `VehicleCard`, `Comparison`, `CatalogFilters`, shared sourced-value rendering and the garage's vehicle cards/service forms. Ranking and comparison state live in `domain.ts`; validated browsing URLs and state transitions live in `browsing.ts` and `useBrowsingState.ts`; the shared catalog never imports app code.

Plug-in energy estimates require only modes used by the chosen electric-driving share. At 0%, electricity data is not needed; at 100%, fuel-only consumption is not needed. Fuel burned during electric operation remains required when that mode is used. Unused comparison inputs are disabled and explained.

Service expenses are optional, in CAD, and stored as integer cents. Blank amounts stay unknown; an entered zero is a known covered/free service. History supports inclusive date filters, provider/work/notes search, chronological or recorded-cost ordering and ten records per page. CSV exports all matching pages for review; JSON backups retain editable data. Stale expense edits and pending deletions are rejected when another tab changes the record.

Garage's maintenance overview brings due/overdue work, tasks due soon and missing-history reminders together across vehicles. Vehicle/status filters and six-row pagination bound the view. Review focuses the corresponding reminder; page changes focus and reveal new results in both the overview and service history. These views share the current local day and update with cross-tab service changes.

Personal reminder names, intervals and starting completion details can be edited without replacing the reminder or its linked service history. Manufacturer intervals retain their reviewed values. Stale reminder edits and pending removals are rejected, while concurrent service and odometer additions are preserved. Saving or cancelling an edit returns focus to the matching reminder.

Form state resets when switching between editing, adding and recording a completion, including valid imported records whose identifiers match. Old dates, notes and expenses cannot carry into a new completion through that switch.

Subaru's exact-trim specification tables enrich 41 Canadian configurations, including the newly listed BRZ Kagayaki Edition. Eighteen additional reviewed government joins supply combined consumption. Manufacturer up-to range remains visibly qualified when notes are hidden; missing electric consumption and contradictory source figures remain unknown. See [the evidence and refresh contract](../../docs/SUBARU-SPECIFICATIONS.md).

Cards show estimated CAD energy cost per 100 km before specifications are opened. Comparisons break that cost into fuel litres/cost and electricity kWh/cost, including fuel burned during plug-in electric operation. Missing consumption and invalid prices produce specific explanations without partial totals. Annual distance affects the annual estimate; per-distance costs and scores remain available when only annual distance is invalid. Calculation and input enablement share the same active-mode rules. Fuel prices must be $0.01–$5/L; electricity permits a verified free charging rate. Hydrogen cost estimates remain unsupported.

Empty energy fields that do not apply to a powertrain display “Not applicable”; applicable missing facts retain “Not verified” and their source explanations. Published values and catalog provenance remain intact. Hide matching specs can hide equivalent inapplicable fields, while mixed applicability and unknown applicable facts stay visible. `energy.ts` owns cost breakdowns and requirements; `specifications.ts` owns this presentation-only applicability check.

The specification table scrolls in both directions within a bounded region. Vehicle headings stay at the top and specification labels stay at the left. Mobile columns use the measured available width so a full vehicle column fits beside its labels. Scroll padding follows the actual heading height to keep focused source links and controls visible. The dialog's close control remains in view; removing a comparison vehicle moves focus to the next remaining vehicle control or Back to cars when fewer than two remain.

When the outer dialog scrolls past the table's top, vehicle headings follow the visible table beneath the close control. They remain clipped to the table and release as its bottom leaves view, keeping energy inputs unobstructed. Header positioning and focus scroll padding share the same measured offset. Scroll work is batched per animation frame; listeners and observers are removed when the comparison closes.

Fuel-specific prices are optional under the energy inputs. Blank premium, diesel and E85 fields use the shared fuel price. Exact rating fuel labels select their matching price; an explicitly verified Diesel powertrain can also use the diesel price. Other records retain the shared assumption without guessing a grade from make/model names. Cards and comparisons show the applied fuel type, unit price and shared/specific basis. Invalid used overrides leave estimates unknown; irrelevant prices do not block EVs or unused plug-in modes. Valid optional prices survive search/comparison links and reloads; older links keep their shared-price behavior.

## Test drives

`buying.ts` owns validated test-drive reviews and portable backups.
`useBuyingWorkspace.ts` handles independent device storage and stale edits.
Ratings remain separate from facts and numerical fit; the latest verdict can
optionally hide ruled-out configurations. Requirements live in the catalog
filters (`filterCars` in `domain.ts`). See [the behavior and privacy contract](../../docs/TEST-DRIVE-JOURNAL.md).
