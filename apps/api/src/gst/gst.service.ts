import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GstConfigService } from './gst.config';
import { GstConfigError, GstProviderError, gstValidationException } from './gst.errors';
import type { GstProviderLookupResult } from './gst.provider';
import { GstProviderRouter } from './gst.provider.router';
import { verifiedFromStatus, type GstInternalStatus } from './gst.status';
import { maskGstin, normalizeGstin, validateGstinFormat } from './gst.validator';

/**
 * Business payload (wrapped by CareerBridge as `{ success, data, requestId }`).
 * `success` here is the GST verification outcome, not the HTTP envelope.
 */
export type GstVerifyResult = {
  success: boolean;
  verified: boolean;
  status: GstInternalStatus;
  message?: string;
  /** Trade name / trademark from GST registry (gstinapi `trade_name`). */
  trademark?: string | null;
  tradeName?: string | null;
  legalName?: string | null;
};

type GstLookupProvider = {
  getGstinDetails(gstin: string): Promise<GstProviderLookupResult>;
};

@Injectable()
export class GstService {
  private readonly logger = new Logger(GstService.name);

  constructor(
    private readonly gstConfig: GstConfigService,
    @Inject('GstProvider') private readonly provider: GstLookupProvider,
    private readonly prisma: PrismaService,
    private readonly router: GstProviderRouter,
  ) {}

  health() {
    const cfg = this.gstConfig.get();
    const providerName = this.router.activeProviderName();
    return {
      configured: cfg.configured || providerName === 'GSTINAPI',
      environment: cfg.environment,
      provider: providerName,
      mockEnabled: cfg.mockEnabled && !cfg.configured && providerName !== 'GSTINAPI',
    };
  }

  async verify(rawGstin: string, userId?: string): Promise<GstVerifyResult> {
    const gstin = normalizeGstin(rawGstin);
    const formatError = validateGstinFormat(gstin);
    if (formatError) {
      throw gstValidationException(formatError);
    }

    const cfg = this.gstConfig.get();
    const providerName = this.router.activeProviderName();
    this.logger.log(
      `GST verification requested gstin=${maskGstin(gstin)} env=${cfg.environment} provider=${providerName}`,
    );

    const started = Date.now();
    try {
      const result = await this.provider.getGstinDetails(gstin);
      const status = result.status;
      const verified = verifiedFromStatus(status);

      const names = {
        trademark: result.tradeName ?? null,
        tradeName: result.tradeName ?? null,
        legalName: result.legalName ?? null,
      };

      const payload: GstVerifyResult =
        status === 'UNKNOWN'
          ? {
              success: false,
              verified: false,
              status: 'UNKNOWN',
              message:
                result.responseCode === '404'
                  ? 'This GSTIN was not found. Double-check the 15-character number (test tip: try 24AAKPV8888P1ZB from gstinapi.in docs).'
                  : 'Could not confirm this GSTIN right now. Please try again.',
              ...names,
            }
          : status === 'NOT_ACTIVE'
            ? {
                success: true,
                verified: false,
                status: 'NOT_ACTIVE',
                message: 'This GSTIN exists but is not Active. Enter an Active GSTIN to continue.',
                ...names,
              }
            : {
                success: true,
                verified,
                status,
                ...names,
              };

      await this.safeAudit({
        gstin,
        verificationStatus: payload.status,
        verified: payload.verified,
        environment: cfg.environment,
        responseCode: result.responseCode || null,
        userId,
        provider: providerName,
      });

      this.logger.log(
        `GST verification completed gstin=${maskGstin(gstin)} verified=${payload.verified} status=${payload.status} durationMs=${Date.now() - started}`,
      );
      return payload;
    } catch (err) {
      const durationMs = Date.now() - started;
      if (err instanceof GstConfigError || err instanceof GstProviderError) {
        this.logger.error(
          `GST verification failed durationMs=${durationMs}: ${err.message}`,
        );
        await this.safeAudit({
          gstin,
          verificationStatus: 'UNKNOWN',
          verified: false,
          environment: cfg.environment,
          responseCode:
            err instanceof GstProviderError ? String(err.httpStatus ?? 'ERR') : 'CONFIG',
          userId,
          provider: providerName,
        });
        return {
          success: false,
          verified: false,
          status: 'UNKNOWN',
          message: err.message,
        };
      }
      throw err;
    }
  }

  private async safeAudit(input: {
    gstin: string;
    verificationStatus: string;
    verified: boolean;
    environment: string;
    responseCode: string | null;
    userId?: string;
    provider: string;
  }) {
    try {
      await this.prisma.gstVerificationAudit.create({
        data: {
          gstin: input.gstin,
          verificationStatus: input.verificationStatus,
          verified: input.verified,
          provider: input.provider,
          environment: input.environment,
          responseCode: input.responseCode,
          userId: input.userId || null,
          verifiedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Could not persist GST audit row: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
}
