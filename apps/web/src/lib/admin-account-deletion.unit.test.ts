import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DELETE_CONFIRM_WORD,
  canOfferAccountDeletion,
  deletionConfirmed,
  deletionKindLabel,
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
