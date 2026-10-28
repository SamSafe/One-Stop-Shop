import { useEffect, useRef, useState } from 'react';
import type { Car } from '@oss/car-catalog';
import { knownIds, loadShortlist, saveShortlist, storageKey } from './domain';

const unavailable = 'Your shortlist cannot be saved on this device. It will work for this visit.';

export function useShortlist(cars: Car[]) {
  function read() {
    try {
      return loadShortlist(window.localStorage, cars);
    } catch {
      return { ids: [], warning: unavailable, canPersist: false };
    }
  }

  const [initial] = useState(read);
  const [savedIds, setSavedIds] = useState(initial.ids);
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const current = useRef(initial.ids);
  const canPersist = useRef(initial.canPersist);
  const unsavedChanges = useRef(false);

  function show(ids: string[]) {
    current.current = ids;
    setSavedIds(ids);
  }

  useEffect(() => {
    const receiveStorage = (event: StorageEvent) => {
      if ((event.key === storageKey || event.key === null) && !unsavedChanges.current) {
        const loaded = read();
        // Reading another tab's change must never write a stale snapshot back.
        current.current = loaded.ids;
        canPersist.current = loaded.canPersist;
        setSavedIds(loaded.ids);
        setStorageWarning(loaded.warning);
      }
    };
    window.addEventListener('storage', receiveStorage);
    return () => window.removeEventListener('storage', receiveStorage);
  }, [cars]);

  function change(update: (ids: string[]) => string[]) {
    let latest = current.current;
    if (canPersist.current) {
      const loaded = read();
      if (loaded.canPersist) latest = loaded.ids;
      else {
        canPersist.current = false;
        setStorageWarning(loaded.warning);
      }
    }
    const next = knownIds(update(latest), cars, cars.length);
    const previous = new Set(latest);
    const added = next.filter((id) => !previous.has(id)).length;
    show(next);
    if (canPersist.current) {
      try {
        if (saveShortlist(window.localStorage, next)) {
          unsavedChanges.current = false;
          setStorageWarning(null);
          return added;
        }
      } catch {
        /* Browser storage access itself can throw. Keep the local choice. */
      }
      canPersist.current = false;
      setStorageWarning(unavailable);
    }
    unsavedChanges.current = true;
    return added;
  }

  function setSaved(id: string, wanted: boolean) {
    change((latest) => (wanted ? [...latest, id] : latest.filter((item) => item !== id)));
  }

  function addMany(ids: string[]) {
    return change((latest) => [...latest, ...ids]);
  }

  function clearShortlist() {
    show([]);
    try {
      // Explicit clearing is the only action allowed to remove an unknown format.
      window.localStorage.removeItem(storageKey);
      canPersist.current = true;
      unsavedChanges.current = false;
      setStorageWarning(null);
      return true;
    } catch {
      canPersist.current = false;
      unsavedChanges.current = true;
      setStorageWarning(unavailable);
      return false;
    }
  }

  return { savedIds, storageWarning, setSaved, addMany, clearShortlist };
}
