import { useEffect, useRef, useState } from 'react';
import {
  buyingStorageKey,
  emptyBuyingWorkspace,
  parseBuyingWorkspace,
  readBuyingWorkspace,
  mergeBuyingWorkspace,
} from './buying';
import type { BuyingWorkspace, TestDriveReview } from './buying';

const visitOnly = 'Buying changes are kept for this visit only. Export a backup before leaving.';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function updateReview(
  workspace: BuyingWorkspace,
  expected: TestDriveReview | null,
  next: TestDriveReview,
) {
  const existing = workspace.reviews.find((r) => r.id === next.id) ?? null;
  if (!same(existing, expected))
    throw new Error('This review changed or was removed in another tab. Reopen it before saving.');
  return { ...workspace, reviews: [...workspace.reviews.filter((r) => r.id !== next.id), next] };
}
export function deleteReview(workspace: BuyingWorkspace, expected: TestDriveReview) {
  if (
    !same(
      workspace.reviews.find((r) => r.id === expected.id),
      expected,
    )
  )
    throw new Error(
      'This review changed or was removed in another tab. Reopen it before removing.',
    );
  return { ...workspace, reviews: workspace.reviews.filter((r) => r.id !== expected.id) };
}
export function useBuyingWorkspace() {
  function load() {
    let raw: string | null | undefined;
    try {
      raw = localStorage.getItem(buyingStorageKey);
      return {
        workspace: readBuyingWorkspace(raw),
        raw,
        persist: true,
        warning: '',
      };
    } catch {
      return {
        workspace: emptyBuyingWorkspace(),
        raw,
        persist: false,
        warning: 'Saved buying data could not be read and has been preserved. ' + visitOnly,
      };
    }
  }
  const [initial] = useState(load);
  const [workspace, setWorkspace] = useState(initial.workspace),
    [warning, setWarning] = useState(initial.warning),
    [error, setError] = useState('');
  const current = useRef(initial.workspace),
    persist = useRef(initial.persist),
    rawSeen = useRef(initial.raw);
  useEffect(() => {
    function receive(event: StorageEvent) {
      if ((event.key === buyingStorageKey || event.key === null) && persist.current) {
        const loaded = load();
        current.current = loaded.workspace;
        persist.current = loaded.persist;
        rawSeen.current = loaded.raw;
        setWorkspace(loaded.workspace);
        setWarning(loaded.warning);
      }
    }
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, []);
  function change(update: (base: BuyingWorkspace) => BuyingWorkspace) {
    try {
      let base = current.current;
      if (persist.current) {
        try {
          const raw = localStorage.getItem(buyingStorageKey);
          base = readBuyingWorkspace(raw);
          rawSeen.current = raw;
        } catch {
          persist.current = false;
          setWarning('Existing buying data was preserved. ' + visitOnly);
        }
      }
      const next = parseBuyingWorkspace({ ...update(base), revision: crypto.randomUUID() });
      if (persist.current) {
        try {
          localStorage.setItem(buyingStorageKey, JSON.stringify(next));
          rawSeen.current = JSON.stringify(next);
          setWarning('');
        } catch {
          persist.current = false;
          setWarning(visitOnly);
        }
      }
      current.current = next;
      setWorkspace(next);
      setError('');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Buying data could not be updated.');
      return false;
    }
  }
  return {
    workspace,
    warning,
    error,
    clearError: () => setError(''),
    saveReview: (expected: TestDriveReview | null, next: TestDriveReview) =>
      change((w) => updateReview(w, expected, next)),
    removeReview: (expected: TestDriveReview) => change((w) => deleteReview(w, expected)),
    merge: (incoming: BuyingWorkspace) => change((w) => mergeBuyingWorkspace(w, incoming)),
    clear: (revision: string) => {
      try {
        const raw = localStorage.getItem(buyingStorageKey);
        const storageChanged = persist.current
          ? raw === null
            ? current.current.reviews.length > 0
            : readBuyingWorkspace(raw).revision !== revision
          : rawSeen.current === undefined
            ? raw !== null
            : raw !== rawSeen.current;
        if (current.current.revision !== revision || storageChanged)
          throw new Error('Buying data changed. Review it before clearing.');
        localStorage.removeItem(buyingStorageKey);
        const next = { ...emptyBuyingWorkspace(), revision: crypto.randomUUID() };
        current.current = next;
        rawSeen.current = null;
        persist.current = true;
        setWorkspace(next);
        setWarning('');
        setError('');
        return true;
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Device buying data could not be cleared. Export a backup.',
        );
        return false;
      }
    },
  };
}
export type BuyingStore = ReturnType<typeof useBuyingWorkspace>;
