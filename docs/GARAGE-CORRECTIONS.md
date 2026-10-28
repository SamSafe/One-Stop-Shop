# Garage correction increment — 26 October 2026

The original review milestone lacked a way to correct a vehicle or service entry without removing it. The resumed goal adds these corrections in place.

This report records the 26 October checkpoint. See [project status](PROJECT-STATUS.md) for current verification and the subsequent personal-reminder increment below.

## Vehicle details

Use **Edit vehicle** on a garage card to correct the make, model, model year, powertrain or nickname. The odometer, personal reminders and service history remain attached to the vehicle.

A nickname change retains the saved comparison configuration. Changing the make, model, year or powertrain removes that link, since its specifications describe the former configuration. Already loaded specifications are shown only when their identity matches the saved reference.

If the new details no longer match a reviewed manufacturer reminder, saving requires an explicit choice to retain the affected intervals as personal reminders. Their IDs, completion baselines and linked service history are retained. The app does not attribute those intervals to the new vehicle's manufacturer schedule. Applicable manufacturer reminders retain their attribution.

## Service history

Open service history and choose **Edit record**. Correct the task description, date, odometer or notes, or change which reminder the record completes. Saving updates the original record instead of adding another entry. Date and mileage validation still apply. Linked reminders recalculate from the resulting history; unlinking a record retains the record and uses the remaining applicable history for its former reminder.

Vehicle and service editors capture the state that was opened. Saving checks the latest stored data and rejects changes when another tab edited the same details or record. A deleted record cannot be recreated by saving an old editor. Unrelated newer history, personal reminders and odometer readings remain intact. Local storage is not a transactional multi-user database; simultaneous independent browser writes remain outside its guarantees.

Successful saves return keyboard focus to the vehicle card. Cancellation discards the draft. Existing version 1 backups remain compatible; no storage migration is required.

This increment leaves the original catalog and maintenance coverage gaps open. Complete model-specific schedules, one-time service milestones, more manual providers, distance forecasts and cloud features remain future work.

## Verification and review point

Implementation commit: `c4ddbe1`.

- Full unit run: 307 passed, including all 16 garage domain tests.
- Full production browser run: 236 passed without retries across desktop/mobile Chromium, Firefox and mobile WebKit. Correction coverage includes cancellation, history retention, manufacturer-to-personal review, recalculated reminders, unlinked records, stale writes, remotely deleted records, changed catalog references and accessibility scans of both editors.
- Production build, strict types, catalog validation, package boundaries and formatting pass.
- All 16 release artifacts and source fingerprint verify. The preview serves the exact prepared catalog bytes; catalog contents remain 6,082 records and 1,328 official sources.
- The correction form was visually reviewed on desktop and a 320 px mobile viewport, with no horizontal document overflow.

The preview remains at `http://localhost:8080/garage`. Try correcting a vehicle's nickname or a service record, then confirm its history and next reminder. The goal's requested feedback stop remains appropriate here: the garage entry, recording, correction and backup loop is now usable, while broader catalog and maintenance coverage is explicitly unfinished.

## Personal reminders — 27 October

Choose **Edit reminder** on a personal task to correct its name, time/distance interval or starting completion details. Saving retains the reminder ID, linked records and calendar event identity. At least one interval is required; an inline error identifies missing intervals. Unknown starting history remains unknown. Clearing starting details does not remove actual service records; later logged work still participates in the due calculation. Reviewed manufacturer intervals retain their verified values.

Saving or cancelling returns focus to the reminder, or to the vehicle if another tab removed it. Edits and pending removals check the original reminder snapshot. A newer correction cannot be overwritten or silently removed, and a deleted reminder cannot be recreated by an old editor. Unrelated service completions and odometer updates remain intact.

Switching between adding, editing and recording a completion creates the correct form state even when imported service and reminder identifiers match. Old dates, notes or expenses cannot carry into the new completion through that switch. Regression cases reproduced both overlapping-identifier failures before the fix.
