# Fit explanations and specification review — 29 October 2026

## Behavior

Every vehicle card and comparison score cell has a **Why this fits** disclosure.
It uses the canonical ranking result for the score and each earned contribution.
It does not introduce a second scoring formula. Requirements are assessed by the
same checks used for filtering and ranking.

The disclosure identifies the active context, requirement outcomes and actual
values, each active priority's importance, source-backed value, target/scale,
earned points and maximum share. It explains excluded zero weights and dormant
body/drivetrain preferences. Missing requirements or active inputs withhold all
earned points and the total, while exposing every missing input and known value.
Failed requirements remain inspectable for vehicles already in a comparison.
Energy-price edits and brief pause/resume update open disclosures. Personal
test-drive ratings remain separate. Published horsepower does not measure
driving enjoyment.

The existing default and buying-brief scales, caps, tie-breakers and rounding are
unchanged. Displayed contributions round to one decimal; totals use the existing
unrounded contributions before whole-number rounding. No partial fit score is
invented when data is missing.

## Reviewed additions

The catalog still contains 6,083 records, including 3,544 year-qualified retail
configurations. There are now 1,360 official source records: 23 new review sources
and all 1,337 original sources. Across 100 exact configurations, this pass fills
682 previously missing numeric facts and six previously unknown drivetrains. Six
conflicting Sienna front-headroom values are withheld for checking.

| Scope                          | Configurations | New numeric facts | Qualification                                                          |
| ------------------------------ | -------------: | ----------------: | ---------------------------------------------------------------------- |
| 2026 Toyota GR86               |              4 |                16 | Front/rear headroom and legroom; excludes 2027                         |
| 2026 Toyota Sienna             |              8 |                16 | Front/second-row legroom; excludes mobility conversions                |
| 2026 Honda Civic Sedan hybrids |              2 |                 2 | 200 hp combined system output                                          |
| 2026 Toyota RAV4 Hybrid        |              7 |                35 | LE/non-LE headroom, legroom, cargo behind front row                    |
| 2025 Mazda CX-50 gasoline      |              5 |                10 | Independently reviewed cargo positions; excludes hybrids               |
| 2026/2027 Hyundai              |             74 |               603 | Reviewed model-year and trim-column mappings; six drivetrain additions |

The official PDF sources are [Toyota GR86, page 3](https://toyotacanada.scene7.com/is/content/toyotacanada/2026%20GR86%20Product%20Information%20ENpdf?bfc=off&cdh=attachment),
[Toyota Sienna, page 3](https://toyotacanada.scene7.com/is/content/toyotacanada/2026%20Sienna%20Product%20Information%20ENpdf?bfc=off&cdh=attachment),
[Honda Civic Sedan, pages 1 and 4](https://www.honda.ca/-/media/Brands/Honda/Models/CIVIC-SEDAN/2026/PDF/2026-Honda-Civic-Sedan-Specifications---EN_v2.pdf?rev=cb0b006d85c1410fb916fabf9ea46b48),
[Toyota RAV4 Hybrid, page 3](https://toyotacanada.scene7.com/is/content/toyotacanada/2026%20RAV4%20Hybrid%20Product%20Information%20ENpdf?bfc=off&cdh=attachment),
and [Mazda CX-50 gasoline, page 4](https://www.mazda.ca/globalassets/mazda-canada/en/pdf/brochures/vehicles/CX-50/2025-mazda-cx-50-specs-en.pdf).
Toyota Canada's model pages link to the reviewed Toyota CDN publications. The
allowlist adds only `media.toyota.ca` and `toyotacanada.scene7.com`.

Hyundai's public Canadian GetSpecifications endpoint supplies each of the 18
model tables. The fresh [Canadian lineup response](https://www.hyundaicanada.com/api/backendservice/buildandprice/GetShowroomsModelJson?language=en&prov=AB)
binds each model GUID to its exact name and year. Each review records the factory
configuration ID, published column and any explicit presentation mapping checked
against engine/drive information. Shared 7/8-passenger columns do not establish
the selected capacity. Only expressly labelled HEV/PHEV branches are transferred
from mixed cells. Standard 276 hp ELANTRA N and 601 hp IONIQ 5 N outputs exclude
conditional boost figures. Hybrid component outputs are not added together.

The Sienna configurator assigns 1,019 mm front headroom to non-LE packages while
the official product-information PDF assigns 968 mm. Six standard non-LE profiles
now show an unknown value, both source references and a note explaining the
conflict. Mobility packages require separate evidence and remain untouched.

Mazda's independent PDF explicitly identifies 889 L behind the rear seat back and
1,595 L behind the front seat back. Those positions resolve the withheld gasoline
CX-50 cargo facts; the original reversed API labels remain preserved in the
original snapshot. Neither hybrid cargo values nor availability flags are changed.

## Evidence and guards

`packages/car-catalog/data/reviewed-specifications.json` retains source URLs,
publication/review dates, PDF page numbers or JSON sections, capture timestamps,
byte counts and SHA-256 hashes. JSON receipts also retain the independent lineup
identity capture, model GUID, year and exact evidence locator. Field notes retain
the published row and column, units, conditions and system-versus-engine output.
Raw files remain in ignored `data/raw/reviewed-specifications/`; app builds consume
the tracked normalized supplement offline.

The overlay requires exact make, model, year, fuel, retail-record kind and record
IDs. It rejects duplicate/overlapping reviews, receipt/source mismatches, invalid
ranges, mismatched model GUIDs or years, and conflicting replacements of known
values. The six explicit numeric conflict actions additionally require the
original value and source to still match. Agreeing known facts retain their
original evidence. Drivetrain additions require an unknown original value.

Prices, rating links, original source records, original manufacturer snapshots,
record identities, availability dates and all untargeted facts are preserved.
Default price/energy fit scores are unchanged; newly verified room, cargo, power
and drivetrain facts become available to the corresponding selected priorities.

## Stopping point

All 18 Hyundai model-year identities and specification tables were checked. Six
factory profiles remain outside the reviewed column mappings: one ELANTRA Tech
package, two ELANTRA N TCR variants, one IONIQ 9 Night package and two PALISADE Night
packages. Their absent package columns do not establish applicability. Other
remaining gaps include roof-dependent alternatives, unlabelled mixed-powertrain
values, consumption/range that needs unit and exact-rating reconciliation,
2027 GR86 interior measurements and Sienna mobility-conversion interiors. Mazda
fuel-grade-dependent power still requires an explicit condition model. Further
copying would require assumptions; this data pass stops here. This is a targeted
review, not a claim of complete Canadian-market or live-inventory coverage.

## Validation

- The final `npm run check` passes all 415 unit cases across 43 files, package
  boundaries, catalog validation, TypeScript and the production build.
- The full regression checkpoint passes 556 distinct browser cases: 417 across
  desktop/mobile Chromium and desktop Firefox, and 139 mobile WebKit cases. The
  initial host run passed 414; its three old Mazda cargo-gap expectations were
  updated to assert both reviewed figures and the independent PDF link, then all
  three passed. WebKit uses the installed engine with the temporary dependency
  wrapper described in the [interface review](INTERFACE-REVIEW.md).
- After the visual review removed repeated missing-data messages and aligned
  requirement-label colours, the 32 affected fit checks were rerun across all four browser profiles
  against the final build. Other source-note callers retain their original
  defaults. No automatic retries or increased timeouts were used.
- Light/dark accessibility scans pass for expanded comparisons. Card and
  comparison geometry passes at 320, 820 and 1,440 pixels. Ten retained visual
  views cover light/dark cards and comparisons at mobile/desktop widths, plus
  unknown requirements and a known requirement failure, with no page errors or
  horizontal overflow.
- The decoded production-catalog audit verifies all 682 additions, six
  drivetrain additions and six explicit quarantines against the protected
  baseline. All 1,337 original sources and all 6,083 default-score inputs are
  identical; 5,983 configurations are entirely unchanged. All 24 distinct raw
  capture hashes and byte counts match their retained receipts.
- All 21 release artifacts verify against final source fingerprint
  `6a0aae48a270737d25abef0dfbd21f642d70778f9118404b534112733cbf7861`.
  Formatting and Git whitespace checks pass. The refreshed local app and Garage
  return HTTP 200 at port 8080.

The local evidence is retained under ignored `artifacts/fit-research/`, including
build/unit logs, browser logs, catalog audit, screenshots and a hashed receipt.
