import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GstConfigError } from './gst.errors';

export type GstEnvironment = 'sandbox' | 'production';

export type GstRuntimeConfig = {
  environment: GstEnvironment;
  provider: 'GSTINAPI' | 'IRIS_IRP' | 'MOCK';
  gstinApiKey: string;
  baseUrl: string;
  authPath: string;
  getGstinPath: string;
  clientId: string;
  clientSecret: string;
  portalId: string;
  /** Taxpayer / API-user GSTIN used in Auth and request headers (requester). */
  requesterGstin: string;
  username: string;
  password: string;
  publicKeyPem: string;
  timeoutMs: number;
  maxRetries: number;
  mockEnabled: boolean;
  isPlaceholder: boolean;
  configured: boolean;
};

const PLACEHOLDER_MARKERS = ['DEMO_', 'placeholder', 'example.com', 'changeme', 'REPLACE_'];

@Injectable()
export class GstConfigService implements OnModuleInit {
  private readonly logger = new Logger(GstConfigService.name);
  private runtime!: GstRuntimeConfig;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.runtime = this.load();
    if (this.runtime.environment === 'production' && !this.runtime.configured && this.runtime.provider !== 'GSTINAPI') {
      throw new GstConfigError(
        'GST_ENV=production but production IRIS IRP credentials are missing or still placeholders. Refusing to start.',
      );
    }
    if (this.runtime.provider === 'GSTINAPI') {
      this.logger.log('GST module using gstinapi.in for GSTIN lookup.');
    } else if (!this.runtime.configured) {
      this.logger.warn(
        `GST module loaded for ${this.runtime.environment} with incomplete/placeholder credentials. ` +
          `Live IRIS calls will fail until real sandbox credentials are set. ` +
          (this.runtime.mockEnabled ? 'GST_MOCK_ENABLED=true — local mock verification is active.' : ''),
      );
    } else {
      this.logger.log(`GST module configured for IRIS IRP (${this.runtime.environment}).`);
    }
  }

  get(): GstRuntimeConfig {
    return this.runtime;
  }

  private load(): GstRuntimeConfig {
    const envRaw = (this.config.get<string>('GST_ENV') || 'sandbox').trim().toLowerCase();
    if (envRaw !== 'sandbox' && envRaw !== 'production') {
      throw new GstConfigError(`Invalid GST_ENV="${envRaw}". Use "sandbox" or "production".`);
    }
    const environment = envRaw as GstEnvironment;
    const prefix = environment === 'sandbox' ? 'GST_SANDBOX' : 'GST_PRODUCTION';

    const baseUrl = (this.config.get<string>(`${prefix}_BASE_URL`) || '').trim();
    const clientId = (this.config.get<string>(`${prefix}_CLIENT_ID`) || '').trim();
    const clientSecret = (this.config.get<string>(`${prefix}_CLIENT_SECRET`) || '').trim();
    const portalId = (this.config.get<string>(`${prefix}_PORTAL_ID`) || '').trim();
    const requesterGstin = (this.config.get<string>(`${prefix}_REQUESTER_GSTIN`) || '').trim().toUpperCase();
    const username = (this.config.get<string>(`${prefix}_USERNAME`) || '').trim();
    const password = (this.config.get<string>(`${prefix}_PASSWORD`) || '').trim();
    const publicKeyPem = (this.config.get<string>('GST_PUBLIC_KEY_PEM') || '')
      .trim()
      .replace(/\\n/g, '\n');

    // Paths are env-configurable. Defaults follow the public NIC e-invoice API surface that
    // IRIS documents as compatible with the E-invoice standard. Confirm exact paths in the
    // official IRIS Core APIs wiki once portal access is granted:
    // https://einvoice6.gst.gov.in/content/core-apis-wiki/
    const authPath =
      (this.config.get<string>('GST_AUTH_PATH') || '/eivital/v1.04/auth').trim() ||
      '/eivital/v1.04/auth';
    const getGstinPath =
      (this.config.get<string>('GST_GET_GSTIN_PATH') || '/eivital/v1.04/Master/gstin/{gstin}').trim() ||
      '/eivital/v1.04/Master/gstin/{gstin}';

    const timeoutMs = Number(this.config.get('GST_API_TIMEOUT_MS') || 15000);
    const maxRetries = Number(this.config.get('GST_API_MAX_RETRIES') || 2);
    const mockEnabled = (this.config.get<string>('GST_MOCK_ENABLED') || 'false').toLowerCase() === 'true';
    const gstinApiKey = (this.config.get<string>('GSTINAPI_KEY') || '').trim();

    const secrets = [baseUrl, clientId, clientSecret, username, password, requesterGstin];
    const isPlaceholder = secrets.some((v) => !v || PLACEHOLDER_MARKERS.some((m) => v.includes(m)));
    const configured =
      Boolean(baseUrl && clientId && clientSecret && username && password && requesterGstin) &&
      !isPlaceholder;

    const provider: GstRuntimeConfig['provider'] = gstinApiKey
      ? 'GSTINAPI'
      : configured
        ? 'IRIS_IRP'
        : 'MOCK';

    return {
      environment,
      provider,
      gstinApiKey,
      baseUrl: baseUrl.replace(/\/$/, ''),
      authPath,
      getGstinPath,
      clientId,
      clientSecret,
      portalId,
      requesterGstin,
      username,
      password,
      publicKeyPem,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000,
      maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 2,
      mockEnabled,
      isPlaceholder,
      configured,
    };
  }
}
