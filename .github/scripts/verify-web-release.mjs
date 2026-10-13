/**
 * Inspect a Next.js standalone tree for the verification web build.
 *
 * The image build writes /app/careerbridge-release from CAREERBRIDGE_RELEASE in
 * the same command that runs next build. That file is the release flag.
 * A compiled "production" string is not, because NODE_ENV is also production.
 *
 * The .invalid names are verification placeholders. They are not a Firebase
 * project and this result is not a deployment decision.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REQUIRED_LITERALS = [
  'https://verification.invalid/api/v1',
  'verification.invalid',
  'verification-not-a-project',
  'verification-not-a-bucket',
  'not-a-firebase-api-key',
  'not-a-firebase-app-id',
];

const FORBIDDEN_HOSTS = [
  'careerbridge-api-dev-601892050765.asia-south1.run.app',
  'careerbridge-f7b72.firebaseapp.com',
  'careerbridge-f7b72.firebasestorage.app',
];

const RELEASE_IDENTIFIER = 'process.env.NEXT_PUBLIC_CAREERBRIDGE_RELEASE';
const RELEASE_FILE = 'careerbridge-release';

function stringLiterals(source) {
  const values = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let j = i + 1;
      let value = '';
      let closed = false;
      while (j < source.length) {
        const ch = source[j];
        if (ch === '\\') {
          value += source[j + 1] ?? '';
          j += 2;
          continue;
        }
        if (ch === '$' && quote === '`' && source[j + 1] === '{') break;
        if (ch === quote) {
          closed = true;
          break;
        }
        if ((ch === '\n' || ch === '\r') && quote !== '`') break;
        value += ch;
        j += 1;
      }
      if (closed) values.push(value);
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return values;
}

function walkJs(dir, files) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      walkJs(full, files);
      continue;
    }
    if (name.endsWith('.js') && !name.endsWith('.js.map')) files.push(full);
  }
}

function readReleaseMarker(root) {
  const file = path.join(root, RELEASE_FILE);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return { releaseBehavior: 'not-verified', releaseValue: 'absent' };
  }
  const raw = fs.readFileSync(file, 'utf8');
  if (raw === 'production\n' || raw === 'production') return { releaseBehavior: 'production', releaseValue: 'production' };
  if (raw === 'dev\n' || raw === 'dev') return { releaseBehavior: 'fail', releaseValue: 'dev' };
  return { releaseBehavior: 'fail', releaseValue: 'unexpected' };
}

export function inspectWebTree(root) {
  const files = [];
  walkJs(root, files);
  const found = new Set();
  const forbiddenHits = [];
  let releaseIdentifier = 'absent';
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes(RELEASE_IDENTIFIER)) releaseIdentifier = 'present';
    for (const host of FORBIDDEN_HOSTS) {
      if (text.includes(host)) forbiddenHits.push({ host, file: path.relative(root, file) });
    }
    for (const literal of stringLiterals(text)) {
      if (REQUIRED_LITERALS.includes(literal)) found.add(literal);
    }
  }
  const missingLiterals = REQUIRED_LITERALS.filter((literal) => !found.has(literal));
  const release = readReleaseMarker(root);
  return {
    filesScanned: files.length,
    placeholders: missingLiterals.length === 0 ? 'present' : 'missing',
    missingLiterals,
    devHosts: forbiddenHits.length === 0 ? 'absent' : 'present',
    forbiddenHits,
    releaseIdentifier,
    releaseBehavior: release.releaseBehavior,
    releaseValue: release.releaseValue,
    deployable: false,
    placeholderNote: 'verification-only .invalid names, not a Firebase project and not a deployment configuration',
  };
}

function printReport(root) {
  if (!fs.existsSync(root)) {
    process.stderr.write(`web root not found: ${root}\n`);
    process.exit(1);
  }
  const report = inspectWebTree(root);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.placeholders !== 'present' || report.devHosts !== 'absent' || report.releaseBehavior !== 'production' || report.releaseValue !== 'production' || report.deployable !== false) {
    process.exit(1);
  }
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'web-release-'));
  const far = path.join(root, 'far.js');
  const other = path.join(root, 'other.js');
  const marker = path.join(root, 'marker.js');
  fs.writeFileSync(
    far,
    `const url = "https://verification.invalid/api/v1";\n${'x'.repeat(400)}\nconst domain = "verification.invalid";\n`,
  );
  fs.writeFileSync(
    other,
    `export const project = 'verification-not-a-project';\nexport const bucket = "verification-not-a-bucket";\nexport const key = "not-a-firebase-api-key";\nexport const app = "not-a-firebase-app-id";\n`,
  );
  fs.writeFileSync(marker, `const markers = ["careerbridge-f7b72", "localhost", "127.0.0.1"];\nconst nodeEnv = "production";\n`);
  const withoutMarker = inspectWebTree(root);
  if (withoutMarker.placeholders !== 'present' || withoutMarker.devHosts !== 'absent' || withoutMarker.releaseBehavior !== 'not-verified') {
    throw new Error(`NODE_ENV production was treated as the release flag: ${JSON.stringify(withoutMarker)}`);
  }
  fs.writeFileSync(path.join(root, 'careerbridge-release'), 'dev\n');
  const devRelease = inspectWebTree(root);
  if (devRelease.releaseBehavior !== 'fail' || devRelease.releaseValue !== 'dev') {
    throw new Error(`dev release was accepted: ${JSON.stringify(devRelease)}`);
  }
  fs.writeFileSync(path.join(root, 'careerbridge-release'), ' production\n');
  const padded = inspectWebTree(root);
  if (padded.releaseBehavior !== 'fail' || padded.releaseValue !== 'unexpected') {
    throw new Error(`padded production was accepted: ${JSON.stringify(padded)}`);
  }
  fs.writeFileSync(path.join(root, 'careerbridge-release'), 'production\n');
  const ok = inspectWebTree(root);
  if (ok.placeholders !== 'present' || ok.devHosts !== 'absent' || ok.releaseBehavior !== 'production' || ok.releaseValue !== 'production' || ok.deployable !== false) {
    throw new Error(`expected the release file to prove production: ${JSON.stringify(ok)}`);
  }
  const partialRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-release-partial-'));
  fs.writeFileSync(path.join(partialRoot, 'partial.js'), 'const u = "https://verification.invalid/api/v1/extra";\n');
  const partial = inspectWebTree(partialRoot);
  if (!partial.missingLiterals.includes('https://verification.invalid/api/v1')) {
    throw new Error('a longer string was accepted as the placeholder URL');
  }
  fs.rmSync(partialRoot, { recursive: true, force: true });
  fs.writeFileSync(path.join(root, 'dev.js'), 'const host = "careerbridge-f7b72.firebaseapp.com";\n');
  const bad = inspectWebTree(root);
  if (bad.devHosts !== 'present') throw new Error('forbidden host was ignored');
  fs.rmSync(root, { recursive: true, force: true });
  process.stdout.write('web-release-self-test-ok\n');
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
const invoked = entry && path.resolve(process.argv[1]) === entry && process.argv[1].includes('verify-web-release');
if (invoked && process.argv[2] === '--self-test') selfTest();
else if (invoked) printReport(process.argv[2] || process.env.WEB_APP_ROOT || '/app');
