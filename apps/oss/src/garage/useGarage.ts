import { useEffect, useRef, useState } from 'react';
import { emptyGarage, garageStorageKey, parseGarage, readGarage, checkGarageSize } from './domain';
import type { Garage } from './domain';
const sessionWarning = 'Changes are only kept for this visit. Export a backup before leaving.';
export function useGarage() {
  const load = () => {
    try {
      return {
        garage: readGarage(localStorage.getItem(garageStorageKey)),
        warning: '',
        persist: true,
      };
    } catch {
      return {
        garage: emptyGarage(),
        warning: 'Saved garage data could not be read. It has been preserved. ' + sessionWarning,
        persist: false,
      };
    }
  };
  const [initial] = useState(load),
    [garage, setGarage] = useState(initial.garage),
    [warning, setWarning] = useState(initial.warning),
    [error, setError] = useState('');
  const current = useRef(initial.garage),
    persist = useRef(initial.persist);
  useEffect(() => {
    const receive = (e: StorageEvent) => {
      if ((e.key === garageStorageKey || e.key === null) && persist.current) {
        const next = load();
        current.current = next.garage;
        persist.current = next.persist;
        setGarage(next.garage);
        setWarning(next.warning);
      }
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, []);
  function change(update: (g: Garage) => Garage, replace = false) {
    try {
      let base = current.current;
      if (replace) persist.current = true;
      if (persist.current && !replace) {
        try {
          base = readGarage(localStorage.getItem(garageStorageKey));
        } catch {
          persist.current = false;
          setWarning('Existing saved data was preserved. ' + sessionWarning);
        }
      }
      const next = parseGarage({ ...update(base), revision: crypto.randomUUID() });
      const serialized = JSON.stringify(next);
      checkGarageSize(serialized);
      if (persist.current) {
        try {
          localStorage.setItem(garageStorageKey, serialized);
          setWarning('');
        } catch {
          persist.current = false;
          setWarning(sessionWarning);
        }
      }
      current.current = next;
      setGarage(next);
      setError('');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The garage could not be updated.');
      return false;
    }
  }
  return { garage, warning, error, change };
}
