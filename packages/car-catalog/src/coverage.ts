import type { Catalog } from './schema';
import type { NrcanSnapshot } from './nrcan-schema';

export function catalogCoverage(catalog: Catalog, snapshot: NrcanSnapshot) {
  const retail = catalog.cars.filter((car) => car.recordKind === 'retail-trim');
  const offers = catalog.cars.filter((car) => car.recordKind === 'manufacturer-offer');
  const rated = new Set(
    catalog.cars.flatMap((car) => (car.governmentRating ? [car.governmentRating.recordId] : [])),
  );
  return {
    objective:
      'Every new passenger vehicle currently offered for sale in Canada, including pickups and vans, all makes, models and retail trims.',
    fullMarketCoverageVerified: false,
    reason:
      'Manufacturer lineup, exact retail-trim and current-availability reconciliation is still incomplete. Rating counts do not prove the full market is covered.',
    ratingsRetrievedAt: snapshot.retrievedAt,
    ratingRecordsExpected: snapshot.records.length,
    ratingRecordsRepresented: rated.size,
    catalogRecords: catalog.cars.length,
    retailConfigurations: retail.length,
    manufacturerOffersWithUnverifiedYear: offers.length,
    manufacturerOfferPricesWithUnverifiedYear: offers.filter(
      (car) => car.facts.msrpCad.value !== null,
    ).length,
    governmentRatingVariants: catalog.cars.filter((car) => car.recordKind === 'government-rating')
      .length,
    verifiedPrices: catalog.cars.filter((car) => car.facts.msrpCad.value !== null).length,
    publishedAllInclusivePrices: catalog.cars.filter((car) => car.publishedPrice).length,
    manufacturerListedConfigurations: catalog.cars.filter(
      (car) =>
        car.recordKind === 'retail-trim' && car.availability.status === 'manufacturer-listed',
    ).length,
    manufacturerListedOffersWithUnverifiedYear: offers.filter(
      (car) => car.availability.status === 'manufacturer-listed',
    ).length,
    makesWithoutCurrentManufacturerListings: [...new Set(catalog.cars.map((car) => car.make))]
      .filter(
        (make) =>
          !catalog.cars.some(
            (car) => car.make === make && car.availability.status === 'manufacturer-listed',
          ),
      )
      .sort(),
    availabilityUnchecked: catalog.cars.filter((car) => car.availability.status === 'not-checked')
      .length,
    modelYears: [
      ...new Set(catalog.cars.flatMap((car) => (car.year === null ? [] : [car.year]))),
    ].sort(),
    ratingModelYears: snapshot.modelYears,
    byMake: [...new Set(catalog.cars.map((car) => car.make))].sort().map((make) => {
      const cars = catalog.cars.filter((car) => car.make === make);
      return {
        make,
        records: cars.length,
        retailConfigurations: cars.filter((car) => car.recordKind === 'retail-trim').length,
        manufacturerOffersWithUnverifiedYear: cars.filter(
          (car) => car.recordKind === 'manufacturer-offer',
        ).length,
        verifiedPrices: cars.filter((car) => car.facts.msrpCad.value !== null).length,
        availabilityUnchecked: cars.filter((car) => car.availability.status === 'not-checked')
          .length,
      };
    }),
    remaining: [
      'Reconcile all Canadian manufacturer lineups, including manufacturers absent from NRCan and unrated pickups/vans.',
      'Verify current Canadian offerings for each model year and configuration; check ratings and announcements separately.',
      'Expand each fuel-rating variant into its verified Canadian retail trims and variant combinations.',
      'Source missing prices, dimensions, cabin/cargo specifications and body styles from manufacturers.',
    ],
  };
}
