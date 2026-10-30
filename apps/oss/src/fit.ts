import type { Car, Metric } from '@oss/car-catalog';
import { energyCostPer100km, priorityDefinitions, priorityKeys, scoreCar } from './domain';
import type { EnergySettings, Priority, Weights } from './domain';
import { estimateEnergy } from './energy';

export interface FitCriterion {
  priority: Priority;
  label: string;
  weight: number;
  value: number | string | null;
  metric?: Metric;
  target: string;
  active: boolean;
  excludedReason: string | null;
  missingReason: string | null;
  points: number | null;
  maximumPoints: number;
}
export const fitNumber = (n: number, digits = 1) =>
  n.toLocaleString('en-CA', { maximumFractionDigits: digits });
const money = (n: number) => `$${fitNumber(n, 2)} CAD`;
const units = { cargo: 'L', room: 'mm', power: 'hp' } as const;

export function explainFit(car: Car, weights: Weights, energy: EnergySettings) {
  const ranking = scoreCar(car, weights, energy);
  const estimate = estimateEnergy(car, energy);
  const criteria: FitCriterion[] = priorityKeys.map((priority) => {
    const weight = weights[priority];
    const definition = priorityDefinitions[priority];
    let value: FitCriterion['value'] = null;
    let metric: Metric | undefined;
    let target = '';
    let missingReason: string | null = null;
    switch (priority) {
      case 'price':
        metric = 'msrpCad';
        value = car.facts.msrpCad.value;
        target = `Full points at ${money(definition.min)} or less; zero at ${money(definition.max)} or more.`;
        break;
      case 'efficiency':
        value = energyCostPer100km(car, energy);
        target = `Full points at $0; zero at $${definition.max} CAD per 100 km. Uses your energy-price settings.`;
        if (!estimate.available) missingReason = estimate.reasons.join(' ');
        break;
      default:
        metric = definition.metric;
        value = car.facts[metric].value;
        target = `Zero points at ${fitNumber(definition.min)} ${units[priority]} or less; full points at ${fitNumber(definition.max)} ${units[priority]} or above.`;
    }
    if (value === null && !missingReason)
      missingReason = metric
        ? (car.facts[metric].note ?? `${definition.label} has not been verified.`)
        : `${definition.label} has not been verified.`;
    return {
      priority,
      label: definition.label,
      weight,
      value,
      metric,
      target,
      active: weight > 0,
      excludedReason: weight === 0 ? 'Importance is set to zero.' : null,
      missingReason,
      points: null,
      maximumPoints: 0,
    };
  });
  const totalWeight = criteria
    .filter((row) => row.active)
    .reduce((sum, row) => sum + row.weight, 0);
  for (const row of criteria) {
    if (!row.active) continue;
    row.maximumPoints = (row.weight / totalWeight) * 100;
    // Earned points come from the ranking result. An incomplete score has no partial total.
    row.points =
      ranking.score === null
        ? null
        : (ranking.contributions.find((c) => c.priority === row.priority)?.points ?? null);
  }
  return {
    score: ranking.score,
    reason: ranking.reason,
    criteria,
    totalWeight,
  };
}
