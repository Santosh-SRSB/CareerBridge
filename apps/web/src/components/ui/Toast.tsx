'use client';

import { useEffect, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: string };

const DISMISS_MS: Record<ToastKind, number> = { success: 4000, info: 4000, error: 7000 };

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<(list: ToastItem[]) => void>();

function emit() {
  for (const listener of listeners) listener(items);
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastKind, message: string) {
  const text = String(message || '').trim();
  if (!text) return;
  // Same message already on screen: keep one.
  if (items.some((t) => t.kind === kind && t.message === text)) return;
  const id = nextId++;
  items = [...items.slice(-3), { id, kind, message: text }];
  emit();
  if (typeof window !== 'undefined') window.setTimeout(() => dismiss(id), DISMISS_MS[kind]);
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
};

const STYLES: Record<ToastKind, string> = {
  success: 'bg-[#047857] text-white',
  error: 'bg-[#b91c1c] text-white',
  info: 'bg-[#0a2e2c] text-white',
};

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setList);
    setList(items);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[1000] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {list.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          data-toast={t.kind}
          className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${STYLES[t.kind]}`}
        >
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="-my-2 -mr-2 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg leading-none text-white/90 hover:bg-white/10"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
