import { useEffect, useRef, useState } from 'react';
import { bodyChoices, driveChoices, briefPriorityLabels, briefPresets, emptyBrief } from './buying';
import type { BriefPriority, BuyingBrief } from './buying';
import type { BuyingStore } from './useBuyingWorkspace';
import { Icon } from './catalogView';
import { useDialogLayout } from './useDialogLayout';

export function BuyingBriefDialog({
  store,
  onClose,
  onApply,
}: {
  store: BuyingStore;
  onClose: () => void;
  onApply: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useDialogLayout(dialog);
  const [original] = useState(store.workspace.brief);
  const [draft, setDraft] = useState<BuyingBrief>(() => structuredClone(original ?? emptyBrief()));
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  function set<K extends keyof BuyingBrief>(key: K, value: BuyingBrief[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function close() {
    dialog.current?.close();
    onClose();
  }
  return (
    <dialog
      className="comparison-dialog buying-dialog managed-dialog"
      ref={dialog}
      aria-labelledby="brief-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="dialog-header">
        <div>
          <h2 id="brief-title">Your buying brief</h2>
          {store.error && (
            <p className="form-error" role="alert">
              {store.error}
            </p>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close buying brief"
          onClick={close}
          autoFocus
        >
          <Icon name="close" size={24} />
        </button>
      </div>
      <p className="dialog-intro">
        Set your requirements, then choose the preferences that matter to you.
      </p>
      <form
        id="buying-brief-form"
        className="buying-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (store.saveBrief(original, { ...draft, enabled: true })) {
            onApply();
            close();
          }
        }}
      >
        <fieldset>
          <legend>Start with your needs</legend>
          <p>
            Budget and seats are requirements. Choose whether body style and drivetrain are
            preferences or must-haves. Unknown requirements need checking.
          </p>
          <div className="buying-fields">
            <label>
              Maximum base MSRP · CAD
              <input
                type="number"
                min="10000"
                max="10000000"
                step="1"
                value={draft.budget ?? ''}
                placeholder="No limit"
                onChange={(e) =>
                  set('budget', e.target.value === '' ? null : Number(e.target.value))
                }
              />
            </label>
            <label>
              Minimum seats
              <select
                value={draft.minSeats ?? ''}
                onChange={(e) => set('minSeats', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">No requirement</option>
                {[2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((n) => (
                  <option key={n} value={n}>
                    {n}+ seats
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="field-hint">
            Base MSRP excludes taxes, freight/PDI and other fees. Leave room for those costs.
          </p>
          <fieldset className="body-options">
            <legend>Body styles you would consider</legend>
            <p>Leave all unchecked for any style.</p>
            <div className="buying-checks">
              {bodyChoices.map((body) => (
                <label key={body}>
                  <input
                    type="checkbox"
                    checked={draft.bodies.includes(body)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        bodies: e.target.checked
                          ? [...d.bodies, body]
                          : d.bodies.filter((b) => b !== body),
                        bodyRequired: e.target.checked
                          ? d.bodyRequired
                          : d.bodies.length > 1 && d.bodyRequired,
                      }))
                    }
                  />
                  {body}
                </label>
              ))}
            </div>
            <label className="matching-filter">
              <input
                type="checkbox"
                disabled={!draft.bodies.length}
                checked={draft.bodyRequired}
                onChange={(e) => set('bodyRequired', e.target.checked)}
              />
              Only show these body styles
            </label>
          </fieldset>
          <div className="buying-fields">
            <label>
              Preferred drivetrain
              <select
                value={draft.drive}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    drive: e.target.value as BuyingBrief['drive'],
                    driveRequired: e.target.value !== 'Any' && d.driveRequired,
                  }))
                }
              >
                {driveChoices.map((d) => (
                  <option key={d} value={d}>
                    {d === 'Any' ? 'No preference' : d}
                  </option>
                ))}
              </select>
            </label>
            <label className="matching-filter">
              <input
                type="checkbox"
                disabled={draft.drive === 'Any'}
                checked={draft.driveRequired}
                onChange={(e) => set('driveRequired', e.target.checked)}
              />
              Drivetrain is a must-have
            </label>
          </div>
          <label className="matching-filter">
            <input
              type="checkbox"
              checked={draft.includeUnverified}
              onChange={(e) => set('includeUnverified', e.target.checked)}
            />
            Include vehicles with unverified requirements for me to check
          </label>
        </fieldset>
        <details className="buying-questionnaire">
          <summary>Optional questionnaire: what matters to you?</summary>
          <div className="buying-questionnaire-content">
            <p>Use a preset or set each priority from 0 to 5.</p>
            <div className="shortlist-tools" role="group" aria-label="Buying priority presets">
              {briefPresets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="button secondary"
                  aria-pressed={JSON.stringify(draft.weights) === JSON.stringify(p.weights)}
                  onClick={() => set('weights', { ...p.weights })}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="buying-fields">
              <label>
                Horsepower target · hp
                <input
                  type="number"
                  min="50"
                  max="1500"
                  step="1"
                  value={draft.horsepower}
                  onChange={(e) => set('horsepower', Number(e.target.value))}
                  required
                />
              </label>
              <label className="matching-filter">
                <input
                  type="checkbox"
                  checked={draft.powerRequired}
                  onChange={(e) => set('powerRequired', e.target.checked)}
                />
                Horsepower target is a minimum requirement
              </label>
              <label>
                Rear-legroom target · mm
                <input
                  type="number"
                  min="600"
                  max="1600"
                  step="1"
                  value={draft.rearLegroom}
                  onChange={(e) => set('rearLegroom', Number(e.target.value))}
                  required
                />
              </label>
              <label className="matching-filter">
                <input
                  type="checkbox"
                  checked={draft.roomRequired}
                  onChange={(e) => set('roomRequired', e.target.checked)}
                />
                Rear-legroom target is a minimum requirement
              </label>
              <label>
                Cargo target, seats up · litres
                <input
                  type="number"
                  min="10"
                  max="4000"
                  step="1"
                  value={draft.cargo}
                  onChange={(e) => set('cargo', Number(e.target.value))}
                  required
                />
              </label>
            </div>
            <p>
              0 = ignore · 5 = highest priority. Record how the car feels in your test-drive notes.
            </p>
            {(Object.keys(briefPriorityLabels) as BriefPriority[]).map((key) => (
              <label className="buying-weight" key={key}>
                {briefPriorityLabels[key]}
                <output htmlFor={`brief-weight-${key}`}>{draft.weights[key]} / 5</output>
                <input
                  id={`brief-weight-${key}`}
                  aria-label={`${briefPriorityLabels[key]} importance`}
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={draft.weights[key]}
                  onChange={(e) =>
                    set('weights', { ...draft.weights, [key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
            <p className="field-hint">
              Body-style and drivetrain weights apply when you choose preferences above. Cargo,
              legroom and horsepower stop earning extra points at your targets. Missing an active
              fact leaves the vehicle unscored. Power can mean engine or total-system output; check
              source notes. Your test drive captures how a seat feels and how the car handles.
            </p>
          </div>
        </details>
        <label className="matching-filter">
          <input
            type="checkbox"
            checked={draft.hideRuledOut}
            onChange={(e) => set('hideRuledOut', e.target.checked)}
          />
          Hide vehicles I ruled out in my latest test-drive review
        </label>
        <p className="buying-private">
          Your brief and test-drive notes are saved on this device. Export them from the journal to
          keep a backup. Copied catalog links include the catalog controls only.
        </p>
      </form>
      <div className="dialog-actions">
        <button type="button" className="button secondary" onClick={close}>
          Cancel brief
        </button>
        <button type="submit" form="buying-brief-form" className="button primary">
          Save and use brief
        </button>
      </div>
    </dialog>
  );
}
