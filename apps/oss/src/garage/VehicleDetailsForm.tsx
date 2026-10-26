import { useState } from 'react';
import { Field } from './fields';
import { incompatibleManufacturerReminders, vehicleDetails } from './domain';
import type { OwnedVehicle, VehicleDetails } from './domain';
export function VehicleDetailsForm({
  original,
  onSave,
  onCancel,
}: {
  original: OwnedVehicle;
  onSave: (details: VehicleDetails, keepAsPersonal: boolean) => boolean;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({ ...vehicleDetails(original), year: String(original.year) }),
    [keepAsPersonal, setKeepAsPersonal] = useState(false);
  const details = {
    ...draft,
    make: draft.make.trim(),
    model: draft.model.trim(),
    engine: draft.engine.trim(),
    nickname: draft.nickname.trim(),
    year: Number(draft.year),
  };
  const incompatible = incompatibleManufacturerReminders(original, details);
  const input = (key: keyof typeof draft, value: string) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setKeepAsPersonal(false);
  };
  const identityChanged =
    (['make', 'model', 'engine'] as const).some(
      (key) => details[key].toLowerCase() !== original[key].trim().toLowerCase(),
    ) || details.year !== original.year;
  return (
    <form
      className="garage-subform"
      aria-label="Edit vehicle details"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(details, keepAsPersonal);
      }}
    >
      <h3>Edit vehicle details</h3>
      <p>
        Correct the details for this vehicle. Its odometer, reminders and service history stay
        attached.
      </p>
      <div className="garage-fields">
        <Field label="Make">
          {(id) => (
            <input
              id={id}
              value={draft.make}
              onChange={(e) => input('make', e.target.value)}
              required
              maxLength={100}
            />
          )}
        </Field>
        <Field label="Model">
          {(id) => (
            <input
              id={id}
              value={draft.model}
              onChange={(e) => input('model', e.target.value)}
              required
              maxLength={100}
            />
          )}
        </Field>
        <Field label="Model year">
          {(id) => (
            <input
              id={id}
              value={draft.year}
              onChange={(e) => input('year', e.target.value)}
              type="number"
              min="1886"
              max={new Date().getFullYear() + 2}
              required
            />
          )}
        </Field>
        <Field label="Engine / powertrain (optional)">
          {(id) => (
            <input
              id={id}
              value={draft.engine}
              onChange={(e) => input('engine', e.target.value)}
              maxLength={200}
            />
          )}
        </Field>
        <Field label="Nickname (optional)">
          {(id) => (
            <input
              id={id}
              value={draft.nickname}
              onChange={(e) => input('nickname', e.target.value)}
              maxLength={100}
            />
          )}
        </Field>
      </div>
      {original.catalogId && identityChanged && (
        <p className="garage-notice">
          The saved comparison specifications describe the previous configuration. Changing its
          make, model, year or powertrain will remove that comparison link.
        </p>
      )}
      {incompatible.length > 0 && (
        <fieldset className="garage-plan-review">
          <legend>Review manufacturer reminders</legend>
          <p>
            The edited details no longer match the reviewed source for{' '}
            {incompatible.length === 1 ? 'this reminder' : 'these reminders'}:
          </p>
          <ul>
            {incompatible.map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
          <label>
            <input
              type="checkbox"
              checked={keepAsPersonal}
              onChange={(e) => setKeepAsPersonal(e.target.checked)}
              required
            />
            Keep the affected intervals as personal reminders. Service history will be kept.
          </label>
        </fieldset>
      )}
      <div className="garage-actions">
        <button type="submit" className="button primary">
          Save vehicle details
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
