# BMW Canadian factory and observed new-stock contract

Reviewed 2026-10-22. The import adds 110 exact Canadian retail model/year profiles
across 2025–2027, including older new stock outside the current ordering tree.
107 have verified factory RRP; 59 have configured technical joins. This is not
full BMW ordering, equipment, transmission or exhaustive inventory coverage.

## Canadian sources and explicit years

The [BMW Canada model overview](https://www.bmw.ca/en/all-models.html) contains 55
cards: 53 vehicle references and two concept cards. Its published configurator
links lead to `configure.bmw.ca/en_CA/`. The shell links its public versioned
settings, which establish Canada, CAD, en-CA, service endpoints and the anonymous
client headers used for public vehicle data. Header values are read at refresh
time and are not stored in the normalized snapshot or committed source.

The official client merges both `bmwCar` and `bmwi` vehicle trees at
`https://prod.ucp.bmw.cloud`. The capture has 49 distinct current codes after
duplicate marketing-series references merge. Model/AG codes, names, body and
drive metadata must match before joining factory data. BMW i uses its separately
declared service brand; a failure in the other brand is not missing pricing.

The [official new-inventory page](https://www.bmw.ca/en/ssl/InventorySearch.html)
embeds the [national inventory provider](https://inventory.bmw.ca/en/NewInventorySearch?site=bmw.ca).
Its read-only search requests specify BMW, status N, include vehicles without an
offer and leave province/series/engine/year/price filters empty. Explicit
`ModelYear`, `VGCode`, `AGCode`, model name and transmission establish identities.
Model years are never inferred from code prefixes or replaced with a default year.

The capture retrieves all 196 reported 48-record pages: 9,386 rows, containing
8,970 distinct vehicle identities and 110 model/year/AG groups. Repeated page
identities leave exhaustive inventory coverage unproven; the coverage report
retains that gap. VINs are used only for local source reconciliation and are not
part of the normalized public catalog. Older observed offerings remain included.

Six current tree references lack an exact observed year mapping and remain
explicit gaps: 230i xDrive Coupe, 330 xDrive Sedan, i3 50 xDrive, XM Label,
iX4 50 xDrive and X5 40 xDrive. Overview AG-code placeholders, unmatched older
references and future models also require reconciliation. Concept cards do not
establish retail availability. Neither tree counts nor rating records prove the
full Canadian market is covered.

## Resolved equipment, RRP and transmission

The public rule solver receives the exact Canadian VG code, source date and
mandatory paint/rim/fabric classes. A successful response must be constructible,
retain the exact VG identity and reconcile each selected option code. Classified
transmission and 48 V fields take precedence over placeholder vehicle-tree
transmission entries. The published gear-selector choices are requested and
duplicate resulting transmissions merge. Further choices and equipment packages
still require expansion; older M2 stock, for example, lists manual and automatic
transmissions while its current ordering response is unavailable.

Pricing uses the public-calculation endpoint, not the internal/dealer retail
calculation. The response must explicitly establish CAD and `RRP_NET` for the
model and options, match the model code and have no invalid or undefined price
inputs. Base MSRP is the MODEL net list price plus its separately selected
transmission option when needed. Default paint, discretionary options,
freight/PDI, dealer charges, levies, taxes and incentives are excluded. The
Alberta fee context is separate from vehicle RRP.

The 2027 228 xDrive Gran Coupe Essential Edition is $50,900 before charges; the
same calculation's $55,095 gross amount is not substituted. The 2026 M340i xDrive
Sedan is $74,500, the 2027 iX3 50 xDrive $75,900 and the 2026 iX xDrive45 $89,900.
The BMW i service namespace is required for the latter.

51 profiles have unavailable current ordering data. Where a valid exact-SKU base
RRP remains published, the catalog retains that bare-model price with ordering
and transmission-option uncertainty visible. This does not price unverified
manual/automatic or equipment combinations. Three prices remain unknown: 2025
530i xDrive Sedan, X2 xDrive28i and 760i xDrive Sedan. Dealer/supplier base-price
fields can disagree and are not used as a factory-price fallback.

## Technical basis and unresolved fields

Configured technical requests use the exact AG code and canonical sorted options
from the verified Canadian solver response. The official Canadian client uses a
technical `countryGroup` named `us`; this does not establish Canadian fuel-cycle
or electric-mode equivalence. Unresolved consumption, range, charging modes,
headroom/legroom and cargo arrangements remain unknown. Older models without
exact solver evidence do not inherit another year's technical data.

Combined power uses the explicit manufacturer `C_LEIST_GES_KOMM_BHP` field.
Metric PS, engine-only hp, continuous motor ratings and separately rated motors
are not converted or summed. The M340i's classified 48 V system establishes a
mild hybrid and 386 combined BHP, distinct from its 375 engine-only hp. Electric,
plug-in and mild-hybrid identities stay separate. Stock gasoline codes without
an established hybrid subtype retain a gasoline/hybrid uncertainty label.

Metric dimensions must be positive and agree with imperial pairs when present.
Published width includes mirrors. Zero placeholders are not measurements.
Seating uses the exact resolved count. A generic luggage volume does not become
seats-up/down cargo without arrangement evidence. Gran Coupe body classification
uses the verified model family rather than treating every marketing coupe as a
two-door coupe.

## Reproduction

`npm run catalog:capture:bmw-stock` uses the installed Playwright Chromium runtime
to read the normal public inventory session. Its anti-forgery header and cookies
are used only in that anonymous browser session and are not saved in the catalog.
`BMW_STOCK_CAPTURE_DIR` optionally selects the local capture directory. Reported
page totals must stay consistent; a changing capture fails before replacing its
manifest. Repeated identities are retained as an explicit coverage gap.

`npm run catalog:sync:bmw` refreshes public factory data using a same-date reviewed
stock capture. `-- --offline` verifies original request/response hashes and exact
snapshot reconstruction; `-- --from-captures <manifest.json>` imports reviewed
captures without advancing their date. Raw data stays under ignored
`data/raw/bmw/`, with stock bytes under `stock/`. Required source, country, model,
price-schema, checksum and catalog-adapter failures prevent replacement. A dated
unsupported ordering/price response remains a recorded gap only for the reviewed
manufacturer model/timeslice and configuration-conflict error codes. Access,
rate-limit, server and unrelated failures abort the refresh. Ordinary builds
and the running app use the normalized snapshot with no manufacturer requests.
