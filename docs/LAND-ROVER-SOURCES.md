# Canadian Land Rover increment — 26 October 2026

42 visible factory derivatives across Defender, Discovery, Discovery Sport, Range Rover, Range Rover Sport, Velar and Evoque. Each product was resolved in the ordinary Canadian LIVE/CDA configurator, with no account, order or saved configuration. The Canadian build menu supplies the seven family roots. The reviewed production normalizer applies `HideRegisterCompatibility.PRODUCT`; raw compatibility alone incorrectly includes retired/hidden products.

29 records have literal manufacturer years: 14 Defender and 13 Range Rover profiles for 2027, Discovery Sport and Evoque for 2026. The 2 Discovery, 10 Sport and 1 Velar profiles are explicitly year-unverified offers. Internal program codes are not model years.

All 42 prices are CAD PRODUCT.GROSS=NET base amounts. Configured summary totals, optional equipment, freight/delivery, luxury tax and RETAIL totals are excluded. Technical metrics remain unknown pending exact equipment and units reconciliation; OCTA descriptions and technical tables conflict on horsepower. Cargo and seating maxima do not establish standard equipment.

## Reproduction

`npm run catalog:sync:landrover -- --from-captures` consumes a reviewed `data/raw/landrover/derivative-review-manifest.json` and `research-manifest.json`. `--offline` reconstructs the committed DTO exactly. All consumed responses are checked against their SHA-256 receipts before parsing. Raw data is ignored. JSONP is parsed as bounded JSON, never executed. The importer verifies body/product coverage, exact selected identities, the reviewed normalizer hash, market, visible compatibility, one-day cohort and no disappearance of previously accepted product/year identities.

A live refresh intentionally requires a new reviewed capture cohort from the current Canadian build menu. Replaying old URLs is not a fresh lineup check. Raw capture helpers in the research cache are not a supported automated refresh API. If current roots or normalizer semantics change, review before accepting new data.

These are current factory offerings, not confirmed order acceptance or stock. National inventory, older new model years and additional equipment combinations remain open. This increment does not establish complete Canadian market coverage.
