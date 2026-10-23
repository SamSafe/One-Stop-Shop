# Genesis Canada source and import contract

Reviewed 2026-10-22. The import adds 41 factory configurations from 40 retail trim
identities across 2026–2027. There are 39 published Alberta all-inclusive prices,
13 exact specification joins and 11 quarantined specification tables. All 41
base MSRP values remain unknown. This is progress toward full Canadian coverage;
older new stock, additional equipment and technical conflicts remain open.

## Published Canadian sources

The [Canadian home page](https://www.genesis.com/ca/en/main.html) independently
links model/year offerings to the
[Canadian builder](https://acquisition.genesis.ca/en/build-and-order). Its linked
`/blocks/genesis-build-and-order/genesis-build-and-order.bundle.js` publishes
anonymous product reads on `https://acquisition.genesis.ca`:

- `/api/genesisbackend/GenesisShowroom/GetLatestYearModelsJson?language=en&province=AB`
- `/api/genesisbackend/GenesisShowroom/GetTrimsJson?language=en&province=AB&modelName={name}&year={year}`
- `/api/genesisbackend/GenesisShowroom/GetTrimColorsJson?language=en&trimExtId={id}&province=AB`

These public reads need no account, token or saved build. All 14 latest-model
families reconcile: G70, G70 Graphite, G80, G80 Prestige Black, G90, G90 Prestige
Black, GV60, GV60 Magma, GV70, Electrified GV70, GV80, GV80 Prestige Black, GV80
Coupe and GV80 Coupe Prestige Black. The trim response includes explicit available
years and their trim dictionaries; requesting the latest year must not discard
the older published 2026 entries. Eighteen overview model/year links reconcile
against the normalized family records.

Identity includes model year, external trim ID and the compatible mapped HSC
factory code. Forty unique trim GUIDs share only 28 default HSCs, so deduplicating
by HSC alone would erase editions. Compatible exterior/interior pairs expose a
second HSC for 2026 GV70 Sport 3.5T: `V7CW5K3BGS00` for the quilted interiors and
`V7CW5K3BGSAU` for Obsidian Black/Sevilla Red suede inserts. Both remain present,
yielding 41 profiles. Cosmetic pairs within one HSC do not create extra cards;
the least expensive compatible pair is retained, and expected HSCs must reconcile.

## Regional pricing basis

The trim response's `vehiclePricingLegal.legalDescription` explicitly describes
`msrp` as all-inclusive. It is not the catalog's fee-exclusive base MSRP. The
published client constructs the displayed amount from the vehicle amount,
compatible exterior/interior charges and itemized provincial `trimTaxes`.

The import retains that sum separately as CAD, Alberta, all-inclusive before
sales tax. Registration, insurance and optional products are excluded. Incentives
are not deducted. For example, 2027 G70 Advanced 2.5T publishes $57,000 plus
$131.88 of Alberta charges, yielding $57,131.88. Prestige 2.5T yields $62,631.88.
These totals appear separately in cards and comparisons, with their source and
basis. Base-MSRP ranking and budget filters continue to treat these records as
unknown; the regional total never becomes a comparable base-price fact.

2027 GV60 Magma is explicitly a preorder with a zero placeholder. It is labeled
announced and has no price. The 2027 Electrified GV70 publishes an $89,500 vehicle
amount but null air-conditioning excise and tire-levy components; its regional
total remains unknown. Its current compatible exterior choices also have a
minimum $900 charge, which must not be replaced by a cheaper marketing headline
or an unavailable colour. Null fees never become zero.

These are published component totals using the manufacturer's client formula.
They are not independently calculator-verified cash quotes. An exploratory
calculator request returned HTTP 401 and supplied no usable evidence; it is not
part of the import. Normal anonymous browser research did not finish rendering
within its timeout. Neither result was bypassed or treated as proof that an
offering is absent.

## Specification identity and measurement limits

The [G70 specifications page](https://www.genesis.com/ca/en/models/luxury-sedan-genesis/g70/specs.html)
contains the Canadian comparison widget with 13 model-code selectors. Its linked
`/etc.clientlibs/genesis-p2/ca/components/content/spec-new/clientlibs.js` publishes
ordinary read-only form POSTs to:

- `/wsvc/ca/api/v2/specVehicle/data`: model code/name, `langCd=en-CA`, `init=true`, `frontPubYn=N`.
- `/wsvc/ca/api/v2/spec/data`: exact model code/name/trim, `selIndex=0`, `langCd=en-CA`, `frontPubYn=N`.

Each returned row retains its `modelTrim`, `mdelCd`, `prdnMyer`, group, item name
and value. Selector year, returned production year and trim identity must agree
before a table can join an exact factory trim. All 24 selected table reads are
captured. Thirteen exact joins remain usable for G70, Graphite, G80, G80 Black,
G90 Black and GV70. Eleven responses conflict with the selected model year:

- 2026 G90 returns 2023; 2026 GV60 and 2027 Electrified GV70 return 2025.
- Three 2027 GV80 tables return 2023; two GV80 Black selector references return 2026.
- 2027 GV80 Coupe returns 2025; two Coupe Black references return 2026.

The returned year might describe a template or generation, but that interpretation
is unverified. These tables remain quarantined, with requested and returned years
reported. Older trims never inherit the latest year's table. Explicit exact-year
factory key features may still establish horsepower, transmission, AWD or seats.

Published hp and mm values retain their qualifiers. Unspecified mirror position
remains unspecified. Generic cargo volume without a seating arrangement does not
become seats-up or folded-seat capacity. A consumption row labeled EPA/AWD lacks
the required Canadian unit/mode evidence and is withheld. EV kW and motor/boost
values are not converted or summed into ordinary horsepower. An attached 2026 G70
PDF is not 2027 evidence. G90's explicit 409 hp and 48 V e-supercharger feature
does not establish a traction-hybrid subtype; the uncertainty stays visible.

## Refresh, replay and remaining coverage

`npm run catalog:sync:genesis` captures the public sources and validates the whole
replacement before writing. HTTP, schema, checksum, identity and reconciliation
failures abort. A live refresh also rejects lost offerings, verified specification
downgrades or lost regional prices. Removing an older offering requires ordering
and new-stock reconciliation rather than silently trusting a changed selector.

`-- --from-captures <manifest.json>` imports a reviewed capture without advancing
its date. `-- --offline` verifies original request/response hashes and byte-identical
normalized reconstruction. Original bytes and receipts stay under ignored
`data/raw/genesis/`; no authentication headers or VINs enter the normalized catalog.
Ordinary builds make no manufacturer requests.

The selectors establish a dated manufacturer offering, not dealer stock or a
delivery date. Independent review of older new inventory is incomplete. The
officially linked preowned search and indexed demonstrator pages do not establish
new-vehicle availability. Full equipment expansion, base-MSRP evidence, Canadian
fuel/energy cycles, charging windows, cabin/cargo arrangements and the quarantined
technical identities remain unresolved within the full market objective.
