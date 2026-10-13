/**
 * Pack the lockfile's Prisma CLI closure for the API runner image.
 *
 * The runner installs production dependencies with npm ci --omit=dev, which
 * leaves out the dev dependency prisma. This script follows the lockfile from
 * node_modules/prisma through dependencies and optionalDependencies, including
 * nested packages such as c12's chokidar. It does not follow devDependencies.
 *
 * --check validates the workspace tree and does not download engine binaries.
 * --download is for the Linux image build. It uses @prisma/fetch-engine and
 * refuses to continue unless the schema engine and query engine files exist.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED = [
  'node_modules/prisma',
  'node_modules/@prisma/config',
  'node_modules/@prisma/engines',
  'node_modules/@prisma/engines-version',
  'node_modules/@prisma/fetch-engine',
  'node_modules/@prisma/get-platform',
  'node_modules/@prisma/debug',
  'node_modules/effect',
  'node_modules/c12',
  'node_modules/c12/node_modules/chokidar',
  'node_modules/deepmerge-ts',
  'node_modules/empathic',
];

function parentKey(key) {
  const marker = '/node_modules/';
  const idx = key.lastIndexOf(marker);
  if (idx === -1) return null;
  return key.slice(0, idx);
}

function resolveDep(packages, fromKey, name) {
  let scope = fromKey;
  while (scope !== null) {
    const candidate = `${scope ? `${scope}/node_modules/` : 'node_modules/'}${name}`;
    if (packages[candidate]) return candidate;
    scope = parentKey(scope);
  }
  const top = `node_modules/${name}`;
  return packages[top] ? top : null;
}

function walk(packages, startKey) {
  const seen = new Set();
  const missing = [];
  const queue = [startKey];
  while (queue.length) {
    const key = queue.pop();
    if (!key || seen.has(key)) continue;
    const meta = packages[key];
    if (!meta) {
      missing.push(key);
      continue;
    }
    seen.add(key);
    const deps = { ...(meta.dependencies || {}), ...(meta.optionalDependencies || {}) };
    for (const name of Object.keys(deps)) {
      const next = resolveDep(packages, key, name);
      if (!next) missing.push(`${key} -> ${name}`);
      else queue.push(next);
    }
  }
  return { seen, missing };
}

function productionKeys(packages) {
  const queue = [];
  const add = (meta) => {
    if (!meta) return;
    for (const name of Object.keys({ ...(meta.dependencies || {}), ...(meta.optionalDependencies || {}) })) {
      const next = resolveDep(packages, '', name);
      if (next) queue.push(next);
    }
  };
  add(packages['']);
  add(packages['apps/api']);
  add(packages['packages/shared']);
  const seen = new Set();
  while (queue.length) {
    const key = queue.pop();
    if (!key || seen.has(key)) continue;
    const meta = packages[key];
    if (!meta || meta.dev) continue;
    seen.add(key);
    for (const name of Object.keys({ ...(meta.dependencies || {}), ...(meta.optionalDependencies || {}) })) {
      const next = resolveDep(packages, key, name);
      if (next) queue.push(next);
    }
  }
  return seen;
}

export function inspectPrismaClosure(root) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const packages = lock.packages || {};
  const prisma = packages['node_modules/prisma'];
  if (!prisma || prisma.version !== '6.19.3') {
    throw new Error('package-lock.json does not pin node_modules/prisma to 6.19.3');
  }
  const { seen, missing } = walk(packages, 'node_modules/prisma');
  if (missing.length) throw new Error(`unresolved Prisma dependency: ${missing.join(', ')}`);
  for (const key of REQUIRED) {
    if (!seen.has(key)) throw new Error(`Prisma closure is missing ${key}`);
  }
  const absent = [];
  for (const key of seen) {
    if (packages[key].optional) continue;
    if (!fs.existsSync(path.join(root, key))) absent.push(key);
  }
  if (absent.length) throw new Error(`Prisma closure path is not installed: ${absent.join(', ')}`);
  const overlap = [...seen].filter((key) => productionKeys(packages).has(key));
  if (overlap.length) {
    throw new Error(`Prisma closure overlaps the API production tree: ${overlap.join(', ')}`);
  }
  const requireFromRoot = createRequire(path.join(root, 'package.json'));
  const installed = requireFromRoot(path.join(root, 'node_modules/prisma/package.json'));
  if (installed.version !== '6.19.3') throw new Error(`installed Prisma CLI is ${installed.version}`);
  const requireFromPrisma = createRequire(path.join(root, 'node_modules/prisma/package.json'));
  requireFromPrisma.resolve('@prisma/config/package.json');
  requireFromPrisma.resolve('@prisma/engines/package.json');
  const enginesMeta = requireFromRoot(path.join(root, 'node_modules/@prisma/engines-version/package.json'));
  const enginesDir = path.join(root, 'node_modules/@prisma/engines');
  const schemaEngine = fs.existsSync(enginesDir)
    && fs.readdirSync(enginesDir).some((name) => name.startsWith('schema-engine-') && fs.statSync(path.join(enginesDir, name)).size > 100000);
  return {
    version: installed.version,
    packages: seen.size,
    overlap: overlap.length,
    enginesVersion: enginesMeta.prisma.enginesVersion,
    schemaEngine: schemaEngine ? 'present' : 'absent',
    keys: [...seen].filter((key) => fs.existsSync(path.join(root, key))).sort(),
  };
}

async function downloadEngines(root) {
  const requireFromPrisma = createRequire(path.join(root, 'node_modules/prisma/package.json'));
  const fetchEngine = requireFromPrisma('@prisma/fetch-engine');
  const { getBinaryTargetForCurrentPlatform } = requireFromPrisma('@prisma/get-platform');
  const { enginesVersion } = requireFromPrisma('@prisma/engines-version');
  const target = await getBinaryTargetForCurrentPlatform();
  if (target !== 'debian-openssl-3.0.x') {
    throw new Error(`Prisma engines must be downloaded for debian-openssl-3.0.x, not ${target}`);
  }
  const enginesDir = path.join(root, 'node_modules/@prisma/engines');
  for (const name of ['schema-engine-windows.exe', 'query_engine-windows.dll.node']) {
    if (fs.existsSync(path.join(enginesDir, name))) {
      throw new Error(`refusing to pack Windows Prisma engine ${name}`);
    }
  }
  await fetchEngine.download({
    binaries: {
      [fetchEngine.BinaryType.QueryEngineLibrary]: enginesDir,
      [fetchEngine.BinaryType.SchemaEngineBinary]: enginesDir,
    },
    version: enginesVersion,
    showProgress: false,
    failSilent: false,
  });
  for (const binaryType of [fetchEngine.BinaryType.SchemaEngineBinary, fetchEngine.BinaryType.QueryEngineLibrary]) {
    const name = fetchEngine.getBinaryName(binaryType, target);
    const file = path.join(enginesDir, name);
    if (!fs.existsSync(file) || fs.statSync(file).size < 100000) {
      throw new Error(`Prisma engine file is missing after download: ${name}`);
    }
  }
  for (const name of ['schema-engine-windows.exe', 'query_engine-windows.dll.node']) {
    if (fs.existsSync(path.join(enginesDir, name))) {
      throw new Error(`refusing to pack Windows Prisma engine ${name}`);
    }
  }
}

async function main() {
  const root = process.env.PRISMA_PACK_ROOT || process.cwd();
  const args = new Set(process.argv.slice(2));
  if (args.has('--download')) await downloadEngines(root);
  const report = inspectPrismaClosure(root);
  if (args.has('--list')) {
    const listFlag = process.argv.indexOf('--list');
    const listPath = process.argv[listFlag + 1];
    if (!listPath || listPath.startsWith('--')) throw new Error('--list requires a file path');
    fs.writeFileSync(listPath, `${report.keys.join('\n')}\n`);
  }
  if (args.has('--download') && report.schemaEngine !== 'present') {
    throw new Error('schema engine binary is absent after download');
  }
  process.stdout.write(
    `prisma-closure-ok version=${report.version} packages=${report.packages} overlap=${report.overlap} engines_version=${report.enginesVersion} schema_engine=${report.schemaEngine}\n`,
  );
}

const invoked = process.argv[1] && process.argv[1].includes('pack-prisma-cli');
if (invoked) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
