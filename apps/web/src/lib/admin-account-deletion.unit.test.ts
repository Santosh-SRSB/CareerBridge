import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DELETE_CONFIRM_WORD,
  DELETE_REASON_MAX_LENGTH,
  DELETE_REASON_MIN_LENGTH,
  auditDeletionReason,
  canOfferAccountDeletion,
  deletionConfirmed,
  deletionKindLabel,
  deletionReasonValid,
  normalizeDeletionReason,
} from './admin-account-deletion';

test('only a Super Admin is offered the Delete action', () => {
  for (const viewerRole of ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR', 'CANDIDATE', 'EMPLOYER_ADMIN', null, undefined]) {
    assert.equal(canOfferAccountDeletion({ viewerRole, kind: 'candidates', status: 'SUSPENDED' }), false);
  }
  assert.equal(canOfferAccountDeletion({ viewerRole: 'SUPER_ADMIN', kind: 'candidates', status: 'SUSPENDED' }), true);
});

test('Delete is offered only for suspended or inactive accounts', () => {
  for (const kind of ['candidates', 'employers', 'admins'] as const) {
    assert.equal(canOfferAccountDeletion({ viewerRole: 'SUPER_ADMIN', kind, status: 'SUSPENDED' }), true);
    assert.equal(canOfferAccountDeletion({ viewerRole: 'SUPER_ADMIN', kind, status: 'INACTIVE' }), true);
    assert.equal(canOfferAccountDeletion({ viewerRole: 'SUPER_ADMIN', kind, status: 'inactive' }), true);
    assert.equal(canOfferAccountDeletion({ viewerRole: 'SUPER_ADMIN', kind, status: 'ACTIVE' }), false);
    assert.equal(canOfferAccountDeletion({ viewerRole: 'SUPER_ADMIN', kind, status: '' }), false);
    assert.equal(canOfferAccountDeletion({ viewerRole: 'SUPER_ADMIN', kind, status: null }), false);
  }
});

test('a Super Admin account is never offered for deletion', () => {
  assert.equal(
    canOfferAccountDeletion({ viewerRole: 'SUPER_ADMIN', kind: 'admins', status: 'SUSPENDED', targetRole: 'SUPER_ADMIN' }),
    false,
  );
  assert.equal(
    canOfferAccountDeletion({
      viewerRole: 'SUPER_ADMIN',
      kind: 'admins',
      status: 'SUSPENDED',
      targetRole: 'PLATFORM_OPERATOR',
    }),
    true,
  );
});

test('deletion requires the exact confirmation word', () => {
  assert.equal(DELETE_CONFIRM_WORD, 'DELETE');
  assert.equal(deletionConfirmed('DELETE'), true);
  assert.equal(deletionConfirmed('  DELETE  '), true);
  assert.equal(deletionConfirmed('delete'), false);
  assert.equal(deletionConfirmed('DEL'), false);
  assert.equal(deletionConfirmed(''), false);
});

test('kind labels are singular and human readable', () => {
  assert.equal(deletionKindLabel('candidates'), 'candidate');
  assert.equal(deletionKindLabel('employers'), 'employer');
  assert.equal(deletionKindLabel('admins'), 'admin');
});

test('deletion reason must be a meaningful trimmed string', () => {
  assert.equal(DELETE_REASON_MIN_LENGTH, 5);
  assert.equal(DELETE_REASON_MAX_LENGTH, 500);
  assert.equal(normalizeDeletionReason('  spam account  '), 'spam account');
  assert.equal(deletionReasonValid('spam'), false);
  assert.equal(deletionReasonValid('spam account'), true);
  assert.equal(deletionReasonValid('  ok id  '), true);
  assert.equal(deletionReasonValid(''), false);
  assert.equal(deletionReasonValid('a'.repeat(501)), false);
});

test('auditDeletionReason reads reason from audit newValue JSON', () => {
  assert.equal(auditDeletionReason(JSON.stringify({ deleted: true, reason: 'Fraudulent signup' })), 'Fraudulent signup');
  assert.equal(auditDeletionReason({ reason: '  Cleanup  ' }), 'Cleanup');
  assert.equal(auditDeletionReason(JSON.stringify({ deleted: true })), null);
  assert.equal(auditDeletionReason(null), null);
  assert.equal(auditDeletionReason('not-json'), null);
});
