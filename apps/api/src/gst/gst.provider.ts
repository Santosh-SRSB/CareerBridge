import { Injectable, Logger } from '@nestjs/common';
import { createDecipheriv, publicEncrypt, randomBytes, constants } from 'crypto';
import { GstConfigService, GstRuntimeConfig } from './gst.config';
import { GstConfigError, GstProviderError } from './gst.errors';
import { maskGstin } from './gst.validator';
import { normalizeGstStatus, type GstInternalStatus } from './gst.status';

export type GstProviderLookupResult = {
  status: GstInternalStatus;
  responseCode?: string;
  durationMs: number;
};

type CachedToken = {
  authToken: string;
  sek: string;
  appKey: Buffer;
  expiresAt: number;
};

/**
 * IRIS IRP provider for Core API "Get GSTIN Details".
 *
 * Auth and request shape follow the public E-invoice / IRP standard that IRIS documents as
 * compatible with core e-invoice APIs (Client ID, Client Secret, requester GSTIN, AuthToken).
 * Exact path strings are env-configurable and must be confirmed against the official wiki:
 * https://einvoice6.gst.gov.in/content/core-apis-wiki/
 * https://einvoice6.gst.gov.in/content/kb/authentication/
 *
 * Auth token validity: 6 hours (360 mins) per IRIS Authentication KB.
 *
 * IMPORTANT LIMITATION:
 * Core APIs are available for a taxpayer only when the API user is authorised by that taxpayer
 * (Manage API access / onboarding). Arbitrary public GSTIN lookup may be restricted by your
 * production credentials. See docs/GST_SANDBOX_SETUP.md.
 */
@Injectable()
export class IrisIrpGstProvider {
  private readonly logger = new Logger(IrisIrpGstProvider.name);
  private tokenCache: CachedToken | null = null;

  constructor(private readonly gstConfig: GstConfigService) {}

  async getGstinDetails(gstin: string): Promise<GstProviderLookupResult> {
    const cfg = this.gstConfig.get();
    const started = Date.now();

    if (cfg.mockEnabled && !cfg.configured) {
      return this.mockLookup(gstin, started);
    }

    if (!cfg.configured) {
      throw new GstConfigError(
        'IRIS IRP credentials are not configured. Set real sandbox values in apps/api/.env (see .env.example).',
      );
    }

    try {
      const token = await this.getAuthToken(cfg);
      const payload = await this.fetchWithRetry(cfg, gstin, token);
      const status = this.extractStatus(payload);
      return {
        status,
        responseCode: String((payload as { Status?: string | number }).Status ?? 'OK'),
        durationMs: Date.now() - started,
      };
    } catch (err) {
      if (err instanceof GstProviderError && err.httpStatus === 401) {
        this.tokenCache = null;
        try {
          const token = await this.getAuthToken(cfg, true);
          const payload = await this.fetchWithRetry(cfg, gstin, token);
          const status = this.extractStatus(payload);
          return {
            status,
            responseCode: String((payload as { Status?: string | number }).Status ?? 'OK'),
            durationMs: Date.now() - started,
          };
        } catch (retryErr) {
          throw retryErr;
        }
      }
      throw err;
    }
  }

  private mockLookup(gstin: string, started: number): GstProviderLookupResult {
    // Deterministic sandbox UI testing only — never used when live credentials are configured.
    const inactiveMarker = process.env.GST_MOCK_INACTIVE_GSTIN?.toUpperCase();
    const activeMarker = process.env.GST_MOCK_ACTIVE_GSTIN?.toUpperCase() || '29AAAAA0000A1Z5';
    let status: GstInternalStatus = 'ACTIVE';
    if (inactiveMarker && gstin === inactiveMarker) {
      status = 'NOT_ACTIVE';
    } else if (gstin === activeMarker) {
      status = 'ACTIVE';
    } else if (gstin.endsWith('Z0') || gstin.endsWith('Z1')) {
      status = 'NOT_ACTIVE';
    }
    this.logger.warn(
      `GST mock lookup for ${maskGstin(gstin)} → ${status} (GST_MOCK_ENABLED=true; not a live IRIS call)`,
    );
    return { status, responseCode: 'MOCK', durationMs: Date.now() - started };
  }

  private async getAuthToken(cfg: GstRuntimeConfig, force = false): Promise<CachedToken> {
    const now = Date.now();
    // IRIS: Auth token valid for 6 hours (360 mins). Refresh 5 minutes early.
    if (!force && this.tokenCache && this.tokenCache.expiresAt > now + 60_000) {
      return this.tokenCache;
    }

    if (!cfg.publicKeyPem) {
      throw new GstConfigError(
        'GST_PUBLIC_KEY_PEM is required for IRIS IRP authentication (RSA-encrypt password / AppKey).',
      );
    }

    const appKey = randomBytes(32);
    const passwordEncrypted = this.rsaEncrypt(cfg.password, cfg.publicKeyPem);
    const appKeyEncrypted = this.rsaEncrypt(appKey.toString('base64'), cfg.publicKeyPem);

    // Payload follows the public NIC e-invoice Auth request shape used across IRPs.
    const authBody = {
      Data: Buffer.from(
        JSON.stringify({
          UserName: cfg.username,
          Password: passwordEncrypted,
          AppKey: appKeyEncrypted,
          ForceRefreshAccessToken: force,
        }),
      ).toString('base64'),
    };

    const url = `${cfg.baseUrl}${cfg.authPath.startsWith('/') ? '' : '/'}${cfg.authPath}`;
    const response = await this.httpJson('POST', url, cfg, {
      body: JSON.stringify(authBody),
      headers: {
        'Content-Type': 'application/json',
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        Gstin: cfg.requesterGstin,
      },
      retryable: true,
    });

    const decoded = this.decodeAuthResponse(response, appKey);
    this.tokenCache = {
      authToken: decoded.authToken,
      sek: decoded.sek,
      appKey,
      // 6 hours per IRIS Authentication KB
      expiresAt: Date.now() + 6 * 60 * 60 * 1000 - 5 * 60 * 1000,
    };
    this.logger.log(`IRIS IRP auth token acquired for ${cfg.environment}`);
    return this.tokenCache;
  }

  private decodeAuthResponse(
    response: Record<string, unknown>,
    appKey: Buffer,
  ): { authToken: string; sek: string } {
    // Support both plaintext-debug and encrypted Data envelopes used by IRPs.
    const status = String(response.Status ?? response.status ?? '');
    if (status && status !== '1' && status.toUpperCase() !== 'SUCCESS') {
      throw new GstProviderError('IRIS IRP authentication failed.', 401, false);
    }

    let data = response.Data ?? response.data;
    if (typeof data === 'string') {
      try {
        // Some IRPs return base64(JSON). Others return AES-encrypted blob with AppKey.
        const asJson = Buffer.from(data, 'base64').toString('utf8');
        if (asJson.trim().startsWith('{')) {
          data = JSON.parse(asJson);
        } else {
          const decrypted = this.aesDecrypt(data, appKey);
          data = JSON.parse(decrypted);
        }
      } catch {
        throw new GstProviderError('Could not decode IRIS IRP auth response.', 502, true);
      }
    }

    const obj = (data || {}) as Record<string, unknown>;
    const authToken = String(obj.AuthToken ?? obj.authToken ?? '');
    const sek = String(obj.Sek ?? obj.sek ?? '');
    if (!authToken) {
      throw new GstProviderError('IRIS IRP auth response missing AuthToken.', 502, true);
    }
    return { authToken, sek };
  }

  private async fetchWithRetry(
    cfg: GstRuntimeConfig,
    gstin: string,
    token: CachedToken,
  ): Promise<Record<string, unknown>> {
    const path = cfg.getGstinPath.replace('{gstin}', encodeURIComponent(gstin));
    const url = `${cfg.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    return this.httpJson('GET', url, cfg, {
      headers: {
        'Content-Type': 'application/json',
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        Gstin: cfg.requesterGstin,
        user_name: cfg.username,
        AuthToken: token.authToken,
      },
      retryable: true,
      decryptWithSek: token.sek ? Buffer.from(token.sek, 'base64') : undefined,
      appKey: token.appKey,
    });
  }

  private extractStatus(payload: Record<string, unknown>): GstInternalStatus {
    // Prefer nested Data object after decryption; fall back to common field names.
    let data: Record<string, unknown> = payload;
    if (payload.Data && typeof payload.Data === 'object') {
      data = payload.Data as Record<string, unknown>;
    } else if (payload.data && typeof payload.data === 'object') {
      data = payload.data as Record<string, unknown>;
    }

    const raw =
      data.Status ??
      data.status ??
      data.Sts ??
      data.sts ??
      data.GstinStatus ??
      data.gstinStatus ??
      data.TxpType;

    return normalizeGstStatus(raw);
  }

  private async httpJson(
    method: 'GET' | 'POST',
    url: string,
    cfg: GstRuntimeConfig,
    options: {
      body?: string;
      headers: Record<string, string>;
      retryable: boolean;
      decryptWithSek?: Buffer;
      appKey?: Buffer;
    },
  ): Promise<Record<string, unknown>> {
    let attempt = 0;
    let lastError: Error | null = null;
    const maxAttempts = options.retryable ? cfg.maxRetries + 1 : 1;

    while (attempt < maxAttempts) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          headers: options.headers,
          body: options.body,
          signal: controller.signal,
        });
        clearTimeout(timer);

        const text = await res.text();
        let json: Record<string, unknown> = {};
        try {
          json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
          json = { raw: text.slice(0, 200) };
        }

        if (res.status === 401 || res.status === 403) {
          throw new GstProviderError(`IRIS IRP returned ${res.status}.`, res.status, false);
        }
        if (res.status === 400 || res.status === 404) {
          throw new GstProviderError(`IRIS IRP returned ${res.status}.`, res.status, false);
        }
        if (res.status === 429 || res.status >= 500) {
          throw new GstProviderError(`IRIS IRP returned ${res.status}.`, res.status, true);
        }
        if (!res.ok) {
          throw new GstProviderError(`IRIS IRP returned ${res.status}.`, res.status, false);
        }

        // Decrypt Data when Sek is present (NIC-compatible encrypted responses).
        if (typeof json.Data === 'string' && options.decryptWithSek && options.appKey) {
          const encryptedData = json.Data;
          try {
            const sek = this.aesDecrypt(
              Buffer.from(options.decryptWithSek).toString('base64'),
              options.appKey,
            );
            // Sek itself may already be the key bytes when returned as base64 in AuthToken payload
            const sekKey = Buffer.from(
              String((JSON.parse(sek) as { Sek?: string }).Sek ?? sek),
              'base64',
            );
            const decrypted = this.aesDecrypt(
              encryptedData,
              sekKey.length === 32 ? sekKey : options.decryptWithSek,
            );
            json.Data = JSON.parse(decrypted);
          } catch {
            try {
              const decrypted = this.aesDecrypt(encryptedData, options.decryptWithSek);
              json.Data = JSON.parse(decrypted);
            } catch {
              // Leave Data as-is if not encrypted / already plain JSON string
              try {
                const maybe = Buffer.from(encryptedData, 'base64').toString('utf8');
                if (maybe.trim().startsWith('{')) {
                  json.Data = JSON.parse(maybe);
                }
              } catch {
                /* ignore */
              }
            }
          }
        }

        return json;
      } catch (err) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err : new Error(String(err));
        const retryable =
          (err instanceof GstProviderError && err.retryable) ||
          lastError.name === 'AbortError' ||
          /fetch|network|ECONN|ETIMEDOUT|abort/i.test(lastError.message);

        if (!retryable || attempt >= maxAttempts) {
          if (lastError.name === 'AbortError') {
            throw new GstProviderError('IRIS IRP request timed out.', 408, true);
          }
          throw lastError;
        }
        const backoffMs = Math.min(2000 * 2 ** (attempt - 1), 8000);
        this.logger.warn(
          `Transient IRIS IRP failure (attempt ${attempt}/${maxAttempts}); retrying in ${backoffMs}ms`,
        );
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    throw lastError || new GstProviderError('IRIS IRP request failed.', 502, true);
  }

  private rsaEncrypt(plain: string, publicKeyPem: string): string {
    const key = publicKeyPem.includes('BEGIN')
      ? publicKeyPem
      : `-----BEGIN PUBLIC KEY-----\n${publicKeyPem}\n-----END PUBLIC KEY-----`;
    const encrypted = publicEncrypt(
      { key, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(plain, 'utf8'),
    );
    return encrypted.toString('base64');
  }

  private aesDecrypt(payloadBase64: string, key: Buffer): string {
    const buf = Buffer.from(payloadBase64, 'base64');
    // AES-256-ECB is the historical NIC e-invoice decrypt mode for Auth Data / Sek payloads.
    const d = createDecipheriv('aes-256-ecb', key.subarray(0, 32), null);
    d.setAutoPadding(true);
    return Buffer.concat([d.update(buf), d.final()]).toString('utf8');
  }
}
