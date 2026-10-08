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

export function deletionKindLabel(kind: AdminDeletableKind): string {
  return kind === 'candidates' ? 'candidate' : kind === 'employers' ? 'employer' : 'admin';
}
