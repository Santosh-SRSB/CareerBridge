import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GstProviderError } from './gst.errors';
import { normalizeGstStatus, type GstInternalStatus } from './gst.status';
import type { GstProviderLookupResult } from './gst.provider';

/**
 * gstinapi.in provider — free-tier public GSTIN lookup via x-api-key.
 * Docs: https://www.gstinapi.in + GST_API_Setup_Guide.pdf
 */
@Injectable()
export class GstinApiProvider {
  private readonly logger = new Logger(GstinApiProvider.name);
  private readonly baseUrl = 'https://gstinapi.in/v1/gstin';

  constructor(private readonly config: ConfigService) {}

  private readApiKey() {
    return (this.config.get<string>('GSTINAPI_KEY') || '')
      .trim()
      .replace(/^["']|["']$/g, '');
  }

  isConfigured() {
    return Boolean(this.readApiKey());
  }

  async getGstinDetails(gstin: string): Promise<GstProviderLookupResult> {
    const started = Date.now();
    const apiKey = this.readApiKey();
    if (!apiKey) {
      throw new GstProviderError('GSTINAPI_KEY is not configured in .env');
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/${encodeURIComponent(gstin)}`, {
        method: 'GET',
        headers: { 'x-api-key': apiKey },
      });
    } catch (err) {
      this.logger.error(
        `gstinapi.in network error: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new GstProviderError('Could not reach gstinapi.in. Check internet / firewall.', 0, true);
    }

    const durationMs = Date.now() - started;

    if (res.status === 401 || res.status === 403) {
      throw new GstProviderError(
        'GSTINAPI_KEY was rejected by gstinapi.in. Check the key in apps/api/.env and restart the API.',
        res.status,
      );
    }

    if (res.status === 404) {
      // GSTIN not in registry — not a provider outage
      return { status: 'UNKNOWN', responseCode: '404', durationMs };
    }

    if (res.status === 429) {
      throw new GstProviderError(
        'gstinapi.in rate limit / monthly quota exceeded. Try again later or upgrade the plan.',
        429,
        true,
      );
    }

    if (!res.ok) {
      this.logger.warn(`gstinapi.in returned ${res.status} for GSTIN lookup`);
      throw new GstProviderError(`gstinapi.in request failed with status ${res.status}`, res.status);
    }

    const body = (await res.json()) as Record<string, unknown>;
    const data =
      body.data && typeof body.data === 'object'
        ? (body.data as Record<string, unknown>)
        : body;

    const rawStatus =
      data.status ??
      body.status ??
      body.gstin_status ??
      body.gstinStatus ??
      data.gstin_status ??
      data.gstinStatus;
    const status: GstInternalStatus = normalizeGstStatus(rawStatus);

    const tradeName = pickString(data, [
      'trade_name',
      'tradeName',
      'TradeName',
      'trademark',
      'nba',
    ]);
    const legalName = pickString(data, [
      'legal_name',
      'legalName',
      'LegalName',
      'lgnm',
      'name',
    ]);

    this.logger.log(`gstinapi.in lookup ok status=${status} durationMs=${durationMs}`);
    return {
      status,
      responseCode: String(res.status),
      durationMs,
      tradeName,
      legalName,
    };
  }
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
