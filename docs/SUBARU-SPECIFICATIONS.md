# Subaru exact-trim specifications — 27 October 2026

The current Canadian lineup, pricing and specification captures reconcile 41
factory configurations across nine models. Specification cells are joined by
manufacturer CarID and checked against the lineup's model code and model year.
Column position, sibling trims and optional equipment do not establish facts.

| Model       | Year | Columns | Official specification page                                                                    |
| ----------- | ---: | ------: | ---------------------------------------------------------------------------------------------- |
| Forester    | 2026 |       6 | [Subaru Canada](https://m.subaru.ca/WebPage.aspx?WebSiteID=282&WebPageID=26168&ModelYear=2026) |
| Impreza     | 2026 |       3 | [Subaru Canada](https://m.subaru.ca/WebPage.aspx?WebSiteID=282&WebPageID=26281&ModelYear=2026) |
| Outback     | 2026 |       4 | [Subaru Canada](https://m.subaru.ca/WebPage.aspx?WebSiteID=282&WebPageID=25921&ModelYear=2026) |
| WRX         | 2026 |       5 | [Subaru Canada](https://m.subaru.ca/WebPage.aspx?WebSiteID=282&WebPageID=26432&ModelYear=2026) |
| BRZ         | 2027 |       4 | [Subaru Canada](https://m.subaru.ca/WebPage.aspx?WebSiteID=282&WebPageID=26729&ModelYear=2027) |
| Crosstrek   | 2027 |       6 | [Subaru Canada](https://m.subaru.ca/WebPage.aspx?WebSiteID=282&WebPageID=26859&ModelYear=2027) |
| Solterra    | 2027 |       6 | [Subaru Canada](https://m.subaru.ca/WebPage.aspx?WebSiteID=282&WebPageID=26625&ModelYear=2027) |
| Trailseeker | 2027 |       3 | [Subaru Canada](https://m.subaru.ca/WebPage.aspx?WebSiteID=282&WebPageID=26677&ModelYear=2027) |
| Uncharted   | 2027 |       4 | [Subaru Canada](https://m.subaru.ca/WebPage.aspx?WebSiteID=282&WebPageID=26573&ModelYear=2027) |

The refreshed [national lineup](https://www.subaru.ca/WebPage.aspx?WebPageID=16564)
adds the 2027 BRZ 輝 Kagayaki Edition, CarID 1625/model code VVMSE. Its explicit
[base MSRP is $39,995 CAD](https://m.subaru.ca/WebPage.aspx?WebSiteID=282&WebPageID=26732&ModelYear=2027&CarID=1625).
All previous 40 configuration IDs and base prices remain unchanged. These are
dated manufacturer listings, without an exhaustive dealer-stock or delivery claim.

## Imported facts and conventions

The importer selects explicitly labelled dimensions, front/rear headroom and
legroom, seats-up/folded cargo, city/highway fuel figures, standard powertrain
evidence, maximum/peak horsepower and manufacturer up-to electric range.
Only a row explicitly labelled body width supplies width. Roof-related cargo
differences stay attached to their exact trim. Separate motor outputs are not
added, and optional/unavailable powertrain rows cannot become standard facts.

Up-to range carries structured `qualifier: "up-to"` metadata. Cards and comparison
tables show “Up to” even when notes are hidden; differently qualified values are
not hidden as matching specifications. No consumption is calculated from range
or battery capacity. Electric consumption remains unknown where the captured
table publishes no kWh/100 km figure.

## Reviewed government joins

The audit adds 18 explicit Subaru joins to the existing five retail links and
24 Honda joins, giving 47 rated retail configurations overall. Each Subaru link
pins captured standard engine, cylinder-layout, transmission and drivetrain
labels; exact year/model/fuel identity; engine size/cylinders; rating fuel type;
and matching city/highway figures. CVT, manual and automatic transmission types
must agree. Combined consumption is supplied only by that reviewed government
record; it is never calculated from the manufacturer's city/highway figures.

Known manufacturer facts retain their provenance. The existing NRCan snapshot
and review dates remain unchanged. Previously exposed standalone rating IDs
remain available, including when several retail trims share one rating. Existing
curated Forester IDs are preserved.

## Explicit source gaps

- WRX GT, CarID 1595: the automatic city metric/imperial cells are 9.4 L/100 km
  and 12.7 MPG; the highway cells are 30 L/100 km and 22 MPG. Both pairs conflict
  under the [NRCan imperial conversion](https://natural-resources.canada.ca/energy-efficiency/transportation-energy-efficiency/personal-vehicles/understanding-tables).
  Both fuel figures remain unknown with a source-conflict explanation. Values
  are not swapped or converted into replacement ratings; no rating is joined.
- Outback Touring, CarID 1582: the exact cylinder-layout row is marked unavailable,
  while its engine is marked standard. City/highway values are retained, but a
  government join and combined consumption remain withheld pending reconciliation.
- Subaru EVs remain unscored under the default energy-cost priority because no
  electric consumption was verified. Hybrid Crosstrek joins remain unreviewed.
- Current manufacturer listing coverage does not establish remaining older new
  stock, every equipment combination or complete Canadian market coverage.

## Refresh and validation

Run `npm run catalog:sync:subaru` to refresh lineup/pricing, then
`npm run catalog:sync:subaru-specifications` for all specification pages. The
specification command stores raw responses under ignored
`data/raw/subaru-specifications/`, with requested/returned URLs and SHA-256
receipts in the checked-in normalized snapshot. It validates every model and
trim column before replacing the normalized file. The specification command
alone does not refresh pricing or lineup receipts.

Review changed evidence and audited links before building. Missing models,
changed model codes, redirect identities, duplicate/missing cells and changed
known facts fail validation. Run `npm run catalog:coverage`, `npm run check` and
the browser suite; the coverage report includes the unresolved source conflicts.
