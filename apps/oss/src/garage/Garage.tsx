import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { maintenanceGuidance, ownerResources } from '@oss/car-catalog/maintenance';
import type { Car, Metric } from '@oss/car-catalog';
import { metricDefinitions } from '@oss/car-catalog/metrics';
import { readGarage, reminderDue, removeReminder, today, updateOdometer } from './domain';
import type { Garage as GarageData, OwnedVehicle, Reminder, ServiceRecord } from './domain';
import { useGarage } from './useGarage';
import './garage.css';
const number = new Intl.NumberFormat('en-CA');
const vehicleName = (v: OwnedVehicle) => v.nickname || `${v.year} ${v.make} ${v.model}`;
function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="garage-field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}
function submitData(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return new FormData(e.currentTarget);
}
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const numeric = (data: FormData, key: string) =>
  text(data, key) === '' ? null : Number(text(data, key));
function download(raw: string, name = 'oss-garage-backup.json') {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AddVehicle({
  candidate,
  onAdd,
  onCancel,
}: {
  candidate: Car | null;
  onAdd: (v: OwnedVehicle) => boolean;
  onCancel: () => void;
}) {
  return (
    <form
      className="garage-panel garage-form"
      onSubmit={(e) => {
        const d = submitData(e);
        onAdd({
          id: crypto.randomUUID(),
          make: text(d, 'make'),
          model: text(d, 'model'),
          year: Number(text(d, 'year')),
          engine: text(d, 'engine'),
          nickname: text(d, 'nickname'),
          odometerKm: Number(text(d, 'km')),
          updatedOn: today(),
          ...(candidate &&
          text(d, 'make') === candidate.make &&
          text(d, 'model') === candidate.model &&
          Number(text(d, 'year')) === candidate.year &&
          text(d, 'engine') === candidate.trim
            ? { catalogId: candidate.id }
            : {}),
          reminders: [],
          records: [],
        });
      }}
      aria-label="Add a vehicle"
    >
      <div className="garage-section-title">
        <h2>Add a vehicle</h2>
        <button type="button" className="text-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p>Enter the vehicle you own. Canadian vehicles of any age can be saved here.</p>
      {candidate && (
        <p className="garage-notice">
          Imported from the comparison catalog. Confirm the model year and powertrain against your
          vehicle.
        </p>
      )}
      <div className="garage-fields">
        <Field label="Make">
          {(id) => (
            <input
              id={id}
              name="make"
              required
              maxLength={100}
              defaultValue={candidate?.make}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Model">
          {(id) => (
            <input id={id} name="model" required maxLength={100} defaultValue={candidate?.model} />
          )}
        </Field>
        <Field label="Model year">
          {(id) => (
            <input
              id={id}
              name="year"
              type="number"
              min="1886"
              max={new Date().getFullYear() + 2}
              required
              defaultValue={candidate?.year ?? undefined}
            />
          )}
        </Field>
        <Field label="Current odometer (km)">
          {(id) => (
            <input id={id} name="km" type="number" min="0" max="5000000" step="1" required />
          )}
        </Field>
        <Field label="Engine / powertrain (optional)">
          {(id) => (
            <input
              id={id}
              name="engine"
              maxLength={200}
              defaultValue={candidate?.trim}
              placeholder="e.g. 2.0 L gasoline, hybrid, electric"
            />
          )}
        </Field>
        <Field label="Nickname (optional)">
          {(id) => (
            <input id={id} name="nickname" maxLength={100} placeholder="e.g. The daily driver" />
          )}
        </Field>
      </div>
      <button className="button primary" type="submit">
        Save vehicle
      </button>
    </form>
  );
}
function ReminderForm({
  vehicle,
  manufacturer,
  onSave,
  onCancel,
}: {
  vehicle: OwnedVehicle;
  manufacturer: boolean;
  onSave: (r: Reminder) => boolean;
  onCancel: () => void;
}) {
  const template = manufacturer ? maintenanceGuidance(vehicle)?.reminder : undefined;
  return (
    <form
      className="garage-subform"
      aria-label={`Add reminder for ${vehicleName(vehicle)}`}
      onSubmit={(e) => {
        const d = submitData(e);
        onSave({
          id: crypto.randomUUID(),
          title: template?.title ?? text(d, 'title'),
          km: template?.km ?? numeric(d, 'km'),
          months: template?.months ?? numeric(d, 'months'),
          lastOn: text(d, 'lastOn') || null,
          lastKm: numeric(d, 'lastKm'),
          ...(template ? { manufacturerKey: template.key } : {}),
        });
      }}
    >
      <h3>{template ? `Set up: ${template.title}` : 'Add a personal reminder'}</h3>
      <p>
        {manufacturer
          ? `Every ${number.format(template!.km)} km or ${template!.months} months, whichever comes first. ${template!.setupNote}`
          : 'Choose an interval from your manual or service provider. Personal reminders are labelled as your own plan.'}
      </p>
      {!manufacturer && (
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
      )}
      {!manufacturer && (
        <div className="garage-fields">
          <Field label="Repeat every (km, optional)">
            {(id) => <input id={id} name="km" type="number" min="1" max="1000000" />}
          </Field>
          <Field label="Repeat every (months, optional)">
            {(id) => <input id={id} name="months" type="number" min="1" max="240" />}
          </Field>
        </div>
      )}
      <div className="garage-fields">
        <Field label="Last completed date">
          {(id) => (
            <input id={id} name="lastOn" type="date" max={today()} required={manufacturer} />
          )}
        </Field>
        <Field label="Last completed odometer (km)">
          {(id) => (
            <input
              id={id}
              name="lastKm"
              type="number"
              min="0"
              max={vehicle.odometerKm}
              required={manufacturer}
            />
          )}
        </Field>
      </div>
      <p className="garage-fine">
        Enter at least one interval and its last completion value. Due reminders use your recorded
        odometer.
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
  onSave,
  onCancel,
}: {
  vehicle: OwnedVehicle;
  reminderId: string | null;
  onSave: (s: ServiceRecord) => boolean;
  onCancel: () => void;
}) {
  const reminder = vehicle.reminders.find((r) => r.id === reminderId);
  return (
    <form
      className="garage-subform"
      aria-label={`Log service for ${vehicleName(vehicle)}`}
      onSubmit={(e) => {
        const d = submitData(e);
        onSave({
          id: crypto.randomUUID(),
          reminderId: reminder?.id ?? null,
          title: reminder?.title ?? text(d, 'title'),
          on: text(d, 'on'),
          km: Number(text(d, 'km')),
          note: text(d, 'note'),
        });
      }}
    >
      <h3>{reminder ? `Complete: ${reminder.title}` : 'Log a service'}</h3>
      {!reminder && (
        <Field label="Service performed">
          {(id) => (
            <input
              id={id}
              name="title"
              required
              maxLength={160}
              placeholder="e.g. Oil and filter replaced"
            />
          )}
        </Field>
      )}
      <div className="garage-fields">
        <Field label="Service date">
          {(id) => (
            <input id={id} name="on" type="date" required max={today()} defaultValue={today()} />
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
              defaultValue={vehicle.odometerKm}
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
            placeholder="Work completed, shop, parts or observations"
          />
        )}
      </Field>
      <p className="garage-fine">
        Update the vehicle’s odometer first if the service reading is higher.
      </p>
      <div className="garage-actions">
        <button type="submit" className="button primary">
          Save service record
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
      null | 'odometer' | 'reminder' | 'manufacturer' | 'service' | 'remove'
    >(null),
    [completion, setCompletion] = useState<string | null>(null),
    [deletion, setDeletion] = useState<string | null>(null),
    [specs, setSpecs] = useState<Car | null>(null),
    [specError, setSpecError] = useState(''),
    [specLoading, setSpecLoading] = useState(false);
  const guidance = maintenanceGuidance(vehicle),
    resources = ownerResources(vehicle.make);
  const reminders = vehicle.reminders
    .map((r) => ({ r, due: reminderDue(vehicle, r) }))
    .sort(
      (a, b) =>
        ['Overdue', 'Due now', 'Due soon', 'Upcoming'].indexOf(a.due.status) -
        ['Overdue', 'Due now', 'Due soon', 'Upcoming'].indexOf(b.due.status),
    );
  const success = (update: (v: OwnedVehicle) => OwnedVehicle) => {
    if (onUpdate(update)) {
      setPanel(null);
      setCompletion(null);
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
    <article className="garage-panel garage-vehicle" aria-label={vehicleName(vehicle)}>
      <div className="garage-section-title">
        <div>
          <p className="eyebrow">
            {vehicle.year} · {vehicle.make}
          </p>
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
            setPanel('service');
          }}
        >
          Log service
        </button>
        <button type="button" className="text-button" onClick={() => setPanel('reminder')}>
          Add reminder
        </button>
      </div>
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
        {guidance?.reminder &&
          !vehicle.reminders.some((r) => r.manufacturerKey === guidance.reminder!.key) && (
            <button type="button" className="text-button" onClick={() => setPanel('manufacturer')}>
              {guidance.reminder.key === 'toyota-2025-visit'
                ? 'Set up service visit reminders'
                : 'Set up oil change reminders'}
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
      {(panel === 'reminder' || panel === 'manufacturer') && (
        <ReminderForm
          vehicle={vehicle}
          manufacturer={panel === 'manufacturer'}
          onSave={(r) => success((v) => ({ ...v, reminders: [...v.reminders, r] }))}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === 'service' && (
        <ServiceForm
          vehicle={vehicle}
          reminderId={completion}
          onSave={(s) => success((v) => ({ ...v, records: [...v.records, s] }))}
          onCancel={() => {
            setPanel(null);
            setCompletion(null);
          }}
        />
      )}
      <section className="garage-reminders" aria-label={`Reminders for ${vehicleName(vehicle)}`}>
        <h3>
          Upcoming maintenance <span className="garage-count">{vehicle.reminders.length}</span>
        </h3>
        {!reminders.length && (
          <p className="garage-empty-note">
            No reminders yet. Add a personal interval or use a supported manufacturer plan above.
          </p>
        )}
        {reminders.map(({ r, due }) => (
          <div className="garage-reminder" key={r.id}>
            <div>
              <span
                className={`garage-status ${due.status === 'Overdue' || due.status === 'Due now' ? 'urgent' : due.status === 'Due soon' ? 'soon' : ''}`}
              >
                {due.status}
              </span>
              <h4>{r.title}</h4>
              <p>
                {due.dueKm !== null && `${number.format(due.dueKm)} km`}
                {due.dueKm !== null && due.dueOn && ' or '}
                {due.dueOn}
                {due.dueKm !== null && due.dueOn && ' · whichever comes first'}
              </p>
              <small>
                {r.manufacturerKey
                  ? (guidance?.reminder?.label ?? 'Manufacturer interval')
                  : 'Personal interval'}{' '}
                ·{' '}
                {[
                  r.km !== null ? `${number.format(r.km)} km` : null,
                  r.months !== null ? `${r.months} months` : null,
                ]
                  .filter(Boolean)
                  .join(' / ')}
              </small>
            </div>
            <div className="garage-actions">
              <button
                type="button"
                className="button secondary"
                aria-label={`Mark completed: ${r.title}`}
                onClick={() => {
                  setCompletion(r.id);
                  setPanel('service');
                }}
              >
                Mark completed<span className="sr-only">: {r.title}</span>
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
        ))}
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
          {!specs && (
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
          {specs && (
            <dl className="garage-specs">
              {(Object.keys(metricDefinitions) as Metric[])
                .filter((k) => specs.facts[k].value !== null)
                .map((k) => (
                  <div key={k}>
                    <dt>{metricDefinitions[k].label}</dt>
                    <dd>
                      {number.format(specs.facts[k].value!)} {metricDefinitions[k].unit}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
          {specs?.manufacturerConfiguration?.specificationsUrl && (
            <a
              href={specs.manufacturerConfiguration.specificationsUrl}
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
  const dueCount = garage.vehicles
    .flatMap((v) => v.reminders.map((r) => reminderDue(v, r, day)))
    .filter((r) => r.status === 'Overdue' || r.status === 'Due now').length;
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
      <header className="site-header garage-header">
        <a className="brand" href="/" aria-label="OSS home">
          oss<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="/">Compare cars ↗</a>
          <a href="/garage" aria-current="page">
            Your garage
          </a>
        </nav>
      </header>
      <main id="garage-main" className="garage-main">
        <div className={`garage-intro ${garage.vehicles.length ? 'has-vehicles' : ''}`}>
          <div>
            <p className="eyebrow">YOUR CARS, TAKEN CARE OF</p>
            <h1>
              {garage.vehicles.length ? (
                'Your garage.'
              ) : (
                <>
                  A little care.
                  <br />
                  <span>A longer road.</span>
                </>
              )}
            </h1>
            <p>Keep your vehicles, service history and next steps together.</p>
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
          <div>
            <strong>{garage.vehicles.length}</strong>
            <span>Vehicles</span>
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
          <AddVehicle
            key={candidate?.id ?? 'manual'}
            candidate={candidate}
            onCancel={() => setAdding(false)}
            onAdd={(v) => {
              if (change((g) => ({ ...g, vehicles: [...g.vehicles, v] }))) {
                setAdding(false);
                setCandidate(null);
                setNotice(`${vehicleName(v)} added to your garage.`);
                history.replaceState(null, '', '/garage');
                return true;
              }
              return false;
            }}
          />
        )}
        {!garage.vehicles.length && !adding && (
          <section className="garage-panel garage-empty">
            <span className="garage-empty-icon" aria-hidden="true">
              ⌂
            </span>
            <h2>
              Every car has a story.
              <br />
              Start keeping yours.
            </h2>
            <p>
              Add the car you already own, enter its odometer, and keep a record of the care it
              gets.
            </p>
            <button className="button primary" type="button" onClick={() => setAdding(true)}>
              Add your first vehicle
            </button>
            <p className="garage-fine">No account needed. Any model year welcome.</p>
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
            <h2 id="garage-backup-title">Keep a copy.</h2>
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
          <a href="/">Find your next vehicle →</a>
        </footer>
      </main>
    </>
  );
}
