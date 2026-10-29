# Garage

The first garage release is implemented as an independent page at `/garage` within the existing OSS deployment. Its UI and local ownership model live in `apps/oss/src/garage`; shared Canadian manufacturer guidance and document metadata live in `packages/car-catalog/src/maintenance.ts`.

Adding an already-owned vehicle is the primary flow and works without downloading the comparison catalog. Guided selection covers published Canadian model-year entries from 1995–2027; any unlisted vehicle can still be entered manually. The selected engine/transmission or a verified catalog configuration fills known details, while trim can be left unknown. Comparison cards offer a convenience link to preselect a catalog configuration; that catalog is loaded only on demand.

Implemented: vehicle entry and detail corrections, automatic reviewed manufacturer tasks, explicit missing-history states, odometer updates, editable service records, personal recurring reminders, due/overdue status, backup export, explicit restore confirmation and cross-tab synchronization. Owned data stays in this browser. Unknown saved formats are preserved; storage failures offer a session-only workflow and export.

The Canadian 2016 Elantra sedan receives six reviewed tasks automatically; Toyota 2025 has a general service-visit reminder. Due thresholds use actual recorded work, and task removals persist until restored. Unreviewed models and dashboard-driven Honda guidance do not acquire invented fixed schedules. See [automatic maintenance](../../docs/AUTOMATIC-MAINTENANCE.md) for coverage, source pages and version 1 compatibility.

Initial supported guidance: Canadian 2016 Elantra sedan severe-use oil/filter reminder and manual specifications; Toyota 2025 general service visits; selected Honda Maintenance Minder A/0 models. See [source review](../../docs/MAINTENANCE-SOURCES.md).

Reminder intervals need explicit completion baselines. Actual completed service resets the next due date/distance; historical entries cannot move a newer baseline backwards. Removing a reminder retains its service history. Removing a vehicle requires confirmation. No automatic reminder is inferred for an unsupported schedule.

Vehicle details and service records can be corrected in place. Stale edits are rejected if another tab changed the same details or record. A correction that invalidates a manufacturer reminder requires an explicit choice to retain its interval as personal; history stays attached. Changing the compared configuration removes its former catalog link.

Future: more Canadian manual providers, complete model-specific task lists, one-time milestones, driving-distance forecasts, accounts and notification channels. A separately deployable garage app remains an architectural option; the initial `/garage` page shares the deployment while keeping comparison data optional.

Known next service dates can be exported as an `.ics` calendar snapshot, with stable event IDs and mileage context. Unknown dates and mileage-only reminders are omitted. Re-export after logging service; notification behavior belongs to the calendar app. Per-vehicle coverage explicitly separates selected reviewed tasks from a complete maintenance schedule.

Service history now includes optional amount paid (CAD, including tax) and provider fields. Costs use integer cents, and blank amounts remain unknown. Matching-record totals show known/unknown coverage and do not claim total ownership costs. Avoid assigning the same full invoice amount to several records.

Search history by work, provider, notes, date or odometer; filter inclusive dates and order by newest, oldest or highest recorded cost. Ten rows render per page. CSV export includes every matching row across pages, with blank unknown amounts and UTF-8 text. Use JSON backups for restoration; CSV is a review export. New optional fields round-trip through current version 1 backups. Older clients may reject these extensions and should preserve the original data.

Cost and provider changes participate in stale-edit checks. A pending deletion also checks the original record, so a correction in another tab cannot be silently deleted. Removing actual linked work recalculates reminders from remaining history, independently of recorded costs.

The maintenance overview prioritizes due/overdue work across vehicles, followed by work due soon and reminders needing actual history. Filter by vehicle or status and review six reminders per page. Review moves keyboard focus directly to the matching reminder without putting private garage identifiers in the address. Overview and history pagination move focus and the viewport to the new results. Reminder states refresh after the local date changes and service entered in another tab.

Personal reminders can be corrected in place: name, time/distance intervals and optional starting completion details. Their IDs, linked receipts and calendar event identities are retained. Logged service still participates in the next due calculation, and newer service or mileage entered in another tab is preserved. Changed or removed reminders reject stale edits and pending removals. Reviewed manufacturer intervals remain source-verified; custom intervals use personal reminders. Empty intervals receive an inline error before saving.
