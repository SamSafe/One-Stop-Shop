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
