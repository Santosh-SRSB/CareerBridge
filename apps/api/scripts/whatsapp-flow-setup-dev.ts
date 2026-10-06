/**
 * DEV-only: create / update / inspect / publish the "Choose Another Time" WhatsApp Flow in the DEV WABA.
 * The Flow JSON comes from src/whatsapp/whatsapp-flow.util.ts. The access token is read from Secret Manager and never printed.
 *
 *   npx ts-node --transpile-only scripts/whatsapp-flow-setup-dev.ts list
 *   npx ts-node --transpile-only scripts/whatsapp-flow-setup-dev.ts create
 *   npx ts-node --transpile-only scripts/whatsapp-flow-setup-dev.ts update <flowId>
 *   npx ts-node --transpile-only scripts/whatsapp-flow-setup-dev.ts status <flowId>
 *   npx ts-node --transpile-only scripts/whatsapp-flow-setup-dev.ts publish <flowId>
 *   npx ts-node --transpile-only scripts/whatsapp-flow-setup-dev.ts json
 */
import { execSync } from 'child_process';
import { buildRescheduleFlowJson, RESCHEDULE_FLOW_NAME } from '../src/whatsapp/whatsapp-flow.util';

const PROJECT = 'careerbridge-f7b72';
const DEV_WABA = '946009308557431';
const GRAPH = 'https://graph.facebook.com/v25.0';
const FLOW_NAME = `${RESCHEDULE_FLOW_NAME}_dev`;

function token() {
  return execSync(`gcloud secrets versions access latest --secret=careerbridge-whatsapp-access-token --project=${PROJECT}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

async function graph(method: 'GET' | 'POST', path: string, body?: BodyInit, json = true) {
  const res = await fetch(`${GRAPH}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, ...(json && body ? { 'Content-Type': 'application/json' } : {}) },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

function show(label: string, r: { status: number; data: Record<string, unknown> }) {
  console.log(`${label}: HTTP ${r.status}`);
  console.log(JSON.stringify(r.data, null, 2));
}

async function main() {
  const [mode, flowId] = process.argv.slice(2);
  const flowJson = JSON.stringify(buildRescheduleFlowJson());

  if (mode === 'json') return console.log(JSON.stringify(buildRescheduleFlowJson(), null, 2));
  if (mode === 'list') return show('flows in DEV WABA', await graph('GET', `/${DEV_WABA}/flows?fields=id,name,status,categories`));

  if (mode === 'create') {
    const r = await graph(
      'POST',
      `/${DEV_WABA}/flows`,
      JSON.stringify({ name: FLOW_NAME, categories: ['APPOINTMENT_BOOKING'], flow_json: flowJson }),
    );
    return show('create (draft)', r);
  }

  if (!flowId || !/^\d+$/.test(flowId)) throw new Error('flowId (numeric) is required for this mode');

  if (mode === 'update') {
    const form = new FormData();
    form.append('name', 'flow.json');
    form.append('asset_type', 'FLOW_JSON');
    form.append('file', new Blob([flowJson], { type: 'application/json' }), 'flow.json');
    return show('update assets', await graph('POST', `/${flowId}/assets`, form, false));
  }
  if (mode === 'status') {
    return show(
      'status',
      await graph('GET', `/${flowId}?fields=id,name,status,categories,validation_errors,json_version,data_api_version,whatsapp_business_account,health_status`),
    );
  }
  if (mode === 'publish') return show('publish', await graph('POST', `/${flowId}/publish`));
  throw new Error(`unknown mode ${mode}`);
}

main().catch((err) => {
  console.error('error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
