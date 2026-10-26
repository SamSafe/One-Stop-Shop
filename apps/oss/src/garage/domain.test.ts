import { describe, it, expect } from 'vitest';
import {
  addMonths,
  emptyGarage,
  parseGarage,
  readGarage,
  reminderDue,
  removeReminder,
  validDate,
  updateOdometer,
} from './domain';
import type { OwnedVehicle, Reminder } from './domain';
const vehicle = (): OwnedVehicle => ({
  id: 'v1',
  make: 'Hyundai',
  model: 'Elantra',
  year: 2016,
  engine: 'GL',
  nickname: '',
  odometerKm: 120000,
  updatedOn: '2026-10-26',
  records: [],
  reminders: [],
});
const reminder = (): Reminder => ({
  id: 'r1',
  title: 'Oil and filter',
  km: 6000,
  months: 6,
  lastOn: '2026-05-01',
  lastKm: 115000,
});
describe('owned garage', () => {
  it('uses calendar months, clamps month ends and handles leap years', () => {
    expect(addMonths('2025-08-31', 6)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-12-31', 2)).toBe('2027-02-28');
    expect(validDate('2026-02-30')).toBe(false);
  });
  it('becomes due on whichever threshold occurs first', () => {
    const v = vehicle(),
      r = reminder();
    expect(reminderDue(v, r, '2026-10-26')).toMatchObject({
      dueOn: '2026-11-01',
      dueKm: 121000,
      status: 'Due soon',
    });
    expect(reminderDue({ ...v, odometerKm: 121000 }, r, '2026-10-26').status).toBe('Due now');
    expect(reminderDue(v, r, '2026-11-02').status).toBe('Overdue');
    expect(reminderDue({ ...v, odometerKm: 122000 }, r, '2026-10-26').status).toBe('Overdue');
  });
  it('resets from actual completion and does not treat an old entry as new work', () => {
    const v = vehicle(),
      r = reminder();
    v.records = [
      { id: 's1', reminderId: 'r1', title: r.title, on: '2026-10-20', km: 119000, note: '' },
    ];
    expect(reminderDue(v, r, '2026-10-26')).toMatchObject({
      dueOn: '2027-04-20',
      dueKm: 125000,
      status: 'Upcoming',
    });
    v.records[0]!.on = '2025-01-01';
    v.records[0]!.km = 100000;
    expect(reminderDue(v, r, '2026-10-26')).toMatchObject({ dueOn: '2026-11-01', dueKm: 121000 });
  });
  it('removes reminders while retaining service records', () => {
    const v = vehicle();
    v.reminders = [reminder()];
    v.records = [
      { id: 's1', reminderId: 'r1', title: 'Oil', on: '2026-10-20', km: 119000, note: 'Shop' },
    ];
    const next = removeReminder(v, 'r1');
    expect(next.reminders).toEqual([]);
    expect(next.records[0]).toMatchObject({ reminderId: null, note: 'Shop' });
  });
  it('roundtrips owned vehicles of any age without a catalog reference', () => {
    const data = { ...emptyGarage(), vehicles: [vehicle()] };
    expect(readGarage(JSON.stringify(data))).toEqual(data);
  });
  it('rejects unsupported or corrupt backups without accepting silent data loss', () => {
    for (const input of [
      { version: 2, revision: 'future', vehicles: [] },
      { ...emptyGarage(), surprise: true },
      { ...emptyGarage(), vehicles: [vehicle(), vehicle()] },
      { ...emptyGarage(), vehicles: [{ ...vehicle(), odometerKm: -1 }] },
      { ...emptyGarage(), vehicles: [{ ...vehicle(), updatedOn: '2026-02-30' }] },
    ])
      expect(() => parseGarage(input)).toThrow();
    expect(() => readGarage('x'.repeat(2000001))).toThrow(/2 MB/);
  });
  it('requires real reminder baselines and prevents falsely attributed manufacturer intervals', () => {
    const v = vehicle();
    v.reminders = [{ ...reminder(), lastKm: null }];
    expect(() => parseGarage({ ...emptyGarage(), vehicles: [v] })).toThrow(/last completion/);
    v.reminders = [{ ...reminder(), manufacturerKey: 'toyota-2025-visit' }];
    expect(() => parseGarage({ ...emptyGarage(), vehicles: [v] })).toThrow(/Manufacturer/);
  });
});

it('prevents a stale form from lowering a newer odometer', () => {
  expect(() => updateOdometer(vehicle(), 119000)).toThrow(/latest saved/);
  expect(updateOdometer(vehicle(), 121000).odometerKm).toBe(121000);
});

it('uses the same UTF-8 byte limit for stored data and imported backup files', () => {
  expect(() => readGarage('é'.repeat(1000001))).toThrow(/2 MB/);
});
