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
  vehicleDetails,
  reviseVehicleDetails,
  reviseServiceRecord,
  automaticallySchedule,
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

describe('automatic manufacturer maintenance', () => {
  it('adds reviewed tasks without inventing completions, mileage or dates', () => {
    const v = automaticallySchedule(vehicle());
    expect(v.reminders).toHaveLength(6);
    expect(v.records).toEqual([]);
    for (const r of v.reminders) {
      expect(r).toMatchObject({ lastOn: null, lastKm: null });
      expect(reminderDue(v, r, '2026-10-27')).toMatchObject({
        status: 'Needs history',
        dueOn: null,
        dueKm: null,
      });
    }
    expect(parseGarage({ ...emptyGarage(), vehicles: [v] }).vehicles[0]).toEqual(v);
    expect(automaticallySchedule(v)).toBe(v);
  });
  it('uses actual linked work and returns to an unknown baseline if that history is removed', () => {
    let v = automaticallySchedule(vehicle());
    const oil = v.reminders.find((r) => r.manufacturerKey === 'hyundai-2016-elantra-oil-severe')!;
    v = {
      ...v,
      records: [
        {
          id: 'receipt',
          reminderId: oil.id,
          title: oil.title,
          on: '2026-10-01',
          km: 119000,
          note: 'Actual service',
        },
      ],
    };
    expect(reminderDue(v, oil, '2026-10-27')).toMatchObject({
      dueOn: '2027-04-01',
      dueKm: 125000,
      status: 'Upcoming',
    });
    expect(reminderDue({ ...v, odometerKm: 125001 }, oil, '2026-10-27').status).toBe('Overdue');
    expect(reminderDue({ ...v, records: [] }, oil).status).toBe('Needs history');
  });
  it('keeps existing sourced reminders and remembers removals until explicitly restored', () => {
    const old = servicedVehicle();
    const v = automaticallySchedule(old);
    expect(
      v.reminders.filter((r) => r.manufacturerKey === 'hyundai-2016-elantra-oil-severe'),
    ).toHaveLength(1);
    expect(v.reminders[0]).toEqual(old.reminders[0]);
    const removed = automaticallySchedule(removeReminder(v, 'r1'));
    expect(removed.reminders).toHaveLength(5);
    expect(removed.records[0]).toMatchObject({
      id: 'service-1',
      reminderId: null,
      note: 'Original receipt',
    });
    expect(
      readGarage(JSON.stringify({ ...emptyGarage(), vehicles: [removed] })).vehicles[0]
        ?.suppressedMaintenance,
    ).toEqual(['hyundai-2016-elantra-oil-severe']);
    expect(automaticallySchedule({ ...removed, suppressedMaintenance: [] }).reminders).toHaveLength(
      6,
    );
  });
  it('replaces unconfigured plans on identity corrections without manufacturing personal intervals', () => {
    const v = automaticallySchedule(vehicle());
    const revised = reviseVehicleDetails(v, structuredClone(v), {
      ...vehicleDetails(v),
      make: 'Unknown',
      model: 'Vehicle',
    });
    expect(automaticallySchedule(revised).reminders).toEqual([]);
    expect(revised.records).toEqual([]);
    expect(parseGarage({ ...emptyGarage(), vehicles: [revised] }).vehicles).toHaveLength(1);
  });
  it('preserves a configured automatic task as personal only after explicit review', () => {
    const v = automaticallySchedule(vehicle());
    const oil = v.reminders.find((r) => r.manufacturerKey === 'hyundai-2016-elantra-oil-severe')!;
    v.records = [
      {
        id: 'receipt',
        reminderId: oil.id,
        title: oil.title,
        on: '2026-10-01',
        km: 119000,
        note: 'Receipt',
      },
    ];
    const details = { ...vehicleDetails(v), model: 'Different vehicle' };
    expect(() => reviseVehicleDetails(v, structuredClone(v), details)).toThrow(/personal/);
    const revised = reviseVehicleDetails(v, structuredClone(v), details, true);
    expect(revised.reminders).toHaveLength(1);
    expect(revised.reminders[0]).toMatchObject({ lastOn: null, lastKm: null });
    expect(revised.reminders[0]?.manufacturerKey).toBeUndefined();
    expect(parseGarage({ ...emptyGarage(), vehicles: [revised] }).vehicles).toHaveLength(1);
    const corrected = reviseServiceRecord(revised, revised.records[0]!, {
      ...revised.records[0]!,
      on: '2026-09-01',
      km: 118000,
    });
    expect(reminderDue(corrected, corrected.reminders[0]!, '2026-10-27')).toMatchObject({
      dueOn: '2027-03-01',
      dueKm: 124000,
    });
    expect(reminderDue({ ...corrected, records: [] }, corrected.reminders[0]!).status).toBe(
      'Needs history',
    );
  });
  it('does not infer fixed schedules for unreviewed vehicles or dashboard-driven Honda service', () => {
    for (const details of [
      { make: 'Honda', model: 'CR-V', year: 2025 },
      { make: 'Hyundai', model: 'Elantra GT', year: 2016 },
      { make: 'Unknown', model: 'Car', year: 2020 },
    ])
      expect(automaticallySchedule({ ...vehicle(), ...details }).reminders).toEqual([]);
    expect(
      automaticallySchedule({ ...vehicle(), make: 'Toyota', model: 'Corolla', year: 2025 })
        .reminders,
    ).toHaveLength(1);
  });
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
  it('keeps incomplete history explicit and prevents falsely attributed manufacturer intervals', () => {
    const v = vehicle();
    v.reminders = [{ ...reminder(), lastKm: null }];
    const parsed = parseGarage({ ...emptyGarage(), vehicles: [v] }).vehicles[0]!;
    expect(reminderDue(parsed, parsed.reminders[0]!, '2026-10-26')).toMatchObject({
      dueOn: '2026-11-01',
      dueKm: null,
      status: 'Needs history',
    });
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

function servicedVehicle(): OwnedVehicle {
  const v = vehicle();
  v.catalogId = 'hyundai-elantra-gl-2016';
  v.reminders = [
    {
      ...reminder(),
      title: 'Engine oil and filter',
      manufacturerKey: 'hyundai-2016-elantra-oil-severe',
    },
  ];
  v.records = [
    {
      id: 'service-1',
      reminderId: 'r1',
      title: 'Engine oil and filter',
      on: '2026-09-01',
      km: 118000,
      note: 'Original receipt',
    },
  ];
  return v;
}
describe('garage corrections', () => {
  it('keeps history, mileage, manufacturer attribution and the catalog link when a nickname changes', () => {
    const v = servicedVehicle(),
      next = reviseVehicleDetails(v, structuredClone(v), {
        ...vehicleDetails(v),
        nickname: 'Daily driver',
      });
    expect(next.nickname).toBe('Daily driver');
    expect(next.records).toEqual(v.records);
    expect(next.reminders).toEqual(v.reminders);
    expect(next.odometerKm).toBe(v.odometerKm);
    expect(next.catalogId).toBe(v.catalogId);
    expect(v.nickname).toBe('');
  });
  it('requires an explicit choice before an identity correction changes manufacturer reminders to personal intervals', () => {
    const v = servicedVehicle(),
      details = { ...vehicleDetails(v), year: 2017 };
    expect(() => reviseVehicleDetails(v, v, details)).toThrow(/no longer match/);
    const next = reviseVehicleDetails(v, v, details, true);
    expect(next.year).toBe(2017);
    expect(next.catalogId).toBeUndefined();
    expect(next.reminders[0]?.manufacturerKey).toBeUndefined();
    expect(next.records).toEqual(v.records);
    expect(next.reminders[0]?.id).toBe('r1');
    expect(parseGarage({ ...emptyGarage(), vehicles: [next] }).vehicles[0]).toEqual(next);
  });
  it('clears configuration-specific specs after a powertrain correction but keeps an applicable maintenance plan', () => {
    const v = servicedVehicle(),
      next = reviseVehicleDetails(v, v, { ...vehicleDetails(v), engine: 'GL · Nu 1.8' });
    expect(next.catalogId).toBeUndefined();
    expect(next.reminders[0]?.manufacturerKey).toBe('hyundai-2016-elantra-oil-severe');
  });
  it('preserves newer history and mileage and rejects changed details or manufacturer plans in another tab', () => {
    const original = servicedVehicle(),
      current = structuredClone(original);
    current.odometerKm = 125000;
    current.records.push({ ...current.records[0]!, id: 'service-2', km: 124000, on: '2026-10-01' });
    const next = reviseVehicleDetails(current, original, {
      ...vehicleDetails(original),
      nickname: 'Elantra',
    });
    expect(next.records).toHaveLength(2);
    expect(next.odometerKm).toBe(125000);
    current.nickname = 'Other tab';
    expect(() => reviseVehicleDetails(current, original, vehicleDetails(original))).toThrow(
      /another tab/,
    );
    current.nickname = '';
    current.reminders[0]!.lastKm = 116000;
    expect(() =>
      reviseVehicleDetails(current, original, { ...vehicleDetails(original), year: 2017 }, true),
    ).toThrow(/Manufacturer reminders changed/);
  });
  it('corrects a record in place and recalculates the linked reminder from the corrected date and distance', () => {
    const v = servicedVehicle(),
      original = structuredClone(v.records[0]!),
      edited = { ...original, on: '2026-10-01', km: 119000, note: 'Corrected receipt' };
    const next = reviseServiceRecord(v, original, edited);
    expect(next.records).toEqual([edited]);
    expect(next.records[0]?.id).toBe(original.id);
    expect(v.records[0]?.note).toBe('Original receipt');
    expect(reminderDue(next, next.reminders[0]!, '2026-10-26')).toMatchObject({
      dueOn: '2027-04-01',
      dueKm: 125000,
    });
  });
  it('keeps an older corrected record from superseding newer service and supports removing its reminder link', () => {
    const v = servicedVehicle();
    v.records.push({ ...v.records[0]!, id: 'service-2', on: '2026-10-01', km: 119000 });
    const original = structuredClone(v.records[0]!);
    const next = reviseServiceRecord(v, original, { ...original, on: '2026-08-01', km: 117000 });
    expect(reminderDue(next, next.reminders[0]!, '2026-10-26')).toMatchObject({
      dueOn: '2027-04-01',
      dueKm: 125000,
    });
    const last = next.records[1]!,
      unlinked = reviseServiceRecord(next, last, { ...last, reminderId: null });
    expect(unlinked.records).toHaveLength(2);
    expect(reminderDue(unlinked, unlinked.reminders[0]!, '2026-10-26')).toMatchObject({
      dueOn: '2027-02-01',
      dueKm: 123000,
    });
  });
  it('rejects stale edits, removed records, identity replacement and invalid corrected data', () => {
    const v = servicedVehicle(),
      original = structuredClone(v.records[0]!);
    v.records[0]!.note = 'Saved elsewhere';
    expect(() => reviseServiceRecord(v, original, { ...original, note: 'Stale' })).toThrow(
      /changed in another tab/,
    );
    expect(() => reviseServiceRecord({ ...v, records: [] }, original, original)).toThrow(
      /removed in another tab/,
    );
    expect(() =>
      reviseServiceRecord(v, v.records[0]!, { ...v.records[0]!, id: 'replacement' }),
    ).toThrow(/original identity/);
    const invalid = reviseServiceRecord(v, v.records[0]!, { ...v.records[0]!, km: 130000 });
    expect(() => parseGarage({ ...emptyGarage(), vehicles: [invalid] })).toThrow(/allowed range/);
  });
});
