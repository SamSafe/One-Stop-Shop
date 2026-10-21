import type { Catalog } from './schema';
import type { NrcanSnapshot } from './nrcan-schema';

export function catalogCoverage(catalog: Catalog, snapshot: NrcanSnapshot) {
  const retail = catalog.cars.filter((car) => car.recordKind === 'retail-trim');
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
    governmentRatingVariants: catalog.cars.length - retail.length,
    verifiedPrices: catalog.cars.filter((car) => car.facts.msrpCad.value !== null).length,
    availabilityUnchecked: catalog.cars.filter((car) => car.availability.status === 'not-checked')
      .length,
    modelYears: snapshot.modelYears,
    byMake: [...new Set(catalog.cars.map((car) => car.make))].sort().map((make) => {
      const cars = catalog.cars.filter((car) => car.make === make);
      return {
        make,
        records: cars.length,
        retailConfigurations: cars.filter((car) => car.recordKind === 'retail-trim').length,
        verifiedPrices: cars.filter((car) => car.facts.msrpCad.value !== null).length,
        availabilityUnchecked: cars.filter((car) => car.availability.status === 'not-checked')
          .length,
      };
    }),
    remaining: [
      'Reconcile all Canadian manufacturer lineups, including manufacturers absent from NRCan and unrated pickups/vans.',
      'Verify which model years and configurations are offered now, rather than merely rated or announced.',
      'Expand each fuel-rating variant into its verified Canadian retail trims and variant combinations.',
      'Source missing prices, dimensions, cabin/cargo specifications and body styles from manufacturers.',
    ],
  };
}
