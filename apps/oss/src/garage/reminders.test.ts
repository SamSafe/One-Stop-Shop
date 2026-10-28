import { describe, expect, it } from 'vitest';
import type { OwnedVehicle, Reminder } from './domain';
import { garageReminders, matchesReminderFilter, reminderTargetId } from './reminders';

const reminder = (id: string, values: Partial<Reminder> = {}): Reminder => ({
  id,
  title: id,
  km: null,
  months: 6,
  lastOn: '2026-04-27',
  lastKm: null,
  ...values,
});
const vehicle = (id: string, reminders: Reminder[]): OwnedVehicle => ({
  id,
  year: 2020,
  make: 'Example',
  model: 'Sedan',
  nickname: id,
  engine: '',
  odometerKm: 20000,
  updatedOn: '2026-10-27',
  reminders,
  records: [],
});

describe('garage reminder overview', () => {
  it('prioritizes actual due states across vehicles without changing the garage or conflating unknown history', () => {
    const vehicles = [
      vehicle('daily', [
        reminder('unknown', { lastOn: null }),
        reminder('upcoming', { lastOn: '2026-10-01' }),
        reminder('soon', { lastOn: '2026-05-01' }),
        reminder('mileage', { km: 6000, lastOn: null, lastKm: 10000 }),
      ]),
      vehicle('weekend', [reminder('due'), reminder('overdue', { lastOn: '2026-04-01' })]),
    ];
    const original = structuredClone(vehicles);
    const entries = garageReminders(vehicles, '2026-10-27');
    expect(
      entries.map(({ vehicle, reminder, due }) => [vehicle.id, reminder.id, due.status]),
    ).toEqual([
      ['daily', 'mileage', 'Overdue'],
      ['weekend', 'overdue', 'Overdue'],
      ['weekend', 'due', 'Due now'],
      ['daily', 'soon', 'Due soon'],
      ['daily', 'unknown', 'Needs history'],
      ['daily', 'upcoming', 'Upcoming'],
    ]);
    expect(entries.filter((entry) => matchesReminderFilter(entry, 'attention'))).toHaveLength(5);
    expect(entries.filter((entry) => matchesReminderFilter(entry, 'due'))).toHaveLength(3);
    expect(entries.filter((entry) => matchesReminderFilter(entry, 'soon'))).toHaveLength(1);
    expect(entries.filter((entry) => matchesReminderFilter(entry, 'history'))).toHaveLength(1);
    expect(vehicles).toEqual(original);
  });
  it('recalculates from real service history and the current day', () => {
    const v = vehicle('car', [reminder('oil', { lastOn: null })]);
    v.records = [
      { id: 'record', reminderId: 'oil', title: 'Oil', on: '2026-04-27', km: 19000, note: '' },
    ];
    expect(garageReminders([v], '2026-10-26')[0]!.due.status).toBe('Due soon');
    expect(garageReminders([v], '2026-10-27')[0]!.due.status).toBe('Due now');
    expect(garageReminders([v], '2026-10-28')[0]!.due.status).toBe('Overdue');
    expect(garageReminders([], '2026-10-27')).toEqual([]);
  });
  it('distinguishes identical reminder IDs and hyphenated pairs in different vehicles', () => {
    const pairs = [
      ['daily', 'oil'],
      ['weekend', 'oil'],
      ['a-b', 'c'],
      ['a', 'b-c'],
    ];
    expect(new Set(pairs.map(([v, r]) => reminderTargetId(v!, r!))).size).toBe(4);
  });
});
