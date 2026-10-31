import { describe, expect, it } from 'vitest';
import { curatedCatalog } from '@oss/car-catalog';
import { defaultEnergy, defaultWeights, parseSharedState } from './domain';
import { initialBrowsingState, parseBrowsingState, serializeViewState } from './browsing';

const cars = curatedCatalog.cars;
describe('shareable browsing state', () => {
  it('roundtrips filters, sort, page, comparison, priorities and energy assumptions', () => {
    const browsing = initialBrowsingState();
    browsing.filters = {
      ...browsing.filters,
      query: 'hybrid 2026 crv',
      make: 'Honda',
      model: 'CR-V',
      year: '2026',
      budget: 42000,
      minSeats: 5,
      bodyStyle: 'SUV',
      fuel: 'Hybrid',
      drivetrain: 'AWD',
      recordKind: 'retail-trim',
      availability: 'not-checked',
      pricedOnly: true,
      savedOnly: true,
    };
    browsing.sort = 'fuel';
    browsing.scoredOnly = true;
    browsing.allTrims = true;
    browsing.page = 3;
    const shared = {
      compare: cars.slice(0, 2).map((car) => car.id),
      weights: { ...defaultWeights, room: 2 },
      energy: { ...defaultEnergy, kilometres: 24000 },
    };
    const query = serializeViewState(shared, browsing);
    expect(parseBrowsingState(query, cars)).toEqual(browsing);
    expect(parseSharedState(query, cars)).toEqual(shared);
  });
  it('leaves default views compact and rejects malformed filters and numbers', () => {
    expect(
      serializeViewState({ compare: [], weights: defaultWeights }, initialBrowsingState()),
    ).toBe('');
    const query =
      '?make=<script>&model=CR-V&year=1900&budget=Infinity&body=spaceship&seats=99&sort=unsafe&page=2e3&priced=yes&scored=yes&powertrain=imaginary&drive=invalid&class=invalid&kind=invalid&availability=invalid';
    expect(parseBrowsingState(query, cars)).toEqual(initialBrowsingState());
    expect(
      parseBrowsingState('?q=' + 'x'.repeat(1000) + '&page=-1', cars).filters.query,
    ).toHaveLength(100);
  });
  it('validates a model against its make and model year and bounds long inputs', () => {
    expect(parseBrowsingState('?make=Honda&model=Forester&year=2026', cars).filters.model).toBe(
      'all',
    );
    expect(parseBrowsingState('?make=Honda&model=CR-V&year=2026', cars).filters.model).toBe('CR-V');
    expect(parseBrowsingState('?model=CR-V', cars).filters.model).toBe('all');
    expect(parseBrowsingState('?page=9999999&budget=-1&seats=0', cars).page).toBe(1);
    expect(parseBrowsingState('?q=' + 'x'.repeat(5000) + '&make=Honda', cars).filters.make).toBe(
      'all',
    );
  });
});
