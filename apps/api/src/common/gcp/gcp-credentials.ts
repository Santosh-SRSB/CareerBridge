import { existsSync, readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import type { ConfigService } from '@nestjs/config';

export type GcpServiceAccount = {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key?: string;
  client_email?: string;
  client_id?: string;
  universe_domain?: string;
};

function resolvePath(configured: string): string {
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
}

/** Strip UTF-8 BOM / odd prefixes that break JSON.parse and google-auth. */
function readJsonFile(path: string): unknown {
  let text = readFileSync(path, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  // Some editors save a literal "?" before `{` after a bad encoding conversion.
  text = text.replace(/^\uFEFF/, '').replace(/^\?+/, '').trim();
  return JSON.parse(text);
}

/**
 * Load GCP service-account credentials for Storage / Document AI / Tasks.
 * Prefer GOOGLE_APPLICATION_CREDENTIALS.
 * Optionally allow FIREBASE_SERVICE_ACCOUNT_PATH when its project_id matches GCP_PROJECT_ID.
 * Returns empty options so clients fall back to Application Default Credentials.
 */
export function loadGcpCredentials(
  config: ConfigService,
  options?: { allowFirebaseSa?: boolean },
): {
  credentials?: GcpServiceAccount;
  keyFilename?: string;
  projectId?: string;
} {
  const expectedProject = (config.get<string>('GCP_PROJECT_ID') || '').trim();
  const allowFirebaseSa = options?.allowFirebaseSa !== false;

  const candidates: Array<{ path: string; requireProjectMatch: boolean }> = [];
  const gac = (config.get<string>('GOOGLE_APPLICATION_CREDENTIALS') || '').trim();
  const firebasePath = (config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH') || '').trim();
  if (gac) candidates.push({ path: gac, requireProjectMatch: false });
  if (allowFirebaseSa && firebasePath) {
    candidates.push({ path: firebasePath, requireProjectMatch: true });
  }

  for (const candidate of candidates) {
    const path = resolvePath(candidate.path);
    if (!existsSync(path)) continue;
    try {
      const parsed = readJsonFile(path) as GcpServiceAccount;
      const privateKey =
        typeof parsed.private_key === 'string'
          ? parsed.private_key.replace(/\\n/g, '\n')
          : '';
      const clientEmail =
        typeof parsed.client_email === 'string' ? parsed.client_email.trim() : '';
      if (!privateKey || !clientEmail) continue;

      if (
        candidate.requireProjectMatch &&
        expectedProject &&
        parsed.project_id &&
        parsed.project_id !== expectedProject
      ) {
        // Wrong GCP project (e.g. Firebase app vs Document AI project) — skip.
        continue;
      }

      return {
        credentials: {
          ...parsed,
          private_key: privateKey,
          client_email: clientEmail,
        },
        keyFilename: path,
        projectId: parsed.project_id,
      };
    } catch {
      // try next candidate
    }
  }

  return {};
}

export type GcpClientOptionsInput = {
  projectIdFallback?: string;
  /** When false, never use FIREBASE_SERVICE_ACCOUNT_PATH (use ADC for Storage). Default true. */
  allowFirebaseSa?: boolean;
};

/** Client options for @google-cloud/* — never pass empty keyFilename. */
export function gcpClientOptions(config: ConfigService, opts?: string | GcpClientOptionsInput) {
  const normalized: GcpClientOptionsInput =
    typeof opts === 'string' ? { projectIdFallback: opts } : opts || {};
  const loaded = loadGcpCredentials(config, {
    allowFirebaseSa: normalized.allowFirebaseSa,
  });
  const projectId =
    config.get<string>('GCP_PROJECT_ID') ||
    loaded.projectId ||
    normalized.projectIdFallback ||
    undefined;

  if (loaded.credentials?.private_key && loaded.credentials?.client_email) {
    return {
      projectId,
      credentials: loaded.credentials,
    };
  }

  // ADC / gcloud auth application-default — only if no file credentials
  return {
    projectId,
  };
}
