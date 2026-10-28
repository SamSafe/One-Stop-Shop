import { describe, expect, it } from 'vitest';
import { garageCalendar } from './calendar';
import type { Garage } from './domain';

const fixture = (): Garage => ({
  version: 1,
  revision: 'test',
  vehicles: [
    {
      id: 'car',
      make: 'Example',
      model: 'Sedan',
      year: 2020,
      engine: '',
      nickname: 'Daily, car; 雪'.repeat(8),
      odometerKm: 20000,
      updatedOn: '2026-10-27',
      records: [],
      reminders: [
        {
          id: 'oil',
          title: 'Oil\rchange, filter; check',
          km: 6000,
          months: 6,
          lastOn: '2026-10-01',
          lastKm: 18000,
        },
        {
          id: 'unknown',
          title: 'Unknown history',
          km: 6000,
          months: 6,
          lastOn: null,
          lastKm: null,
        },
        {
          id: 'distance',
          title: 'Distance only',
          km: 5000,
          months: null,
          lastOn: null,
          lastKm: 18000,
        },
      ],
    },
  ],
});

describe('garage calendar snapshots', () => {
  it('exports only actual next dates with exclusive day ends and mileage context', () => {
    const calendar = garageCalendar(fixture(), new Date('2026-10-27T12:00:00Z'));
    const unfolded = calendar.content.replace(/\r\n /g, '');
    expect(calendar.count).toBe(1);
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20270401\r\nDTEND;VALUE=DATE:20270402');
    expect(unfolded).toContain('DTSTAMP:20261027T120000Z');
    expect(unfolded).toContain('24\\,000 km');
    expect(unfolded).not.toContain('RRULE');
    expect(unfolded).not.toContain('Unknown history');
    expect(unfolded).not.toContain('Distance only');
  });
  it('escapes owner text and folds UTF-8 without splitting characters or allowing injected properties', () => {
    const { content } = garageCalendar(fixture());
    expect(content.replace(/\r\n /g, '')).toContain(
      'SUMMARY:Oil\\nchange\\, filter\\; check · Daily\\, car\\; 雪',
    );
    expect(content.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true,
    );
    expect(
      new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(content)),
    ).toBe(content);
  });
  it('uses corrected actual service history and stable event IDs on re-export', () => {
    const garage = fixture();
    garage.vehicles[0]!.records.push({
      id: 'receipt',
      reminderId: 'oil',
      title: 'Oil changed',
      on: '2026-10-15',
      km: 19000,
      note: '',
    });
    const first = garageCalendar(garage),
      second = garageCalendar(garage);
    expect(first.content).toContain('DTSTART;VALUE=DATE:20270415');
    expect(first.content.match(/UID:[^\r]+/)?.[0]).toBe(second.content.match(/UID:[^\r]+/)?.[0]);
  });
  it('keeps event IDs distinct for different hyphenated vehicle/reminder pairs', () => {
    const garage = fixture(),
      first = garage.vehicles[0]!,
      second = structuredClone(first);
    first.id = 'a-b';
    first.reminders[0]!.id = 'c';
    second.id = 'a';
    second.reminders[0]!.id = 'b-c';
    garage.vehicles.push(second);
    const ids = garageCalendar(garage).content.match(/UID:[^\r]+/g)!;
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
