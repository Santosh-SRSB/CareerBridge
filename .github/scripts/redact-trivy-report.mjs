import fs from 'node:fs';

const drop = new Set([
  'Match',
  'Code',
  'Raw',
  'Offset',
  'Layer',
  'CauseMetadata',
  'Cause',
]);

function scrub(value) {
  if (typeof value !== 'string') return value;
  if (/BEGIN [A-Z ]*PRIVATE KEY/.test(value)) return '[redacted]';
  return value;
}

function walk(value) {
  if (Array.isArray(value)) return value.map(walk);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (drop.has(key)) continue;
    out[key] = scrub(walk(child));
  }
  return out;
}

const input = process.argv[2];
const output = process.argv[3];
const report = JSON.parse(fs.readFileSync(input, 'utf8'));
const redacted = walk(report);
const counts = { UNKNOWN: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, secrets: 0 };
for (const result of redacted.Results || []) {
  for (const vuln of result.Vulnerabilities || []) {
    const severity = vuln.Severity || 'UNKNOWN';
    counts[severity] = (counts[severity] || 0) + 1;
  }
  counts.secrets += (result.Secrets || []).length;
}
fs.writeFileSync(output, `${JSON.stringify(redacted)}\n`);
process.stdout.write(`${JSON.stringify(counts)}\n`);
