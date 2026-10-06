'use client';

import type { ReactNode } from 'react';
import { ariaSortFor, type SortState } from '@/lib/table-sort';

export function SortableHeader<K extends string>({
  sortKey,
  sort,
  onSort,
  children,
  className,
}: {
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  children: ReactNode;
  className?: string;
}) {
  const ariaSort = ariaSortFor(sort, sortKey);
  const indicator = ariaSort === 'ascending' ? '▲' : ariaSort === 'descending' ? '▼' : '↕';
  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex min-h-12 items-center gap-1 bg-transparent p-0 text-inherit [font:inherit] [letter-spacing:inherit] [text-transform:inherit] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        data-testid={`sort-${sortKey}`}
      >
        <span>{children}</span>
        <span aria-hidden="true" className={ariaSort === 'none' ? 'opacity-40' : ''}>
          {indicator}
        </span>
        <span className="sr-only">
          {ariaSort === 'none' ? ', not sorted' : ariaSort === 'ascending' ? ', sorted ascending' : ', sorted descending'}
        </span>
      </button>
    </th>
  );
}
