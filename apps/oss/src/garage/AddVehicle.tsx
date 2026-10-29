import { loadOwnerDirectory } from './ownerLookup';
import { useEffect, useRef, useState } from 'react';
import { focusAndReveal } from './focus';
import type { Car } from '@oss/car-catalog';
import { ownerYears, ownerMakes, ownerModels } from '@oss/car-catalog/owner-directory';
import type { OwnerDirectory } from '@oss/car-catalog/owner-directory';
import { maintenanceGuidance } from '@oss/car-catalog/maintenance';
import { Field, submitData, text } from './fields';
import { today } from './domain';
import type { OwnedVehicle } from './domain';
type Seed = { id?: string; make: string; model: string; year: number | null; trim: string };
function ManualVehicle({
  candidate,
  onAdd,
  onCancel,
}: {
  candidate: Seed | null;
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
          ...(candidate?.id &&
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
      {candidate?.id && (
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
              autoFocus
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

export function AddVehicle({
  candidate,
  onAdd,
  onCancel,
}: {
  candidate: Car | null;
  onAdd: (v: OwnedVehicle) => boolean;
  onCancel: () => void;
}) {
  const [directory, setDirectory] = useState<OwnerDirectory | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [manual, setManual] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => focusAndReveal(heading.current), [manual]);
  const [year, setYear] = useState(candidate?.year ? String(candidate.year) : ''),
    [make, setMake] = useState(candidate?.make ?? ''),
    [model, setModel] = useState(candidate?.model ?? ''),
    [choice, setChoice] = useState(candidate?.id ?? '');
  useEffect(() => {
    let active = true;
    setError('');
    void loadOwnerDirectory()
      .then((d) => {
        if (active) {
          setDirectory(d);
          if (candidate?.year) {
            const match = d.models.find(
              (m) =>
                m.year === candidate.year &&
                m.make.toLowerCase() === candidate.make.toLowerCase() &&
                m.model.toLowerCase() === candidate.model.toLowerCase(),
            );
            if (match) {
              setMake(match.make);
              setModel(match.model);
            }
          }
        }
      })
      .catch(() => {
        if (active)
          setError(
            'Vehicle lookup could not be loaded. Retry, or enter your vehicle details manually.',
          );
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const selected = directory
      ? ownerModels(directory, Number(year), make).find((m) => m.model === model)
      : null,
    configuration = selected?.choices.find((c) => (c.catalogId ?? c.label) === choice),
    guidance = selected ? maintenanceGuidance(selected) : null;
  const seed: Seed | null =
    candidate ??
    (year || make || model
      ? { year: year ? Number(year) : null, make, model, trim: configuration?.engine ?? '' }
      : null);
  if (manual)
    return (
      <div>
        <button className="text-button finder-back" type="button" onClick={() => setManual(false)}>
          ← Back to vehicle lookup
        </button>
        <ManualVehicle candidate={seed} onAdd={onAdd} onCancel={onCancel} />
      </div>
    );
  return (
    <form
      className="garage-panel garage-form vehicle-finder"
      aria-label="Add a vehicle"
      onSubmit={(e) => {
        const d = submitData(e);
        if (!selected) return;
        const trim = text(d, 'trim'),
          engine = [trim, configuration?.engine].filter(Boolean).join(' · ').slice(0, 200);
        onAdd({
          id: crypto.randomUUID(),
          make: selected.make,
          model: selected.model,
          year: selected.year,
          engine,
          nickname: text(d, 'nickname'),
          odometerKm: Number(text(d, 'km')),
          updatedOn: today(),
          ...(configuration?.catalogId && !trim ? { catalogId: configuration.catalogId } : {}),
          reminders: [],
          records: [],
        });
      }}
    >
      <div className="garage-section-title">
        <div>
          <h2 ref={heading} tabIndex={-1}>
            Which vehicle do you own?
          </h2>
        </div>
        <button type="button" className="text-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p>
        Choose your vehicle, then add its mileage. Service guidance is matched separately to the
        vehicle and model year.
      </p>
      {candidate && (
        <p className="finder-status">
          Selected from your comparison. Confirm the configuration matches your vehicle.
        </p>
      )}
      {!directory && !error && (
        <p className="finder-status" role="status">
          Loading Canadian vehicle lookup…
        </p>
      )}
      {error && (
        <div className="garage-notice" role="status">
          <p>{error}</p>
          <button type="button" className="text-button" onClick={() => setRetry((n) => n + 1)}>
            Retry vehicle lookup
          </button>
        </div>
      )}
      <div className="garage-fields identify-grid">
        <Field label="Model year">
          {(id) => (
            <select
              id={id}
              value={year}
              disabled={!directory}
              required
              onChange={(e) => {
                setYear(e.target.value);
                setMake('');
                setModel('');
                setChoice('');
              }}
            >
              <option value="">Select year</option>
              {directory &&
                ownerYears(directory).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </select>
          )}
        </Field>
        <Field label="Make">
          {(id) => (
            <select
              id={id}
              value={make}
              disabled={!directory || !year}
              required
              onChange={(e) => {
                setMake(e.target.value);
                setModel('');
                setChoice('');
              }}
            >
              <option value="">Select make</option>
              {directory &&
                year &&
                ownerMakes(directory, Number(year)).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
          )}
        </Field>
        <Field label="Model">
          {(id) => (
            <select
              id={id}
              value={model}
              disabled={!directory || !make}
              required
              onChange={(e) => {
                setModel(e.target.value);
                setChoice('');
              }}
            >
              <option value="">Select model</option>
              {directory &&
                make &&
                ownerModels(directory, Number(year), make).map((m) => (
                  <option key={m.model} value={m.model}>
                    {m.model}
                  </option>
                ))}
            </select>
          )}
        </Field>
        <Field label="Engine / powertrain (optional)">
          {(id) => (
            <select
              id={id}
              value={choice}
              disabled={!selected}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">Not sure / add later</option>
              {selected?.choices.some((c) => c.catalogId) && (
                <optgroup label="Catalog configurations">
                  {selected.choices
                    .filter((c) => c.catalogId)
                    .map((c) => (
                      <option key={c.catalogId} value={c.catalogId}>
                        {c.label}
                      </option>
                    ))}
                </optgroup>
              )}
              {selected?.choices.some((c) => !c.catalogId) && (
                <optgroup label="Published engine and transmission choices">
                  {selected.choices
                    .filter((c) => !c.catalogId)
                    .map((c) => (
                      <option key={c.label} value={c.label}>
                        {c.label}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          )}
        </Field>
      </div>
      {selected && (
        <>
          <div className="finder-confirmation">
            <strong>
              {selected.year} {selected.make} {selected.model}
            </strong>
            <span>
              {guidance
                ? 'Manufacturer guidance available for this model year'
                : 'Vehicle identified · maintenance schedule not yet reviewed'}
            </span>
            <p>
              {configuration?.catalogId
                ? 'This selection links the published comparison specifications. Confirm the equipment against your car.'
                : 'Published engine choices do not identify every Canadian retail trim. Choose only what you can confirm.'}
            </p>
          </div>
          <div className="garage-fields">
            <Field label="Current odometer (km)">
              {(id) => (
                <input
                  id={id}
                  name="km"
                  type="number"
                  min="0"
                  max="5000000"
                  required
                  inputMode="numeric"
                  placeholder="e.g. 120000"
                />
              )}
            </Field>
            <Field label="Nickname (optional)">
              {(id) => (
                <input id={id} name="nickname" maxLength={100} placeholder="e.g. Daily driver" />
              )}
            </Field>
            {!configuration?.catalogId && (
              <Field label="Canadian trim (optional)">
                {(id) => (
                  <input
                    id={id}
                    name="trim"
                    maxLength={100}
                    placeholder="e.g. GL — leave blank if unsure"
                  />
                )}
              </Field>
            )}
          </div>
          <button className="button primary" type="submit">
            Save vehicle
          </button>
        </>
      )}
      <div className="finder-footer">
        <button type="button" className="text-button" onClick={() => setManual(true)}>
          Vehicle or year not listed? Enter details manually
        </button>
        <p>
          Lookup covers published Canadian models from{' '}
          {directory ? Math.min(...directory.models.map((m) => m.year)) : 1995} onward.{' '}
          <a
            href="https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64"
            target="_blank"
            rel="noreferrer"
          >
            Natural Resources Canada fuel-rating data
          </a>{' '}
          and current manufacturer catalog; coverage varies by year and vehicle.
        </p>
      </div>
    </form>
  );
}
