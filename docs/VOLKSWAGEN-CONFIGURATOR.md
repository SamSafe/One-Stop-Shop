# Volkswagen Canadian catalogue contract

Reviewed on 2026-10-22. This capture adds 33 exact factory configurations across
12 listed model years. Current dealer stock, every optional equipment combination
and all remaining new inventory have not been exhaustively verified.

## Public sources and exact joins

- [Canadian model overview](https://www.vw.ca/en/models/new-vehicles.html)
- [Canadian build selector](https://www.vw.ca/en/configurator.html)
- [Public client/service configuration](https://www.vw.ca/en.global-config.json)
- [Canadian buyer's-guide index](https://www.vw.ca/en/buyers-guides.html)

Both overview pages publish percent-encoded JSON under the
`x-feature-hub/serialized-states` script type. The importer decodes JSON, then the
feature app's `modelOverviewResult`, without executing remote JavaScript. The
source URL must establish CA, CAD and English on the reviewed model-overview
service. Displayed models/trims reconcile against independently declared
`modelStructure.modelElements` references and their hierarchy.

The overview is broader than the online build selector. It retains listed 2026
Taos, Jetta and GLI while online configuration is disabled. Using only the build
selector would lose those factory references. Every listed trim's entire
`data.engines` array is used; the GLI includes manual and automatic models.
Reference/default models are not substituted for all engines.

The public configurator client calls the following read-only resource:

    https://oneapi.volkswagen.com/viso/catalogue/models

The `tenant` must be `ihdcc-vw-ca-en` for VW passenger-car catalogue entries or
`ihdcc-vwn-ca-en` for the ID. Buzz. Other parameters are exact `carlineKey`,
`salesgroupKey`, `modelFilters=EquipmentLine:{trimId}`, with price, technical,
WLTP and mandatory-data flags enabled. The public client identifier from VW's
published service configuration is used only during explicit refreshes. It is
not a private/user credential and is not copied into the tracked snapshot.

Every catalogue model must match an overview engine's carline, salesgroup,
equipment line, full model code, year and version. The complete sets must agree.
Encoded package codes remain part of the model identity, including
`DA1RPT$MAAUE40$GPS1PS1$GWO1WO1` for the Golf R Black Edition. A new year or model
with the same base code cannot silently replace the requested configuration.

## MSRP and regional prices

The configurator uses the catalogue model's CAD `prices[type=price]` as its model
base price. `vatIncluded=false` is required. The Canadian page's legal definition
explicitly excludes taxes, freight/PDI, levies, fees and optional equipment from
MSRP. Exactly one eligible model price is required; missing or ambiguous prices
remain null. A package already encoded in a factory model identifier is included
once in that model price, rather than priced as a separate surcharge.

Examples are $37,495 for 2026 Tiguan Trendline, $35,395 for either 2026 Jetta GLI
transmission, $51,995 for Golf R and $54,595 for its Black Edition. The ID. Buzz
RWD/AWD model prices are $77,495/$82,995. Public regional display prices can include
freight, levies, dealer charges and incentives; captured ID. Buzz regional amounts
were substantially below base MSRP. They are not used as MSRP, and apparent fee
subtraction cannot recover an undiscounted model price reliably.

The exact model's API source receipt is retained. User-facing source links point
to the official configurator with exact model/year/version and trim parameters;
no public-client header value is put into those links. Stock, dealer fees, optional colours and purchase eligibility remain separate from catalog MSRP.

## Technical data and passenger scope

The snapshot preserves the source's relevant technical group, description,
display value and underlying raw values. Full original responses remain in the
checksum cache. Published display units control interpretation; unlabelled
engine-power filters whose internal name says PS are not treated as hp. Explicit
hp and kW remain distinct, and engine/motor ratings are not summed.

The GLI manual publishes 8.1 L/100km combined versus the automatic's 8.2. Both
factory identities and their exact fields are preserved. A fuel display such as
`7,6 l/100km` is a decimal-comma value; `1,853 mm` uses a thousands separator.
Unsupported units, alternatives and malformed numbers remain unknown.

Roof-qualified headroom values are not selected by default. If with/without-roof
values differ, the metric remains unverified with both source values. An equal
value across alternatives can be used. Width specifically excludes mirrors.
Cargo behind the third row means all seats upright for three-row vehicles;
volume behind the first row retains folding/removal caveats.

VW places the ID. Buzz in its internal commercial catalogue. Its exact technical
data establish seven seats for RWD and six for AWD, so both remain in passenger
scope. The internal category is not a cargo-only exclusion. RWD publishes 25.3
kWh/100km and 377 km range, with 282 hp explicitly stated. AWD publishes its own
26.1 kWh/100km, 372 km and 335 hp. Several AC charger powers have different times;
the comparison leaves recharge time unknown until a power is specified, and does
not substitute a DC fast-charge or standard-outlet time.

## Remaining coverage and reproducibility

The current 2026 Atlas overview card is virtual and supplies no trim/engine
references. The importer records a gap instead of inventing a default model or
trusting the virtual card's inconsistent electric flag. SUVW-family and
previous-model navigation cards are not retail configurations. ID.4 and other
models absent from the current overview still require retail/current-new-stock
reconciliation. Additional factory equipment, roof choices, optional seating and
older new inventory remain open; these checks do not establish full VW coverage.

Refresh with `npm run catalog:sync:volkswagen`. `-- --offline` verifies every
consumed SHA256, rebuilds the snapshot and preserves its original date. Reviewed
captures can be imported with `-- --from-captures <manifest.json>`. Required
request or identity failures prevent replacement. Raw bytes and the capture
manifest stay under ignored `data/raw/volkswagen/`; normalized records and source
receipts are tracked. The application/build uses that snapshot without runtime
manufacturer requests. The coverage report retains virtual-family, ambiguous
measurement and additional configuration/inventory gaps.
