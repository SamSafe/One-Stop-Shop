import { maxServiceCostCents, validDate } from './domain';
import type { OwnedVehicle, ServiceRecord } from './domain';
import { vehicleName } from './vehicleName';

export const serviceCurrency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});
export const historyPageSize = 10;
export interface HistoryFilters {
  query: string;
  from: string;
  to: string;
}
export type HistorySort = 'newest' | 'oldest' | 'cost';

export function parseServiceCost(raw: string): number | undefined {
  const input = raw.trim();
  if (!input) return undefined;
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(input))
    throw new Error('Enter a CAD amount with at most two decimal places, or leave it blank.');
  const [whole = '', fraction = ''] = input.split('.');
  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > maxServiceCostCents)
    throw new Error('The amount paid must be between $0 and $1,000,000 CAD.');
  return cents;
}

export function historyRangeError(filters: HistoryFilters): string | null {
  if ((filters.from && !validDate(filters.from)) || (filters.to && !validDate(filters.to)))
    return 'Use valid dates for the history range.';
  if (filters.from && filters.to && filters.from > filters.to)
    return 'The start date must be on or before the end date.';
  return null;
}

export function selectServiceHistory(
  records: ServiceRecord[],
  filters: HistoryFilters,
  sort: HistorySort,
) {
  if (historyRangeError(filters)) return [];
  const terms = filters.query.trim().toLocaleLowerCase('en-CA').split(/\s+/).filter(Boolean);
  const selected = records.filter((record) => {
    const text =
      `${record.title} ${record.note} ${record.provider ?? ''} ${record.on} ${record.km}`.toLocaleLowerCase(
        'en-CA',
      );
    return (
      (!filters.from || record.on >= filters.from) &&
      (!filters.to || record.on <= filters.to) &&
      terms.every((term) => text.includes(term))
    );
  });
  return selected.sort((a, b) => {
    if (sort === 'cost') {
      if (a.costCents === undefined && b.costCents !== undefined) return 1;
      if (a.costCents !== undefined && b.costCents === undefined) return -1;
      const delta = (b.costCents ?? 0) - (a.costCents ?? 0);
      if (delta) return delta;
    }
    const chronology = a.on.localeCompare(b.on) || a.km - b.km;
    return (sort === 'oldest' ? chronology : -chronology) || a.id.localeCompare(b.id);
  });
}

export function serviceCostSummary(records: ServiceRecord[]) {
  return records.reduce(
    (summary, record) => {
      if (record.costCents === undefined) summary.unknown++;
      else {
        summary.known++;
        summary.totalCents += record.costCents;
      }
      return summary;
    },
    { known: 0, unknown: 0, totalCents: 0 },
  );
}

function csvCell(value: string | number): string {
  let text = String(value);
  // Quoting alone does not stop spreadsheet formulas in owner-entered text.
  if (/^[\u0000-\u0020]*[=+\-@]|^[\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function serviceHistoryCsv(vehicle: OwnedVehicle, records: ServiceRecord[]): string {
  const rows: (string | number)[][] = [
    [
      'Vehicle',
      'Model year',
      'Make',
      'Model',
      'Engine / trim',
      'Service date',
      'Odometer (km)',
      'Service',
      'Provider',
      'Amount paid (CAD)',
      'Notes',
    ],
  ];
  for (const record of records)
    rows.push([
      vehicleName(vehicle),
      vehicle.year,
      vehicle.make,
      vehicle.model,
      vehicle.engine,
      record.on,
      record.km,
      record.title,
      record.provider ?? '',
      record.costCents === undefined ? '' : (record.costCents / 100).toFixed(2),
      record.note,
    ]);
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
