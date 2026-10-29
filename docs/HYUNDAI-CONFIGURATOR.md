# Hyundai Canadian source contract

This capture covers 18 model/year entries, 55 parent trims and all 80 factory
subtrims/packages listed by the current Canadian build tool. It includes
overlapping 2026/2027 years, gas/hybrid/plug-in/electric configurations, distinct
manual/DCT variants and optional seating/packages. Older new dealer inventory,
models absent from the current tool and outstanding specifications remain within
the full-market objective. These counts do not prove complete Hyundai inventory.

## Source and identity

- https://www.hyundaicanada.com/en/vehicles/all-vehicles
- https://www.hyundaicanada.com/en/shopping-tools/buildandprice

The public buildAndPrice.bundle.js identifies the backendservice requests on
the same official Canadian domain. Its URL and checksum are retained. The lineup
response's models are nested by family; multiple gas/HEV/PHEV cards can reference
the same model ID and modelNameCMS. Deduplicate those references only when model
year and CMS identity agree, then capture the entire referenced trim list.

GetShowroomsModelJson supplies the model/year references. The captured request
uses language=en and prov=AB; the current client also uses lang=en in its initial
request. getShowroomModelTrimsJson uses modelId, prov=AB and language=en. Reconcile
every parent and every subTrims.trimID, including factory packages and seating
choices. All selected option keys must exist in that parent's option ledger.
Linked-model references require review instead of being silently skipped.

The model/trim response repeats model ID, year and CMS key; verify all of them.
Some newer source identifiers are GUID-shaped but not RFC UUIDs. Preserve the
manufacturer's IDs exactly rather than rejecting them based on UUID version bits.
These IDs identify source records; they are not represented as HSC ordering codes.

## Price and feature requests

Request trimallpurchaseOptions with the exact trimId, prov=AB and lang=en. Verify
the returned trimId, province and includeDestination=false. The explicit msrp
field is the complete selected-trim MSRP. Delivery, levies, dealer administration,
taxes, incentives and finance terms are separate. The parent card's calculatedValue
includes delivery and fees and must not become base MSRP. Do not add a package
surcharge again to an exact package trim's MSRP.

The captured 2026 Kona N Line AWD with Ultimate Package has $39,699 from parent
option arithmetic versus $39,399 in the exact-trim calculator. The app uses the
calculator's explicit msrp, retains both numbers and displays a source-conflict
note. The discrepancy also appears in the coverage report and requires review.

Request getAllTrimFeatures with the same trimId, isParentVehicle=false and
language=en. Verify its trim name against the factory subtrim. Retain the raw
response hash and only the performance/seating rows needed by the app in the
normalized snapshot. Published drive/transmission labels are used where explicit;
an absent label remains unverified. Seven/eight-passenger factory trim names are
also explicit seating evidence; conflicting feature/name evidence stays unknown.

## Specification gaps and availability

GetSpecifications uses modelId and lang=en. Seventeen model tables returned
HTTP 503/504 after bounded retries during this capture. A successful earlier
Tucson table is retained, but it uses presentation columns and shares an Ultimate
column across HEV and PHEV. Its engine power, legroom and operating-mode values
must be reconciled to exact factory IDs before use. A column name or a nameplate
maximum alone is insufficient evidence. Missing dimensions, cargo, power and
energy facts remain unknown. EV-equivalent consumption never becomes gasoline
consumption; unverified plug-in operating modes never produce a guessed cost.

On 29 October 2026, all 18 tables and the model/year lineup returned successful
fresh responses. A separate reviewed supplement now adds 603 numeric facts and
six previously unknown drivetrains across 74 exact factory configurations. It
retains model-year identity evidence and every factory-ID/column mapping. Literal
column matches and explicitly reviewed engine/drive presentation differences are
accepted. Shared 7/8-seat columns supply only common, unqualified facts. Explicitly
labelled HEV/PHEV branches can be used for the matching powertrain; an unlabelled
mixed branch remains unknown. Conditional roof alternatives and unlisted Tech,
TCR and Night packages are excluded. Standard 276 hp ELANTRA N and 601 hp IONIQ 5 N
output is distinguished from conditional boost figures. Consumption, range,
prices, source captures and availability dates are unchanged. The
[review report](FIT-AND-SPECIFICATION-REVIEW.md) records the remaining limits.

All 55 current parents are unflagged as sold out, so their 80 configurations have
dated manufacturer-listing evidence. This establishes a national tool listing,
not dealer stock or a delivery promise. Older model-year inventory and models
absent from the tool still need separate review.

## Refresh and reproduction

Run `npm run catalog:sync:hyundai` for an explicit live refresh. Required-source
failures leave the tracked snapshot intact. The application builds and runs from
the snapshot, without a runtime manufacturer API dependency.

Raw response bytes remain in ignored data/raw/hyundai, keyed by SHA-256. Run
`npm run catalog:sync:hyundai -- --offline` to reconstruct every record from those
verified bytes and preserve the original capture date. The initial import used
responses captured successfully before a subsequent backend outage; it did not
pretend that failed requests were fresh successful captures.

For previously reviewed local captures, `-- --from-captures <manifest.json>` reads
the ignored raw files using a manifest with retrievedAt and sources containing
the exact requested URL, SHA-256 and HTTP status. Review receipt provenance before
creating this manifest. All hashes, source domains, identity joins and expected
configuration sets are checked by the same import path. This mode preserves the
manifest's original date; it does not fetch or refresh the source.
