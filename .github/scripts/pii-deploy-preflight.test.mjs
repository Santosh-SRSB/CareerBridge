import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedFromEnv, piiPreflight } from './pii-deploy-preflight.mjs';

const ENV = {
  PII_KEYS_SECRET: 'careerbridge-pii-encryption-keys',
  PII_LOOKUP_SECRET: 'careerbridge-pii-lookup-key',
  PII_SECRET_VERSION: '1',
  PII_ACTIVE_KEY_ID: 'dev1',
};
const expected = expectedFromEnv(ENV);
const SENTINEL = 'sentinel-plain-value-must-not-be-printed';
const READY = 'careerbridge-api-dev-00042-abc';

const boundEnv = () => [
  { name: 'NODE_ENV', value: 'production' },
  { name: 'SOME_PLAIN_SETTING', value: SENTINEL },
  { name: 'DATABASE_URL', valueFrom: { secretKeyRef: { name: 'careerbridge-database-url', key: 'latest' } } },
  { name: 'PII_ENCRYPTION_ACTIVE_KEY_ID', value: 'dev1' },
  { name: 'PII_ENCRYPTION_KEYS', valueFrom: { secretKeyRef: { name: 'careerbridge-pii-encryption-keys', key: '1' } } },
  { name: 'PII_LOOKUP_KEY', valueFrom: { secretKeyRef: { name: 'careerbridge-pii-lookup-key', key: '1' } } },
];

/** Shapes of `gcloud run services describe --format=json` and `gcloud run revisions describe --format=json`. */
function service({ env = boundEnv(), created = READY, ready = READY } = {}) {
  return {
    spec: { template: { spec: { containers: [{ image: 'registry/api:abc', env }] } } },
    status: { latestCreatedRevisionName: created, latestReadyRevisionName: ready, conditions: [{ type: 'Ready', status: 'True' }] },
  };
}
function revision({ env = boundEnv(), name = READY, readyStatus = 'True' } = {}) {
  return {
    metadata: { name },
    spec: { containers: [{ image: 'registry/api:abc', env }] },
    status: { conditions: [{ type: 'Ready', status: readyStatus }] },
  };
}

function mutated(mutate) {
  const env = boundEnv();
  mutate(env);
  return env;
}
const entry = (env, name) => env.find((e) => e.name === name);
const remove = (name) => (env) => env.splice(env.indexOf(entry(env, name)), 1);
const unbound = () => mutated((env) => (remove('PII_ENCRYPTION_KEYS')(env), remove('PII_LOOKUP_KEY')(env), remove('PII_ENCRYPTION_ACTIVE_KEY_ID')(env)));

test('passes when template and ready revision pin both secrets to version 1 with active key id dev1', () => {
  assert.deepEqual(piiPreflight(service(), revision(), expected), []);
});

test('fails closed before binding: neither the template nor the revision has the keyring', () => {
  const problems = piiPreflight(service({ env: unbound() }), revision({ env: unbound() }), expected);
  assert.equal(problems.length, 6);
  assert.ok(problems.some((p) => p === 'service template: PII_ENCRYPTION_KEYS expected exactly one env entry, found 0.'));
  assert.ok(problems.some((p) => p === `revision ${READY}: PII_LOOKUP_KEY expected exactly one env entry, found 0.`));
});

test('fails when either secret reference is absent from the template only', () => {
  for (const name of ['PII_ENCRYPTION_KEYS', 'PII_LOOKUP_KEY']) {
    const problems = piiPreflight(service({ env: mutated(remove(name)) }), revision(), expected);
    assert.deepEqual(problems, [`service template: ${name} expected exactly one env entry, found 0.`]);
  }
});

test('fails when the template is bound but no ready revision has used the binding yet', () => {
  const problems = piiPreflight(service(), revision({ env: unbound() }), expected);
  assert.equal(problems.length, 3);
  assert.ok(problems.every((p) => p.startsWith(`revision ${READY}:`)));
});

test('fails when a secret is bound to "latest" or another version instead of the pinned one', () => {
  for (const key of ['latest', '2']) {
    const env = mutated((e) => (entry(e, 'PII_LOOKUP_KEY').valueFrom.secretKeyRef.key = key));
    const problems = piiPreflight(service({ env }), revision({ env }), expected);
    assert.equal(problems.length, 2);
    assert.match(problems[0], new RegExp(`references careerbridge-pii-lookup-key:${key}, expected careerbridge-pii-lookup-key:1`));
  }
});

test('fails when the variables point at the wrong secrets, including the two being swapped', () => {
  const env = mutated((e) => {
    entry(e, 'PII_ENCRYPTION_KEYS').valueFrom.secretKeyRef.name = 'careerbridge-pii-lookup-key';
    entry(e, 'PII_LOOKUP_KEY').valueFrom.secretKeyRef.name = 'careerbridge-pii-encryption-keys';
  });
  assert.equal(piiPreflight(service({ env }), revision(), expected).length, 2);
});

test('fails when a key is a plain env value, without echoing the value', () => {
  const env = mutated((e) => {
    const k = entry(e, 'PII_ENCRYPTION_KEYS');
    delete k.valueFrom;
    k.value = SENTINEL;
  });
  const problems = piiPreflight(service({ env }), revision(), expected);
  assert.deepEqual(problems, ['service template: PII_ENCRYPTION_KEYS must be a Secret Manager reference, not a plain value.']);
});

test('fails on duplicate entries for a secret variable', () => {
  const env = mutated((e) => e.push(structuredClone(entry(e, 'PII_LOOKUP_KEY'))));
  assert.deepEqual(piiPreflight(service({ env }), revision(), expected), [
    'service template: PII_LOOKUP_KEY expected exactly one env entry, found 2.',
  ]);
});

test('fails when the active key id is missing, different, or a secret reference, without echoing the value', () => {
  const cases = [
    remove('PII_ENCRYPTION_ACTIVE_KEY_ID'),
    (e) => (entry(e, 'PII_ENCRYPTION_ACTIVE_KEY_ID').value = SENTINEL),
    (e) => {
      const a = entry(e, 'PII_ENCRYPTION_ACTIVE_KEY_ID');
      delete a.value;
      a.valueFrom = { secretKeyRef: { name: 'x', key: '1' } };
    },
  ];
  for (const mutate of cases) {
    assert.deepEqual(piiPreflight(service({ env: mutated(mutate) }), revision(), expected), [
      'service template: PII_ENCRYPTION_ACTIVE_KEY_ID must be set once as the plain value "dev1".',
    ]);
  }
});

test('fails when the revision checked is not Ready or is not the latest ready revision', () => {
  for (const readyStatus of ['False', 'Unknown']) {
    assert.deepEqual(piiPreflight(service(), revision({ readyStatus }), expected), [`Revision ${READY} is not Ready.`]);
  }
  const other = piiPreflight(service(), revision({ name: 'careerbridge-api-dev-00001-old' }), expected);
  assert.match(other[0], /expected the latest ready revision careerbridge-api-dev-00042-abc/);
  assert.deepEqual(piiPreflight(service({ ready: '' }), revision(), expected), ['Service has no ready revision.']);
});

test('does not lock out deploys after a failed rollout: a newer unready revision is tolerated', () => {
  assert.deepEqual(piiPreflight(service({ created: 'careerbridge-api-dev-00043-bad' }), revision(), expected), []);
});

test('fails closed on empty or malformed descriptions', () => {
  assert.ok(piiPreflight({}, {}, expected).length > 0);
  assert.ok(piiPreflight(null, null, expected).length > 0);
  const twoContainers = service();
  twoContainers.spec.template.spec.containers.push({ env: [] });
  assert.ok(piiPreflight(twoContainers, revision(), expected).includes('service template: expected one container, found 2.'));
});

test('fails closed when the expected configuration is missing or unsafe', () => {
  assert.throws(() => expectedFromEnv({ ...ENV, PII_SECRET_VERSION: '' }), /PII_SECRET_VERSION not set/);
  assert.throws(() => expectedFromEnv({}), /PII_KEYS_SECRET, PII_LOOKUP_SECRET, PII_SECRET_VERSION, PII_ACTIVE_KEY_ID/);
  assert.ok(piiPreflight(service(), revision(), { ...expected, version: 'latest' }).some((p) => p.includes('pinned version number')));
  assert.ok(
    piiPreflight(service(), revision(), { ...expected, lookupSecret: expected.keysSecret }).some((p) => p.includes('different secrets')),
  );
});

test('CLI exits 0 only when the gate passes, and never prints plain env values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pii-preflight-'));
  const script = fileURLToPath(new URL('./pii-deploy-preflight.mjs', import.meta.url));
  const run = (svc, rev, env = ENV, raw = false) => {
    const svcFile = join(dir, 'service.json');
    const revFile = join(dir, 'revision.json');
    writeFileSync(svcFile, raw ? svc : JSON.stringify(svc));
    writeFileSync(revFile, JSON.stringify(rev));
    return spawnSync(process.execPath, [script, svcFile, revFile], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
  };

  const ok = run(service(), revision());
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /PII preflight OK: service template and ready revision careerbridge-api-dev-00042-abc/);

  const afterFailedRollout = run(service({ created: 'careerbridge-api-dev-00043-bad' }), revision());
  assert.equal(afterFailedRollout.status, 0);
  assert.match(afterFailedRollout.stdout, /::warning::Latest created revision careerbridge-api-dev-00043-bad is not ready/);

  const bad = run(service({ env: mutated((e) => (entry(e, 'PII_ENCRYPTION_ACTIVE_KEY_ID').value = SENTINEL)) }), revision());
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /::error::PII preflight/);
  assert.match(bad.stdout, /Refusing to deploy/);

  const notJson = run(`{"spec": "${SENTINEL}`, revision(), ENV, true);
  assert.equal(notJson.status, 1);
  assert.match(notJson.stdout, /Could not read .* as JSON/);

  const unconfigured = run(service(), revision(), {});
  assert.equal(unconfigured.status, 1);
  assert.match(unconfigured.stdout, /Preflight is not configured/);

  const missingArg = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(missingArg.status, 1);

  for (const out of [ok, afterFailedRollout, bad, notJson, unconfigured]) {
    assert.ok(!(out.stdout + out.stderr).includes(SENTINEL));
  }
});
