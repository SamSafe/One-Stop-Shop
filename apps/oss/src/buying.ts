import type { Car } from '@oss/car-catalog';
import type { EnergySettings, Filters } from './domain';
import { estimateEnergy } from './energy';
import { vehicleBodyStyle } from './vehicleBodyStyle';

export const buyingStorageKey = 'oss-buying-v1';
export const buyingFileLimit = 2_000_000;
export const bodyChoices = [
  'Sedan',
  'Hatchback',
  'Coupe',
  'Convertible',
  'Wagon',
  'SUV',
  'Pickup',
  'Minivan',
  'Van',
] as const;
export const driveChoices = ['Any', 'AWD', '4WD', 'FWD', 'RWD'] as const;
export const briefPriorityLabels = {
  price: 'Purchase price',
  energy: 'Energy cost',
  cargo: 'Cargo space',
  room: 'Rear legroom',
  power: 'Horsepower',
  drive: 'Preferred drivetrain',
  body: 'Preferred body styles',
};
export type BriefPriority = keyof typeof briefPriorityLabels;
export type BriefWeights = Record<BriefPriority, number>;
export interface BuyingBrief {
  enabled: boolean;
  budget: number | null;
  minSeats: number | null;
  bodies: string[];
  bodyRequired: boolean;
  drive: (typeof driveChoices)[number];
  driveRequired: boolean;
  horsepower: number;
  powerRequired: boolean;
  rearLegroom: number;
  roomRequired: boolean;
  cargo: number;
  includeUnverified: boolean;
  hideRuledOut: boolean;
  weights: BriefWeights;
}
export const briefPresets: { label: string; weights: BriefWeights }[] = [
  {
    label: 'Everyday value',
    weights: { price: 3, energy: 3, cargo: 0, room: 0, power: 0, drive: 3, body: 3 },
  },
  {
    label: 'Passenger space',
    weights: { price: 2, energy: 1, cargo: 3, room: 5, power: 0, drive: 3, body: 3 },
  },
  {
    label: 'More power',
    weights: { price: 2, energy: 1, cargo: 0, room: 0, power: 5, drive: 3, body: 3 },
  },
];
export function emptyBrief(): BuyingBrief {
  return {
    enabled: true,
    budget: null,
    minSeats: null,
    bodies: [],
    bodyRequired: false,
    drive: 'Any',
    driveRequired: false,
    horsepower: 300,
    powerRequired: false,
    rearLegroom: 1000,
    roomRequired: false,
    cargo: 700,
    includeUnverified: false,
    hideRuledOut: false,
    weights: { ...briefPresets[0]!.weights },
  };
}
// A new brief starts from the catalog search the buyer has already narrowed:
// budget, seats, body style and drivetrain become its starting needs.
export function briefFromFilters(filters: Filters): BuyingBrief {
  const brief = emptyBrief();
  const body = bodyChoices.find((choice) => choice === filters.bodyStyle);
  const drive = driveChoices.find((choice) => choice !== 'Any' && choice === filters.drivetrain);
  return {
    ...brief,
    budget: filters.budget,
    minSeats: filters.minSeats ?? null,
    bodies: body ? [body] : [],
    drive: drive ?? 'Any',
  };
}
export const reviewDimensions = {
  enjoyment: 'Driving enjoyment',
  comfort: 'Seat comfort',
  rearSpace: 'Rear-seat space',
  visibility: 'Visibility',
};
export type ReviewDimension = keyof typeof reviewDimensions;
export const verdictLabels = {
  consider: 'Still considering',
  unsure: 'Undecided',
  'ruled-out': 'Ruled out',
};
export interface TestDriveReview {
  id: string;
  carId: string;
  vehicleName: string;
  date: string;
  createdAt: string;
  verdict: keyof typeof verdictLabels;
  ratings: Record<ReviewDimension, number | null>;
  notes: string;
}
export interface BuyingWorkspace {
  version: 1;
  revision: string;
  brief: BuyingBrief | null;
  reviews: TestDriveReview[];
}
export function emptyBuyingWorkspace(): BuyingWorkspace {
  return { version: 1, revision: 'initial', brief: null, reviews: [] };
}

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key)) ||
    keys.some((key) => !(key in value))
  )
    throw new Error('Unsupported or incomplete buying data. Keep the original backup.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()))
    throw new Error('Invalid text in buying data.');
}
function number(value: unknown, min: number, max: number, nullable = false) {
  if (nullable && value === null) return;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    throw new Error('Invalid number in buying data.');
}
export function parseBuyingBrief(value: unknown): BuyingBrief {
  const defaults = emptyBrief();
  const b = object(value, Object.keys(defaults));
  for (const key of [
    'enabled',
    'bodyRequired',
    'driveRequired',
    'powerRequired',
    'roomRequired',
    'includeUnverified',
    'hideRuledOut',
  ])
    if (typeof b[key] !== 'boolean') throw new Error('Invalid buying preference.');
  number(b.budget, 10000, 10000000, true);
  number(b.minSeats, 2, 15, true);
  number(b.horsepower, 50, 1500);
  number(b.rearLegroom, 600, 1600);
  number(b.cargo, 10, 4000);
  if (!driveChoices.includes(b.drive as (typeof driveChoices)[number]))
    throw new Error('Invalid drivetrain.');
  if (
    !Array.isArray(b.bodies) ||
    b.bodies.length > bodyChoices.length ||
    b.bodies.some((v) => !bodyChoices.includes(v)) ||
    new Set(b.bodies).size !== b.bodies.length
  )
    throw new Error('Invalid body styles.');
  if (b.bodyRequired && !b.bodies.length)
    throw new Error('Choose at least one required body style.');
  if (b.driveRequired && b.drive === 'Any') throw new Error('Choose a required drivetrain.');
  const weights = object(b.weights, Object.keys(briefPriorityLabels));
  for (const weight of Object.values(weights)) number(weight, 0, 5);
  return structuredClone(value) as BuyingBrief;
}
export function parseReview(value: unknown): TestDriveReview {
  const r = object(value, [
    'id',
    'carId',
    'vehicleName',
    'date',
    'createdAt',
    'verdict',
    'ratings',
    'notes',
  ]);
  text(r.id, 100);
  text(r.carId, 100);
  text(r.vehicleName, 500);
  text(r.notes, 4000, true);
  text(r.date, 10);
  if (!/^[a-z0-9-]+$/.test(r.id) || !/^[a-z0-9-]+$/.test(r.carId))
    throw new Error('Invalid review identifier.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
    !Number.isFinite(Date.parse(r.date)) ||
    new Date(r.date).toISOString().slice(0, 10) !== r.date
  )
    throw new Error('Enter a valid test-drive date.');
  text(r.createdAt, 24);
  if (
    !Number.isFinite(Date.parse(r.createdAt)) ||
    new Date(r.createdAt).toISOString() !== r.createdAt
  )
    throw new Error('Invalid review creation date.');
  if (typeof r.verdict !== 'string' || !Object.hasOwn(verdictLabels, r.verdict))
    throw new Error('Invalid test-drive verdict.');
  const ratings = object(r.ratings, Object.keys(reviewDimensions));
  for (const rating of Object.values(ratings)) number(rating, 1, 5, true);
  return structuredClone(value) as TestDriveReview;
}
export function parseBuyingWorkspace(value: unknown): BuyingWorkspace {
  const w = object(value, ['version', 'revision', 'brief', 'reviews']);
  if (w.version !== 1)
    throw new Error('Unsupported buying backup version. Keep the original file.');
  text(w.revision, 100);
  if (!Array.isArray(w.reviews) || w.reviews.length > 1000)
    throw new Error('A buying journal can contain up to 1,000 reviews.');
  const reviews = w.reviews.map(parseReview);
  if (new Set(reviews.map((r) => r.id)).size !== reviews.length)
    throw new Error('Duplicate review identifiers in buying data.');
  const result: BuyingWorkspace = {
    version: 1,
    revision: w.revision,
    brief: w.brief === null ? null : parseBuyingBrief(w.brief),
    reviews,
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > buyingFileLimit)
    throw new Error('Buying data must be smaller than 2 MB.');
  return result;
}
export function readBuyingWorkspace(raw: string | null): BuyingWorkspace {
  if (raw === null) return emptyBuyingWorkspace();
  if (new TextEncoder().encode(raw).length > buyingFileLimit)
    throw new Error('Buying backup is too large.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('That buying backup is not valid JSON. Keep the original file.');
  }
  return parseBuyingWorkspace(value);
}
export function mergeBuyingWorkspace(
  current: BuyingWorkspace,
  incoming: BuyingWorkspace,
): BuyingWorkspace {
  const ids = new Set(current.reviews.map((r) => r.id));
  return parseBuyingWorkspace({
    ...current,
    brief: current.brief ?? incoming.brief,
    reviews: [...current.reviews, ...incoming.reviews.filter((r) => !ids.has(r.id))],
  });
}
export function buyingBackup(workspace: BuyingWorkspace): string {
  // Export within the same byte bound enforced by storage and imports.
  return JSON.stringify(parseBuyingWorkspace(workspace));
}
export function latestReview(reviews: TestDriveReview[], carId: string) {
  return reviews
    .filter((r) => r.carId === carId)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id),
    )[0];
}
export interface RequirementCheck {
  key: 'budget' | 'seats' | 'body' | 'drive' | 'power' | 'room';
  label: string;
  actual: number | string | null;
  target: number | string | string[];
  status: 'met' | 'unknown' | 'failed';
}
export function requirementChecks(car: Car, brief: BuyingBrief): RequirementCheck[] {
  const checks: RequirementCheck[] = [];
  function check(
    key: RequirementCheck['key'],
    label: string,
    actual: RequirementCheck['actual'],
    target: RequirementCheck['target'],
    meets: boolean,
  ) {
    checks.push({
      key,
      label,
      actual,
      target,
      status: actual === null ? 'unknown' : meets ? 'met' : 'failed',
    });
  }
  if (brief.budget !== null)
    check(
      'budget',
      'Within budget',
      car.facts.msrpCad.value,
      brief.budget,
      (car.facts.msrpCad.value ?? Infinity) <= brief.budget,
    );
  if (brief.minSeats !== null)
    check(
      'seats',
      `${brief.minSeats}+ seats`,
      car.facts.seats.value,
      brief.minSeats,
      (car.facts.seats.value ?? 0) >= brief.minSeats,
    );
  if (brief.bodyRequired)
    check(
      'body',
      'Required body style',
      vehicleBodyStyle(car) === 'Not verified' ? null : vehicleBodyStyle(car),
      brief.bodies,
      brief.bodies.includes(vehicleBodyStyle(car)),
    );
  if (brief.driveRequired)
    check(
      'drive',
      `${brief.drive} required`,
      car.drivetrain === 'Not verified' ? null : car.drivetrain,
      brief.drive,
      car.drivetrain === brief.drive,
    );
  if (brief.powerRequired)
    check(
      'power',
      `${brief.horsepower}+ hp`,
      car.facts.horsepower.value,
      brief.horsepower,
      (car.facts.horsepower.value ?? 0) >= brief.horsepower,
    );
  if (brief.roomRequired)
    check(
      'room',
      `${brief.rearLegroom}+ mm rear legroom`,
      car.facts.rearLegroomMm.value,
      brief.rearLegroom,
      (car.facts.rearLegroomMm.value ?? 0) >= brief.rearLegroom,
    );
  return checks;
}
export function assessRequirements(car: Car, brief: BuyingBrief) {
  const checks = requirementChecks(car, brief);
  return {
    matched: checks.filter((check) => check.status === 'met').map((check) => check.label),
    unknown: checks.filter((check) => check.status === 'unknown').map((check) => check.label),
    failed: checks.filter((check) => check.status === 'failed').map((check) => check.label),
  };
}
export function matchesBrief(car: Car, brief: BuyingBrief, reviews: TestDriveReview[]) {
  const needs = assessRequirements(car, brief);
  return (
    !needs.failed.length &&
    (brief.includeUnverified || !needs.unknown.length) &&
    !(brief.hideRuledOut && latestReview(reviews, car.id)?.verdict === 'ruled-out')
  );
}
export function scoreBuyingBrief(car: Car, brief: BuyingBrief, energy: EnergySettings) {
  const needs = assessRequirements(car, brief);
  const contributions: {
    priority: BriefPriority;
    value: number;
    weight: number;
    points: number;
  }[] = [];
  if (needs.failed.length || needs.unknown.length)
    return {
      score: null,
      contributions,
      reason: needs.failed.length
        ? `Does not meet: ${needs.failed.join(', ')}.`
        : `Requirements need checking: ${needs.unknown.join(', ')}.`,
    };
  const keys = (Object.keys(brief.weights) as BriefPriority[]).filter(
    (key) =>
      brief.weights[key] > 0 &&
      !(key === 'drive' && brief.drive === 'Any') &&
      !(key === 'body' && !brief.bodies.length),
  );
  const total = keys.reduce((sum, key) => sum + brief.weights[key], 0);
  if (!total)
    return {
      score: null,
      contributions,
      reason: 'Choose at least one preference to calculate fit.',
    };
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  for (const key of keys) {
    let value: number | null = null,
      desirability = 0;
    if (key === 'price') {
      value = car.facts.msrpCad.value;
      if (value !== null)
        desirability = brief.budget
          ? clamp((brief.budget - value) / (brief.budget * 0.5))
          : clamp((60000 - value) / 30000);
    }
    if (key === 'energy') {
      const estimate = estimateEnergy(car, energy);
      value = estimate.available ? estimate.total : null;
      if (value !== null) desirability = clamp(1 - value / 24);
    }
    if (key === 'cargo') {
      value = car.facts.cargoSeatsUpL.value;
      if (value !== null) desirability = clamp(value / brief.cargo);
    }
    if (key === 'room') {
      value = car.facts.rearLegroomMm.value;
      if (value !== null) desirability = clamp(value / brief.rearLegroom);
    }
    if (key === 'power') {
      value = car.facts.horsepower.value;
      if (value !== null) desirability = clamp(value / brief.horsepower);
    }
    if (key === 'drive') {
      value = car.drivetrain === 'Not verified' ? null : Number(car.drivetrain === brief.drive);
      desirability = value ?? 0;
    }
    if (key === 'body') {
      const body = vehicleBodyStyle(car);
      value = body === 'Not verified' ? null : Number(brief.bodies.includes(body));
      desirability = value ?? 0;
    }
    if (value === null)
      return {
        score: null,
        contributions: [],
        reason: `Missing ${briefPriorityLabels[key].toLowerCase()} data for your brief.`,
      };
    contributions.push({
      priority: key,
      value,
      weight: brief.weights[key],
      points: ((desirability * brief.weights[key]) / total) * 100,
    });
  }
  return {
    score: Math.round(contributions.reduce((sum, c) => sum + c.points, 0)),
    contributions,
    reason: null,
  };
}
