import { useRef, useState } from 'react';
import type { OwnedVehicle } from './domain';
import { Field } from './fields';
import { focusAndReveal } from './focus';
import { matchesReminderFilter, reminderTargetId } from './reminders';
import type { GarageReminder, ReminderFilter } from './reminders';
import { vehicleName } from './vehicleName';

const pageSize = 6;
const number = new Intl.NumberFormat('en-CA');
const filters: { value: ReminderFilter; label: string }[] = [
  { value: 'attention', label: 'All needing attention' },
  { value: 'due', label: 'Due or overdue' },
  { value: 'soon', label: 'Due soon' },
  { value: 'history', label: 'Needs service history' },
];

export function RemindersOverview({
  entries,
  vehicles,
}: {
  entries: GarageReminder[];
  vehicles: OwnedVehicle[];
}) {
  const [filter, setFilter] = useState<ReminderFilter>('attention');
  const [vehicleId, setVehicleId] = useState('');
  const [requestedPage, setRequestedPage] = useState(1);
  const results = useRef<HTMLHeadingElement>(null);
  const selectedVehicle = vehicles.some((vehicle) => vehicle.id === vehicleId) ? vehicleId : '';
  const scope = entries.filter((entry) => !selectedVehicle || entry.vehicle.id === selectedVehicle);
  const matching = scope.filter((entry) => matchesReminderFilter(entry, filter));
  const pages = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(requestedPage, pages),
    start = (page - 1) * pageSize;
  function changePage(next: number) {
    setRequestedPage(next);
    requestAnimationFrame(() => focusAndReveal(results.current));
  }
  return (
    <section className="garage-panel garage-overview" aria-labelledby="reminders-overview-title">
      <h2 id="reminders-overview-title">Maintenance overview</h2>
      <p className="garage-fine">
        Due and overdue work appears first. Thresholds use actual service history and recorded
        odometers. Missing history needs a baseline before the next service can be calculated.
      </p>
      <div className="garage-overview-filters">
        <Field label="Show reminders">
          {(id) => (
            <select
              id={id}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as ReminderFilter);
                setRequestedPage(1);
              }}
            >
              {filters.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label} (
                  {scope.filter((entry) => matchesReminderFilter(entry, option.value)).length})
                </option>
              ))}
            </select>
          )}
        </Field>
        {vehicles.length > 1 && (
          <Field label="Vehicle for reminders">
            {(id) => (
              <select
                id={id}
                value={selectedVehicle}
                onChange={(event) => {
                  setVehicleId(event.target.value);
                  setRequestedPage(1);
                }}
              >
                <option value="">All vehicles</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicleName(vehicle)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
      </div>
      <p className="garage-fine" aria-live="polite">
        {matching.length} {matching.length === 1 ? 'reminder matches' : 'reminders match'} this
        view.
      </p>
      {matching.length === 0 ? (
        <p>
          {filter === 'attention'
            ? 'No reminders need attention based on the recorded history and odometers.'
            : 'No reminders match this filter.'}
        </p>
      ) : (
        <>
          <h3 className="garage-results-title" ref={results} tabIndex={-1}>
            Reminders · Page {page} of {pages}
          </h3>
          <ul className="garage-overview-list">
            {matching.slice(start, start + pageSize).map(({ vehicle, reminder, due }) => (
              <li key={reminderTargetId(vehicle.id, reminder.id)}>
                <div>
                  <span
                    className={`garage-status ${due.status === 'Overdue' || due.status === 'Due now' ? 'urgent' : due.status === 'Due soon' ? 'soon' : 'pending'}`}
                  >
                    {due.status}
                  </span>
                  <h4>{reminder.title}</h4>
                  <p>
                    {vehicleName(vehicle)} · {number.format(vehicle.odometerKm)} km recorded
                  </p>
                  <p className="garage-fine">
                    {due.status === 'Needs history' && 'Add missing service history. '}
                    {due.dueKm !== null && `${number.format(due.dueKm)} km`}
                    {due.dueKm !== null && due.dueOn && ' or '}
                    {due.dueOn}
                    {due.dueKm !== null && due.dueOn && ' · whichever comes first'}
                  </p>
                </div>
                <button
                  type="button"
                  className="button secondary"
                  aria-label={`Review reminder: ${reminder.title} for ${vehicleName(vehicle)}`}
                  onClick={() =>
                    focusAndReveal(
                      document.getElementById(reminderTargetId(vehicle.id, reminder.id)),
                    )
                  }
                >
                  Review reminder
                </button>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav className="garage-history-pages" aria-label="Maintenance overview pages">
              <button
                type="button"
                className="button secondary"
                disabled={page === 1}
                onClick={() => changePage(page - 1)}
              >
                Previous reminders
              </button>
              <span>
                Page {page} of {pages} · {start + 1}–{Math.min(start + pageSize, matching.length)}{' '}
                of {matching.length}
              </span>
              <button
                type="button"
                className="button secondary"
                disabled={page === pages}
                onClick={() => changePage(page + 1)}
              >
                Next reminders
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
