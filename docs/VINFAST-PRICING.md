# VinFast Canadian public pricing

The public Canadian lineup lists VF 8 and VF 9 with ECO and PLUS price cards.
The required sources were captured on October 26, 2026 UTC (October 25 in
Edmonton), from 00:26:11.127Z through 00:26:19.341Z. Original timestamps, response
hashes, source URLs and public province preferences remain in the tracked
snapshot. Ordinary application builds use that snapshot without network access.

## Sources and regional context

- [Canadian lineup](https://vinfastauto.ca/en)
- [VF 8 pricing](https://vinfastauto.ca/en/vehicles/vf-8)
- [VF 9 pricing](https://vinfastauto.ca/en/vehicles/vf-9)
- The site's `vinfast_price.js` public province selector is pinned by URL and
  checksum. It sets the anonymous `province` preference to BC, ON or QC and
  reloads the page. No account/session credential is supplied or stored.

All six model/province pages must contain both trim cards and matching regional
terms. The parser scopes `block-offer`, joins exact model/trim terms IDs and
separates explicit MSRP from all-in prices. Header/navigation defaults are not
used as regional pricing. All three provinces agree on MSRP:

| Offer     | MSRP CAD | Model year established |
| --------- | -------: | ---------------------- |
| VF 8 ECO  |   54,490 | Unverified             |
| VF 8 PLUS |   61,490 | Unverified             |
| VF 9 ECO  |   74,890 | 2024                   |
| VF 9 PLUS |   78,890 | Unverified             |

The VF 9 ECO cash terms explicitly identify a new, previously unregistered 2024
vehicle and reconcile both MSRP and the province's all-in amount. They contain
no dated expiry. This establishes a dated manufacturer offering, not a physical
stock count, clean title inspection, accepted order or delivery promise.

The other cards have no matching current year-qualified cash terms. VF 8 ECO's
current lease example omits a model year; historical 2024 examples for VF 8 PLUS
and VF 9 PLUS have expired. A model year in a range footnote, image path, product
identifier or copyright is not an exact current price-to-year join. These three
records therefore use `manufacturer-offer`, `year: null` and a visible explanation.
Their stable IDs can survive a later verified year assignment.

MSRP excludes fees, freight/PDI, taxes, options and incentives. VF 9 ECO's all-in
amount varies by province (77,310 BC; 77,321 ON; 77,308 QC). Those amounts and
conditional finance/lease credits are never substituted for base MSRP. They are
retained in the source snapshot, without asserting an exact-year all-inclusive
price for every card. Technical tables contain preliminary/projected values,
other model-year references and partial charging intervals. Those are not
promoted into exact-year drivetrain, seating, dimensions, range, consumption or
full-recharge facts. Unknowns retain explanations.

## Refresh and validation

Run `npm run catalog:sync:vinfast` for a live refresh, or append `-- --offline` for
exact reconstruction from checksum-verified ignored raw captures in
`data/raw/vinfast`. A reviewed capture can use
`-- --from-captures <manifest.json>`. Offline mode preserves the original source
dates. A live refresh follows only the official root pages and the public
province preference; it does not log in, submit an order or create a reservation.

The importer rejects required HTTP failures/redirects, changed client code,
missing or duplicated pages/trims, mismatched region/model/terms IDs, incompatible
regional MSRP/year contexts, unsupported prices, invented years without matching
cash evidence, changed dated cash eligibility and a capture window over 24 hours.
Replacement is atomic. Refreshes cannot run backwards or silently lose a current
model/trim or previously established model year. Changed or removed offerings
require explicit reconciliation with remaining new vehicles before replacement.
The HTML parser never executes source scripts.

## Remaining coverage

Published shop product and province-selected fresh-order GET links redirected
anonymous visitors to login during the October 23 access review. No account,
order, reservation or lead was submitted, and the boundary was not bypassed.
The October 26 positive pricing refresh does not redate that access observation.
The public pricing pages remain usable; a login redirect is not evidence that
Canadian offerings do not exist. Ordering outside BC/ON/QC uses a reservation
flow in the reviewed public client, rather than establishing the same retail
order acceptance or regional price scope.

All three unverified model years, factory equipment combinations, exact technical
facts, current/older new stock and independent national offering checks remain
open. Four public price cards do not establish complete VinFast or Canadian
market coverage. The report keeps the full-market gate false and counts
year-unverified offers separately from year-qualified configurations.
