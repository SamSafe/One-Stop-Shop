# Ford/Lincoln Canadian source contract

The current adapter imports default factory builds. Additional selectable
engine/drive/equipment combinations and older new inventory still require
reconciliation. This file does not claim full manufacturer or national coverage.

## Public sources

- https://shop.ford.ca/showroom/
- https://shop.lincolncanada.com/showroom/
- https://www.ford.ca/build-price/f150/2026/choose-model
- https://www.lincolncanada.com/build-price/nautilus/2026/choose-model

The showroom supplies the country/currency, retail model years and build links.
Primary and secondary model years are both included. Future-only and commercial
entries retain explicit exclusion reasons. A future-only entry is not proof that
all remaining older new stock is unavailable.

The model-selection page supplies Canadian config/catalog IDs, trim variants,
body tags, selected WERS codes and configuration hashes. Follow its exact build
URL, including configId, config, trimConfig, complex and vehicleTrim. A bare build
path without these values can return an error. Transient source errors receive
bounded retries; an invalid/incomplete refresh never replaces the existing snapshot.

The source uses React Flight JSON/text rows. Read embedded JSON and text lengths
without evaluating remote JavaScript. Text lengths count UTF-8 bytes, not string
characters. References can point to another row or an element's props. Country,
brand, year, catalog, trim, hash and selected variant codes must all reconcile.
URL aliases must be explicitly present in the manufacturer's metadata. Composite
marketed-series codes can join multiple selected codes with underscores.

## Prices and facts

The model-selection priceMap.MSRP and the build's TRIM_PRICE/Total may contain fees
and allowances. Use the build's explicit MSRP Base and Options components,
subtract selected colour charges and explicit DISCOUNT_PACK amounts, and exclude
freight, levies, luxury tax, delivery allowances, employee discounts and accessories.
Do not turn absent price components into zero or double-add the fee breakdown.
Known facts link to the exact captured build and retain the calculation basis.

Selected powertrain/body identity comes from keyFeatureMap and selectedWersCodes.
Do not infer FWD/RWD from a generic 4x2 code, or liquid-fuel consumption from an EV
equivalent rating. Do not copy nameplate maxima or a government rating without an
exact configuration join. Other published specifications still require review.

## Remaining configuration enumeration

The public model-selection client invokes a read-only getBuildResponse calculator
when a selection changes. Its current server-action identifier is discoverable in
the page's own client chunks and can change with a deployment; do not assume a
previous opaque identifier remains valid. The request includes country CAN,
language en-ca, configId, the current configState, delta (the chosen WERS code),
deltaOperation ADDITION and the original trimSelectConfigState where applicable.
This calculates a configuration; purchase, quote, contact and lead actions are
outside this importer.

A live research sample changed the F-150 XL's engine from EN-WQ to EN-BM and
returned a new configuration hash, selected features and price components. The
next pass must enumerate valid core choices through the calculator and reconcile
each response. Available choice lists are not a Cartesian product: selecting one
option can change other equipment or body codes. Verify the returned selection,
preserve its original body/trim identity, deduplicate configurations and retain
source receipts before adding them to the catalog. Include engine, drive,
transmission, equipment, battery and other choices needed to distinguish retail
configurations and published ratings. Source ambiguity remains an explicit gap.

## Refresh and reproduction

Run `npm run catalog:sync:ford` for a fresh capture. Full responses are retained in
ignored data/raw/ford and their hashes are tracked in the normalized snapshot.
Run `npm run catalog:sync:ford -- --offline` to verify those captures and rebuild
without changing the source retrieval date. Ordinary builds use the checked-in
snapshot and make no data-source network requests.
