import { useMemo } from 'react';
import type { Car } from '@oss/car-catalog';
import { energyCostPer100km, filterCars, rankCars } from './domain';
import type { EnergySettings, Filters, Weights } from './domain';
import type { SortOrder } from './browsing';
import { ruledOutIds } from './buying';
import type { TestDriveReview } from './buying';

export function useCatalogResults({
  cars,
  filters,
  savedIds,
  weights,
  energy,
  sort,
  scoredOnly,
  reviews,
}: {
  cars: Car[];
  filters: Filters;
  savedIds: string[];
  weights: Weights;
  energy: EnergySettings;
  sort: SortOrder;
  scoredOnly: boolean;
  reviews: TestDriveReview[];
}) {
  const ruledOut = useMemo(() => ruledOutIds(reviews), [reviews]);
  const results = useMemo(() => {
    const ranked = rankCars(filterCars(cars, filters, savedIds, ruledOut), weights, energy);
    if (sort === 'price')
      ranked.sort(
        (a, b) =>
          (a.car.facts.msrpCad.value ?? Infinity) - (b.car.facts.msrpCad.value ?? Infinity) ||
          a.car.id.localeCompare(b.car.id),
      );
    if (sort === 'fuel')
      ranked.sort(
        (a, b) =>
          (energyCostPer100km(a.car, energy) ?? Infinity) -
            (energyCostPer100km(b.car, energy) ?? Infinity) || a.car.id.localeCompare(b.car.id),
      );
    return scoredOnly ? ranked.filter((result) => result.score !== null) : ranked;
    // Distance driven does not affect ranking, so it is not a dependency.
  }, [
    cars,
    filters,
    weights,
    savedIds,
    sort,
    scoredOnly,
    ruledOut,
    energy.fuelPrice,
    energy.electricityPrice,
    energy.electricFraction,
    energy.premiumPrice,
    energy.dieselPrice,
    energy.e85Price,
  ]);
  // Records hidden only because a numeric limit has no verified figure for them.
  const uncheckedHidden = useMemo(() => {
    const limited =
      filters.budget || filters.minSeats || filters.minHorsepower || filters.minRearLegroom;
    if (!limited || filters.includeUnverified) return 0;
    return (
      filterCars(cars, { ...filters, includeUnverified: true }, savedIds, ruledOut).length -
      filterCars(cars, filters, savedIds, ruledOut).length
    );
  }, [cars, filters, savedIds, ruledOut]);
  return {
    results,
    uncheckedHidden,
    scoredCount: results.filter((result) => result.score !== null).length,
    ruledOutCount: ruledOut.length,
  };
}
