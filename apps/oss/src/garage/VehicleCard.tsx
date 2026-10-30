import { useRef, useState } from 'react';
import {
  maintenanceGuidance,
  maintenanceTasks,
  ownerResources,
} from '@oss/car-catalog/maintenance';
import type { Car, Metric } from '@oss/car-catalog';
import { metricDefinitions } from '@oss/car-catalog/metrics';
import {
  reminderDue,
  deleteReminder,
  reviseReminder,
  updateOdometer,
  reviseVehicleDetails,
  reviseServiceRecord,
  deleteServiceRecord,
} from './domain';
import type { OwnedVehicle, Reminder, ServiceRecord } from './domain';
import { Field, submitData, text } from './fields';
import { VehicleDetailsForm } from './VehicleDetailsForm';
import { ReminderForm, ServiceForm } from './ServiceForms';
import { vehicleName } from './vehicleName';
import { ServiceHistory } from './ServiceHistory';
import { reminderPriority, reminderTargetId } from './reminders';
import { focusAndReveal } from './focus';
const number = new Intl.NumberFormat('en-CA');
export function VehicleCard({
  vehicle,
  day,
  onUpdate,
  onRemove,
}: {
  vehicle: OwnedVehicle;
  day: string;
  onUpdate: (f: (v: OwnedVehicle) => OwnedVehicle) => boolean;
  onRemove: () => boolean;
}) {
  const [panel, setPanel] = useState<
      null | 'odometer' | 'reminder' | 'service' | 'remove' | 'edit'
    >(null),
    [editingVehicle, setEditingVehicle] = useState<OwnedVehicle | null>(null),
    [editingRecord, setEditingRecord] = useState<ServiceRecord | undefined>(undefined),
    [editingReminder, setEditingReminder] = useState<Reminder | undefined>(undefined),
    [completion, setCompletion] = useState<string | null>(null),
    [deletion, setDeletion] = useState<Reminder | null>(null),
    [specs, setSpecs] = useState<Car | null>(null),
    [specError, setSpecError] = useState(''),
    [specLoading, setSpecLoading] = useState(false);
  const article = useRef<HTMLElement>(null);
  const closePanel = () => {
    setPanel(null);
    requestAnimationFrame(() => focusAndReveal(article.current));
  };
  const shownSpecs = specs?.id === vehicle.catalogId ? specs : null;
  const guidance = maintenanceGuidance(vehicle),
    resources = ownerResources(vehicle.make);
  const reminders = vehicle.reminders
    .map((r) => ({ r, due: reminderDue(vehicle, r, day) }))
    .sort((a, b) => reminderPriority[a.due.status] - reminderPriority[b.due.status]);
  const success = (update: (v: OwnedVehicle) => OwnedVehicle, focusTarget?: string) => {
    if (onUpdate(update)) {
      setPanel(null);
      setCompletion(null);
      setEditingRecord(undefined);
      setEditingReminder(undefined);
      setEditingVehicle(null);
      setDeletion(null);
      requestAnimationFrame(() =>
        focusTarget
          ? focusAndReveal(document.getElementById(focusTarget))
          : focusAndReveal(article.current),
      );
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
      id={`garage-vehicle-${vehicle.id}`}
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
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setEditingReminder(undefined);
            setDeletion(null);
            setPanel('reminder');
          }}
        >
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
            focusAndReveal(article.current);
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
                autoFocus
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
            <button className="button secondary" type="button" onClick={closePanel}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="garage-guidance">
        <h3>{guidance?.title ?? 'Maintenance guidance'}</h3>
        <p className="garage-fine maintenance-coverage">
          {maintenanceTasks(vehicle).length
            ? `${maintenanceTasks(vehicle).length} selected manufacturer tasks reviewed · full schedule not yet verified`
            : guidance
              ? 'Manufacturer guidance available · no fixed task schedule reviewed'
              : 'Manufacturer schedule not yet reviewed · personal reminders available'}
        </p>
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
            Add service history to calculate due dates for these reviewed tasks. Check your
            vehicle's full maintenance schedule for additional work.
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
          key={editingReminder ? `edit-reminder:${editingReminder.id}` : 'new-reminder'}
          vehicle={vehicle}
          reminder={editingReminder}
          onSave={(r) =>
            success(
              (v) =>
                editingReminder
                  ? reviseReminder(v, editingReminder, r)
                  : { ...v, reminders: [...v.reminders, r] },
              reminderTargetId(vehicle.id, r.id),
            )
          }
          onCancel={() => {
            setPanel(null);
            setEditingReminder(undefined);
            focusAndReveal(
              editingReminder
                ? (document.getElementById(reminderTargetId(vehicle.id, editingReminder.id)) ??
                    article.current)
                : article.current,
            );
          }}
        />
      )}
      {panel === 'service' && (
        <ServiceForm
          key={
            editingRecord
              ? `edit-service:${editingRecord.id}`
              : completion
                ? `complete-reminder:${completion}`
                : 'new-service'
          }
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
            focusAndReveal(article.current);
          }}
        />
      )}
      <section className="garage-reminders" aria-label={`Reminders for ${vehicleName(vehicle)}`}>
        <h3>
          Maintenance schedule <span className="garage-count">{vehicle.reminders.length}</span>
        </h3>
        {!reminders.length && (
          <p className="garage-empty-note">
            {maintenanceTasks(vehicle).length
              ? 'No reminders yet. Add a personal interval or use the manufacturer tasks above.'
              : 'No reminders yet. Use Add reminder to set an interval from your owner’s manual or service provider.'}
          </p>
        )}
        {reminders.map(({ r, due }) => {
          const task = maintenanceTasks(vehicle).find((task) => task.key === r.manufacturerKey);
          return (
            <div
              className="garage-reminder"
              key={r.id}
              id={reminderTargetId(vehicle.id, r.id)}
              role="group"
              aria-label={`${r.title} for ${vehicleName(vehicle)}`}
              tabIndex={-1}
            >
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
                {!r.manufacturerKey && (
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Edit reminder: ${r.title}`}
                    onClick={() => {
                      setEditingReminder(structuredClone(r));
                      setDeletion(null);
                      setPanel('reminder');
                    }}
                  >
                    Edit reminder
                  </button>
                )}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setDeletion(structuredClone(r))}
                >
                  Remove<span className="sr-only"> reminder: {r.title}</span>
                </button>
              </div>
              {deletion?.id === r.id && (
                <div className="garage-confirm">
                  <p>Remove this reminder? Service history will be kept.</p>
                  <div className="garage-actions">
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => {
                        if (onUpdate((v) => deleteReminder(v, deletion))) {
                          setDeletion(null);
                          requestAnimationFrame(() => article.current?.focus());
                        }
                      }}
                    >
                      Remove reminder
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setDeletion(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
      <ServiceHistory
        vehicle={vehicle}
        onEdit={(record) => {
          setEditingRecord(record);
          setCompletion(null);
          setPanel('service');
        }}
        onDelete={(record) => onUpdate((current) => deleteServiceRecord(current, record))}
      />
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
            Remove {vehicleName(vehicle)}, its {vehicle.reminders.length}{' '}
            {vehicle.reminders.length === 1 ? 'reminder' : 'reminders'} and {vehicle.records.length}{' '}
            service {vehicle.records.length === 1 ? 'record' : 'records'} from this device? Export a
            backup first if you want to keep them.
          </p>
          <div className="garage-actions">
            <button type="button" className="button danger" onClick={onRemove}>
              Remove vehicle and records
            </button>
            <button type="button" className="button secondary" onClick={closePanel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
