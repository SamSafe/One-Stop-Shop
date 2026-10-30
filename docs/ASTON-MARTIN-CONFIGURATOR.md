# Aston Martin Canadian public listings

The October 30, 2026 UTC capture uses the anonymous production configurator's
Canada selector. `/data/api/country-list` includes `CA` and
`/models/products/CA` returns 16 products. Product IDs and model codes join the
English `DERIVATIVE_SELECTION` and `STANDARD_LIST` entries. These are listings,
not accepted orders, quotations or confirmed allocations.

Ten products enter the app as `manufacturer-offer` records with `year=null`:
Valhalla, Valhalla Spider, Vanquish Coupe/Volante, DBX GT/S, DB12 S Coupe/Volante and Vantage S
Coupe/Roadster. The menu and the anonymous Canadian configuration responses
publish neither model year nor price. Current calendar dates, image paths,
product codes and first-delivery dates do not establish a model year. Global
or dealer prices do not become base CAD MSRP.

The production client declares five products stock-only: AM617 Vantage Coupe,
AM647 Vantage Roadster, AM546A DB12 Volante, AM576A DB12 Coupe and AM890 DBX707.
They remain in the source reconciliation but are withheld from current-offer
rows pending qualifying Canadian new-stock evidence. This does not establish
that they are unavailable. Valen, AM390, is also withheld: its manufacturer
announcement schedules first deliveries for Q2 2027. A current allocation and
Canadian offering still require verification; 2027 is not inferred as its model
year.

Menu `POWER.VALUE[0]` is imported only with `POWER.UNIT[0]=bhp`. PS is not copied
as horsepower. Product-specific standard seating supplies eight of the ten
offerings; Valhalla and Valhalla Spider seating remain unknown in this capture.
The linked Valhalla manufacturer page explicitly establishes its plug-in hybrid
category. The Valhalla Spider's own page lists a hybrid powertrain but does not
mention plug-in charging, so it is recorded as a hybrid; the coupe's category is
not copied to it. No WLTP
economy/range, Chinese regional specification, alternative federal dimension or
unknown-year Canadian government rating is substituted. Other metrics retain
explicit unknown reasons.

The public application makes a configuration GET with a serialized DRL selection
and `country=CA`. Ten such responses, including the withheld Valen, were captured.
These establish anonymous Canadian configuration access, not a base-equipment
or package universe. Ephemeral response session/configuration identifiers stay
in the ignored raw cache; they are not copied into the tracked snapshot.
No lead, saved build, account, reservation or order was submitted.

## Refresh and source checks

Run `npm run catalog:sync:aston-martin`. Builds use the tracked factual snapshot
and never require manufacturer network access. `-- --offline` reconstructs it
exactly from checksummed raw captures and preserves their original dates.
`-- --from-captures path/to/manifest.json` supports a reviewed capture set.

The capture contains 18 successful receipts, each with URL, SHA-256 and original
capture time. The latest is 2026-10-26T05:08:12.183Z. Source bytes live under the
ignored `data/raw/aston-martin` directory; the tracked snapshot retains only
receipt metadata, factual identities and numeric/short-label projections.

The reviewed public core client is `chunk-2CDO63CM.js`, SHA-256
`bf2f53c7882fdd40fd58e611039361d2d759366e575ad886fe828a608c1d2bb6`.
Its entry client is `main-7MUIX7YT.js`, SHA-256
`42d8513879174ad26d082eb3caebd154ea8dc447a8aad859c5cc7471318adb82`.
They replaced `chunk-BTNBP6WG.js` and `main-REOVSZF3.js` in a 30 October rebuild
that renamed minified identifiers; the stock-only product list and the
configuration, patch and product request templates are unchanged.
Changed production bootstrap or clients, unreviewed identities, duplicate/missing joins, non-public
products, absent Canada, new price/year fields or changed delivery qualification
require review. The importer verifies all bytes before atomically replacing the
snapshot, checks capture dates and prevents silent loss of reviewed coverage.

Exact model years, base MSRP, factory equipment combinations, current/older new
stock, allocations, independent national lineup checks and remaining technical
facts are open. This milestone does not establish complete Aston Martin or
Canadian-market coverage.
