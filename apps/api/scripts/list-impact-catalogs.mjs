/**
 * One-shot helper: list Impact catalogs and print Id/Name only.
 * Usage: node apps/api/scripts/list-impact-catalogs.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(filePath) {
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    out[trimmed.slice(0, i)] = trimmed.slice(i + 1);
  }
  return out;
}

const env = loadEnv(resolve(process.cwd(), 'apps/api/.env'));
const sid = env.IMPACT_ACCOUNT_SID?.trim();
const token = env.IMPACT_AUTH_TOKEN?.trim();
const base = (env.IMPACT_API_BASE || 'https://api.impact.com').replace(/\/$/, '');

if (!sid || !token) {
  console.error('Missing IMPACT_ACCOUNT_SID or IMPACT_AUTH_TOKEN in apps/api/.env');
  process.exit(1);
}

const auth = Buffer.from(`${sid}:${token}`).toString('base64');
const res = await fetch(`${base}/Mediapartners/${sid}/Catalogs`, {
  headers: { Accept: 'application/json', Authorization: `Basic ${auth}` },
});

const text = await res.text();
if (!res.ok) {
  console.error(`Impact catalogs failed: ${res.status}`);
  console.error(text.slice(0, 300));
  process.exit(1);
}

const data = JSON.parse(text);
const catalogs = Array.isArray(data.Catalogs) ? data.Catalogs : [];
console.log(`Found ${catalogs.length} catalog(s):`);
for (const c of catalogs) {
  console.log(`- Id=${c.Id} | Name=${c.Name} | Advertiser=${c.AdvertiserName} | Campaign=${c.CampaignName} | Items=${c.NumberOfItems}`);
}

const udemy = catalogs.find((c) =>
  `${c.Name ?? ''} ${c.AdvertiserName ?? ''} ${c.CampaignName ?? ''}`.toLowerCase().includes('udemy'),
);
if (udemy?.Id) {
  console.log(`\nSuggested IMPACT_CATALOG_ID=${udemy.Id}`);
} else if (catalogs[0]?.Id) {
  console.log(`\nNo Udemy-named catalog found. First catalog Id=${catalogs[0].Id}`);
}
