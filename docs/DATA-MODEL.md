# Data model (planning)

Conceptual model only — entities and fields, not schema/DDL. The dividing line
is the architectural rule: **shared catalog data vs. per-app data.** The catalog
never references app concepts; apps reference the catalog by id.

## Shared — `packages/car-catalog`

The canonical, app-agnostic source of truth about cars.

### Make
Manufacturer. Fields: name, country, logo.

### Model
A nameplate under a make (e.g. "Golf"). Fields: make, name, body style,
generation, production years.

### Trim / Variant
The unit users actually compare. Most spec depth lives here. Fields grouped:

- **Identity:** model, name, model year, market(s).
- **Dimensions:** length, width, height, wheelbase, kerb weight, boot/cargo
  volume (seats up / down), towing capacity.
- **Interior / space:** seat count, seating layout (e.g. 2+3, 2+3+2), front/rear
  leg room, front/rear head room, shoulder room, ISOFIX points.
- **Powertrain:** fuel type (petrol/diesel/hybrid/PHEV/BEV), engine/motor,
  displacement, power (kW/hp), torque, transmission, drivetrain (FWD/RWD/AWD),
  battery capacity + range (if electric), 0–100, top speed.
- **Running costs:** fuel economy / efficiency, CO2, fuel tank size, insurance
  group, est. annual running cost, warranty.
- **Technology:** infotainment (screen size, CarPlay/Android Auto), driver-assist
  features, connectivity, key comfort/safety features.
- **Safety:** NCAP/IIHS rating, airbag count, assist systems.

### MaintenanceSchedule  *(feeds the Garage app, lives in the catalog)*
Per-model/trim service plan parsed from manuals. A schedule is a list of
**ScheduleItem**s. Fields per item: name (e.g. "engine oil & filter"),
interval-by-mileage, interval-by-time, category (routine / wear / seasonal /
inspection), notes. The catalog stores the *generic* schedule; the Garage app
personalizes it per user vehicle (see below).

### Source / provenance
Where each datum came from (manufacturer brochure, manual, dataset) + fetched-at
+ confidence. Important for trust and for re-scraping.

## Per-app — `apps/oss`

Nothing here is in the catalog; all of it references catalog ids.

- **Shortlist / Comparison:** a user-saved set of trim ids being compared.
- **Priorities:** the user's stated weights (budget, fuel cost, space,
  reliability, etc.) used to rank — the core of the decision-first UX.
- **Saved searches** (optional later).

## Per-app — `apps/garage`

- **Garage:** a user's collection of owned vehicles.
- **UserVehicle:** an owned car. References a catalog trim id (or a manual entry
  if the trim isn't in the catalog yet). Fields: nickname, current mileage,
  avg miles/week, purchase date, plate (optional).
- **PersonalizedSchedule:** a copy of the catalog `MaintenanceSchedule`
  attached to a UserVehicle so it can diverge per user. Each item tracks:
  last-done (date + mileage), next-due (computed from intervals + avg mileage),
  status (done / upcoming / overdue), and history.
- **Reminder:** derived from PersonalizedSchedule items approaching due.
- **Preferences:** date vs. mileage emphasis, notification channels.

## Cross-cutting

- **User / Account:** shared identity so a user *can* use both apps, but neither
  app requires the other. Belongs to a shared auth package, not the catalog.
