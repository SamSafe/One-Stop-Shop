import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import type { Car } from '@oss/car-catalog';
import { readGarage, today } from './domain';
import type { Garage as GarageData, OwnedVehicle } from './domain';
import { useGarage } from './useGarage';
import { VehicleCard } from './VehicleCard';
import { vehicleName } from './vehicleName';
import { download } from './download';
import { garageCalendar } from './calendar';
import { garageReminders } from './reminders';
import { RemindersOverview } from './RemindersOverview';
import './garage.css';
import { AppHeader } from '../AppHeader';
import { focusAndReveal } from './focus';
const AddVehicle = lazy(() => import('./AddVehicle').then((m) => ({ default: m.AddVehicle })));

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
  const addButton = useRef<HTMLButtonElement>(null);
  const importRequest = useRef(0);
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
  const scheduleStates = useMemo(
    () => garageReminders(garage.vehicles, day),
    [garage.vehicles, day],
  );
  const dueCount = scheduleStates.filter(
    ({ due }) => due.status === 'Overdue' || due.status === 'Due now',
  ).length;
  const historyCount = scheduleStates.filter(({ due }) => due.status === 'Needs history').length;
  function update(id: string, f: (v: OwnedVehicle) => OwnedVehicle) {
    return change((g) => {
      if (!g.vehicles.some((v) => v.id === id))
        throw new Error('This vehicle was removed in another tab.');
      return { ...g, vehicles: g.vehicles.map((v) => (v.id === id ? f(v) : v)) };
    });
  }
  async function readFile(file: File | undefined) {
    const request = ++importRequest.current;
    setImportError('');
    setPending(null);
    if (!file) return;
    try {
      if (file.size > 2000000) throw new Error('Choose a garage JSON backup smaller than 2 MB.');
      const next = readGarage(await file.text());
      if (request === importRequest.current) setPending(next);
    } catch (e) {
      if (request === importRequest.current)
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
            <p>Odometer readings, service history and maintenance reminders.</p>
          </div>
          <button
            ref={addButton}
            type="button"
            className="button primary"
            disabled={adding}
            aria-expanded={adding}
            aria-controls="garage-add-vehicle"
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
        {scheduleStates.length > 0 && (
          <RemindersOverview entries={scheduleStates} vehicles={garage.vehicles} />
        )}
        {garage.vehicles.length > 0 && (
          <section className="garage-panel garage-calendar" aria-labelledby="calendar-title">
            <h2 id="calendar-title">Calendar export</h2>
            <p>
              Export reminders with a known due date. Mileage-only reminders stay in Garage. Export
              again after logging service, and set notifications in your calendar app.
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const calendar = garageCalendar(garage);
                if (!calendar.count) {
                  setNotice(
                    'No calendar dates are known yet. Add actual service history to establish due dates.',
                  );
                  return;
                }
                download(calendar.content, 'oss-maintenance.ics', 'text/calendar;charset=utf-8');
                setNotice(
                  `${calendar.count} service ${calendar.count === 1 ? 'date' : 'dates'} exported. Import the file into your calendar app.`,
                );
              }}
            >
              Export service dates (.ics)
            </button>
          </section>
        )}
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
        <div id="garage-add-vehicle">
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
                onCancel={() => {
                  setAdding(false);
                  requestAnimationFrame(() => focusAndReveal(addButton.current));
                }}
                onAdd={(v) => {
                  if (change((g) => ({ ...g, vehicles: [...g.vehicles, v] }))) {
                    setAdding(false);
                    setCandidate(null);
                    setNotice(`${vehicleName(v)} added to your garage.`);
                    requestAnimationFrame(() =>
                      focusAndReveal(document.getElementById(`garage-vehicle-${v.id}`)),
                    );
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
        </div>
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
              day={day}
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
              onClick={() => download(JSON.stringify(garage))}
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
                This backup contains {pending.vehicles.length}{' '}
                {pending.vehicles.length === 1 ? 'vehicle' : 'vehicles'} and{' '}
                {pending.vehicles.reduce((n, v) => n + v.records.length, 0)}{' '}
                {pending.vehicles.reduce((n, v) => n + v.records.length, 0) === 1
                  ? 'service record'
                  : 'service records'}
                . Restoring this file replaces your current garage. Export a backup first to keep a
                copy.
              </p>
              <div className="garage-actions">
                <button
                  type="button"
                  className="button danger"
                  onClick={() => {
                    if (change(() => pending, true)) {
                      setPending(null);
                      setNotice('Garage restored from backup.');
                    }
                  }}
                >
                  Replace garage with backup
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    importRequest.current++;
                    setPending(null);
                  }}
                >
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
