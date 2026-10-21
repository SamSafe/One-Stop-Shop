# Mazda Canadian source contract

The import covers the public tool's active model/trim/engine/model-option SKU
lineage. Current-offering conflicts, older new inventory and ambiguous/unpublished
specifications still require reconciliation. This is a progress milestone, not
proof that every new Mazda in Canada is represented.

## Sources and identity

- https://www.mazda.ca/en/shopping/build-and-price/
- https://www.mazda.ca/en/vehicles/

The build page identifies its current public client bundle. That client explicitly
uses the production API at n8xgyscaa3.execute-api.ca-central-1.amazonaws.com/prod.
Only that exact reviewed API hostname is allowed; the importer does not grant
trust to arbitrary AWS endpoints. The client URL and hash are retained.

Follow ModelYears → Trims/{year}/{carline} → EngineModels/{year}/{carline}/{trim}
→ Packages/{model_code}/{option_code}. Requests use prov_code=AB and lang_code=en.
Reconcile every listed trim, engine/transmission model and model_option_package.
The model-year ID, year and carline must match each response. Each financial
based_on model/option identity must match the requested configuration.

The specs endpoint accepts POST JSON with cars:[model_code/option_code]. Verify
the returned model/option, model-year, year/carline and retail trim ID. Shared
package metadata can name GS/GT for a Kuro option; preserve that parent alias
alongside the actual retail trim and exact factory codes. A metadata alias is
not permission to borrow another trim's specifications.

## Prices and measurements

Package financial.msrp is the full configuration MSRP. The website internally
derives a package increment by subtracting the selected model's MSRP; do not add
the raw full package price to the base a second time. Fees, freight/PDE, colours,
incentives, protection and non-model add-ons are separate from the imported MSRP.

Specification tables use HEADER/Header, DATA/Data and FEATURE row types. Preserve
the table/header context, normalize only these documented forms and reject an
unrecognized row kind instead of silently losing specifications. Keep units and
qualifiers visible. Do not select arbitrary fuel-grade power maxima, mix fuel-only
and blended PHEV modes, choose an unspecified roof alternative, or copy a
nameplate cargo maximum into an exact trim.

Five captured CX-50 gasoline SKUs publish 1,595 L behind rear seats and 889 L behind
front seats. Both values remain unverified in the app; the source values and
conflict are explained and reported. An independent authoritative check is required
before correcting them. Source values are not automatically swapped.

## Availability and reproduction

Active imports require show_bnp and a non-legacy model entry. Building-disabled
older references remain in an inventory-review ledger, not a discontinued list.
The captured 2025 CX-50 and CX-50 Hybrid entries still carry coming-soon flags.
Their eight SKUs are labeled with that flag and require current-offering review.
An MSRP or an old model year alone does not establish stock or discontinuation.

Run `npm run catalog:sync:mazda` for a fresh explicit capture. Raw responses remain
in ignored data/raw/mazda; the normalized snapshot retains their hashes. Run
`npm run catalog:sync:mazda -- --offline` to checksum-verify the public client and
every response, revalidate the identities and rebuild without advancing its
retrieval date. Ordinary application builds use the tracked snapshot offline.
