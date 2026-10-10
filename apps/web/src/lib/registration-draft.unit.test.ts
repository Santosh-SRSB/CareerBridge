import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REGISTRATION_DRAFT_TTL_MS,
  clearRegistrationDraft,
  loadRegistrationDraft,
  markRegistrationDraftForChange,
  sanitizeRegistrationDraft,
  saveRegistrationDraft,
  type RegistrationFormDraft,
} from './registration-draft';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const candidate: RegistrationFormDraft = {
  accountType: 'CANDIDATE',
  fullName: 'Asha K',
  email: 'asha@example.test',
  dial: '+91',
  national: '9800000001',
  otpChannel: 'MOBILE',
  agreedToTerms: true,
  location: 'Maharashtra|Pune',
  whatsappOptIn: true,
  pendingRequestId: 'otp-1',
};

test('round-trips the safe registration fields for the same account type', () => {
  const storage = memoryStorage();
  saveRegistrationDraft(candidate, storage, 1_000);
  assert.deepEqual(loadRegistrationDraft('CANDIDATE', storage, 2_000), candidate);
  assert.equal(loadRegistrationDraft('EMPLOYER', storage, 2_000), null);
});

test('never writes passwords, OTP codes or tokens even when they are passed in', () => {
  const storage = memoryStorage();
  saveRegistrationDraft(
    {
      ...candidate,
      password: 'Secret@123',
      confirmPassword: 'Secret@123',
      otp: '123456',
      accessToken: 'tok',
      refreshToken: 'ref',
      idToken: 'id',
    } as RegistrationFormDraft,
    storage,
  );
  const raw = [...storage.map.values()].join('');
  for (const secret of ['Secret@123', '123456', 'tok', 'ref', '"id"', 'password', 'otp"', 'Token']) {
    assert.ok(!raw.includes(secret), `stored draft must not contain ${secret}`);
  }
});

test('expires after the TTL and removes the stale entry', () => {
  const storage = memoryStorage();
  saveRegistrationDraft(candidate, storage, 0);
  assert.ok(loadRegistrationDraft('CANDIDATE', storage, REGISTRATION_DRAFT_TTL_MS));
  assert.equal(loadRegistrationDraft('CANDIDATE', storage, REGISTRATION_DRAFT_TTL_MS + 1), null);
  assert.equal(storage.map.size, 0);
});

test('malformed or tampered entries are discarded', () => {
  const storage = memoryStorage();
  storage.setItem('cb_registration_draft', '{not json');
  assert.equal(loadRegistrationDraft('CANDIDATE', storage), null);
  assert.equal(storage.map.size, 0);
  storage.setItem('cb_registration_draft', JSON.stringify({ ...candidate, accountType: 'ADMIN', savedAt: Date.now() }));
  assert.equal(loadRegistrationDraft('CANDIDATE', storage), null);
  storage.setItem('cb_registration_draft', JSON.stringify({ ...candidate }));
  assert.equal(loadRegistrationDraft('CANDIDATE', storage), null, 'no timestamp → stale');
});

test('one draft per tab: a resubmission replaces it instead of adding another', () => {
  const storage = memoryStorage();
  saveRegistrationDraft(candidate, storage, 1_000);
  saveRegistrationDraft({ ...candidate, national: '9800000002', pendingRequestId: 'otp-2' }, storage, 2_000);
  assert.equal(storage.map.size, 1);
  const draft = loadRegistrationDraft('CANDIDATE', storage, 3_000)!;
  assert.equal(draft.national, '9800000002');
  assert.equal(draft.pendingRequestId, 'otp-2');
});

test('"Change mobile number" records the abandoned OTP request and keeps the other fields', () => {
  const storage = memoryStorage();
  saveRegistrationDraft(candidate, storage, 1_000);
  markRegistrationDraftForChange('otp-resent-3', storage, 2_000);
  const draft = loadRegistrationDraft('CANDIDATE', storage, 3_000)!;
  assert.equal(draft.pendingRequestId, 'otp-resent-3');
  assert.equal(draft.fullName, 'Asha K');
  assert.equal(draft.national, '9800000001');
});

test('WhatsApp updates stay on by default but a candidate opt-out survives the round trip', () => {
  const storage = memoryStorage();
  saveRegistrationDraft({ ...candidate, whatsappOptIn: false }, storage, 1_000);
  assert.equal(loadRegistrationDraft('CANDIDATE', storage, 2_000)!.whatsappOptIn, false);

  assert.equal(sanitizeRegistrationDraft({ ...candidate, whatsappOptIn: undefined })!.whatsappOptIn, true);
});

test('clearing after successful verification (or Start over) removes the draft', () => {
  const storage = memoryStorage();
  saveRegistrationDraft(candidate, storage);
  clearRegistrationDraft(storage);
  assert.equal(loadRegistrationDraft('CANDIDATE', storage), null);
});

test('employer drafts keep the company name and drop candidate-only fields', () => {
  const draft = sanitizeRegistrationDraft({
    accountType: 'EMPLOYER',
    fullName: 'Ravi',
    companyName: 'Acme Pvt Ltd',
    email: 'hr@acme.in',
    dial: '+91',
    national: '98 0000-0003',
    otpChannel: 'EMAIL',
    agreedToTerms: true,
    location: 'Maharashtra|Pune',
    whatsappOptIn: true,
  })!;
  assert.equal(draft.companyName, 'Acme Pvt Ltd');
  assert.equal(draft.national, '9800000003');
  assert.equal('location' in draft, false);
  assert.equal('whatsappOptIn' in draft, false);
});

test('no storage available (server render) is a no-op', () => {
  saveRegistrationDraft(candidate, null);
  assert.equal(loadRegistrationDraft('CANDIDATE', null), null);
  clearRegistrationDraft(null);
});
