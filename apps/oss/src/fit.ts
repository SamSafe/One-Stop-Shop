import type { Car, Metric } from '@oss/car-catalog';
import { energyCostPer100km, priorityDefinitions, priorityKeys, scoreCar } from './domain';
import type { EnergySettings, Priority, Weights } from './domain';
import { briefPriorityLabels, requirementChecks } from './buying';
import type { BriefPriority, BuyingBrief, RequirementCheck } from './buying';
import { estimateEnergy } from './energy';
import { vehicleBodyStyle } from './vehicleBodyStyle';

export type FitPriority = Priority | BriefPriority;
export interface FitCriterion {
  priority: FitPriority;
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

export function explainFit(
  car: Car,
  weights: Weights,
  energy: EnergySettings,
  savedBrief?: BuyingBrief | null,
) {
  const brief = savedBrief?.enabled ? savedBrief : null;
  const ranking = scoreCar(car, weights, energy, brief);
  const estimate = estimateEnergy(car, energy);
  const keys: FitPriority[] = brief
    ? (Object.keys(briefPriorityLabels) as BriefPriority[])
    : priorityKeys;
  const criteria: FitCriterion[] = keys.map((priority) => {
    const weight = brief ? brief.weights[priority as BriefPriority] : weights[priority as Priority];
    let excludedReason: string | null = weight === 0 ? 'Importance is set to zero.' : null;
    if (brief && priority === 'drive' && brief.drive === 'Any')
      excludedReason = 'Choose a preferred drivetrain to include this priority.';
    if (brief && priority === 'body' && !brief.bodies.length)
      excludedReason = 'Choose a preferred body style to include this priority.';
    const label = brief
      ? briefPriorityLabels[priority as BriefPriority]
      : priorityDefinitions[priority as Priority].label;
    let value: FitCriterion['value'] = null;
    let metric: Metric | undefined;
    let target = '';
    let missingReason: string | null = null;
    switch (priority) {
      case 'price':
        metric = 'msrpCad';
        value = car.facts.msrpCad.value;
        target = brief?.budget
          ? `Full points at ${money(brief.budget / 2)} or less; zero at your ${money(brief.budget)} budget.`
          : `Full points at ${money(priorityDefinitions.price.min)} or less; zero at ${money(priorityDefinitions.price.max)} or more.`;
        break;
      case 'energy':
      case 'efficiency':
        value = brief
          ? estimate.available
            ? estimate.total
            : null
          : energyCostPer100km(car, energy);
        target = `Full points at $0; zero at $${priorityDefinitions.efficiency.max} CAD per 100 km. Uses your energy-price settings.`;
        if (!estimate.available) missingReason = estimate.reasons.join(' ');
        break;
      case 'cargo':
      case 'room':
        metric = priority === 'cargo' ? 'cargoSeatsUpL' : 'rearLegroomMm';
        value = car.facts[metric].value;
        target = brief
          ? `Full points at your ${fitNumber(priority === 'cargo' ? brief.cargo : brief.rearLegroom)} ${priority === 'cargo' ? 'L cargo' : 'mm rear legroom'} target or above. Points rise proportionally from zero.`
          : `Zero points at ${fitNumber(priorityDefinitions[priority].min)} ${priority === 'cargo' ? 'L' : 'mm'} or less; full points at ${fitNumber(priorityDefinitions[priority].max)} ${priority === 'cargo' ? 'L' : 'mm'} or above.`;
        break;
      case 'power':
        metric = 'horsepower';
        value = car.facts.horsepower.value;
        target = `Full points at your ${fitNumber(brief!.horsepower)} hp target or above. Points rise proportionally from zero.`;
        break;
      case 'drive':
        value = car.drivetrain === 'Not verified' ? null : car.drivetrain;
        target = `Full points for ${brief!.drive}; zero for another verified drivetrain.`;
        break;
      case 'body':
        value = vehicleBodyStyle(car) === 'Not verified' ? null : vehicleBodyStyle(car);
        target = `Full points for ${brief!.bodies.join(' or ') || 'a selected body style'}; zero for another verified style.`;
        break;
    }
    if (value === null && !missingReason)
      missingReason = metric
        ? (car.facts[metric].note ?? `${label} has not been verified.`)
        : `${label} has not been verified.`;
    return {
      priority,
      label,
      weight,
      value,
      metric,
      target,
      active: !excludedReason,
      excludedReason,
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
    mode: brief ? ('brief' as const) : ('priorities' as const),
    requirements: brief ? requirementChecks(car, brief) : [],
    criteria,
    totalWeight,
  };
}
export function requirementDescription(check: RequirementCheck) {
  switch (check.key) {
    case 'budget':
      return `Base MSRP up to ${money(check.target as number)}`;
    case 'seats':
      return `At least ${check.target} seats`;
    case 'body':
      return (check.target as string[]).join(' or ');
    case 'drive':
      return `${check.target} drivetrain`;
    case 'power':
      return `At least ${fitNumber(check.target as number)} hp`;
    case 'room':
      return `At least ${fitNumber(check.target as number)} mm rear legroom`;
  }
}
export function requirementValue(check: RequirementCheck) {
  if (check.actual === null) return 'Not verified';
  if (typeof check.actual === 'string') return check.actual;
  switch (check.key) {
    case 'budget':
      return money(check.actual);
    case 'seats':
      return `${check.actual} seats`;
    case 'power':
      return `${fitNumber(check.actual)} hp`;
    case 'room':
      return `${fitNumber(check.actual)} mm`;
    default:
      return String(check.actual);
  }
}
