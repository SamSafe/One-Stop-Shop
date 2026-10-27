# Canadian owner-vehicle directory

The garage identifies older owned vehicles independently of the current comparison catalog. It is not a used-vehicle listing database, a VIN decoder, or proof of current sale availability.

## Coverage and sources

The reviewed snapshot combines six English Natural Resources Canada CSV resources from the [Fuel consumption ratings dataset](https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64): adjusted 1995–2014 ratings, 2015–2024 ratings, 2025 ratings, 2026 ratings, battery-electric 2012–2026 records, and plug-in hybrid 2012–2026 records. The original two-cycle 1995–2014 resource is excluded. These data are available under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).

Only identity and engine/transmission/fuel descriptions are retained. Historical consumption figures and prices are not added to the shopping catalog. Current year-qualified retail records supply additional configuration choices through their existing catalog IDs; every join validates the model year, make and model. Matching display case can be normalized without collapsing distinct model names or bodies.

The snapshot has 20,426 model-year entries across 1995–2027 and 66 makes. It parses 30,886 published rating rows and offers 34,389 deduplicated powertrain or existing retail-configuration choices. These are not 20,426 distinct current models or a complete history of Canadian retail trims. Unrated vehicles, some trims, older years and special equipment remain outside lookup coverage. Manual entry remains available.

The 2016 Elantra has published Nu 1.8/2.0 engine and automatic/manual choices. Those ratings do not establish the GL trim or a U.S. equivalent. Owners can leave the configuration unknown or enter their Canadian trim as their own information. Manufacturer maintenance guidance is matched separately; identifying a model does not claim its complete maintenance schedule has been reviewed.

## Integrity and delivery

Every CSV has a canonical publisher URL, captured timestamp, byte count and SHA-256 receipt. The reviewed 2025 CSV is Windows-1252; its decoder exception is pinned to its exact checksum. Other files require valid UTF-8. CSV quoting and source columns are checked. CVT simulated gears remain distinct from actual fixed-speed transmissions.

The source snapshot lives in `packages/car-catalog/data/owner-directory.json`. Build preparation validates it against the catalog, then emits a losslessly packed hashed asset. It is approximately 1.34 MB raw / 192 kB gzip and loads only when the owner opens the vehicle finder. The comparison catalog is not required for this lookup. Source binaries and ephemeral download redirect query strings are not bundled or committed.

## Refresh and replay

    npm run garage:capture:directory
    npm run garage:sync:directory
    npm run garage:sync:directory -- --offline

Capture uses the ordinary public publisher redirects, bounds response sizes, and requires the six reviewed English resources. New resource identities require review. Sync checks exact source bytes, validates identities and catalog references, and replaces the normalized snapshot atomically. Review dates derive from source capture timestamps in the client’s Canadian timezone, not from a later offline replay. The offline command checks exact reconstruction using retained source files.

The directory supplies selection choices. It does not infer an odometer, service completion, ownership, exact equipment or a maintenance deadline.
