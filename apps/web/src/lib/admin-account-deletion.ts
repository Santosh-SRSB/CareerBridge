export type AdminDeletableKind = 'candidates' | 'employers' | 'admins';

export type AdminAccountDeletionPreview = {
  kind: 'CANDIDATE' | 'EMPLOYER' | 'ADMIN';
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  role: string;
  accountStatus: string;
  deletable: boolean;
  blockers: string[];
  related: Array<{ label: string; count: number }>;
  retained: string[];
};

/** Word the Super Admin must type to enable permanent deletion. */
export const DELETE_CONFIRM_WORD = 'DELETE';

/** Reason required before permanent deletion; stored on the audit row. */
export const DELETE_REASON_MIN_LENGTH = 5;
export const DELETE_REASON_MAX_LENGTH = 500;

const DELETABLE_STATUSES = new Set(['SUSPENDED', 'INACTIVE']);

/**
 * Whether to offer the Delete action on a list card. The API enforces the same rules;
 * this only hides an action that would be refused.
 */
export function canOfferAccountDeletion(input: {
  viewerRole: string | null | undefined;
  kind: AdminDeletableKind;
  status: string | null | undefined;
  targetRole?: string | null;
}): boolean {
  if (input.viewerRole !== 'SUPER_ADMIN') return false;
  if (!DELETABLE_STATUSES.has(String(input.status ?? '').toUpperCase())) return false;
  if (input.kind === 'admins' && input.targetRole === 'SUPER_ADMIN') return false;
  return true;
}

export function deletionConfirmed(typed: string): boolean {
  return typed.trim() === DELETE_CONFIRM_WORD;
}

/** Normalize and validate the Super Admin deletion reason for the confirm button / API. */
export function normalizeDeletionReason(reason: string): string {
  return reason.trim().replace(/\s+/g, ' ');
}

export function deletionReasonValid(reason: string): boolean {
  const normalized = normalizeDeletionReason(reason);
  return (
    normalized.length >= DELETE_REASON_MIN_LENGTH && normalized.length <= DELETE_REASON_MAX_LENGTH
  );
}

export function deletionKindLabel(kind: AdminDeletableKind): string {
  return kind === 'candidates' ? 'candidate' : kind === 'employers' ? 'employer' : 'admin';
}

/** Pull the deletion reason out of an audit `newValue` JSON string when present. */
export function auditDeletionReason(newValue: unknown): string | null {
  if (newValue == null || newValue === '') return null;
  try {
    const parsed = typeof newValue === 'string' ? JSON.parse(newValue) : newValue;
    if (!parsed || typeof parsed !== 'object') return null;
    const reason = (parsed as { reason?: unknown }).reason;
    if (typeof reason !== 'string') return null;
    const trimmed = reason.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}
