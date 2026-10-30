import { describe, expect, it } from 'vitest';
import { catalog } from '@oss/car-catalog';
import type { Car } from '@oss/car-catalog';
import {
  defaultEnergy,
  defaultFilters,
  defaultWeights,
  filterCars,
  scoreCar,
  uncheckedLimits,
} from './domain';
import {
  emptyBuyingWorkspace,
  latestReview,
  mergeBuyingWorkspace,
  parseBuyingWorkspace,
  parseReview,
  readBuyingWorkspace,
  ruledOutIds,
  buyingBackup,
  buyingFileLimit,
} from './buying';
import type { TestDriveReview } from './buying';
import { deleteReview, updateReview } from './useBuyingWorkspace';

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
describe('catalog requirements', () => {
  const limits = {
    ...defaultFilters,
    budget: 50000,
    minSeats: 4,
    minHorsepower: 250,
    minRearLegroom: 1000,
  };
  it('applies price, seat, power and legroom limits to verified figures', () => {
    const c = car();
    expect(filterCars([c], limits)).toEqual([c]);
    for (const [key, value] of [
      ['msrpCad', 50001],
      ['seats', 3],
      ['horsepower', 249],
      ['rearLegroomMm', 999],
    ] as const) {
      const failing = car();
      failing.facts[key].value = value;
      expect(filterCars([failing], limits)).toEqual([]);
      expect(filterCars([failing], { ...limits, includeUnverified: true })).toEqual([]);
    }
  });
  it('keeps unverified figures only when asked, and names the limits to check', () => {
    const c = car();
    c.facts.horsepower.value = null;
    c.facts.seats.value = null;
    expect(filterCars([c], limits)).toEqual([]);
    expect(filterCars([c], { ...limits, includeUnverified: true })).toEqual([c]);
    expect(uncheckedLimits(c, limits)).toEqual(['seats', 'horsepower']);
    expect(uncheckedLimits(c, defaultFilters)).toEqual([]);
  });
  it('scores horsepower without letting personal ratings change published-fit scores', () => {
    const c = car();
    const weights = { ...defaultWeights, price: 0, efficiency: 0, power: 3 };
    expect(scoreCar(c, weights, defaultEnergy).score).toBe(33);
    c.facts.horsepower.value = null;
    expect(scoreCar(c, weights, defaultEnergy)).toMatchObject({
      score: null,
      reason: 'Missing horsepower data.',
    });
  });
  it('hides vehicles ruled out by the latest dated review only when asked', () => {
    const c = car(),
      r = { ...review(), carId: c.id, verdict: 'ruled-out' as const };
    const hiding = { ...defaultFilters, hideRuledOut: true };
    expect(ruledOutIds([r])).toEqual([c.id]);
    expect(filterCars([c], defaultFilters, [], ruledOutIds([r]))).toEqual([c]);
    expect(filterCars([c], hiding, [], ruledOutIds([r]))).toEqual([]);
    const later = { ...r, id: 'review-b', date: '2026-10-21', verdict: 'consider' as const };
    expect(ruledOutIds([r, later])).toEqual([]);
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
  it('round trips multiline personal notes and unavailable configuration reviews', () => {
    const w = {
      ...emptyBuyingWorkspace(),
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
  it('reads backups from versions that also stored a buying brief and drops the brief', () => {
    const legacy = { ...emptyBuyingWorkspace(), brief: { budget: 40000 }, reviews: [review()] };
    expect(readBuyingWorkspace(JSON.stringify(legacy))).toEqual({
      ...emptyBuyingWorkspace(),
      reviews: [review()],
    });
    expect(readBuyingWorkspace(JSON.stringify({ ...legacy, brief: null }))).not.toHaveProperty(
      'brief',
    );
    expect(() => parseBuyingWorkspace({ ...legacy, brief: 'yes' })).toThrow('Unsupported');
  });
  it('rejects unsupported, malformed, over-limit and ambiguous data', () => {
    expect(() => readBuyingWorkspace('{')).toThrow();
    expect(() => parseBuyingWorkspace({ ...emptyBuyingWorkspace(), version: 2 })).toThrow(
      'version',
    );
    expect(() => parseBuyingWorkspace({ ...emptyBuyingWorkspace(), notes: 'x' })).toThrow();
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
  it('merges new IDs while preserving conflicting reviews', () => {
    const current = { ...emptyBuyingWorkspace(), reviews: [review()] };
    const incoming = {
      ...emptyBuyingWorkspace(),
      reviews: [{ ...review(), notes: 'Conflicting version' }, review('review-b')],
    };
    expect(mergeBuyingWorkspace(current, incoming).reviews).toEqual([review(), review('review-b')]);
  });
  it('rejects stale edits and removals while preserving independent changes', () => {
    const original = review(),
      changed = { ...original, notes: 'Newer notes' };
    const w = {
      ...emptyBuyingWorkspace(),
      reviews: [changed, review('review-b')],
    };
    expect(() => updateReview(w, original, { ...original, notes: 'Old editor' })).toThrow(
      'another tab',
    );
    expect(() => deleteReview(w, original)).toThrow('another tab');
    expect(() => updateReview({ ...w, reviews: [] }, original, original)).toThrow('another tab');
    expect(updateReview(w, changed, { ...changed, notes: 'Corrected' }).reviews).toContainEqual(
      review('review-b'),
    );
    expect(deleteReview(w, changed).reviews).toEqual([review('review-b')]);
  });
});
