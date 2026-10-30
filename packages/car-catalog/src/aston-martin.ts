import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Source } from './schema';
import { astonPageUrl } from './aston-martin-import';
import type { AstonSnapshot } from './aston-martin-import';

export const astonRecordId = (id: string) => `aston-martin-ca-${id.toLowerCase()}`;
export function addAstonOffers(base: Catalog, snapshot: AstonSnapshot): Catalog {
  const on = snapshot.retrievedAt.slice(0, 10);
  const menuId = 'aston-martin-ca-public-menu',
    specsId = 'aston-martin-ca-configurator-specs';
  const sources: Source[] = [
    {
      id: menuId,
      publisher: 'Aston Martin',
      title: 'Aston Martin Canadian public configurator product menu',
      url: snapshot.sources.menu.url,
      reviewedAt: snapshot.sources.menu.capturedAt.slice(0, 10),
      publishedAt: null,
      locator:
        'Canada (CA) in the public country selector; /models/products/CA. Product IDs and modelCode join the English derivative labels. Five client-declared stock-only products and Valen, with announced Q2 2027 first deliveries, are withheld pending current offering evidence. Confirm quotes, order acceptance and current stock with the retailer.',
    },
    {
      id: specsId,
      publisher: 'Aston Martin',
      title: 'Aston Martin configurator derivative labels, bhp and standard seating',
      url: snapshot.sources.translations.url,
      reviewedAt: snapshot.sources.translations.capturedAt.slice(0, 10),
      publishedAt: null,
      locator:
        'DERIVATIVE_SELECTION[modelCode][productId].STATS.POWER.VALUE[0] with UNIT[0]=bhp; STANDARD_LIST[modelCode][productId].BODY for explicit seating. These describe the year-unverified manufacturer listing. PS, WLTP economy, regionalized Chinese specifications and model-year guesses are not substituted.',
    },
    {
      id: 'aston-martin-valhalla-powertrain',
      publisher: 'Aston Martin',
      title: 'Valhalla manufacturer plug-in hybrid powertrain description',
      url: snapshot.sources.valhalla.url,
      reviewedAt: snapshot.sources.valhalla.capturedAt.slice(0, 10),
      publishedAt: null,
      locator:
        'The manufacturer describes the plug-in hybrid architecture. Canadian model year, rated electric range and Canadian energy consumption require separate evidence.',
    },
    {
      id: 'aston-martin-valhalla-spider-powertrain',
      publisher: 'Aston Martin',
      title: 'Valhalla Spider manufacturer hybrid powertrain specification',
      url: snapshot.sources.valhallaSpider.url,
      reviewedAt: snapshot.sources.valhallaSpider.capturedAt.slice(0, 10),
      publishedAt: null,
      locator:
        "The Spider's own page lists a hybrid powertrain with a high-voltage battery and e-motors. It does not state plug-in charging, so the coupe's plug-in description is not applied.",
    },
  ];
  const cars: Car[] = snapshot.products
    .filter((p) => p.role === 'menu-offer')
    .map((p) => {
      const facts = Object.fromEntries(
        Object.keys(metricDefinitions).map((k) => [
          k,
          {
            value: null,
            source: null,
            note: 'Not verified for this Canadian listing and an exact model year. Global WLTP values, fee-inclusive or dealer prices, image years and other model years are not substituted.',
          } satisfies Fact,
        ]),
      ) as Car['facts'];
      facts.msrpCad.note =
        'No Canadian currency or price is published in the captured Canadian product menu and anonymous configuration response. Request an exact-year base MSRP from the manufacturer or dealer; a configured quote or foreign-market price is not substituted.';
      facts.horsepower = {
        value: p.powerBhp,
        source: specsId,
        note: `Published configurator menu power for ${p.id}: ${p.powerBhp} bhp. This is the menu's brake-horsepower value, not PS or a Canadian model-year rating. The offering's model year remains unverified.`,
      };
      if (p.seats !== null)
        facts.seats = {
          value: p.seats,
          source: specsId,
          note: `Explicit standard seating for product ${p.id} in the configurator's product-specific body section. Model year and additional equipment combinations remain unverified.`,
        };
      return {
        id: astonRecordId(p.id),
        make: 'Aston Martin',
        model: p.model,
        trim:
          p.name === p.model
            ? 'Manufacturer listing'
            : p.name.startsWith(`${p.model} `)
              ? p.name.slice(p.model.length + 1)
              : p.name,
        year: null,
        market: 'CA',
        recordKind: 'manufacturer-offer',
        modelYearNote:
          'The Canadian public configurator does not publish an exact model year. A current calendar date, product code, image path or first-delivery date does not establish one.',
        bodyStyle: p.family === 'M230' ? 'SUV' : p.convertible ? 'Convertible' : 'Coupe',
        fuel: p.id === 'AM003A' ? 'Plug-in hybrid' : p.id === 'AM004' ? 'Hybrid' : 'Gasoline',
        drivetrain: 'Not verified',
        variant: 'Canadian configurator listing · year unverified',
        manufacturerConfiguration: {
          id: p.id,
          code: `${p.family}/${p.id}`,
          transmission: p.transmission,
          specificationsUrl: astonPageUrl(p.family, p.id),
        },
        availability: {
          status: 'manufacturer-listed',
          checkedAt: on,
          source: menuId,
          note: 'Listed in the Canadian public configurator with an anonymous CA configuration response. The configurator is indicative and subject to dealer availability; current allocation, order acceptance, new stock, delivery, exact model year and equipment combinations remain unverified.',
        },
        sourceIds: [
          menuId,
          specsId,
          ...(p.id === 'AM003A' ? ['aston-martin-valhalla-powertrain'] : []),
          ...(p.id === 'AM004' ? ['aston-martin-valhalla-spider-powertrain'] : []),
        ],
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
export function astonReviewGaps(snapshot: AstonSnapshot) {
  return [
    {
      brand: 'Aston Martin',
      field: 'scope',
      reason: `${snapshot.products.filter((p) => p.role === 'menu-offer').length} year-unverified Canadian public configurator listings are represented. Exact model years, base CAD MSRP, packages, independent national availability, allocations and current/older new inventory remain unverified. These are manufacturer offers, not year-qualified retail configurations.`,
    },
    ...snapshot.products
      .filter((p) => p.role !== 'menu-offer')
      .map((p) => ({
        brand: 'Aston Martin',
        configuration: `${p.id}/${p.name}`,
        field: p.role,
        reason:
          p.role === 'stock-only'
            ? 'The public production client routes this product to stock search. It is retained in the source reconciliation but not promoted to a current offering without qualifying new-stock evidence. Absence from the app is not evidence of unavailable Canadian stock.'
            : 'Valen is in the Canadian menu, but its manufacturer announcement schedules first deliveries for Q2 2027. Canadian model year and current allocation require separate verification; the profile remains withheld.',
      })),
    {
      brand: 'Aston Martin',
      field: 'technical-specifications',
      reason:
        'Product-specific menu bhp and explicit standard seating are represented with year qualifications. Remaining technical facts, Canadian energy/range ratings, dimensions with federal/regional alternatives and factory equipment combinations require exact offering and model-year reconciliation.',
    },
  ];
}
