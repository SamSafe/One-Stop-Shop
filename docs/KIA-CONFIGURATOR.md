# Kia Canadian source contract

This capture reconciles 24 model/powertrain/year references in the current
Canadian source, including 23 passenger entries with 126 factory trim/package
configurations. Two PV5 cargo trims are retained as a documented commercial-only
exclusion. This is a manufacturer progress milestone, not proof of all Canadian
new inventory or every additional equipment/production variant.

## Sources and identity

- https://www.kia.ca/en/vehicles
- https://www.kia.ca/en/shopping-tools/build-and-price

Both pages expose a vehicle-list HTML attribute containing encoded JSON. Decode
the HTML entities once and parse JSON without executing page scripts. Validate
the same flat vehicleList and grouped vehicleFamiliesList from both pages.
Each grouped model must match its flat reference, including factory codes,
prices and specifications. Do not use defaultYear as an availability filter:
current non-default years and 2025 Telluride/EV6 offerings remain included.

The flat source has a 2027 EV4 entry absent from the grouped family list. Its
separate official model page must expose the same vehiclePath, year, trim codes,
prices and specifications before acceptance. The capture records that additional
evidence and its checksum. Other ungrouped model references require the same
reconciliation rather than being silently dropped or counted as current.

Every parent trim and nested package has a content-fragment path, trimCode and
FSC code list. A packageParentTrim must match its containing parent. Each
year/trimCode is retained as a stable configuration identity, and no package
borrows its parent's missing specifications. EV3/EV4 AWD packages can publish no
performance.drivetrain; their explicit AWD package name establishes drive.
Transmission configuration and exact-trim powertrain feature labels provide
additional explicit drive evidence when that main field is absent. Conflicting
labels remain unverified instead of choosing one arbitrarily.

The 2027 EV4 E4145V AWD package calls itself Wind but explicitly references the
Wind Premium parent. Its display name follows that parent relationship. The
original Wind label, parent name, package identity and factory code all remain
available for reconciliation, and the source alias appears in the gap report.

Twenty-six records have multiple FSC aliases under one published trim record.
Preserve them all; do not invent identical vehicles or assume they only encode
colour. Equipment, production-revision and ordering-code reconciliation remains
necessary before exhaustive configuration coverage can be asserted.

## Prices, units and measurements

priceDetails.AB.msrp is the complete factory trim/package MSRP. Do not add it as
a package surcharge. Delivery/destination, dealer fees, taxes, levies, colours,
accessories and incentives are separate. The exact source record and field path
remain in the fact note. A national MSRP is not a dealer stock or price quote.

The same page's i18n dictionary explicitly labels Power - hp, Horsepower,
Estimated Fuel Economy (L/100km), electric range in km and Level 2 charging at
240 V. Capture and validate those labels before interpreting unitless numbers.
Do not confuse motor power in hp with battery/charger power in kW, or gasoline
equivalent Le/100km with gasoline consumed or measured kWh/100km. Engine and motor
ratings are not added; combined-system qualifiers remain in the source note.
For example, the 2027 Carnival HEV publishes 242 hp combined output, separately
from its engine and motor ratings. The combined field is used directly.

Use explicit volumeBehindThirdRow for all seats upright in a three-row vehicle,
volumeBehindSecondRow for a two-row vehicle, and volumeBehindFirstRow for the
published maximum seating-fold/removal arrangement. Generic minimumVolume and
maximumVolume lack an explicit arrangement and remain unverified. Cargo-floor
alternatives, ranges and roof-qualified headroom also remain unknown until their
exact applicability is established. The gap report retains these source values.

Plug-in fuel/energy operating modes require separate reconciliation. Do not
convert a generic plug-in rating into a whole-journey cost. Manufacturer target
ranges remain unverified. Parsed Level 2 times retain their original equipment,
charging-window and footnote qualifications; they are not fast-charge promises.

## Scope, refresh and reproduction

Kia's official PV5 announcement identifies the current Canadian model as a
dedicated two-seat commercial cargo vehicle. The exclusion is limited to that
reviewed 2027 Basic/Plus entry and retains both factory codes and the official
evidence URL/hash. A changed or passenger PV5 entry triggers renewed review.
Carnival passenger minivans remain included.

Run `npm run catalog:sync:kia` for an explicit live capture. All required source
pages, identities and expected sets must reconcile before atomic replacement.
Raw bytes remain in ignored data/raw/kia, keyed by SHA-256; the tracked snapshot
retains their receipts. `npm run catalog:sync:kia -- --offline` reconstructs the
same snapshot from verified bytes without advancing its capture date. Ordinary
application builds and the running app never fetch manufacturer data at runtime.

Current national tool listings do not prove dealer stock, delivery dates or all
older vehicles still offered new. Makes absent from NRCan, omitted models and
additional older inventory remain part of the full-market objective.
