'use client';

import { useEffect, useState } from 'react';
import type { CatalogSeedItem } from '@careerbridge/shared';
import { getCatalog } from '@/lib/api';

type CatalogOption = { value: string; label: string; parentValue: string | null };

/**
 * Active items of an admin-managed list (Admin → Settings). Until the request resolves — or if it fails —
 * the built-in defaults are shown so forms stay usable.
 */
export function useCatalog(slug: string, fallback: CatalogSeedItem[]) {
  const [items, setItems] = useState<CatalogOption[]>(() =>
    fallback.map((item) => ({ value: item.value, label: item.label, parentValue: item.parentValue ?? null })),
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCatalog(slug)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows.map((row) => ({ value: row.value, label: row.label, parentValue: row.parentValue })));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { items, loaded };
}
