import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Filters } from './domain';
import type { BrowsingState, SortOrder } from './browsing';

export function useBrowsingState(initial: BrowsingState) {
  const [state, restore] = useState(initial);
  const setFilters: Dispatch<SetStateAction<Filters>> = (update) =>
    restore((current) => ({
      ...current,
      filters: typeof update === 'function' ? update(current.filters) : update,
      page: 1,
    }));
  return {
    state,
    restore,
    setFilters,
    setSort: (sort: SortOrder) => restore((current) => ({ ...current, sort, page: 1 })),
    setScoredOnly: (scoredOnly: boolean) =>
      restore((current) => ({ ...current, scoredOnly, page: 1 })),
    setRequestedPage: (page: number) => restore((current) => ({ ...current, page })),
    resetPage: () => restore((current) => (current.page === 1 ? current : { ...current, page: 1 })),
  };
}
