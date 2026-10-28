import { describe, expect, it } from 'vitest';
import {
  deleteServiceRecord,
  emptyGarage,
  parseGarage,
  readGarage,
  reminderDue,
  reviseServiceRecord,
} from './domain';
import type { OwnedVehicle, ServiceRecord } from './domain';
import {
  historyRangeError,
  parseServiceCost,
  selectServiceHistory,
  serviceCostSummary,
  serviceHistoryCsv,
} from './history';

const record = (overrides: Partial<ServiceRecord> = {}): ServiceRecord => ({
  id: 'oil',
  reminderId: 'reminder',
  title: 'Oil and filter',
  on: '2026-08-01',
  km: 18000,
  note: 'Synthetic oil, receipt 42',
  ...overrides,
});
const vehicle = (): OwnedVehicle => ({
  id: 'car',
  make: 'Example',
  model: 'Sedan',
  year: 2020,
  engine: '',
  nickname: '',
  odometerKm: 20000,
  updatedOn: '2026-10-27',
  reminders: [{ id: 'reminder', title: 'Oil', km: 6000, months: 6, lastOn: null, lastKm: null }],
  records: [
    record({ costCents: 12999, provider: 'Atelier North' }),
    record({
      id: 'inspection',
      reminderId: null,
      title: 'Inspection',
      on: '2026-09-01',
      km: 19000,
      costCents: 0,
      provider: 'Warranty shop',
    }),
    record({ id: 'tires', reminderId: null, title: 'Tires', on: '2026-10-01', km: 20000 }),
  ],
});
const filters = { query: '', from: '', to: '' };

describe('recorded service costs and history', () => {
  it('keeps exact cents, distinguishes unknown from free work, and bounds owner amounts', () => {
    expect(parseServiceCost('')).toBeUndefined();
    expect(parseServiceCost(' 0 ')).toBe(0);
    expect(parseServiceCost('.29')).toBe(29);
    expect(parseServiceCost('125.43')).toBe(12543);
    expect(parseServiceCost('1000000.00')).toBe(100000000);
    for (const invalid of ['-1', '1e3', '1.234', 'NaN', '$30', '1000000.01'])
      expect(() => parseServiceCost(invalid)).toThrow();
    expect(serviceCostSummary(vehicle().records)).toEqual({
      known: 2,
      unknown: 1,
      totalCents: 12999,
    });
  });
  it('reads old backups without adding amounts and preserves cost/provider extensions in new backups', () => {
    const v = vehicle(),
      backup = { ...emptyGarage(), vehicles: [v] };
    expect(readGarage(JSON.stringify(backup))).toEqual(backup);
    v.records = [record()];
    const old = readGarage(JSON.stringify({ ...emptyGarage(), vehicles: [v] }));
    expect(old.vehicles[0]!.records[0]).toEqual(record());
    expect(old.vehicles[0]!.records[0]).not.toHaveProperty('costCents');
  });
  it('rejects invalid money, provider fields and unsupported extensions instead of silently losing them', () => {
    for (const costCents of [-1, 1.2, 100000001, Infinity, NaN, null]) {
      const v = vehicle();
      Object.assign(v.records[0]!, { costCents });
      expect(() => parseGarage({ ...emptyGarage(), vehicles: [v] })).toThrow();
    }
    for (const provider of ['', ' ', 'x'.repeat(101), null]) {
      const v = vehicle();
      Object.assign(v.records[0]!, { provider });
      expect(() => parseGarage({ ...emptyGarage(), vehicles: [v] })).toThrow();
    }
    const v = vehicle();
    Object.assign(v.records[0]!, { futureExpense: 500 });
    expect(() => parseGarage({ ...emptyGarage(), vehicles: [v] })).toThrow('unsupported structure');
  });
  it('filters the full history by work, provider, notes and inclusive dates without mutating records', () => {
    const v = vehicle(),
      original = structuredClone(v.records);
    expect(
      selectServiceHistory(
        v.records,
        { query: 'atelier SYNTHETIC', from: '2026-08-01', to: '2026-08-01' },
        'newest',
      ).map((r) => r.id),
    ).toEqual(['oil']);
    expect(selectServiceHistory(v.records, filters, 'oldest').map((r) => r.id)).toEqual([
      'oil',
      'inspection',
      'tires',
    ]);
    expect(selectServiceHistory(v.records, filters, 'cost').map((r) => r.id)).toEqual([
      'oil',
      'inspection',
      'tires',
    ]);
    expect(v.records).toEqual(original);
    expect(historyRangeError({ ...filters, from: '2026-10-01', to: '2026-09-01' })).toContain(
      'start date',
    );
    expect(selectServiceHistory(v.records, { ...filters, from: '2026-02-30' }, 'newest')).toEqual(
      [],
    );
  });
  it('protects concurrent amount/provider edits and deletions and recalculates only from actual remaining work', () => {
    const v = vehicle(),
      original = structuredClone(v.records[0]!);
    const edited = { ...original, costCents: 14999, provider: 'New shop' };
    const revised = reviseServiceRecord(v, original, edited);
    expect(reminderDue(revised, revised.reminders[0]!, '2026-10-27')).toEqual(
      reminderDue(v, v.reminders[0]!, '2026-10-27'),
    );
    expect(() => reviseServiceRecord(revised, original, original)).toThrow(
      'changed in another tab',
    );
    expect(() => deleteServiceRecord(revised, original)).toThrow('changed in another tab');
    const removed = deleteServiceRecord(revised, edited);
    expect(removed.records.map((r) => r.id)).toEqual(['inspection', 'tires']);
    expect(reminderDue(removed, removed.reminders[0]!, '2026-10-27').status).toBe('Needs history');
    expect(() => deleteServiceRecord(removed, edited)).toThrow('removed in another tab');
  });
  it('exports selected records with exact money, blank unknown amounts, UTF-8, quotes and safe spreadsheet text', () => {
    const v = vehicle();
    v.nickname = '=SUM(1,1)';
    v.records[0]!.title = 'Oil, filter "premium"';
    v.records[0]!.provider = 'Atelier Été';
    v.records[0]!.note = 'first line\nsecond line';
    const csv = serviceHistoryCsv(v, v.records);
    expect(csv.startsWith('\ufeff"Vehicle"')).toBe(true);
    expect(csv).toContain('"\'=SUM(1,1)"');
    expect(csv).toContain('"Oil, filter ""premium"""');
    expect(csv).toContain('"Atelier Été","129.99","first line\nsecond line"');
    expect(csv).toContain('"Warranty shop","0.00"');
    expect(csv).toContain('"Tires","",""');
    expect(serviceHistoryCsv(v, [record({ title: '\t=cmd', note: '  +SUM(1,1)' })])).toContain(
      '"\'\t=cmd"',
    );
    expect(serviceHistoryCsv(v, [record({ note: '  +SUM(1,1)' })])).toContain('"\'  +SUM(1,1)"');
  });
});
