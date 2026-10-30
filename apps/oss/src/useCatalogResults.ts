import { useMemo } from 'react';
import type { Car } from '@oss/car-catalog';
import { energyCostPer100km, filterCars, rankCars } from './domain';
import type { EnergySettings, Filters, Weights } from './domain';
import type { SortOrder } from './browsing';
import { assessRequirements, matchesBrief } from './buying';
import type { BuyingBrief, TestDriveReview } from './buying';

export function useCatalogResults({
  cars,
  filters,
  savedIds,
  weights,
  energy,
  sort,
  scoredOnly,
  brief,
  reviews,
}: {
  cars: Car[];
  filters: Filters;
  savedIds: string[];
  weights: Weights;
  energy: EnergySettings;
  sort: SortOrder;
  scoredOnly: boolean;
  brief: BuyingBrief | null;
  reviews: TestDriveReview[];
}) {
  const results = useMemo(() => {
    const eligible = filterCars(cars, filters, savedIds).filter(
      (car) => !brief || matchesBrief(car, brief, reviews),
    );
    const ranked = rankCars(eligible, weights, energy, brief);
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
    brief,
    reviews,
    energy.fuelPrice,
    energy.electricityPrice,
    energy.electricFraction,
    energy.premiumPrice,
    energy.dieselPrice,
    energy.e85Price,
  ]);
  // Records that meet every verified requirement but miss data for another.
  const requirementGaps = useMemo(
    () =>
      brief
        ? filterCars(cars, filters, savedIds).filter((car) => {
            const needs = assessRequirements(car, brief);
            return !needs.failed.length && needs.unknown.length > 0;
          }).length
        : 0,
    [cars, brief, filters, savedIds],
  );
  return {
    results,
    scoredCount: results.filter((result) => result.score !== null).length,
    requirementGaps,
  };
}
