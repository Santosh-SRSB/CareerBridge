/** Interval used by Super Admin candidate and employer list auto-refresh. */
export const ADMIN_LIST_POLL_MS = 30_000;

export const ADMIN_LIST_POLL_TABS = ['candidates', 'employers'] as const;
export type AdminListPollTab = (typeof ADMIN_LIST_POLL_TABS)[number];

export function isAdminListPollTab(tab: string): tab is AdminListPollTab {
  return (ADMIN_LIST_POLL_TABS as readonly string[]).includes(tab);
}

export type VisiblePollClock = {
  setInterval: (handler: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
  addEventListener: (type: 'visibilitychange', handler: () => void) => void;
  removeEventListener: (type: 'visibilitychange', handler: () => void) => void;
  hidden: () => boolean;
};

export type VisiblePollOptions = {
  intervalMs: number;
  refresh: () => void | Promise<void>;
  clock?: VisiblePollClock;
};

function browserClock(): VisiblePollClock {
  return {
    setInterval: (handler, ms) => window.setInterval(handler, ms),
    clearInterval: (id) => window.clearInterval(id),
    addEventListener: (type, handler) => document.addEventListener(type, handler),
    removeEventListener: (type, handler) => document.removeEventListener(type, handler),
    hidden: () => document.visibilityState === 'hidden',
  };
}

/**
 * Calls `refresh` on an interval while the page is visible.
 * Skips ticks when the tab is hidden or a previous refresh is still in flight.
 * Resumes immediately when the tab becomes visible again.
 */
export function startVisiblePoll(options: VisiblePollOptions): () => void {
  const clock = options.clock ?? browserClock();
  let inFlight = false;
  let stopped = false;

  const tick = () => {
    if (stopped || clock.hidden() || inFlight) return;
    inFlight = true;
    Promise.resolve()
      .then(() => options.refresh())
      .catch(() => {
        /* callers handle their own errors; keep the timer alive */
      })
      .finally(() => {
        inFlight = false;
      });
  };

  const onVisibility = () => {
    if (!clock.hidden()) tick();
  };

  const timer = clock.setInterval(tick, options.intervalMs);
  clock.addEventListener('visibilitychange', onVisibility);

  return () => {
    stopped = true;
    clock.clearInterval(timer);
    clock.removeEventListener('visibilitychange', onVisibility);
  };
}
