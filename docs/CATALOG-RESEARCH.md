# Canadian launch catalog research

Verified **2026-10-20** for **Canada**, model year **2026**. These are native Canadian manufacturer/NRCan values, not conversions from US data. Prices are **CAD base MSRP**, before freight/PDI, taxes, registration, dealer fees, levies, paint, accessories, and packages. Coverage is a curated sample.

## Verified values

| Field | Honda CR-V LX 2WD | Honda CR-V Sport Hybrid AWD | Subaru Forester Convenience AWD | Subaru Forester Touring AWD | Mazda CX-5 GX AWD |
| --- | ---: | ---: | ---: | ---: | ---: |
| Base MSRP, CAD | 36,975 | 45,900 | 34,195 | 39,195 | 36,300 |
| City, L/100 km | 8.4 | 6.0 | 9.1 | 9.1 | 9.9 |
| Highway, L/100 km | 7.1 | 6.9 | 7.2 | 7.2 | 7.9 |
| Combined, L/100 km | 7.8 | 6.4 | 8.3 | 8.3 | 9.0 |
| Horsepower | 190 | 204 system | 180 | 180 | 187 |
| Seats | 5 | 5 | 5 | 5 | 5 |
| Cargo, rear seats up, L | 1,113 | 1,028 | 838 | 779 | 954 |
| Cargo, rear seats down, L | 2,166 | 2,030 | 2,107 | 1,957 | 1,882 |
| Front headroom, mm | 1,016 | 970 | 1,047 | 1,016 | 1,007 |
| Rear headroom, mm | 970 | 970 | 1,006 | 957 | 1,020 |
| Front legroom, mm | 1,049 | 1,049 | 1,101 | 1,101 | 1,058 |
| Rear legroom, mm | 1,042 | 1,042 | 1,000 | 1,000 | 1,012 |
| Length, mm | 4,695 | 4,695 | 4,655 | 4,655 | 4,690 |
| Published width, mm | 2,150 | 2,150 | 1,830 body | 1,830 body | 1,892 mirrors folded |
| Height, mm | 1,680 | 1,690 | 1,730 | 1,730 | 1,690 without antenna |
| Drivetrain | FWD | AWD | AWD | AWD | AWD |

Width conventions differ. Honda's Canadian PDF labels width without specifying mirror position. Subaru also publishes **2,063 mm with mirrors extended**; Mazda publishes **2,077 mm with mirrors in driving position**. Keep each width's method visible; these cannot guarantee garage clearance.

The Mazda alternative is intentional: the [Canadian CX-50 page](https://www.mazda.ca/en/vehicles/cx-50/specifications/) researched on the verification date identified a **sold-out 2025** model. A Canadian 2026 GS-L offering was not established. The current **2026 CX-5 GX AWD** has complete Canadian evidence. No US 2026 CX-50 values were reused.

## Source register and field mapping

All retrieved **2026-10-20**. Undated sources have `publishedAt: null`. Retrieval is not a claimed price effective date.

| Source ID | Official source | Published / updated | Fields and locator |
| --- | --- | --- | --- |
| `honda-ca-2026-crv-specs` | [Honda Canada specifications, version 4](https://www.honda.ca/-/media/Brands/Honda/Models/CR-V/2026/PDF/2026-Honda-CR-V-Specifications---EN_v4.pdf?rev=c1a5cb87c6f74a0e9a7e0edf3a58ea2b) | Undated | LX and Sport Hybrid columns: p. 1 horsepower/system horsepower, drivetrain, fuel; p. 3 seats; p. 4 exterior/interior dimensions and cargo. Select LX FWD values where drivetrain variants differ. |
| `honda-ca-2026-crv-pricing` | [Honda Canada pricing announcement](https://hondanews.ca/en-CA/releases/release-04150531cb93adf566aca863300f8f08-rugged-electrified-and-refreshed-best-selling-honda-cr-v-hybrid-gains-new-trailsport-hybrid-trim-and-more-standard-tech) | 2025-05-28 | Pricing & Fuel Economy table, LX (2WD) and Sport Hybrid (AWD), MSRP column; footnotes 1–3. |
| `subaru-ca-2026-forester-specs` | [Subaru Canada specifications](https://www.subaru.ca/WebPage.aspx?ModelYear=2026&Range=Forester&WebPageID=26168&WebSiteID=282) | Undated | Convenience car ID 1562; Touring ID 1563. Engine output; Transmission/Drivetrain; Seating capacity; Measurements: Cargo Area, Interior, Exterior, Fuel Economy. Numeric values are each `specAvail` element's `avail` attribute, associated by `carid`. |
| `subaru-ca-2026-forester-pricing` | [Subaru Canada pricing](https://www.subaru.ca/WebPage.aspx?CarID=1562&ModelYear=2026&Range=Forester&WebPageID=26171&WebSiteID=282) | Undated | Embedded model data: Convenience 1562/TJACP transmission MSRP 34195; Touring 1563/TJATP transmission MSRP 39195. Use base MSRP, not displayed vehicle price with freight/fees. |
| `mazda-ca-2026-cx5-specs` | [Mazda Canada specifications](https://prod.mazda.ca/en/vehicles/cx-5/specifications/?trim=NXXL86%2AA00) | Undated | GX column, Specifications and Capacities: horsepower, fuel, exterior/interior dimensions, seating and cargo. Engineering Features: standard i-Activ AWD. Headroom without panoramic roof; height without antenna. |
| `mazda-ca-2026-cx5-pricing` | [Mazda Canada pricing announcement](https://en.media.mazda.ca/2026-01-13-Mazda-Announces-Pricing-and-Packaging-for-All-New-2026-CX-5) | 2026-01-13 | Starting MSRP table, CX-5 GX; footnote 2 for freight/PDE exclusion. |
| `nrcan-2026-fuel` | [Official fuel-consumption CSV](https://open.canada.ca/data/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64/resource/9df1b18d-d036-4783-a61c-99f1f75b3ac5/download/my2026-fuel-consumption-ratings.csv), [dataset description](https://open.canada.ca/data/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64) | Data update 2026-10-06 | 2026 rows: Honda CR-V 1.5L/AV; Honda CR-V Hybrid AWD 2.0L/AV; Subaru Forester AWD 2.5L/AV8; Mazda CX-5 4WD (SIL) 2.5L/AS6. City/Highway/Combined L/100km columns. |

Subaru's page labels omit numeric values in some text readers. Its original HTML was checked directly, binding `carid="1562"` and `carid="1563"` to exact trims. Body width and mirror-extended width are separate fields. Canadian city/highway ratings map both trims to NRCan's Forester AWD row, which directly establishes combined consumption. No rating was calculated from rounded values.

The NRCan CSV independently agrees with all four powertrain configurations. Certification names supplement manufacturer trim identities. Actual consumption varies with use and conditions.

## Price dates and exclusions

| Configurations | `priceEffectiveAt` | Basis |
| --- | --- | --- |
| Both Honda trims | 2025-05-28 | Dated announcement MSRP. The separately listed selling price includes $2,000 freight/PDI and additional charges; use MSRP instead. |
| Both Subaru trims | null | Current official base MSRP verified 2026-10-20; exact effective date not established. Freight/PDI, taxes and other fees are extra. |
| Mazda CX-5 GX | 2026-01-13 | Dated announcement; excludes $2,195 freight/PDE, taxes, title and other fees. |

Published MSRP is a comparison input, not an on-road quote. Honda and Mazda prices are dated announcements; an undated live configurator did not reconfirm them. Dealer prices, fees and offers vary by province. Store `verifiedAt: "2026-10-20"` and each price's basis/date.

## Measurement notes

- Fuel uses Canadian **L/100 km**, where lower is better; never label it MPG.
- Cargo uses manufacturer-published litres with rear seats up/down. Canadian tables do not all establish a harmonized SAE/ISO standard. Preserve `method: "manufacturer-published; measurement standard unspecified"`.
- Headroom is trim-specific: LX/Convenience differ from moonroof-equipped Sport Hybrid/Touring. Mazda GX explicitly uses no panoramic roof.
- Hybrid horsepower is combined system output.
- Reliability, repair costs, ownership-cost predictions and maintenance intervals remain unsupported/null.
- Manufacturer hosts: `honda.ca`, `hondanews.ca`, `subaru.ca`, `mazda.ca`, `prod.mazda.ca`, `en.media.mazda.ca`. NRCan evidence: `open.canada.ca`.
- Honda PDF fuel/dimension columns were visually inspected after downloading the original. No vehicle imagery was copied into the product.
