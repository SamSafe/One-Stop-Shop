import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Source } from './schema';
import type { LandroverSnapshot } from './landrover-import';
const names = {
  l663: 'Defender',
  l462: 'Discovery',
  l550: 'Discovery Sport',
  l460: 'Range Rover',
  l461: 'Range Rover Sport',
  l560: 'Range Rover Velar',
  l551: 'Range Rover Evoque',
};
export function addLandroverRetail(base: Catalog, snapshot: LandroverSnapshot): Catalog {
  const on = snapshot.retrievedAt.slice(0, 10),
    sources: Source[] = [],
    cars: Car[] = [];
  for (const p of snapshot.profiles) {
    const id = `land-rover-ca-${p.family}-${p.id.toLowerCase()}-${p.year ?? 'year-unverified'}`,
      source = `${id}-factory`;
    sources.push({
      id: source,
      publisher: 'Land Rover',
      title: `${p.year ?? 'Year unverified'} ${p.model} · ${p.body} · ${p.engine}`,
      url: p.source.url,
      reviewedAt: on,
      publishedAt: null,
      locator: `Canadian LIVE/CDA factory rules, selected PRODUCT ${p.id}; visible compatibility follows the reviewed production normalizer. Base MSRP is PRODUCT.GROSS=NET in CAD, excluding configured options, delivery/freight and taxes. ${p.yearBasis === 'canadian-overview-title' ? 'Year is explicit in the current Canadian Range Rover overview title: https://www.rangerover.com/en-ca/range-rover/index.html.' : p.yearBasis === 'native-description' ? 'Year is explicit in the native vehicle description.' : 'Internal program codes are not literal model years; model year remains unverified.'}`,
    });
    const facts = Object.fromEntries(
      Object.keys(metricDefinitions).map((key) => [
        key,
        {
          value: null,
          source: null,
          note: 'Not verified for this exact Canadian base equipment. Conditional seating/cargo tables, foreign-market ratings and conflicting power units are not substituted.',
        } satisfies Fact,
      ]),
    ) as Car['facts'];
    if (p.price !== null)
      facts.msrpCad = {
        value: p.price,
        source,
        note: 'Canadian selected PRODUCT base amount before delivery/freight, options and taxes. Configured summary and RETAIL totals are excluded.',
      };
    cars.push({
      id,
      make: 'Land Rover',
      model: names[p.family],
      trim: `${p.body} · ${p.model} · ${p.engine}`,
      year: p.year,
      ...(p.year === null
        ? {
            modelYearNote:
              'The current Canadian factory configuration does not publish a literal model year. Its internal program/version code is not treated as a year.',
          }
        : {}),
      market: 'CA',
      recordKind: p.year === null ? 'manufacturer-offer' : 'retail-trim',
      bodyStyle: 'SUV',
      fuel: p.fuel,
      drivetrain: p.drivetrain,
      manufacturerConfiguration: {
        id: p.id,
        code: p.id,
        transmission: p.transmission,
        specificationsUrl: p.source.url,
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: on,
        source,
        note: 'Visible in the current Canadian factory configurator and resolved to the exact product. Stock, order acceptance, allocations, additional equipment combinations and older new inventory remain unverified.',
      },
      sourceIds: [source],
      facts,
    });
  }
  return validateCatalog({
    ...base,
    reviewedAt: on > base.reviewedAt ? on : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
