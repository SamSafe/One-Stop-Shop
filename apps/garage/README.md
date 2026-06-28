# Garage — car maintenance reminder app

Standalone app. Build a garage of the cars you *own* and get reminded to do
maintenance at the right intervals. Must stand entirely on its own — most users
already own a car and have never heard of OSS. One-sentence pitch: *"track your
cars, never miss a service."*

Adding a car you already own is the **primary** flow. Importing a car from OSS
is a rare convenience, never an assumption.

## Original notes

The app should be extended into an owned garage.

Scrape for your own use case:

- find specs
- download and parse schedules
- store the data on a DB
- get users to add vehicles to a garage
- dashboard provides details, upcoming items, controls (date/mileage
  preferences) and average mileage a week they drive.
- for user cars:
  - load maintenance schedule
  - create and attach new table for user containing schedule and items to be done
  - allow tracking so follow-ups are personalized:
    - "did change at x, next is due at x+y"
    - consider wear items, consider seasonal items (winter tires)

## Note on the data layer

The "find specs / download & parse schedules / store on a DB" part is **not**
garage-specific — it's the shared catalog. That logic lives in
`packages/car-catalog`. The garage app owns only the per-user concerns:
garages, owned vehicles, mileage, personalized schedules, reminders.

## Feature ideas

- Add an owned vehicle (manual entry must work even when the trim isn't in the
  catalog yet) — this is the primary onboarding flow.
- Load the catalog maintenance schedule and personalize it per vehicle.
- Dashboard: upcoming items, overdue items, per-vehicle details and controls.
- Mileage model: current mileage + avg miles/week → predict next-due dates.
- Tracking: "did change at X, next is due at X+Y"; full service history.
- Wear items and seasonal items (e.g. winter tires) handled distinctly.
- Reminders (in-app first; email/push later).

## MVP scope

In: add vehicle, attach + personalize a schedule, dashboard of upcoming/overdue,
mileage + date preferences, mark items done with history.

Out (for MVP): multi-user garages/sharing, OSS import bridge, deep notification
channels, cost tracking/receipts.

## Personalization model

Each owned vehicle gets its **own copy** of the catalog schedule so it can
diverge per user (different mileage, skipped/added items). Next-due is computed
from the item's mileage/time interval against the vehicle's current mileage and
average weekly mileage. See `docs/DATA-MODEL.md` (UserVehicle / PersonalizedSchedule).
