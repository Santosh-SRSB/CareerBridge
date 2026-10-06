export type SortDirection = 'asc' | 'desc';

export type SortState<K extends string> = { key: K; dir: SortDirection };

export type SortValue = string | number | null | undefined;

/** Clicking the active column flips direction; a new column starts at `defaultDir`. */
export function nextSort<K extends string>(
  current: SortState<K>,
  key: K,
  defaultDir: SortDirection = 'asc',
): SortState<K> {
  if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: defaultDir };
}

/** Stable sort; empty values (null/undefined/'') always go last regardless of direction. */
export function sortRows<T>(rows: readonly T[], value: (row: T) => SortValue, dir: SortDirection): T[] {
  const factor = dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, v: value(row) }))
    .sort((a, b) => {
      const aEmpty = a.v == null || a.v === '';
      const bEmpty = b.v == null || b.v === '';
      if (aEmpty || bEmpty) {
        if (aEmpty && bEmpty) return a.index - b.index;
        return aEmpty ? 1 : -1;
      }
      let cmp: number;
      if (typeof a.v === 'number' && typeof b.v === 'number') cmp = a.v - b.v;
      else cmp = String(a.v).localeCompare(String(b.v), undefined, { sensitivity: 'base', numeric: true });
      return cmp !== 0 ? cmp * factor : a.index - b.index;
    })
    .map((entry) => entry.row);
}

export function ariaSortFor<K extends string>(state: SortState<K>, key: K): 'ascending' | 'descending' | 'none' {
  if (state.key !== key) return 'none';
  return state.dir === 'asc' ? 'ascending' : 'descending';
}
