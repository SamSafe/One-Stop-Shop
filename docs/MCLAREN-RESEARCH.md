# McLaren Canadian factory identities

The October 26, 2026 UTC import adds five explicit 2027 Canadian factory
profiles: Artura Coupe/Spider, 750S Coupe/Spider and GTS. McLaren is absent
from the current NRCan snapshot. These records expand the catalog to 48 makes;
they do not establish complete Canadian McLaren or national market coverage.

The public configurator accepts Canada for all five. Its ordinary General
response explicitly supplies `CH_GEN_COUNTRY=CA`, `CH_GEN_MODEL_YEAR=2027`,
model family P16/P28/P22S, body COUPE/SPIDER/GT and the hybrid classification.
The named model-year field is delivered to the normal public browser, although
it is not displayed in the summary. Neither a copyright date, image name,
product code nor dealer inventory supplies this factory model year. Initial
profile metadata must match the model, country and English language and confirm
public access.

Canadian `webui.showPriceSummary` and `webui.showPricesByCountry` flags are
false. The loaded defaults can include optional equipment and selected packs;
they are not represented as bare models with zero-cost equipment. Base MSRP,
transmission and numerical specifications remain unknown with reasons. Current
global model pages publish power and EU WLTP values without an exact Canadian
year/equipment qualification; those figures are not copied into these records.
Road-going Artura profiles retain their plug-in hybrid category; racing models
are excluded from this passenger-vehicle import.

## Source replay and refresh

Run `npm run catalog:sync:mclaren`. It invokes the anonymous public browser
capture, verifies 18 source receipts and atomically replaces the factual
snapshot only after every model, country, year and source join validates.
`-- --offline` exactly reconstructs the snapshot from the original checksummed
raw responses and preserves their dates. `-- --from-captures path/to/manifest.json`
imports a reviewed capture set. Ordinary builds use the tracked snapshot and
never contact a manufacturer.

`npm run catalog:capture:mclaren` collects a review manifest without replacing
the accepted snapshot or its replay manifest. A normal browser loads the public
manufacturer navigation, chooses Canada and opens each Configure from Base
Model flow. Capture stops after identity responses, before the 3D preview is
needed. No lead, saved build, account, reservation or order is submitted.
Original responses and ephemeral session data remain in the ignored raw cache;
the tracked snapshot retains receipt metadata and factual identities.

The bootstrap currently references `/mclaren-ui/assets/index-BNg9rp8r.js`,
SHA-256 `c75be33d5426536b2150de6d8512d239ad652816ccfe7272561dc9827ceb038f`. It
replaced `index-8XucOWk-.js` on 30 October; the configuration endpoints and
price-display flags are unchanged, and the refreshed capture reproduced every
profile's facts.
Changed bootstrap/client, country restrictions, private access, profile aliases,
price-display flags, missing/ambiguous model-year fields, stale captures and
lost model/year coverage require review. A year advance requires older-new-stock
reconciliation before replacing the accepted snapshot.

## Remaining coverage

The manufacturer navigation also lists 788HS, 788HS Spider and W1 without a
Canadian public configuration link. Their current Canadian offerings and
allocations remain unverified. Motorsport categories do not enter this catalog.

Toronto's separately captured new inventory lists two 2027 750S Spider vehicles
and one 2026 GTS, with pricing on request. The 2026 stock observation is not
assigned to the current 2027 GTS factory profile. Exact older-year trims,
equipment, base MSRP and national stock remain open. The matching franchise
dealer and manufacturer retailer page are documented in the
[additional-make ledger](canadian-market-universe.json).

Further public tab inspection found Artura Performance and TechLux interiors
and selected equipment packs. Other tab captures encountered the manufacturer's
3D GPU error overlay. Alternate configurations remain unresolved; that error
does not establish unavailable equipment. Independent national lineup checks,
all retail trims, exact technical facts, limited/special models, allocations
and current/older new stock remain within the goal.

The subsequent October 26 stock-page captures also show 2026 Artura Spider
and 750S Spider headings in Montreal, 2025 Artura/GTS cards in Vancouver and
a 2026 750S card in Quebec City. Names retain their published specificity;
exact trim/body, equipment, new/unregistered condition and price basis still
require detail-page reconciliation. The ledger retains their original checksums
and capture times. These observations are not promoted to the 2027 profiles or
used as a national inventory count.
