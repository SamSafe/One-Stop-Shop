import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Source } from './schema';
import { vinfastProfiles } from './vinfast-import';
import type { VinfastSnapshot } from './vinfast-import';

const sourceId = (model: string, province: string) =>
  `vinfast-ca-${model.replace('-', '')}-${province.toLowerCase()}-public-prices`;
export const vinfastRecordId = (model: string, trim: string) =>
  `vinfast-ca-${model.replace('-', '')}-${trim.toLowerCase()}`;
export function addVinfastOffers(base: Catalog, snapshot: VinfastSnapshot): Catalog {
  const on = snapshot.retrievedAt.slice(0, 10),
    sources: Source[] = snapshot.pages.map((p) => ({
      id: sourceId(p.model, p.province),
      publisher: 'VinFast Canada',
      title: `VinFast VF ${p.model.slice(-1)} Canadian Eco/Plus MSRP, ${p.province} public province view`,
      url: p.source.url,
      reviewedAt: on,
      publishedAt: null,
      locator: `Select ${p.province} in the public province selector. Read block-offer vehicle-item MSRP and its exact trim terms modal. MSRP is separate from all-in figures and finance/lease credits. Only an explicit matching new/unregistered cash-price statement establishes a model year; expired examples, image paths, store product identifiers and range-footnote years do not.`,
    }));
  const cars: Car[] = vinfastProfiles(snapshot).map((p) => {
    const id = vinfastRecordId(p.model, p.trim),
      refs = snapshot.pages
        .filter((page) => page.model === p.model)
        .map((page) => sourceId(page.model, page.province));
    const facts = Object.fromEntries(
      Object.keys(metricDefinitions).map((key) => [
        key,
        {
          value: null,
          source: null,
          note: 'Not verified for this exact Canadian offering and model year. Generic preliminary specifications, projected range, other model years and partial charging intervals are not substituted.',
        } satisfies Fact,
      ]),
    ) as Car['facts'];
    facts.msrpCad = {
      value: p.msrpCad,
      source: refs[0]!,
      note: `${p.year === null ? 'Current Canadian manufacturer offer with an unverified model year' : `Explicit ${p.year} Canadian new/unregistered ${p.trim} offer`}: published MSRP agrees in BC, Ontario and Quebec. Excludes freight/PDI, fees, levies, taxes, optional equipment and incentives. All-in amounts and conditional finance/lease credits are not normalized as MSRP.${p.year === null ? ' This amount is not assigned to any particular model year; confirm the year and exact vehicle with VinFast.' : ''}`,
    };
    return {
      id,
      make: 'VinFast',
      model: `VF ${p.model.slice(-1)}`,
      trim: p.trim,
      year: p.year,
      market: 'CA',
      bodyStyle: 'SUV',
      fuel: 'Electric',
      drivetrain: 'Not verified',
      recordKind: p.year === null ? 'manufacturer-offer' : 'retail-trim',
      ...(p.year === null
        ? {
            modelYearNote:
              'The current Canadian MSRP card does not verify a model year. Confirm the year and exact vehicle with VinFast.',
          }
        : {}),
      variant: 'BC · ON · QC public offer',
      availability: {
        status: 'manufacturer-listed',
        checkedAt: on,
        source: refs[0]!,
        note: `Current Canadian manufacturer price card for ${p.trim}, reviewed in BC, Ontario and Quebec. Ordering outside these provinces uses a reservation flow. Anonymous configuration links redirect to login; factory equipment combinations, current new stock, title/condition, order acceptance and delivery remain unverified. ${p.year === null ? 'Historical year-qualified lease/finance examples do not establish this offer’s model year.' : 'The exact-year cash-price terms have no dated expiry in the captured text; current stock still requires confirmation.'}`,
      },
      sourceIds: refs,
      facts,
    };
  });
  return validateCatalog({
    ...base,
    reviewedAt: on > base.reviewedAt ? on : base.reviewedAt,
    cars: [...base.cars, ...cars],
    sources: [...base.sources, ...sources],
  });
}
export function vinfastReviewGaps(snapshot: VinfastSnapshot) {
  return [
    {
      brand: 'VinFast',
      field: 'scope',
      reason:
        'Public Canadian Eco/Plus MSRP cards for VF 8 and VF 9 are represented. Three are manufacturer offers with unverified model years, not year-qualified retail configurations. Factory packages, model-year reconciliation, new stock and independent national offering checks remain open.',
    },
    {
      brand: 'VinFast',
      field: 'factory-and-stock-access',
      reason:
        'The published shop product and province-selected fresh-order GETs redirect anonymous visitors to login. No account or reservation was used. The public pricing pages remain available; the redirect is not evidence of no Canadian offerings. Configured equipment, older new stock and delivery require further sources.',
    },
    {
      brand: 'VinFast',
      field: 'regional-price-basis',
      reason:
        'MSRP agrees across BC/ON/QC. Published all-in amounts, dated financing/lease examples, conditional credits and potentially differing fee scopes remain separate. They are not used to infer base MSRP, a model year or an all-inclusive price for an exact configuration.',
    },
    ...vinfastProfiles(snapshot)
      .filter((p) => p.year === null)
      .map((p) => ({
        brand: 'VinFast',
        configuration: `${p.model}/${p.trim}`,
        field: 'model-year',
        reason:
          'No exact current price-to-model-year join is established. Historical lease/finance examples and specification/range footnotes are not substituted; this remains a manufacturer offer with year=null.',
      })),
    ...vinfastProfiles(snapshot).map((p) => ({
      brand: 'VinFast',
      configuration: `${p.model}/${p.trim}`,
      field: 'technical-specifications',
      reason:
        'Manufacturer tables include preliminary values, projected ranges and partial-charge intervals with different year contexts. Exact-year power, drivetrain, dimensions, seating, cargo and energy facts remain unverified.',
    })),
  ];
}
