import { maintenanceTasks } from '@oss/car-catalog/maintenance';
import type { ManufacturerReminderKey } from '@oss/car-catalog/maintenance';
export const garageStorageKey = 'oss-garage-v1';
export interface Reminder {
  id: string;
  title: string;
  km: number | null;
  months: number | null;
  lastOn: string | null;
  lastKm: number | null;
  manufacturerKey?: ManufacturerReminderKey;
}
export interface ServiceRecord {
  id: string;
  reminderId: string | null;
  title: string;
  on: string;
  km: number;
  note: string;
  costCents?: number;
  provider?: string;
}
export const maxServiceCostCents = 100_000_000;
export interface OwnedVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  engine: string;
  nickname: string;
  odometerKm: number;
  updatedOn: string;
  catalogId?: string;
  reminders: Reminder[];
  records: ServiceRecord[];
  suppressedMaintenance?: ManufacturerReminderKey[];
}
export interface Garage {
  version: 1;
  revision: string;
  vehicles: OwnedVehicle[];
}
export const emptyGarage = (): Garage => ({ version: 1, revision: 'empty', vehicles: [] });
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function validDate(input: unknown): input is string {
  return (
    typeof input === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(input) &&
    Number.isFinite(Date.parse(input)) &&
    new Date(input).toISOString().slice(0, 10) === input
  );
}
const fail = (message: string): never => {
  throw new Error(message);
};
function object(input: unknown, keys: string[]): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !keys.includes(k))
  )
    return fail('Garage data has an unsupported structure.');
  return input as Record<string, unknown>;
}
function string(input: unknown, max = 100, allowEmpty = false): string {
  if (typeof input !== 'string' || input.length > max || (!allowEmpty && !input.trim()))
    return fail('A garage text field is missing or too long.');
  return input;
}
function number(input: unknown, min: number, max: number): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < min || input > max)
    return fail('A garage number is outside the allowed range.');
  return input;
}
function date(input: unknown) {
  if (!validDate(input) || input > today()) return fail('Use a valid date on or before today.');
  return input;
}
function array(input: unknown, max: number): unknown[] {
  if (!Array.isArray(input) || input.length > max)
    return fail('Garage data exceeds the supported size.');
  return input;
}
function identifier(input: unknown) {
  const id = string(input, 100);
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return fail('Garage identifier is invalid.');
  return id;
}
function unique(items: { id: string }[]) {
  if (new Set(items.map((x) => x.id)).size !== items.length)
    fail('Garage data contains duplicate identifiers.');
}
export function parseGarage(input: unknown): Garage {
  const root = object(input, ['version', 'revision', 'vehicles']);
  if (root.version !== 1)
    fail('This garage format is not supported. Your existing data has been kept.');
  const vehicles = array(root.vehicles, 50).map((input) => {
    const v = object(input, [
      'id',
      'make',
      'model',
      'year',
      'engine',
      'nickname',
      'odometerKm',
      'updatedOn',
      'catalogId',
      'reminders',
      'records',
      'suppressedMaintenance',
    ]);
    const odometerKm = number(v.odometerKm, 0, 5000000),
      year = number(v.year, 1886, new Date().getFullYear() + 2),
      make = string(v.make),
      model = string(v.model);
    const tasks = maintenanceTasks({ make, model, year });
    const suppressedMaintenance =
      v.suppressedMaintenance === undefined
        ? undefined
        : array(v.suppressedMaintenance, 100).map((key) => {
            const task = tasks.find((task) => task.key === key);
            if (!task) return fail('Suppressed maintenance task does not match this vehicle.');
            return task.key;
          });
    const reminders = array(v.reminders, 100).map((input) => {
      const r = object(input, [
        'id',
        'title',
        'km',
        'months',
        'lastOn',
        'lastKm',
        'manufacturerKey',
      ]);
      const km = r.km === null ? null : number(r.km, 1, 1000000),
        months = r.months === null ? null : number(r.months, 1, 240);
      if (km === null && months === null) fail('A reminder needs a distance or time interval.');
      const lastOn = r.lastOn === null ? null : date(r.lastOn),
        lastKm = r.lastKm === null ? null : number(r.lastKm, 0, odometerKm);
      const title = string(r.title, 160);
      const template = tasks.find((task) => task.key === r.manufacturerKey);
      if (
        r.manufacturerKey !== undefined &&
        (!template ||
          r.manufacturerKey !== template.key ||
          km !== template.km ||
          months !== template.months ||
          title !== template.title)
      )
        fail('Manufacturer reminder does not match its reviewed vehicle and interval.');
      return {
        id: identifier(r.id),
        title,
        km,
        months,
        lastOn,
        lastKm,
        ...(r.manufacturerKey ? { manufacturerKey: template!.key } : {}),
      };
    });
    unique(reminders);
    const records = array(v.records, 2000).map((input) => {
      const r = object(input, [
        'id',
        'reminderId',
        'title',
        'on',
        'km',
        'note',
        'costCents',
        'provider',
      ]);
      const reminderId = r.reminderId === null ? null : identifier(r.reminderId);
      if (reminderId !== null && !reminders.some((x) => x.id === reminderId))
        fail('Service record references an unknown reminder.');
      return {
        id: identifier(r.id),
        reminderId,
        title: string(r.title, 160),
        on: date(r.on),
        km: number(r.km, 0, odometerKm),
        note: string(r.note, 1000, true),
        ...(r.costCents !== undefined
          ? { costCents: number(r.costCents, 0, maxServiceCostCents) }
          : {}),
        ...(r.provider !== undefined ? { provider: string(r.provider, 100) } : {}),
      };
    });
    unique(records);
    const updatedOn = date(v.updatedOn);
    return {
      id: identifier(v.id),
      make,
      model,
      year,
      engine: string(v.engine, 200, true),
      nickname: string(v.nickname, 100, true),
      odometerKm,
      updatedOn,
      ...(v.catalogId !== undefined ? { catalogId: identifier(v.catalogId) } : {}),
      reminders,
      records,
      ...(suppressedMaintenance !== undefined
        ? { suppressedMaintenance: [...new Set(suppressedMaintenance)] }
        : {}),
    };
  });
  unique(vehicles);
  return { version: 1, revision: identifier(root.revision), vehicles };
}
export function readGarage(raw: string | null) {
  if (raw === null) return emptyGarage();
  checkGarageSize(raw);
  return parseGarage(JSON.parse(raw));
}
export function addMonths(on: string, months: number) {
  const [year, month, day] = on.split('-').map(Number) as [number, number, number];
  const d = new Date(Date.UTC(year, month - 1 + months, 1));
  d.setUTCDate(
    Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()),
  );
  return d.toISOString().slice(0, 10);
}
export function reminderBaseline(v: OwnedVehicle, r: Reminder) {
  const history = v.records
    .filter((s) => s.reminderId === r.id)
    .sort((a, b) => b.on.localeCompare(a.on) || b.km - a.km);
  const last = history[0];
  // An imported historical entry must not move an explicit newer baseline backwards.
  const lastOn = last && (!r.lastOn || last.on >= r.lastOn) ? last.on : r.lastOn;
  const lastKm = last && last.km >= (r.lastKm ?? 0) ? last.km : r.lastKm;
  return { lastOn, lastKm };
}
export function reminderDue(v: OwnedVehicle, r: Reminder, on = today()) {
  const { lastOn, lastKm } = reminderBaseline(v, r);
  const dueOn = r.months !== null && lastOn ? addMonths(lastOn, r.months) : null;
  const dueKm = r.km !== null && lastKm !== null ? lastKm + r.km : null;
  const overdue = (dueOn !== null && dueOn < on) || (dueKm !== null && dueKm < v.odometerKm);
  const due =
    overdue || (dueOn !== null && dueOn === on) || (dueKm !== null && dueKm === v.odometerKm);
  const soon =
    !due &&
    ((dueOn !== null && Date.parse(dueOn) - Date.parse(on) <= 30 * 86400000) ||
      (dueKm !== null && dueKm - v.odometerKm <= 1000));
  const missingHistory =
    (r.km !== null && lastKm === null) || (r.months !== null && lastOn === null);
  return {
    dueOn,
    dueKm,
    status: overdue
      ? 'Overdue'
      : due
        ? 'Due now'
        : missingHistory
          ? 'Needs history'
          : soon
            ? 'Due soon'
            : 'Upcoming',
  } as const;
}
export function removeReminder(v: OwnedVehicle, id: string): OwnedVehicle {
  const key = v.reminders.find((r) => r.id === id)?.manufacturerKey;
  return {
    ...v,
    reminders: v.reminders.filter((r) => r.id !== id),
    records: v.records.map((r) => (r.reminderId === id ? { ...r, reminderId: null } : r)),
    ...(key
      ? { suppressedMaintenance: [...new Set([...(v.suppressedMaintenance ?? []), key])] }
      : {}),
  };
}

function assertCurrentReminder(vehicle: OwnedVehicle, original: Reminder) {
  const current = vehicle.reminders.find((reminder) => reminder.id === original.id);
  if (!current)
    fail(
      'This reminder was removed in another tab. Cancel this action to see the latest schedule.',
    );
  const keys = ['id', 'title', 'km', 'months', 'lastOn', 'lastKm', 'manufacturerKey'] as const;
  if (keys.some((key) => current![key] !== original[key]))
    fail(
      'This reminder changed in another tab. Cancel this action and review it before trying again.',
    );
}

export function reviseReminder(
  vehicle: OwnedVehicle,
  original: Reminder,
  edited: Reminder,
): OwnedVehicle {
  assertCurrentReminder(vehicle, original);
  if (edited.id !== original.id) fail('A corrected reminder must retain its original identity.');
  if (original.manufacturerKey || edited.manufacturerKey)
    fail(
      'Reviewed manufacturer reminders use verified intervals. Add a personal reminder for your own plan.',
    );
  return {
    ...vehicle,
    reminders: vehicle.reminders.map((reminder) =>
      reminder.id === original.id ? edited : reminder,
    ),
  };
}

export function deleteReminder(vehicle: OwnedVehicle, original: Reminder): OwnedVehicle {
  assertCurrentReminder(vehicle, original);
  return removeReminder(vehicle, original.id);
}

export function automaticallySchedule(v: OwnedVehicle): OwnedVehicle {
  const templates = maintenanceTasks(v)
    .filter(
      (task) =>
        !v.suppressedMaintenance?.includes(task.key) &&
        !v.reminders.some((r) => r.manufacturerKey === task.key),
    )
    .slice(0, Math.max(0, 100 - v.reminders.length));
  if (!templates.length) return v;
  const used = new Set(v.reminders.map((r) => r.id));
  const added = templates.map((task) => {
    let id = `automatic-${task.key}`,
      suffix = 1;
    while (used.has(id)) id = `automatic-${task.key}-${suffix++}`;
    used.add(id);
    return {
      id,
      title: task.title,
      km: task.km,
      months: task.months,
      lastOn: null,
      lastKm: null,
      manufacturerKey: task.key,
    };
  });
  return { ...v, reminders: [...v.reminders, ...added] };
}
export function automaticallyScheduleGarage(g: Garage): Garage {
  return { ...g, vehicles: g.vehicles.map(automaticallySchedule) };
}

export function updateOdometer(v: OwnedVehicle, km: number): OwnedVehicle {
  if (!Number.isInteger(km) || km < v.odometerKm || km > 5000000)
    throw new Error(
      'The odometer must be at least the latest saved reading. Check whether another tab updated it.',
    );
  return { ...v, odometerKm: km, updatedOn: today() };
}

export function checkGarageSize(raw: string) {
  if (new TextEncoder().encode(raw).byteLength > 2000000)
    fail('Garage file exceeds 2 MB. Export and reduce its size before adding more records.');
}

export type VehicleDetails = Pick<OwnedVehicle, 'make' | 'model' | 'year' | 'engine' | 'nickname'>;
const detailsKeys = ['make', 'model', 'year', 'engine', 'nickname'] as const;
const identityKeys = ['make', 'model', 'year', 'engine'] as const;
export function vehicleDetails(v: VehicleDetails): VehicleDetails {
  return { make: v.make, model: v.model, year: v.year, engine: v.engine, nickname: v.nickname };
}
function sameIdentity(a: VehicleDetails, b: VehicleDetails) {
  return identityKeys.every((key) =>
    typeof a[key] === 'string' && typeof b[key] === 'string'
      ? String(a[key]).trim().toLowerCase() === String(b[key]).trim().toLowerCase()
      : a[key] === b[key],
  );
}
export function incompatibleManufacturerReminders(v: OwnedVehicle, details: VehicleDetails) {
  const tasks = maintenanceTasks(details);
  return v.reminders.filter((r) => {
    const template = tasks.find((task) => task.key === r.manufacturerKey);
    return (
      r.manufacturerKey &&
      !unconfiguredPlan(v, r) &&
      (!template ||
        r.km !== template.km ||
        r.months !== template.months ||
        r.title !== template.title)
    );
  });
}
function unconfiguredPlan(v: OwnedVehicle, r: Reminder) {
  return (
    r.lastOn === null &&
    r.lastKm === null &&
    !v.records.some((record) => record.reminderId === r.id)
  );
}
export function reviseVehicleDetails(
  current: OwnedVehicle,
  original: OwnedVehicle,
  details: VehicleDetails,
  keepAsPersonal = false,
): OwnedVehicle {
  if (current.id !== original.id || detailsKeys.some((key) => current[key] !== original[key]))
    fail('Vehicle details changed in another tab. Cancel and reopen the editor to review them.');
  const changedIdentity = !sameIdentity(original, details);
  if (changedIdentity) {
    const manufacturerState = (v: OwnedVehicle) =>
      JSON.stringify(v.reminders.filter((r) => r.manufacturerKey));
    if (manufacturerState(current) !== manufacturerState(original))
      fail('Manufacturer reminders changed in another tab. Cancel and reopen the vehicle editor.');
  }
  const incompatible = new Set(
    incompatibleManufacturerReminders(current, details).map((r) => r.id),
  );
  if (incompatible.size && !keepAsPersonal)
    fail(
      'These vehicle details no longer match a manufacturer reminder. Choose whether to keep the affected intervals as personal reminders.',
    );
  const result = {
    ...current,
    ...details,
    reminders: current.reminders.flatMap((r) => {
      const matches = maintenanceTasks(details).some(
        (task) =>
          task.key === r.manufacturerKey &&
          task.km === r.km &&
          task.months === r.months &&
          task.title === r.title,
      );
      if (r.manufacturerKey && !matches && unconfiguredPlan(current, r)) return [];
      if (!incompatible.has(r.id)) return [r];
      const { manufacturerKey: _source, ...personal } = r;
      return [personal];
    }),
  };
  if (result.suppressedMaintenance) {
    const keys = new Set(maintenanceTasks(details).map((task) => task.key));
    result.suppressedMaintenance = result.suppressedMaintenance.filter((key) => keys.has(key));
  }
  if (changedIdentity) delete result.catalogId;
  return result;
}
export function reviseServiceRecord(
  vehicle: OwnedVehicle,
  original: ServiceRecord,
  edited: ServiceRecord,
): OwnedVehicle {
  assertCurrentServiceRecord(vehicle, original);
  if (edited.id !== original.id)
    fail('A corrected service record must retain its original identity.');
  return { ...vehicle, records: vehicle.records.map((r) => (r.id === original.id ? edited : r)) };
}

function assertCurrentServiceRecord(vehicle: OwnedVehicle, original: ServiceRecord) {
  const current = vehicle.records.find((r) => r.id === original.id);
  if (!current)
    fail(
      'This service record was removed in another tab. Cancel this action to see the latest history.',
    );
  const keys = ['id', 'reminderId', 'title', 'on', 'km', 'note', 'costCents', 'provider'] as const;
  if (keys.some((key) => current![key] !== original[key]))
    fail(
      'This service record changed in another tab. Cancel this action and review the latest history before trying again.',
    );
}

export function deleteServiceRecord(vehicle: OwnedVehicle, original: ServiceRecord): OwnedVehicle {
  assertCurrentServiceRecord(vehicle, original);
  return { ...vehicle, records: vehicle.records.filter((record) => record.id !== original.id) };
}
