# MINI Canada source research and import contract

Reviewed 2026-10-22. This research has not yet added MINI retail configurations to
the catalog. The full Canadian market objective still includes every new model,
retail trim, overlapping model year and observed older new-stock offering.

## Published Canadian sources

The [Canadian home page](https://www.mini.ca/en),
[builder](https://www.mini.ca/en/shopping/buildandprice) and
[national new inventory](https://www.mini.ca/en/shopping/inventory/) are captured.
The versioned configurator script linked by the builder publishes its production
base URL, `https://api.minicdn.ca`. Its product reads require no account or secret
header. Public read routes are:

- `/v1/config/carousel?lang=en&province=AB`
- `/v1/config/selectline?lang=en&cacode={CACode}`
- `/v1/config/selectstyle?lang=en&cacode={CACode}&lineid={lineid}`
- `/v1/config/navdata?lang=en&cacode={CACode}&lineid={lineid}[&styleid={StyleID}]`
- `/v1/config/techspec?CACode={CACode}&lang=en`

The carousel supplies explicit `Year`, `CACode`, `AGCode`, model names, active
flags, base `Price`, `AllInclusivePrice` and fee components. It declares 2026 and
2027 and has 25 references representing 23 unique codes: the two electric
Countryman references repeat in both U25 and U25-E. Duplicate references must
reconcile rather than create duplicate vehicles. All 23 are active in this
capture. Empty F56/F60 sections do not establish current retail offerings.

All 23 equipment-line and technical responses and all 42 line-specific style
responses are captured. The current selector yields 90 distinct model/line/style
combinations, including a null style when the published style list is empty.
PREMIER/PREMIER+, Classic/Favoured, Piano Black styles and Paul Smith editions
must retain their separate identities. These counts are research evidence, not
proof of complete ordering or market coverage.

## National stock and additional model years

The normal anonymous inventory page initializes its public search using a
session anti-forgery header. Read-only search requests go to
`/en/shopping/inventory/InventorySearch_API` after normal initialization. No
account, personal input, saved build, reservation or purchase is required.
Cookies and anti-forgery values remain in the browser and are not catalog data.

The page publishes sizes 12, 24 and 36. The final capture uses 36, MINI, status N,
no demos, includes vehicles without offers, and clears province/retailer, price,
model-year, mileage, photo and geographic restrictions. Default requests had
`WithPhotosOnly: true` and mileage limits; those defaults must not silently define
the market scope. The cleared search still reports 1,553 rows, all 1,553 distinct
VINs, across 44 pages with consistent totals. Every row is new and not a demo.
VINs serve only local source reconciliation and must not enter the normalized
public catalog.

There are 36 observed year/VG/AG groups across 2025–2027. Together with the current
carousel there are 37 distinct Canadian codes to reconcile, including older new
stock, Icon, JCW, Victory, Heritage and Elementary editions absent from the
current carousel. Stock line labels do not prove every style/equipment selection
is available. Older API options must not become current ordering claims without
matching evidence.

## Pricing and technical safeguards

Base `Price` is separate from all-inclusive price, fees, paint and discretionary
equipment. Line and style increments are published separately. For example,
2027 Cooper C 3 door is $35,990; PREMIER+ adds $1,250, and its Piano Black Favoured
style adds $2,000. Verify compatible selections and any mandatory charges before
treating their arithmetic as a complete configuration MSRP. The nav-data response
distinguishes zero-cost paint from optional paint. Default paint and all-inclusive
calculations must not replace base MSRP.

Stock supplier base-price values conflict within several exact codes; they are
not a factory-price fallback. Carousel 27HP declares AG 43GD, while observed 2027
Paul Smith 5-door stock declares 53GD. Preserve and report that conflict before
joining AG-based measurements or another model's data.

Exact model-code technical tables publish explicit hp, mm, luggage arrangement,
powertrain and transmission labels. Width includes mirrors. Charging fields
distinguish AC 0–100% at 9.6 kW from DC 10–80% at 130 kW. Bare wheelbase/battery
numbers and `7:30`/`0:29` durations require unit/format review; they are not decimal
hours or interchangeable charging modes. Missing consumption, seating, cabin and
range fields must remain unknown.

Three 2025 tables (25HC, 25HE and 25VA) describe a six-speed manual, while their
observed new stock is automatic. Do not copy those apparently stale technical
tables into the stock profiles. The observed 27YQ Countryman S ALL4 JCW Edition
line endpoint returned HTTP 500 on two reads, and its technical table was empty.
Retain its stock identity and an explicit source gap; do not borrow a sibling's
price or specifications. A temporary/access/server failure during a future
refresh must not overwrite previously verified data with unknowns.

Research bytes and checksum receipts are under ignored `data/raw/mini/`, with
inventory receipts under `stock/`. A production importer, normalized snapshot,
offline reconstruction, compatibility expansion, independent lineup review and
browser coverage remain to implement. No MINI completeness claim is justified.
