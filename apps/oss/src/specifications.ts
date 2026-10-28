import type { Car, Metric } from '@oss/car-catalog';

// Preserve any published value. Applicability explains only otherwise empty fields.
export function nonApplicableReason(car: Car, metric: Metric): string | null {
  if (car.facts[metric].value !== null) return null;
  if (
    ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'].includes(metric) &&
    (car.fuel === 'Electric' || car.fuel === 'Hydrogen')
  )
    return car.fuel === 'Electric'
      ? 'Battery-electric propulsion does not use liquid fuel.'
      : 'Hydrogen propulsion does not use liquid fuel.';
  if (metric === 'electricModeFuelL100km' && car.fuel !== 'Plug-in hybrid')
    return 'This field applies only to plug-in hybrid electric operation.';
  if (
    [
      'electricCombinedKwh100km',
      'electricModeLe100km',
      'electricRangeKm',
      'rechargeHours',
    ].includes(metric) &&
    car.fuel !== 'Electric' &&
    car.fuel !== 'Plug-in hybrid'
  )
    return 'Plug-in consumption, range and charging do not apply to this powertrain.';
  return null;
}
