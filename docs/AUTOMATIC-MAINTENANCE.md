# Automatic maintenance plans

The garage adds reviewed manufacturer tasks when a supported vehicle is saved or an existing garage is opened. Owners enter actual service history rather than creating each task and interval. This is in-app scheduling based on recorded dates and mileage; background notifications and dealer bookings are separate future work.

## Reviewed coverage

For the Canadian 2016 Elantra sedan, the plan contains:

| Task                              | Distance interval | Time interval | Canadian manual location |
| --------------------------------- | ----------------- | ------------- | ------------------------ |
| Engine oil and filter, severe use | 6,000 km          | 6 months      | Chapter 7, page 19       |
| Tire pressure and condition check | —                 | 1 month       | Chapter 7, page 7        |
| Exterior lights check             | —                 | 1 month       | Chapter 7, page 7        |
| Engine coolant level check        | —                 | 1 month       | Chapter 7, page 7        |
| Clean battery and terminals       | —                 | 12 months     | Chapter 7, page 8        |
| Tire rotation                     | 12,000 km         | 6 months      | Chapter 7, pages 9–18    |

Where both thresholds apply, either can make the task due. Owner checks are distinct from component replacement. The existing checksummed Canadian maintenance chapter supplies these tasks; pages 7, 8, 9 and 19 were visually reviewed. [Hyundai Canada](https://www.hyundaicanada.com/en/about/faq) directs owners to the severe-use schedule. The normal schedule's periodic tire rotation remains applicable alongside the severe-use oil interval. Task details link to their exact source pages and instructions.

This is a selected set of reviewed tasks, not the complete maintenance schedule. Equipment-specific transmission work, conditional “more frequently” instructions and first-service coolant/belt milestones are not made into universal recurring intervals. Elantra GT, other model years and unconfirmed U.S. trim equivalents are excluded.

Toyota 2025 guidance creates the reviewed general maintenance-visit reminder (8,000 km or 6 months), not a model-specific oil schedule. Honda's reviewed Maintenance Minder guidance remains dashboard-driven. Unreviewed vehicles can use personal reminders; no generic manufacturer interval is invented. See [maintenance sources](MAINTENANCE-SOURCES.md).

## History and due calculations

New automatic tasks start with unknown completion dates and odometers. They do not create service records. **Needs history** remains explicit until the required information is available; a known threshold that is already reached can still establish that service is due. Unknown values are never represented by zero or the vehicle's addition date.

Adding service history records the owner's actual completion. Subsequent completions, corrections, linked records and odometer updates recalculate due thresholds. Calendar months clamp at month ends; time and distance thresholds are evaluated independently. A custom plan may also retain incomplete history without pretending its next due date is known.

The garage does not infer that an unlinked receipt completed a task by matching its title. Owners can explicitly associate a service record with a reminder. Existing explicit baselines remain independent of later records, so correcting or removing a record does not freeze its former date into the baseline.

## Persistence and corrections

Automatic task IDs are stable and generated only for missing manufacturer keys. Existing sourced reminders, personal reminders and all service records remain intact. Reopening a garage does not duplicate tasks or overwrite its original stored bytes; the next successful change persists the reconciled plan.

Removing a sourced task records its key in the optional `suppressedMaintenance` list, so it stays removed on subsequent visits. Its service records remain as unlinked history. **Restore removed manufacturer tasks** reinstates the plan without claiming that old unlinked work completed it.

Vehicle identity corrections replace empty incompatible plans automatically. Plans with actual baselines or linked history require explicit review before their intervals become personal; records stay attached. Suppressions are retained only where the reviewed task still applies. Nickname edits preserve the plan. Unsupported saved formats and failed storage keep the existing preservation/export behaviour.

Personal reminder names, intervals and starting completion details can be corrected in place. Linked service records retain their original work descriptions and IDs; the corrected interval applies to the current actual history. Clearing starting details does not erase logged work. Manufacturer reminders keep their reviewed intervals. Stale reminder edits and pending removals check the original reminder before applying; newer service records and odometer readings remain intact.

Existing version 1 garages and backups remain readable. The current reader accepts incomplete reminder history and optional suppressed task keys; it still validates dates, mileage, IDs, manufacturer attribution and exact reviewed intervals. Older clients may reject these extensions and should preserve the original file rather than discard it.
