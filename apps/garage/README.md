# Garage

The first garage release is implemented as an independent page at `/garage` within the existing OSS deployment. Its UI and local ownership model live in `apps/oss/src/garage`; shared Canadian manufacturer guidance and document metadata live in `packages/car-catalog/src/maintenance.ts`.

Adding an already-owned vehicle is the primary flow and works without downloading the comparison catalog. Guided selection covers published Canadian model-year entries from 1995–2027; any unlisted vehicle can still be entered manually. The selected engine/transmission or a verified catalog configuration fills known details, while trim can be left unknown. Comparison cards offer a convenience link to preselect a catalog configuration; that catalog is loaded only on demand.

Implemented: vehicle entry and detail corrections, odometer updates, editable service records, personal recurring reminders, selected manufacturer guidance, due/overdue status, backup export, explicit restore confirmation and cross-tab synchronization. Owned data stays in this browser. Unknown saved formats are preserved; storage failures offer a session-only workflow and export.

Initial supported guidance: Canadian 2016 Elantra sedan severe-use oil/filter reminder and manual specifications; Toyota 2025 general service visits; selected Honda Maintenance Minder A/0 models. See [source review](../../docs/MAINTENANCE-SOURCES.md).

Reminder intervals need explicit completion baselines. Actual completed service resets the next due date/distance; historical entries cannot move a newer baseline backwards. Removing a reminder retains its service history. Removing a vehicle requires confirmation. No automatic reminder is inferred for an unsupported schedule.

Vehicle details and service records can be corrected in place. Stale edits are rejected if another tab changed the same details or record. A correction that invalidates a manufacturer reminder requires an explicit choice to retain its interval as personal; history stays attached. Changing the compared configuration removes its former catalog link.

Future: more Canadian manual providers, complete model-specific task lists, one-time milestones, driving-distance forecasts, accounts and notification channels. A separately deployable garage app remains an architectural option; the initial `/garage` page shares the deployment while keeping comparison data optional.
