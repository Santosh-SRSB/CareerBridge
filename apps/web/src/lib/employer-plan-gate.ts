/** Session + server gate: employer must pay for a plan before posting a new job. */

import { getEmployerSubscription } from '@/lib/api';

const PLAN_KEY = 'cb_employer_plan';
const READY_KEY = 'cb_employer_plan_ready_for_post';

export function getStoredEmployerPlanId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(PLAN_KEY);
  } catch {
    return null;
  }
}

export function hasEmployerPlanForJobPost(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(READY_KEY) === '1' && Boolean(sessionStorage.getItem(PLAN_KEY));
  } catch {
    return false;
  }
}

export function storeEmployerPlanId(planId: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PLAN_KEY, planId);
  } catch {
    /* ignore */
  }
}

/** Call only after verified payment (or mock checkout success). */
export function markEmployerPlanForJobPost(planId: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PLAN_KEY, planId);
    sessionStorage.setItem(READY_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearEmployerPlanGate() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(READY_KEY);
  } catch {
    /* ignore */
  }
}

/** Prefer server subscription; fall back to session only if API is unreachable mid-flow. */
export async function canEmployerPostJob(): Promise<boolean> {
  try {
    const status = await getEmployerSubscription();
    if (status.active) {
      if (status.planId) markEmployerPlanForJobPost(status.planId);
      return true;
    }
    clearEmployerPlanGate();
    return false;
  } catch {
    return hasEmployerPlanForJobPost();
  }
}

export const EMPLOYER_POST_JOB_PRICING_HREF = '/employer/payments/buy?intent=post-job';
export const EMPLOYER_POST_JOB_HREF = '/employer/jobs/new';
