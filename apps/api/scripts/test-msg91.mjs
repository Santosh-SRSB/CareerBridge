import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envText = readFileSync(resolve(root, '.env'), 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const authkey = env.MSG91_AUTH_KEY;
const templateId = env.MSG91_TEMPLATE_ID;
const mobile = process.argv[2] || '919931484733';
const otp = process.argv[3] || '1234';

if (!authkey) {
  console.error('MSG91_AUTH_KEY missing in apps/api/.env');
  process.exit(1);
}

const bodies = [
  { label: 'custom-otp-no-template', body: { mobile, otp, otp_length: 4 } },
  ...(templateId
    ? [{ label: 'custom-otp-with-template', body: { mobile, otp, otp_length: 4, template_id: templateId } }]
    : []),
  ...(templateId
    ? [{ label: 'msg91-generated-otp', body: { mobile, template_id: templateId, otp_length: 4 } }]
    : []),
];

for (const url of ['https://control.msg91.com/api/v5/otp', 'https://api.msg91.com/api/v5/otp']) {
  for (const item of bodies) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authkey, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(item.body),
    });
    const text = await res.text();
    console.log(JSON.stringify({ url, case: item.label, status: res.status, response: text }));
  }
}
