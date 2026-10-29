import { describe, expect, it } from 'vitest';
import { catalog } from '@oss/car-catalog';
import type { Car } from '@oss/car-catalog';
import { defaultEnergy, defaultWeights, scoreCar } from './domain';
import {
  assessRequirements,
  emptyBrief,
  emptyBuyingWorkspace,
  latestReview,
  matchesBrief,
  mergeBuyingWorkspace,
  parseBuyingBrief,
  parseBuyingWorkspace,
  parseReview,
  readBuyingWorkspace,
  buyingBackup,
  buyingFileLimit,
  scoreBuyingBrief,
} from './buying';
import type { BriefPriority, BuyingBrief, TestDriveReview } from './buying';
import { deleteReview, updateBrief, updateReview } from './useBuyingWorkspace';

function car(values: Partial<Car> = {}): Car {
  const c = structuredClone(catalog.cars[0]!);
  Object.assign(c, values);
  for (const [key, value] of Object.entries({
    msrpCad: 45000,
    seats: 4,
    horsepower: 250,
    rearLegroomMm: 1000,
    cargoSeatsUpL: 700,
  }))
    c.facts[key as keyof Car['facts']].value = value;
  return c;
}
function brief(only: BriefPriority): BuyingBrief {
  const b = emptyBrief();
  for (const key of Object.keys(b.weights) as BriefPriority[])
    b.weights[key] = Number(key === only);
  return b;
}
function review(id = 'review-a', date = '2026-10-20'): TestDriveReview {
  return {
    id,
    carId: catalog.cars[0]!.id,
    vehicleName: 'My test vehicle',
    date,
    createdAt: '2026-10-20T15:00:00.000Z',
    verdict: 'unsure',
    ratings: { enjoyment: null, comfort: null, rearSpace: null, visibility: null },
    notes: '',
  };
}
describe('buying brief matching', () => {
  it('uses chosen body styles and power instead of inferring a lifestyle', () => {
    const b = brief('power');
    b.bodies = ['Coupe', 'Convertible'];
    b.weights.body = 1;
    const coupe = car({ bodyStyle: 'Coupe' }),
      van = car({ bodyStyle: 'Minivan' });
    van.facts.horsepower.value = 350;
    expect(scoreBuyingBrief(coupe, b, defaultEnergy).score).toBe(92);
    expect(scoreBuyingBrief(van, b, defaultEnergy).score).toBe(50);
    b.bodyRequired = true;
    expect(matchesBrief(van, b, [])).toBe(false);
    expect(matchesBrief(coupe, b, [])).toBe(true);
  });
  it('applies every hard requirement and keeps unknown facts distinct', () => {
    const b = emptyBrief();
    Object.assign(b, {
      budget: 50000,
      minSeats: 4,
      bodies: ['Coupe'],
      bodyRequired: true,
      drive: 'AWD',
      driveRequired: true,
      horsepower: 240,
      powerRequired: true,
      rearLegroom: 950,
      roomRequired: true,
    });
    const c = car({ bodyStyle: 'Coupe', drivetrain: 'AWD' });
    expect(assessRequirements(c, b)).toEqual({
      matched: [
        'Within budget',
        '4+ seats',
        'Required body style',
        'AWD required',
        '240+ hp',
        '950+ mm rear legroom',
      ],
      unknown: [],
      failed: [],
    });
    expect(matchesBrief(c, b, [])).toBe(true);
    c.facts.horsepower.value = null;
    expect(matchesBrief(c, b, [])).toBe(false);
    b.includeUnverified = true;
    expect(matchesBrief(c, b, [])).toBe(true);
    expect(scoreBuyingBrief(c, b, defaultEnergy)).toMatchObject({
      score: null,
      reason: 'Requirements need checking: 240+ hp.',
    });
    c.drivetrain = '4WD';
    expect(matchesBrief(c, b, [])).toBe(false);
  });
  it('makes price scores relative to the chosen budget and caps targets', () => {
    const b = brief('price'),
      c = car();
    b.budget = 60000;
    expect(scoreBuyingBrief(c, b, defaultEnergy).score).toBe(50);
    b.budget = 90000;
    expect(scoreBuyingBrief(c, b, defaultEnergy).score).toBe(100);
    b.budget = 40000;
    expect(scoreBuyingBrief(c, b, defaultEnergy).score).toBeNull();
    const space = brief('room');
    space.rearLegroom = 900;
    expect(scoreBuyingBrief(c, space, defaultEnergy).score).toBe(100);
    c.facts.rearLegroomMm.value = 1200;
    expect(scoreBuyingBrief(c, space, defaultEnergy).score).toBe(100);
  });
  it('requires active facts, ignores unused preferences and preserves legacy scoring when paused', () => {
    const c = car();
    c.facts.horsepower.value = null;
    const b = brief('power');
    expect(scoreBuyingBrief(c, b, defaultEnergy).score).toBeNull();
    b.weights.power = 0;
    b.weights.price = 1;
    b.weights.drive = 5;
    b.weights.body = 5;
    expect(scoreBuyingBrief(c, b, defaultEnergy).score).toBe(50);
    expect(scoreCar(c, defaultWeights, defaultEnergy, { ...b, enabled: false })).toEqual(
      scoreCar(c, defaultWeights, defaultEnergy),
    );
  });
  it('does not let personal ratings change published-fit scores; latest verdict hiding is opt-in', () => {
    const b = brief('price'),
      c = car(),
      r = { ...review(), verdict: 'ruled-out' as const };
    expect(matchesBrief(c, b, [r])).toBe(true);
    b.hideRuledOut = true;
    expect(matchesBrief(c, b, [r])).toBe(false);
    const later = { ...r, id: 'review-b', date: '2026-10-21', verdict: 'consider' as const };
    expect(matchesBrief(c, b, [r, later])).toBe(true);
    expect(scoreBuyingBrief(c, b, defaultEnergy).score).toBe(50);
  });
  it('orders multiple same-day visits by creation time and retains unknown ratings', () => {
    const a = review('review-z'),
      b = { ...review('review-a'), createdAt: '2026-10-20T16:00:00.000Z' };
    expect(latestReview([a, b], a.carId)).toEqual(b);
    expect(parseReview(a).ratings.enjoyment).toBeNull();
  });
});
describe('buying storage and portable reviews', () => {
  it('round trips an export near the byte limit without whitespace making it unimportable', () => {
    const sample = { ...review(), id: 'review-00000', notes: 'x'.repeat(4000) };
    const recordBytes = new TextEncoder().encode(JSON.stringify(sample)).length + 1;
    const count = Math.floor((buyingFileLimit - 1000) / recordBytes);
    const workspace = {
      ...emptyBuyingWorkspace(),
      reviews: Array.from({ length: count }, (_, index) => ({
        ...sample,
        id: `review-${String(index).padStart(5, '0')}`,
      })),
    };
    expect(new TextEncoder().encode(JSON.stringify(workspace, null, 2)).length).toBeGreaterThan(
      buyingFileLimit,
    );
    const backup = buyingBackup(workspace);
    expect(new TextEncoder().encode(backup).length).toBeLessThanOrEqual(buyingFileLimit);
    expect(readBuyingWorkspace(backup)).toEqual(workspace);
  });
  it('round trips briefs, multiline personal notes and unavailable configuration reviews', () => {
    const w = {
      ...emptyBuyingWorkspace(),
      brief: emptyBrief(),
      reviews: [
        {
          ...review(),
          carId: 'unavailable-car',
          notes: 'Steering felt great.\nCheck rear-seat access next time.',
        },
      ],
    };
    expect(readBuyingWorkspace(JSON.stringify(w))).toEqual(w);
    expect(readBuyingWorkspace(null)).toEqual(emptyBuyingWorkspace());
  });
  it('rejects unsupported, malformed, over-limit and ambiguous data', () => {
    expect(() => readBuyingWorkspace('{')).toThrow();
    expect(() => parseBuyingWorkspace({ ...emptyBuyingWorkspace(), version: 2 })).toThrow(
      'version',
    );
    expect(() => parseBuyingBrief({ ...emptyBrief(), age: 70 })).toThrow();
    expect(() => parseBuyingBrief({ ...emptyBrief(), bodyRequired: true })).toThrow('body style');
    expect(() =>
      parseBuyingBrief({ ...emptyBrief(), weights: { ...emptyBrief().weights, power: 6 } }),
    ).toThrow();
    expect(() => parseReview({ ...review(), date: '2026-02-30' })).toThrow('date');
    expect(() =>
      parseReview({ ...review(), ratings: { ...review().ratings, comfort: 0 } }),
    ).toThrow();
    expect(() => parseReview({ ...review(), notes: 'x'.repeat(4001) })).toThrow();
    expect(() =>
      parseBuyingWorkspace({ ...emptyBuyingWorkspace(), reviews: [review(), review()] }),
    ).toThrow('Duplicate');
    expect(() => readBuyingWorkspace(' '.repeat(2_000_001))).toThrow('large');
  });
  it('merges new IDs while preserving existing brief and conflicting reviews', () => {
    const current = { ...emptyBuyingWorkspace(), brief: emptyBrief(), reviews: [review()] };
    const incoming = {
      ...emptyBuyingWorkspace(),
      brief: { ...emptyBrief(), budget: 80000 },
      reviews: [{ ...review(), notes: 'Conflicting version' }, review('review-b')],
    };
    const result = mergeBuyingWorkspace(current, incoming);
    expect(result.brief).toEqual(current.brief);
    expect(result.reviews).toEqual([review(), review('review-b')]);
    expect(mergeBuyingWorkspace(emptyBuyingWorkspace(), incoming).brief).toEqual(incoming.brief);
  });
  it('rejects stale edits, removals and brief replacement while preserving independent changes', () => {
    const original = review(),
      changed = { ...original, notes: 'Newer notes' };
    const w = {
      ...emptyBuyingWorkspace(),
      brief: emptyBrief(),
      reviews: [changed, review('review-b')],
    };
    expect(() => updateReview(w, original, { ...original, notes: 'Old editor' })).toThrow(
      'another tab',
    );
    expect(() => deleteReview(w, original)).toThrow('another tab');
    expect(() => updateReview({ ...w, reviews: [] }, original, original)).toThrow('another tab');
    expect(() => updateBrief(w, null, emptyBrief())).toThrow('another tab');
    expect(updateReview(w, changed, { ...changed, notes: 'Corrected' }).reviews).toContainEqual(
      review('review-b'),
    );
    expect(deleteReview(w, changed).reviews).toEqual([review('review-b')]);
  });
});
