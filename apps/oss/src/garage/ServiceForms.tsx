import { reminderDue, today } from './domain';
import type { OwnedVehicle, Reminder, ServiceRecord } from './domain';
import { Field, submitData, text, numeric } from './fields';
import { vehicleName } from './vehicleName';
import { useId, useState } from 'react';
import { parseServiceCost } from './history';
export function ReminderForm({
  vehicle,
  reminder,
  onSave,
  onCancel,
}: {
  vehicle: OwnedVehicle;
  reminder?: Reminder;
  onSave: (r: Reminder) => boolean;
  onCancel: () => void;
}) {
  const [intervalError, setIntervalError] = useState(false);
  const [startingDate, setStartingDate] = useState(reminder?.lastOn ?? '');
  const intervalErrorId = useId();
  return (
    <form
      className="garage-subform"
      aria-label={`${reminder ? 'Edit' : 'Add'} reminder for ${vehicleName(vehicle)}`}
      onSubmit={(e) => {
        const d = submitData(e);
        if (numeric(d, 'km') === null && numeric(d, 'months') === null) {
          setIntervalError(true);
          e.currentTarget.querySelector<HTMLInputElement>('[name="km"]')?.focus();
          return;
        }
        setIntervalError(false);
        onSave({
          id: reminder?.id ?? crypto.randomUUID(),
          title: text(d, 'title'),
          km: numeric(d, 'km'),
          months: numeric(d, 'months'),
          lastOn: text(d, 'lastOn') || null,
          lastKm: numeric(d, 'lastKm'),
        });
      }}
    >
      <h3>{reminder ? 'Edit' : 'Add'} a personal reminder</h3>
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
            defaultValue={reminder?.title}
            autoFocus
            placeholder="e.g. Seasonal tire change"
          />
        )}
      </Field>
      <div className="garage-fields">
        <Field label="Repeat every (km, optional)">
          {(id) => (
            <input
              id={id}
              name="km"
              type="number"
              min="1"
              max="1000000"
              defaultValue={reminder?.km ?? ''}
              onChange={() => setIntervalError(false)}
              aria-invalid={intervalError}
              aria-describedby={intervalError ? intervalErrorId : undefined}
            />
          )}
        </Field>
        <Field label="Repeat every (months, optional)">
          {(id) => (
            <input
              id={id}
              name="months"
              type="number"
              min="1"
              max="240"
              defaultValue={reminder?.months ?? ''}
              onChange={() => setIntervalError(false)}
              aria-invalid={intervalError}
              aria-describedby={intervalError ? intervalErrorId : undefined}
            />
          )}
        </Field>
      </div>
      {intervalError && (
        <p className="garage-notice" role="alert" id={intervalErrorId}>
          Enter a distance interval, a time interval, or both.
        </p>
      )}
      {reminder && (
        <p className="garage-fine">
          Starting completion details are used together with logged service history. Later logged
          work takes priority. To correct logged work, edit its service record in Service history.
        </p>
      )}
      <div className="garage-fields">
        <Field label={reminder ? 'Starting completion date (optional)' : 'Last completed date'}>
          {(id) => (
            <input
              id={id}
              name="lastOn"
              type="date"
              max={today()}
              value={startingDate}
              onChange={(event) => setStartingDate(event.target.value)}
            />
          )}
        </Field>
        <Field
          label={
            reminder
              ? 'Starting completion odometer (km, optional)'
              : 'Last completed odometer (km)'
          }
        >
          {(id) => (
            <input
              id={id}
              name="lastKm"
              type="number"
              min="0"
              max={vehicle.odometerKm}
              defaultValue={reminder?.lastKm ?? ''}
            />
          )}
        </Field>
      </div>
      <p className="garage-fine">
        Choose an interval and add the last completion if known. Otherwise this plan needs service
        history before its next due date can be calculated.
      </p>
      <div className="garage-actions">
        <button type="submit" className="button primary">
          {reminder ? 'Save reminder changes' : 'Save reminder'}
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
export function ServiceForm({
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
  const [costError, setCostError] = useState('');
  const reminder = vehicle.reminders.find((r) => r.id === (record?.reminderId ?? reminderId));
  const needsHistory =
    !record && reminder && reminderDue(vehicle, reminder).status === 'Needs history';
  return (
    <form
      className="garage-subform"
      aria-label={`${record ? 'Edit service' : 'Log service'} for ${vehicleName(vehicle)}`}
      onSubmit={(e) => {
        const d = submitData(e);
        let costCents: number | undefined;
        try {
          costCents = parseServiceCost(text(d, 'cost'));
        } catch (error) {
          setCostError(error instanceof Error ? error.message : 'Check the amount paid.');
          return;
        }
        setCostError('');
        const provider = text(d, 'provider');
        const linkedId = record || !reminder ? text(d, 'reminderId') || null : reminder.id;
        const linked = vehicle.reminders.find((r) => r.id === linkedId);
        onSave({
          id: record?.id ?? crypto.randomUUID(),
          reminderId: linkedId,
          title: record ? text(d, 'title') : (linked?.title ?? text(d, 'title')),
          on: text(d, 'on'),
          km: Number(text(d, 'km')),
          note: text(d, 'note'),
          ...(costCents !== undefined ? { costCents } : {}),
          ...(provider ? { provider } : {}),
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
              autoFocus
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
              autoFocus={!record && !!reminder}
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
      <div className="garage-fields">
        <Field label="Amount paid (CAD, optional)">
          {(id) => (
            <>
              <input
                id={id}
                name="cost"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                inputMode="decimal"
                defaultValue={
                  record?.costCents === undefined ? '' : (record.costCents / 100).toFixed(2)
                }
                placeholder="e.g. 89.95"
                aria-describedby={`${id}-hint`}
                onChange={() => setCostError('')}
              />
              <small id={`${id}-hint`}>
                Include tax for this record. Blank means unknown; use 0 for covered work. Avoid
                counting the same invoice total on several records.
              </small>
            </>
          )}
        </Field>
        <Field label="Service provider (optional)">
          {(id) => (
            <input
              id={id}
              name="provider"
              maxLength={100}
              defaultValue={record?.provider}
              placeholder="Shop name or DIY"
            />
          )}
        </Field>
      </div>
      {costError && (
        <p className="garage-notice" role="alert">
          {costError}
        </p>
      )}
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
