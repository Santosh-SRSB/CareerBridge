/**
 * DEV-only: inspect / update the WhatsApp Business profile of the DEV number (+91 95137 91117, WABA 946009308557431).
 * Every write first asks Meta to confirm the phone number ID is that number inside that WABA, and stops otherwise.
 * The access token comes from Secret Manager, is sent only in request headers, and is never printed.
 *
 *   npx ts-node --transpile-only scripts/whatsapp-profile-setup-dev.ts check
 *   npx ts-node --transpile-only scripts/whatsapp-profile-setup-dev.ts apply-profile
 *   npx ts-node --transpile-only scripts/whatsapp-profile-setup-dev.ts submit-display-name
 *   npx ts-node --transpile-only scripts/whatsapp-profile-setup-dev.ts verify
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  assertDevTarget,
  buildProfileUpdate,
  checkProfileImage,
  DESIRED_PROFILE,
  DEV_META_APP_ID,
  DEV_WABA_ID,
  displayNameChangePath,
  graphUrl,
  PROFILE_IMAGE_RELATIVE_PATH,
  PROFILE_IMAGE_SHA256,
  redact,
  uploadSessionPath,
} from './whatsapp-profile-dev.lib';

const PROJECT = 'careerbridge-f7b72';
const REGION = 'asia-south1';
const DEV_SERVICE = 'careerbridge-api-dev';
const PROFILE_FIELDS = 'about,address,description,email,profile_picture_url,websites,vertical';

const sh = (cmd: string) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const secret = (name: string) => sh(`gcloud secrets versions access latest --secret=${name} --project=${PROJECT}`);

const TOKEN = secret('careerbridge-whatsapp-access-token');
const PHONE_ID = secret('careerbridge-whatsapp-phone-number-id');
const safe = (value: unknown) => redact(typeof value === 'string' ? value : JSON.stringify(value), [TOKEN]);

type Graph = { status: number; data: Record<string, any> };

async function graph(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Graph> {
  const res = await fetch(graphUrl(path), {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: ((await res.json().catch(() => ({}))) as Record<string, any>) ?? {} };
}

function failIfError(label: string, r: Graph) {
  if (r.status !== 200 || r.data.error) throw new Error(`${label} failed: HTTP ${r.status} ${safe(r.data.error ?? r.data)}`);
  return r.data;
}

function configuredWabaId() {
  const svc = JSON.parse(sh(`gcloud run services describe ${DEV_SERVICE} --region=${REGION} --project=${PROJECT} --format=json`));
  const env: Array<{ name: string; value?: string }> = svc.spec.template.spec.containers[0].env ?? [];
  return env.find((e) => e.name === 'WHATSAPP_BUSINESS_ACCOUNT_ID')?.value;
}

async function confirmDevTarget() {
  const wabaPhones = failIfError('list DEV WABA phone numbers', await graph('GET', `/${DEV_WABA_ID}/phone_numbers?fields=id,display_phone_number`));
  const phone = failIfError('read phone number', await graph('GET', `/${PHONE_ID}?fields=display_phone_number`));
  const target = assertDevTarget({
    configuredWabaId: configuredWabaId(),
    phoneNumberId: PHONE_ID,
    wabaPhones: wabaPhones.data ?? [],
    phoneDisplayNumber: phone.display_phone_number,
  });
  console.log(`target confirmed by Meta: WABA ${target.wabaId}, phone ${target.displayPhone} (id ${target.phoneNumberId})`);
  return target;
}

async function confirmTokenApp() {
  const d = failIfError('debug_token', await graph('GET', `/debug_token?input_token=${encodeURIComponent(TOKEN)}`));
  const appId = String(d.data?.app_id ?? '');
  if (appId !== DEV_META_APP_ID) throw new Error(`token belongs to app ${appId}, expected ${DEV_META_APP_ID}`);
  return appId;
}

async function showState() {
  const phone = failIfError(
    'read phone number',
    await graph('GET', `/${PHONE_ID}?fields=display_phone_number,verified_name,name_status,new_display_name,new_name_status`),
  );
  const profile = failIfError('read profile', await graph('GET', `/${PHONE_ID}/whatsapp_business_profile?fields=${PROFILE_FIELDS}`));
  const p = (profile.data ?? [])[0] ?? {};
  console.log('display_phone_number:', phone.display_phone_number);
  console.log('verified_name:', JSON.stringify(phone.verified_name), 'name_status:', phone.name_status);
  console.log('new_display_name:', JSON.stringify(phone.new_display_name ?? null), 'new_name_status:', phone.new_name_status ?? null);
  console.log('about:', JSON.stringify(p.about ?? null));
  console.log('description:', JSON.stringify(p.description ?? null));
  console.log('websites:', JSON.stringify(p.websites ?? null));
  console.log('vertical:', JSON.stringify(p.vertical ?? null));
  console.log('profile_picture_url set:', Boolean(p.profile_picture_url));
  return { phone, profile: p };
}

function loadProfileImage() {
  const file = resolve(__dirname, '..', '..', '..', PROFILE_IMAGE_RELATIVE_PATH);
  const buf = readFileSync(file);
  const check = checkProfileImage(buf);
  console.log(`profile image: ${check.format} ${check.width}x${check.height} ${check.bytes} bytes sha256 ${check.sha256.slice(0, 16)}…`);
  if (check.sha256 !== PROFILE_IMAGE_SHA256) throw new Error('profile image is not the provided official SRSB logo (hash mismatch)');
  if (!check.ok) throw new Error(`profile image does not meet Meta requirements: ${check.problems.join('; ')}`);
  return { buf, check };
}

async function uploadProfileImage() {
  const appId = await confirmTokenApp();
  const { buf, check } = loadProfileImage();
  const session = failIfError('open upload session', await graph('POST', uploadSessionPath(appId, check)));
  const uploadId = String(session.id ?? '');
  if (!uploadId.startsWith('upload:')) throw new Error('Meta did not return an upload session id');
  const res = await fetch(graphUrl(`/${uploadId}`), {
    method: 'POST',
    headers: { Authorization: `OAuth ${TOKEN}`, file_offset: '0', 'Content-Type': check.format! },
    body: buf,
  });
  const data = ((await res.json().catch(() => ({}))) as Record<string, any>) ?? {};
  if (res.status !== 200 || !data.h) throw new Error(`image upload failed: HTTP ${res.status} ${safe(data.error ?? data)}`);
  console.log('image uploaded: HTTP 200, handle received');
  return String(data.h);
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'check') {
    await confirmDevTarget();
    loadProfileImage();
    await showState();
    return;
  }
  if (mode === 'apply-profile') {
    await confirmDevTarget();
    const handle = await uploadProfileImage();
    const r = await graph('POST', `/${PHONE_ID}/whatsapp_business_profile`, buildProfileUpdate(handle));
    console.log(`profile update: HTTP ${r.status} ${safe(r.data)}`);
    failIfError('profile update', r);
    await showState();
    return;
  }
  if (mode === 'submit-display-name') {
    await confirmDevTarget();
    const r = await graph('POST', displayNameChangePath(PHONE_ID));
    console.log(`display name change (${DESIRED_PROFILE.displayName}): HTTP ${r.status} ${safe(r.data)}`);
    failIfError('display name change', r);
    await showState();
    return;
  }
  if (mode === 'verify') {
    await confirmDevTarget();
    const { profile } = await showState();
    if (profile.profile_picture_url) {
      const img = await fetch(profile.profile_picture_url);
      const out = join(tmpdir(), 'cb-wa-profile-picture-dev.jpg');
      writeFileSync(out, Buffer.from(await img.arrayBuffer()));
      console.log('current profile picture downloaded for visual check:', out);
    }
    return;
  }
  throw new Error(`unknown mode ${mode ?? '(none)'}`);
}

main().catch((err) => {
  console.error('error:', safe(err instanceof Error ? err.message : String(err)));
  process.exitCode = 1;
});
