import { describe, expect, it } from 'vitest';
import {
  automaticallySchedule,
  deleteReminder,
  emptyGarage,
  parseGarage,
  reminderDue,
  reviseReminder,
} from './domain';
import type { OwnedVehicle, Reminder } from './domain';
import { garageCalendar } from './calendar';

const vehicle = (): OwnedVehicle => ({
  id: 'car',
  year: 2020,
  make: 'Example',
  model: 'Sedan',
  engine: '',
  nickname: '',
  odometerKm: 20000,
  updatedOn: '2026-10-27',
  reminders: [
    {
      id: 'oil',
      title: 'Oil and filter',
      km: 6000,
      months: 6,
      lastOn: '2026-10-20',
      lastKm: 20000,
    },
  ],
  records: [
    {
      id: 'receipt',
      reminderId: 'oil',
      title: 'Oil and filter',
      on: '2026-09-01',
      km: 19000,
      note: 'Original receipt',
      costCents: 9529,
      provider: 'Atelier North',
    },
  ],
});

describe('reminder corrections', () => {
  it('corrects an interval and its starting history in place while keeping actual linked work and calendar identity', () => {
    const v = vehicle(),
      original = structuredClone(v),
      r = v.reminders[0]!;
    const next = reviseReminder(v, r, {
      ...r,
      title: 'Personal oil plan',
      km: 5000,
      months: 2,
      lastOn: null,
      lastKm: null,
    });
    expect(next.reminders).toHaveLength(1);
    expect(next.reminders[0]!.id).toBe(r.id);
    expect(next.records).toEqual(original.records);
    expect(v).toEqual(original);
    expect(reminderDue(next, next.reminders[0]!, '2026-10-27')).toMatchObject({
      dueOn: '2026-11-01',
      dueKm: 24000,
      status: 'Due soon',
    });
    const before = garageCalendar({ ...emptyGarage(), vehicles: [v] });
    const after = garageCalendar({ ...emptyGarage(), vehicles: [next] });
    expect(before.content.match(/UID:[^\r]+/)?.[0]).toBe(after.content.match(/UID:[^\r]+/)?.[0]);
    expect(after.content).toContain('DTSTART;VALUE=DATE:20261101');
    expect(parseGarage({ ...emptyGarage(), vehicles: [next] }).vehicles[0]).toEqual(next);
  });
  it('preserves newer mileage and service entered while the interval editor is open', () => {
    const original = vehicle(),
      current = structuredClone(original);
    current.odometerKm = 25000;
    current.records.push({
      ...current.records[0]!,
      id: 'new-receipt',
      on: '2026-10-27',
      km: 25000,
    });
    const r = original.reminders[0]!;
    const next = reviseReminder(current, r, { ...r, km: 5000, months: 2 });
    expect(next.odometerKm).toBe(25000);
    expect(next.records).toEqual(current.records);
    expect(reminderDue(next, next.reminders[0]!, '2026-10-27')).toMatchObject({
      dueOn: '2026-12-27',
      dueKm: 30000,
    });
  });
  it('rejects changed or removed reminders for both pending edits and removals', () => {
    const original = vehicle(),
      r = original.reminders[0]!;
    const changes: Partial<Reminder>[] = [
      { title: 'New title' },
      { km: 7000 },
      { months: 12 },
      { lastOn: '2026-09-01' },
      { lastKm: 18000 },
      { manufacturerKey: 'toyota-2025-visit' },
    ];
    for (const change of changes) {
      const current = { ...original, reminders: [{ ...r, ...change }] };
      expect(() => reviseReminder(current, r, r)).toThrow('changed in another tab');
      expect(() => deleteReminder(current, r)).toThrow('changed in another tab');
    }
    const removed = { ...original, reminders: [] };
    expect(() => reviseReminder(removed, r, r)).toThrow('removed in another tab');
    expect(() => deleteReminder(removed, r)).toThrow('removed in another tab');
  });
  it('retains identity and reviewed manufacturer attribution and relies on strict saved-data validation', () => {
    const v = vehicle(),
      r = v.reminders[0]!;
    expect(() => reviseReminder(v, r, { ...r, id: 'new-id' })).toThrow('original identity');
    expect(() => reviseReminder(v, r, { ...r, manufacturerKey: 'toyota-2025-visit' })).toThrow(
      'verified intervals',
    );
    const invalid = reviseReminder(v, r, { ...r, km: null, months: null });
    expect(() => parseGarage({ ...emptyGarage(), vehicles: [invalid] })).toThrow(
      'distance or time interval',
    );
    const supported = automaticallySchedule({
      ...v,
      make: 'Hyundai',
      model: 'Elantra',
      year: 2016,
      reminders: [],
      records: [],
    });
    const reviewed = supported.reminders[0]!;
    expect(() => reviseReminder(supported, reviewed, { ...reviewed, km: 9999 })).toThrow(
      'verified intervals',
    );
    const removed = deleteReminder(supported, reviewed);
    expect(
      automaticallySchedule(removed).reminders.some(
        (r) => r.manufacturerKey === reviewed.manufacturerKey,
      ),
    ).toBe(false);
  });
  it('keeps all service details when a freshly reviewed reminder is removed', () => {
    const v = vehicle();
    v.records.push({ ...v.records[0]!, id: 'new-receipt', on: '2026-10-27', km: 20000 });
    const next = deleteReminder(v, v.reminders[0]!);
    expect(next.reminders).toEqual([]);
    expect(next.records).toEqual(v.records.map((record) => ({ ...record, reminderId: null })));
    expect(v.records[0]!.reminderId).toBe('oil');
  });
});
