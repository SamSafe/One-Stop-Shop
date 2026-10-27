import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import {
  maintenanceGuidance,
  maintenanceTasks,
  ownerResources,
} from '@oss/car-catalog/maintenance';
import type { Car, Metric } from '@oss/car-catalog';
import { metricDefinitions } from '@oss/car-catalog/metrics';
import {
  readGarage,
  reminderDue,
  removeReminder,
  today,
  updateOdometer,
  reviseVehicleDetails,
  reviseServiceRecord,
} from './domain';
import { Field, submitData, text, numeric } from './fields';
import { VehicleDetailsForm } from './VehicleDetailsForm';
import type { Garage as GarageData, OwnedVehicle, Reminder, ServiceRecord } from './domain';
import { useGarage } from './useGarage';
import './garage.css';
import { AppHeader } from '../AppHeader';
const AddVehicle = lazy(() => import('./AddVehicle').then((m) => ({ default: m.AddVehicle })));

const number = new Intl.NumberFormat('en-CA');
const vehicleName = (v: OwnedVehicle) => v.nickname || `${v.year} ${v.make} ${v.model}`;
function download(raw: string, name = 'oss-garage-backup.json') {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ReminderForm({
  vehicle,
  onSave,
  onCancel,
}: {
  vehicle: OwnedVehicle;
  onSave: (r: Reminder) => boolean;
  onCancel: () => void;
}) {
  return (
    <form
      className="garage-subform"
      aria-label={`Add reminder for ${vehicleName(vehicle)}`}
      onSubmit={(e) => {
        const d = submitData(e);
        onSave({
          id: crypto.randomUUID(),
          title: text(d, 'title'),
          km: numeric(d, 'km'),
          months: numeric(d, 'months'),
          lastOn: text(d, 'lastOn') || null,
          lastKm: numeric(d, 'lastKm'),
        });
      }}
    >
      <h3>Add a personal reminder</h3>
      <p>
        Choose an interval from your manual or service provider. Personal reminders are labelled as
        your own plan.
      </p>
      <Field label="Reminder name">
        {(id) => (
          <input
            id={id}
            name="title"
            required
            maxLength={160}
            placeholder="e.g. Seasonal tire change"
          />
        )}
      </Field>
      <div className="garage-fields">
        <Field label="Repeat every (km, optional)">
          {(id) => <input id={id} name="km" type="number" min="1" max="1000000" />}
        </Field>
        <Field label="Repeat every (months, optional)">
          {(id) => <input id={id} name="months" type="number" min="1" max="240" />}
        </Field>
        <Field label="Last completed date">
          {(id) => <input id={id} name="lastOn" type="date" max={today()} />}
        </Field>
        <Field label="Last completed odometer (km)">
          {(id) => <input id={id} name="lastKm" type="number" min="0" max={vehicle.odometerKm} />}
        </Field>
      </div>
      <p className="garage-fine">
        Choose an interval and add the last completion if known. Otherwise this plan needs service
        history before its next due date can be calculated.
      </p>
      <div className="garage-actions">
        <button type="submit" className="button primary">
          Save reminder
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function ServiceForm({
  vehicle,
  reminderId,
  record,
  onSave,
  onCancel,
}: {
  vehicle: OwnedVehicle;
  reminderId: string | null;
  record?: ServiceRecord;
  onSave: (s: ServiceRecord) => boolean;
  onCancel: () => void;
}) {
  const reminder = vehicle.reminders.find((r) => r.id === (record?.reminderId ?? reminderId));
  const needsHistory =
    !record && reminder && reminderDue(vehicle, reminder).status === 'Needs history';
  return (
    <form
      className="garage-subform"
      aria-label={`${record ? 'Edit service' : 'Log service'} for ${vehicleName(vehicle)}`}
      onSubmit={(e) => {
        const d = submitData(e);
        const linkedId = record || !reminder ? text(d, 'reminderId') || null : reminder.id;
        const linked = vehicle.reminders.find((r) => r.id === linkedId);
        onSave({
          id: record?.id ?? crypto.randomUUID(),
          reminderId: linkedId,
          title: record ? text(d, 'title') : (linked?.title ?? text(d, 'title')),
          on: text(d, 'on'),
          km: Number(text(d, 'km')),
          note: text(d, 'note'),
        });
      }}
    >
      <h3>
        {record
          ? 'Edit service record'
          : reminder
            ? `${needsHistory ? 'Add service history' : 'Complete'}: ${reminder.title}`
            : 'Log a service'}
      </h3>
      {needsHistory && (
        <p>Add the last actual completion date and odometer. No previous service is assumed.</p>
      )}
      {record && (
        <p>
          Correct the work, date or reading. Linked reminders will be recalculated from the
          corrected history.
        </p>
      )}
      {(!reminder || record) && (
        <Field label="Service performed">
          {(id) => (
            <input
              id={id}
              name="title"
              required
              maxLength={160}
              defaultValue={record?.title}
              placeholder="e.g. Oil and filter replaced"
            />
          )}
        </Field>
      )}
      <div className="garage-fields">
        <Field label="Service date">
          {(id) => (
            <input
              id={id}
              name="on"
              type="date"
              required
              max={today()}
              defaultValue={
                needsHistory ? (reminder?.lastOn ?? undefined) : (record?.on ?? today())
              }
            />
          )}
        </Field>
        <Field label="Service odometer (km)">
          {(id) => (
            <input
              id={id}
              name="km"
              type="number"
              min="0"
              max={vehicle.odometerKm}
              required
              defaultValue={
                needsHistory ? (reminder?.lastKm ?? undefined) : (record?.km ?? vehicle.odometerKm)
              }
            />
          )}
        </Field>
      </div>
      <Field label="Service notes (optional)">
        {(id) => (
          <textarea
            id={id}
            name="note"
            maxLength={1000}
            rows={3}
            defaultValue={record?.note}
            placeholder="Work completed, shop, parts or observations"
          />
        )}
      </Field>
      {(record || !reminder) && (
        <Field label="Apply to reminder (optional)">
          {(id) => (
            <select id={id} name="reminderId" defaultValue={record?.reminderId ?? ''}>
              <option value="">No linked reminder</option>
              {vehicle.reminders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      <p className="garage-fine">
        Update the vehicle’s odometer first if the service reading is higher.
      </p>
      <div className="garage-actions">
        <button type="submit" className="button primary">
          {record ? 'Save service changes' : 'Save service record'}
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function VehicleCard({
  vehicle,
  onUpdate,
  onRemove,
}: {
  vehicle: OwnedVehicle;
  onUpdate: (f: (v: OwnedVehicle) => OwnedVehicle) => boolean;
  onRemove: () => boolean;
}) {
  const [panel, setPanel] = useState<
      null | 'odometer' | 'reminder' | 'service' | 'remove' | 'edit'
    >(null),
    [editingVehicle, setEditingVehicle] = useState<OwnedVehicle | null>(null),
    [editingRecord, setEditingRecord] = useState<ServiceRecord | undefined>(undefined),
    [completion, setCompletion] = useState<string | null>(null),
    [deletion, setDeletion] = useState<string | null>(null),
    [specs, setSpecs] = useState<Car | null>(null),
    [specError, setSpecError] = useState(''),
    [specLoading, setSpecLoading] = useState(false);
  const article = useRef<HTMLElement>(null);
  const shownSpecs = specs?.id === vehicle.catalogId ? specs : null;
  const guidance = maintenanceGuidance(vehicle),
    resources = ownerResources(vehicle.make);
  const reminders = vehicle.reminders
    .map((r) => ({ r, due: reminderDue(vehicle, r) }))
    .sort(
      (a, b) =>
        ['Overdue', 'Due now', 'Due soon', 'Needs history', 'Upcoming'].indexOf(a.due.status) -
        ['Overdue', 'Due now', 'Due soon', 'Needs history', 'Upcoming'].indexOf(b.due.status),
    );
  const success = (update: (v: OwnedVehicle) => OwnedVehicle) => {
    if (onUpdate(update)) {
      setPanel(null);
      setCompletion(null);
      setEditingRecord(undefined);
      setEditingVehicle(null);
      requestAnimationFrame(() => article.current?.focus());
      return true;
    }
    return false;
  };
  async function loadSpecs() {
    setSpecLoading(true);
    try {
      const { catalog } = await import('@oss/car-catalog');
      const c = catalog.cars.find((c) => c.id === vehicle.catalogId);
      if (!c) throw new Error('This configuration is no longer in the catalog.');
      setSpecs(c);
      setSpecError('');
    } catch {
      setSpecError('Catalog specifications could not be loaded. Your garage remains available.');
    } finally {
      setSpecLoading(false);
    }
  }
  return (
    <article
      ref={article}
      tabIndex={-1}
      className="garage-panel garage-vehicle"
      aria-label={vehicleName(vehicle)}
    >
      <div className="garage-section-title">
        <div>
          {vehicle.nickname && (
            <p className="eyebrow">
              {vehicle.year} · {vehicle.make}
            </p>
          )}
          <h2>{vehicleName(vehicle)}</h2>
          {vehicle.nickname && <p>{vehicle.model}</p>}
        </div>
        <span className="garage-odometer">
          {number.format(vehicle.odometerKm)} <small>km</small>
        </span>
      </div>
      {vehicle.engine && <p className="garage-powertrain">{vehicle.engine}</p>}
      <p className="garage-fine">
        Odometer recorded {vehicle.updatedOn}. Reminders update when you enter a new reading.
      </p>
      <div className="garage-actions">
        <button type="button" className="button secondary" onClick={() => setPanel('odometer')}>
          Update odometer
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setCompletion(null);
            setEditingRecord(undefined);
            setPanel('service');
          }}
        >
          Log service
        </button>
        <button type="button" className="text-button" onClick={() => setPanel('reminder')}>
          Add reminder
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setEditingVehicle(structuredClone(vehicle));
            setPanel('edit');
          }}
        >
          Edit vehicle
        </button>
      </div>
      {panel === 'edit' && editingVehicle && (
        <VehicleDetailsForm
          original={editingVehicle}
          onSave={(details, personal) =>
            success((v) => reviseVehicleDetails(v, editingVehicle, details, personal))
          }
          onCancel={() => {
            setPanel(null);
            setEditingVehicle(null);
            article.current?.focus();
          }}
        />
      )}
      {panel === 'odometer' && (
        <form
          className="garage-subform"
          aria-label={`Update odometer for ${vehicleName(vehicle)}`}
          onSubmit={(e) => {
            const d = submitData(e);
            success((v) => updateOdometer(v, Number(text(d, 'km'))));
          }}
        >
          <Field label="New odometer (km)">
            {(id) => (
              <input
                id={id}
                name="km"
                type="number"
                min={vehicle.odometerKm}
                max="5000000"
                required
                defaultValue={vehicle.odometerKm}
              />
            )}
          </Field>
          <div className="garage-actions">
            <button className="button primary" type="submit">
              Save odometer
            </button>
            <button className="button secondary" type="button" onClick={() => setPanel(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="garage-guidance">
        <h3>{guidance?.title ?? 'Maintenance guidance'}</h3>
        <p>
          {guidance?.note ??
            'An exact Canadian maintenance schedule has not been verified for this vehicle. Add personal reminders using your owner’s manual or service provider’s instructions.'}
        </p>
        {guidance && (
          <p className="garage-fine">
            <a href={guidance.sourceUrl} target="_blank" rel="noreferrer">
              {guidance.sourceTitle}
            </a>{' '}
            · {guidance.locator} · Reviewed {guidance.reviewedAt}
          </p>
        )}
        {resources && (
          <div className="garage-actions">
            <a href={resources.manuals} target="_blank" rel="noreferrer">
              Owner’s manuals ↗
            </a>
            <a href={resources.schedule} target="_blank" rel="noreferrer">
              Canadian maintenance schedule ↗
            </a>
          </div>
        )}
        {maintenanceTasks(vehicle).length > 0 && (
          <p className="garage-fine">
            Reviewed manufacturer tasks are added automatically. Enter actual service history to
            establish due dates; this is a selected task list, not a complete maintenance schedule.
          </p>
        )}
        {!!vehicle.suppressedMaintenance?.length && (
          <button
            type="button"
            className="text-button"
            onClick={() => success((v) => ({ ...v, suppressedMaintenance: [] }))}
          >
            Restore removed manufacturer tasks
          </button>
        )}
      </div>
      {guidance?.documents && (
        <details className="garage-history">
          <summary>Owner’s manual &amp; service specifications</summary>
          <p className="garage-fine">
            Canadian 2016 Elantra sedan manual. GL is retained as entered; U.S. trim equivalence is
            unverified. Confirm your engine and transmission before applying equipment-specific
            instructions.
          </p>
          <div className="garage-actions">
            {guidance.documents.map((d) => (
              <a key={d.id} href={d.url} target="_blank" rel="noreferrer">
                {d.title} ↗
              </a>
            ))}
          </div>
          <dl className="garage-manual-specs">
            {guidance.specifications?.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>
                  <strong>{s.value}</strong>
                  <p>{s.note}</p>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.locator} ↗
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {panel === 'reminder' && (
        <ReminderForm
          vehicle={vehicle}
          onSave={(r) => success((v) => ({ ...v, reminders: [...v.reminders, r] }))}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === 'service' && (
        <ServiceForm
          key={editingRecord?.id ?? completion ?? 'new-service'}
          vehicle={vehicle}
          reminderId={completion}
          record={editingRecord}
          onSave={(s) =>
            success((v) =>
              editingRecord
                ? reviseServiceRecord(v, editingRecord, s)
                : { ...v, records: [...v.records, s] },
            )
          }
          onCancel={() => {
            setPanel(null);
            setCompletion(null);
            setEditingRecord(undefined);
            article.current?.focus();
          }}
        />
      )}
      <section className="garage-reminders" aria-label={`Reminders for ${vehicleName(vehicle)}`}>
        <h3>
          Maintenance schedule <span className="garage-count">{vehicle.reminders.length}</span>
        </h3>
        {!reminders.length && (
          <p className="garage-empty-note">
            No reminders yet. Add a personal interval or use a supported manufacturer plan above.
          </p>
        )}
        {reminders.map(({ r, due }) => {
          const task = maintenanceTasks(vehicle).find((task) => task.key === r.manufacturerKey);
          return (
            <div className="garage-reminder" key={r.id}>
              <div>
                <span
                  className={`garage-status ${due.status === 'Overdue' || due.status === 'Due now' ? 'urgent' : due.status === 'Due soon' ? 'soon' : due.status === 'Needs history' ? 'pending' : ''}`}
                >
                  {due.status}
                </span>
                <h4>{r.title}</h4>
                <p>
                  {due.status === 'Needs history' &&
                    'Service history is incomplete — add the missing details to calculate the next due thresholds. '}
                  {due.dueKm !== null && `${number.format(due.dueKm)} km`}
                  {due.dueKm !== null && due.dueOn && ' or '}
                  {due.dueOn}
                  {due.dueKm !== null && due.dueOn && ' · whichever comes first'}
                </p>
                <small>
                  {r.manufacturerKey
                    ? (task?.label ?? 'Manufacturer interval')
                    : 'Personal interval'}{' '}
                  ·{' '}
                  {[
                    r.km !== null ? `${number.format(r.km)} km` : null,
                    r.months !== null ? `${r.months} months` : null,
                  ]
                    .filter(Boolean)
                    .join(' / ')}
                </small>
                {task && (
                  <details className="garage-task-source">
                    <summary>Schedule source &amp; conditions</summary>
                    <p>{task.setupNote}</p>
                    <a href={task.sourceUrl} target="_blank" rel="noreferrer">
                      {task.locator} ↗
                    </a>
                  </details>
                )}
              </div>
              <div className="garage-actions">
                <button
                  type="button"
                  className="button secondary"
                  aria-label={`${due.status === 'Needs history' ? 'Add service history' : 'Mark completed'}: ${r.title}`}
                  onClick={() => {
                    setCompletion(r.id);
                    setEditingRecord(undefined);
                    setPanel('service');
                  }}
                >
                  {due.status === 'Needs history' ? 'Add service history' : 'Mark completed'}
                  <span className="sr-only">: {r.title}</span>
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setDeletion(`reminder-${r.id}`)}
                >
                  Remove<span className="sr-only"> reminder: {r.title}</span>
                </button>
              </div>
              {deletion === `reminder-${r.id}` && (
                <div className="garage-confirm">
                  <p>Remove this reminder? Service history will be kept.</p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      if (onUpdate((v) => removeReminder(v, r.id))) setDeletion(null);
                    }}
                  >
                    Remove reminder
                  </button>
                  <button type="button" className="text-button" onClick={() => setDeletion(null)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>
      <details className="garage-history">
        <summary>Service history ({vehicle.records.length})</summary>
        {!vehicle.records.length && <p>No service records yet.</p>}
        {[...vehicle.records]
          .sort((a, b) => b.on.localeCompare(a.on) || b.km - a.km)
          .map((s) => (
            <div className="garage-record" key={s.id}>
              <h4>{s.title}</h4>
              <p>
                {s.on} · {number.format(s.km)} km
              </p>
              {s.note && <p className="garage-record-note">{s.note}</p>}
              <button
                type="button"
                className="text-button"
                aria-label={`Edit record: ${s.title} on ${s.on}`}
                onClick={() => {
                  setEditingRecord(structuredClone(s));
                  setCompletion(null);
                  setPanel('service');
                }}
              >
                Edit record
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setDeletion(`record-${s.id}`)}
              >
                Delete
                <span className="sr-only">
                  {' '}
                  record: {s.title} on {s.on}
                </span>
              </button>
              {deletion === `record-${s.id}` && (
                <div className="garage-confirm">
                  <p>
                    Delete this record? Its reminder will be recalculated from the remaining
                    history.
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      if (
                        onUpdate((v) => ({ ...v, records: v.records.filter((r) => r.id !== s.id) }))
                      )
                        setDeletion(null);
                    }}
                  >
                    Delete record
                  </button>
                  <button type="button" className="text-button" onClick={() => setDeletion(null)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
      </details>
      {vehicle.catalogId && (
        <details className="garage-history">
          <summary>Comparison catalog specifications</summary>
          <p className="garage-fine">
            Published specifications describe the saved catalog configuration. Verify equipment
            against your own vehicle.
          </p>
          {!shownSpecs && (
            <button
              className="text-button"
              type="button"
              disabled={specLoading}
              onClick={() => void loadSpecs()}
            >
              {specLoading ? 'Loading specifications…' : 'Load published specifications'}
            </button>
          )}
          {specError && <p role="status">{specError}</p>}
          {shownSpecs && (
            <dl className="garage-specs">
              {(Object.keys(metricDefinitions) as Metric[])
                .filter((k) => shownSpecs.facts[k].value !== null)
                .map((k) => (
                  <div key={k}>
                    <dt>{metricDefinitions[k].label}</dt>
                    <dd>
                      {number.format(shownSpecs.facts[k].value!)} {metricDefinitions[k].unit}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
          {shownSpecs?.manufacturerConfiguration?.specificationsUrl && (
            <a
              href={shownSpecs.manufacturerConfiguration.specificationsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Manufacturer specifications ↗
            </a>
          )}
        </details>
      )}
      <div className="garage-vehicle-footer">
        <button type="button" className="text-button" onClick={() => setPanel('remove')}>
          Remove vehicle
        </button>
      </div>
      {panel === 'remove' && (
        <div className="garage-confirm">
          <p>
            Remove {vehicleName(vehicle)}, its {vehicle.reminders.length} reminders and{' '}
            {vehicle.records.length} service records from this device? Export a backup first if you
            want to keep them.
          </p>
          <div className="garage-actions">
            <button type="button" className="button danger" onClick={onRemove}>
              Remove vehicle and records
            </button>
            <button type="button" className="button secondary" onClick={() => setPanel(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
export function Garage() {
  const [day, setDay] = useState(today);
  useEffect(() => {
    const refresh = () => setDay(today());
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const manual = useRef(false);
  const { garage, warning, error, change } = useGarage(),
    [adding, setAdding] = useState(false),
    [candidate, setCandidate] = useState<Car | null>(null),
    [notice, setNotice] = useState(''),
    [importError, setImportError] = useState(''),
    [pending, setPending] = useState<GarageData | null>(null);
  useEffect(() => {
    document.title = 'Your garage — OSS';
    const id = new URLSearchParams(location.search).get('vehicle');
    if (!id) return;
    let active = true;
    setNotice('Loading the selected catalog configuration…');
    void import('@oss/car-catalog')
      .then(({ catalog }) => {
        if (!active || manual.current) return;
        const c = catalog.cars.find((c) => c.id === id);
        setCandidate(c ?? null);
        setAdding(true);
        setNotice(
          c ? '' : 'That configuration could not be found. You can enter your vehicle below.',
        );
      })
      .catch(() => {
        if (active && !manual.current) {
          setAdding(true);
          setNotice('The comparison catalog could not load. You can enter your vehicle below.');
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const scheduleStates = garage.vehicles.flatMap((v) =>
    v.reminders.map((r) => reminderDue(v, r, day)),
  );
  const dueCount = scheduleStates.filter(
    (r) => r.status === 'Overdue' || r.status === 'Due now',
  ).length;
  const historyCount = scheduleStates.filter((r) => r.status === 'Needs history').length;
  function update(id: string, f: (v: OwnedVehicle) => OwnedVehicle) {
    return change((g) => {
      if (!g.vehicles.some((v) => v.id === id))
        throw new Error('This vehicle was removed in another tab.');
      return { ...g, vehicles: g.vehicles.map((v) => (v.id === id ? f(v) : v)) };
    });
  }
  async function readFile(file: File | undefined) {
    setImportError('');
    setPending(null);
    if (!file) return;
    try {
      if (file.size > 2000000) throw new Error('Choose a garage JSON backup smaller than 2 MB.');
      setPending(readGarage(await file.text()));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'That backup could not be read.');
    }
  }
  return (
    <>
      <a className="skip-link" href="#garage-main">
        Skip to garage
      </a>
      <AppHeader page="garage" />
      <main id="garage-main" className="garage-main">
        <div className={`garage-intro ${garage.vehicles.length ? 'has-vehicles' : ''}`}>
          <div>
            <h1>Your garage</h1>
            <p>Mileage, service history and maintenance reminders.</p>
          </div>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              manual.current = true;
              setCandidate(null);
              setAdding(true);
              setNotice('');
            }}
          >
            + Add a vehicle
          </button>
        </div>
        <div className="garage-summary">
          {historyCount > 0 && (
            <div>
              <strong>{historyCount}</strong>
              <span>Need service history</span>
            </div>
          )}
          <div>
            <strong>{garage.vehicles.length}</strong>
            <span>{garage.vehicles.length === 1 ? 'Vehicle' : 'Vehicles'}</span>
          </div>
          <div>
            <strong>{dueCount}</strong>
            <span>Due or overdue</span>
          </div>
          <div>
            <strong>{garage.vehicles.reduce((n, v) => n + v.records.length, 0)}</strong>
            <span>Service records</span>
          </div>
        </div>
        <p className="garage-fine garage-privacy">
          Saved in this browser on this device. Export a backup to keep a copy or move to another
          device. Reminders appear here when you visit.
        </p>
        {warning && (
          <div className="garage-notice" role="alert">
            <p>{warning}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                try {
                  download(
                    localStorage.getItem('oss-garage-v1') ?? 'null',
                    'oss-garage-original.json',
                  );
                } catch {
                  setNotice(
                    'Saved original data could not be accessed. Export the current garage below.',
                  );
                }
              }}
            >
              Download saved original
            </button>
          </div>
        )}
        {(error || importError) && (
          <p className="garage-notice" role="alert">
            {error || importError}
          </p>
        )}
        <div className="garage-message" role="status">
          {notice}
        </div>
        {adding && (
          <Suspense
            fallback={
              <div className="garage-panel" role="status">
                Opening vehicle finder…
              </div>
            }
          >
            <AddVehicle
              key={candidate?.id ?? 'manual'}
              candidate={candidate}
              onCancel={() => setAdding(false)}
              onAdd={(v) => {
                if (change((g) => ({ ...g, vehicles: [...g.vehicles, v] }))) {
                  setAdding(false);
                  setCandidate(null);
                  setNotice(`${vehicleName(v)} added to your garage.`);
                  try {
                    history.replaceState(null, '', '/garage');
                  } catch {
                    /* Saved vehicle remains usable when address updates are unavailable. */
                  }
                  return true;
                }
                return false;
              }}
            />
          </Suspense>
        )}
        {!garage.vehicles.length && !adding && (
          <section className="garage-panel garage-empty">
            <h2>No vehicles added</h2>
            <p>Choose your vehicle and enter its current odometer to start a service record.</p>
            <button className="button primary" type="button" onClick={() => setAdding(true)}>
              Add your first vehicle
            </button>
            <p className="garage-fine">
              Select a vehicle from the Canadian directory, or enter one that is not listed.
            </p>
          </section>
        )}
        <div className="garage-vehicles">
          {garage.vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onUpdate={(f) => update(v.id, f)}
              onRemove={() =>
                change((g) => ({ ...g, vehicles: g.vehicles.filter((x) => x.id !== v.id) }))
              }
            />
          ))}
        </div>
        <section className="garage-backup garage-panel" aria-labelledby="garage-backup-title">
          <div>
            <h2 id="garage-backup-title">Backup and restore</h2>
            <p>Back up vehicles, reminders and service history as a JSON file.</p>
          </div>
          <div className="garage-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => download(JSON.stringify(garage, null, 2))}
            >
              Export garage
            </button>
            <label className="button secondary garage-import">
              Choose backup
              <input
                type="file"
                accept=".json,application/json"
                aria-label="Choose garage backup"
                onChange={(e) => {
                  void readFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          {pending && (
            <div className="garage-confirm">
              <p>
                This backup contains {pending.vehicles.length} vehicles and{' '}
                {pending.vehicles.reduce((n, v) => n + v.records.length, 0)} service records.
                Restoring it will replace the {garage.vehicles.length} vehicles currently shown.
                Export your current garage first if needed.
              </p>
              <div className="garage-actions">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    if (change(() => pending, true)) {
                      setPending(null);
                      setNotice('Garage restored from backup.');
                    }
                  }}
                >
                  Replace garage with backup
                </button>
                <button type="button" className="button secondary" onClick={() => setPending(null)}>
                  Cancel restore
                </button>
              </div>
            </div>
          )}
        </section>
        <footer className="garage-footer">
          <p>
            Canadian manufacturer guidance is available for selected vehicles. Exact schedules and
            specifications are still being expanded.
          </p>
          <a href="/">Compare vehicles</a>
        </footer>
      </main>
    </>
  );
}
