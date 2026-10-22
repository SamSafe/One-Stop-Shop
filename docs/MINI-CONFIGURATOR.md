# MINI Canada source research and import contract

Reviewed 2026-10-22. The import adds 189 retail profiles: 175 current
line/style/named-package combinations and 14 additional new-stock base profiles
across 2025–2027. It verifies 185 prices. Older equipped stock, individual optional
equipment and missing technical fields remain open within the full market goal.

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
responses are captured. Each of the 90 exact current model/line/style contexts has
its own nav-data receipt. The current selector yields 90 distinct model/line/style
combinations, including a null style when the published style list is empty.
PREMIER/PREMIER+, Classic/Favoured, Piano Black styles and Paul Smith editions
retain their separate identities. Non-accessory products in each Packages category
are expanded into 175 selections using their published increments and package
requirements/exclusions from the linked rules file. Individual options, paint,
wheels and accessories do not establish additional verified configurations here.
These counts do not prove complete ordering or market coverage.

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
current carousel. All 37 code/year identities are represented. Stock line labels
do not prove every style/equipment selection is available. Fourteen codes outside
the active carousel remain stock-base profiles; current ordering and exact
equipped stock pricing require matching evidence. Published bare-model RRP is
labeled separately from equipped stock selling price and is withheld when its
transmission identity conflicts.

## Pricing and technical safeguards

Base `Price` is separate from all-inclusive price, fees, paint and discretionary
equipment. Line and style increments are published separately. For example,
2027 Cooper C 3 door is $35,990; PREMIER+ adds $1,250, and its Piano Black Favoured
style adds $2,000, yielding $39,240 before other options and fees. Each exact
selection response must retain zero-cost required colour/upholstery choices and
no unresolved transmission charge. A 2027 Countryman S ALL4 PREMIER+ with Piano
Black Favoured style, Advanced Driver Assistance and Interior Protection packages
is $53,890. The nav-data response distinguishes zero-cost paint from optional
paint. Default paint and all-inclusive calculations do not replace base MSRP.

Stock supplier base-price values conflict within several exact codes; they are
not a factory-price fallback. Carousel 27HP declares AG 43GD, while observed 2027
Paul Smith 5-door stock declares 53GD. Preserve and report that conflict before
joining AG-based measurements or another model's data.

Exact model-code technical tables publish explicit hp, mm, luggage arrangement,
powertrain and transmission labels. Width includes mirrors. Charging fields
distinguish AC 0–100% at 9.6 kW from DC 10–80% at 130 kW. Bare wheelbase/battery
numbers and `7:30`/`0:29` durations require unit/format review; they are not decimal
hours or interchangeable charging modes. Missing consumption, seating, cabin and
range fields remain unknown. Technical data is published by exact CACode, with
optional wheel/equipment-specific measurement differences still unverified.
Model-level dimensions are not represented as separate option measurements.

Three 2025 tables (25HC, 25HE and 25VA) describe a six-speed manual, while their
observed new stock is automatic. Do not copy those apparently stale technical
tables into the stock profiles. The observed 27YQ Countryman S ALL4 JCW Edition
line endpoint returned HTTP 500 on two reads, and its HTTP 200 technical response
reports an invalid CACode. Its stock identity remains present with unknown price
and specifications. The three manual/automatic conflicts also leave MSRP unknown;
supplier values and siblings are not substituted. AG-conflicting 27HP technical
fields are quarantined while its exact-code factory price remains independently
verified.

## Refresh and reconstruction

`npm run catalog:capture:mini-stock` reads the normal anonymous stock session and
all reported pages, with `MINI_STOCK_CAPTURE_DIR` optionally selecting an isolated
cache. New/non-demo identity, distinct VIN counts and page totals must reconcile
before its manifest is replaced. Required source and count failures retain the
previous manifest. No headers or VINs enter the normalized snapshot.

`npm run catalog:sync:mini` uses a same-date stock capture and the official public
factory routes. Required failures abort replacement. The initial reviewed 27YQ
line failure is accepted only for that exact URL/status/response hash during
explicit capture replay. Live access, server or other failures still abort;
another error body cannot silently replace prices with unknowns.

`-- --from-captures <manifest.json>` compiles reviewed bytes without advancing their
source date. `-- --offline` verifies request/response hashes and byte-identical
normalized reconstruction. Factory bytes and receipts stay under ignored
`data/raw/mini/`, inventory receipts under `stock/`. Ordinary builds require no
manufacturer requests. Additional factory/stock selections, independent market
review and unresolved technical evidence still prevent a MINI completeness claim.
