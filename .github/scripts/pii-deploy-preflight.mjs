// Deploy preflight for careerbridge-api-dev: refuses to deploy unless the PII keyring is bound as intended.
//
// Inputs: JSON from `gcloud run services describe <service> --format=json` and from
// `gcloud run revisions describe <latest ready revision> --format=json`. Both hold Secret Manager references
// (secret name + version) only, never secret payloads; plain env values in them are never printed.
//
// Checked: the service template (inherited by the next `services update --image`) and the latest ready revision
// both reference the expected secrets at the pinned version, with the expected active key id. The revision being
// Ready proves Cloud Run could access those versions when it started; a Secret Manager container existing proves
// nothing. Not checked (needs the payload or Secret Manager access the deployer does not have): that the keys are
// well-formed, or that a version was not disabled after that revision started. Only the API startup log
// ("PII keyring loaded") proves the keyring loads.
//
// Usage: node pii-deploy-preflight.mjs <service.json> <revision.json>
// Expected values come from PII_KEYS_SECRET, PII_LOOKUP_SECRET, PII_SECRET_VERSION and PII_ACTIVE_KEY_ID.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const EXPECTED_ENV = ['PII_KEYS_SECRET', 'PII_LOOKUP_SECRET', 'PII_SECRET_VERSION', 'PII_ACTIVE_KEY_ID'];

export function expectedFromEnv(env) {
  const missing = EXPECTED_ENV.filter((name) => !(env[name] || '').trim());
  if (missing.length) throw new Error(`Preflight is not configured: ${missing.join(', ')} not set.`);
  return {
    keysSecret: env.PII_KEYS_SECRET.trim(),
    lookupSecret: env.PII_LOOKUP_SECRET.trim(),
    version: env.PII_SECRET_VERSION.trim(),
    activeKeyId: env.PII_ACTIVE_KEY_ID.trim(),
  };
}

function checkSecretRef(env, name, secret, version, where, problems) {
  const entries = env.filter((entry) => entry.name === name);
  if (entries.length !== 1) {
    problems.push(`${where}: ${name} expected exactly one env entry, found ${entries.length}.`);
    return;
  }
  const ref = entries[0].valueFrom?.secretKeyRef;
  if (entries[0].value !== undefined || !ref) {
    problems.push(`${where}: ${name} must be a Secret Manager reference, not a plain value.`);
    return;
  }
  if (ref.name !== secret || String(ref.key) !== version) {
    problems.push(`${where}: ${name} references ${ref.name}:${ref.key}, expected ${secret}:${version}.`);
  }
}

function checkEnv(containers, expected, where, problems) {
  if (!Array.isArray(containers) || containers.length !== 1) {
    problems.push(`${where}: expected one container, found ${Array.isArray(containers) ? containers.length : 0}.`);
    return;
  }
  const env = containers[0].env || [];
  checkSecretRef(env, 'PII_ENCRYPTION_KEYS', expected.keysSecret, expected.version, where, problems);
  checkSecretRef(env, 'PII_LOOKUP_KEY', expected.lookupSecret, expected.version, where, problems);
  // The actual value is never echoed, in case key material was pasted into it by mistake.
  const active = env.filter((entry) => entry.name === 'PII_ENCRYPTION_ACTIVE_KEY_ID');
  if (active.length !== 1 || active[0].valueFrom || active[0].value !== expected.activeKeyId) {
    problems.push(`${where}: PII_ENCRYPTION_ACTIVE_KEY_ID must be set once as the plain value "${expected.activeKeyId}".`);
  }
}

const isReady = (resource) => (resource?.status?.conditions || []).some((c) => c.type === 'Ready' && c.status === 'True');

/** Returns the list of problems; an empty list means the deploy may proceed. */
export function piiPreflight(service, revision, expected) {
  const problems = [];
  if (expected.keysSecret === expected.lookupSecret) {
    problems.push('PII_KEYS_SECRET and PII_LOOKUP_SECRET must name different secrets.');
  }
  if (!/^[0-9]+$/.test(expected.version)) {
    problems.push(`PII_SECRET_VERSION must be a pinned version number, not "${expected.version}".`);
  }

  checkEnv(service?.spec?.template?.spec?.containers, expected, 'service template', problems);

  const readyName = service?.status?.latestReadyRevisionName;
  if (!readyName) {
    problems.push('Service has no ready revision.');
  } else if (revision?.metadata?.name !== readyName) {
    problems.push(`Revision description is ${revision?.metadata?.name || '(none)'}, expected the latest ready revision ${readyName}.`);
  } else if (!isReady(revision)) {
    problems.push(`Revision ${readyName} is not Ready.`);
  } else {
    checkEnv(revision?.spec?.containers, expected, `revision ${readyName}`, problems);
  }
  return problems;
}

// JSON.parse errors quote part of the input, which may contain plain env values.
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`Could not read ${file} as JSON.`);
  }
}

function main(argv, env) {
  const [serviceFile, revisionFile] = argv.slice(2);
  if (!serviceFile || !revisionFile) throw new Error('Usage: node pii-deploy-preflight.mjs <service.json> <revision.json>');
  const expected = expectedFromEnv(env);
  const service = readJson(serviceFile);
  const revision = readJson(revisionFile);
  const problems = piiPreflight(service, revision, expected);
  if (problems.length) {
    for (const problem of problems) console.log(`::error::PII preflight: ${problem}`);
    console.log('Refusing to deploy: bind the PII keyring to the API service first (docs/pii-encryption-dev-runbook.md).');
    return 1;
  }
  const created = service.status.latestCreatedRevisionName;
  if (created && created !== service.status.latestReadyRevisionName) {
    console.log(`::warning::Latest created revision ${created} is not ready; checked the ready revision instead.`);
  }
  console.log(
    `PII preflight OK: service template and ready revision ${service.status.latestReadyRevisionName} reference ` +
      `PII_ENCRYPTION_KEYS -> ${expected.keysSecret}:${expected.version}, ` +
      `PII_LOOKUP_KEY -> ${expected.lookupSecret}:${expected.version}, active key id ${expected.activeKeyId}.`,
  );
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    process.exitCode = main(process.argv, process.env);
  } catch (err) {
    console.log(`::error::PII preflight: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}
