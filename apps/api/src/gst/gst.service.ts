import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GstConfigService, type GstRuntimeConfig } from './gst.config';
import { GstConfigError, GstProviderError, gstValidationException } from './gst.errors';
import { IrisIrpGstProvider } from './gst.provider';
import { type GstInternalStatus } from './gst.status';
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
  trademark?: string | null;
  /** Which lookup answered; MOCK is a local test double, never a live GST lookup. */
  provider: GstRuntimeConfig['provider'];
  mock: boolean;
};

export const GST_MOCK_ACTIVE_MESSAGE =
  'Test mode: this server uses a mock GST check, not a live GST lookup. The result is not real verification.';
export const GST_MOCK_NOT_ACTIVE_MESSAGE =
  'Test mode: this server uses a mock GST check, and this GSTIN is not on its test list. Live GST lookup is not available here.';
export const GST_UNAVAILABLE_MESSAGE = 'GSTIN verification is temporarily unavailable. Please try again.';
export const GST_NOT_CONFIGURED_MESSAGE = 'GSTIN verification is not available on this server right now. Please contact support.';

@Injectable()
export class GstService {
  private readonly logger = new Logger(GstService.name);

  constructor(
    private readonly gstConfig: GstConfigService,
    private readonly provider: IrisIrpGstProvider,
    private readonly prisma: PrismaService,
  ) {}

  health() {
    const cfg = this.gstConfig.get();
    return {
      configured: cfg.configured,
      environment: cfg.environment,
      provider: cfg.provider,
      mockEnabled: cfg.mockEnabled && !cfg.configured,
    };
  }

  async verify(rawGstin: string, userId?: string): Promise<GstVerifyResult> {
    const gstin = normalizeGstin(rawGstin);
    const formatError = validateGstinFormat(gstin);
    if (formatError) {
      throw gstValidationException(formatError);
    }

    const cfg = this.gstConfig.get();
    this.logger.log(
      `GST verification requested gstin=${maskGstin(gstin)} env=${cfg.environment} provider=${cfg.provider}`,
    );

    const started = Date.now();
    const usingMock = !cfg.gstinApiKey && cfg.mockEnabled && !cfg.configured;
    const provider = usingMock ? 'MOCK' : cfg.provider;
    try {
      const result = await this.provider.getGstinDetails(gstin);
      const status = result.status;

      const payload: GstVerifyResult =
        status === 'UNKNOWN'
          ? {
              success: false,
              verified: false,
              status: 'UNKNOWN',
              trademark: null,
              message: GST_UNAVAILABLE_MESSAGE,
              provider,
              mock: usingMock,
            }
          : status === 'ACTIVE'
            ? {
                success: true,
                verified: true,
                status: 'ACTIVE',
                trademark: result.tradeName,
                provider,
                mock: usingMock,
                ...(usingMock ? { message: GST_MOCK_ACTIVE_MESSAGE } : {}),
              }
            : {
                success: true,
                verified: false,
                status: 'NOT_ACTIVE',
                trademark: null,
                message: usingMock ? GST_MOCK_NOT_ACTIVE_MESSAGE : 'This GSTIN is not active.',
                provider,
                mock: usingMock,
              };
      if (usingMock && status !== 'ACTIVE') {
        this.logger.warn(
          'GST mock provider active (GST_MOCK_ENABLED=true, no GSTINAPI_KEY / IRIS credentials); only GST_MOCK_ACTIVE_GSTIN verifies.',
        );
      }

      await this.safeAudit({
        gstin,
        verificationStatus: payload.status,
        verified: payload.verified,
        provider,
        environment: cfg.environment,
        responseCode: result.responseCode || null,
        userId,
      });

      this.logger.log(
        `GST verification completed gstin=${maskGstin(gstin)} verified=${payload.verified} status=${payload.status} durationMs=${Date.now() - started}`,
      );
      return payload;
    } catch (err) {
      const durationMs = Date.now() - started;
      if (err instanceof GstConfigError || err instanceof GstProviderError) {
        this.logger.error(
          `GST verification failed durationMs=${durationMs}: ${err instanceof GstProviderError ? `http=${err.httpStatus}` : 'config'}`,
        );
        await this.safeAudit({
          gstin,
          verificationStatus: 'UNKNOWN',
          verified: false,
          provider,
          environment: cfg.environment,
          responseCode:
            err instanceof GstProviderError ? String(err.httpStatus ?? 'ERR') : 'CONFIG',
          userId,
        });
        return {
          success: false,
          verified: false,
          status: 'UNKNOWN',
          message: err instanceof GstConfigError ? GST_NOT_CONFIGURED_MESSAGE : GST_UNAVAILABLE_MESSAGE,
          provider,
          mock: usingMock,
        };
      }
      throw err;
    }
  }

  private async safeAudit(input: {
    gstin: string;
    verificationStatus: string;
    verified: boolean;
    provider: string;
    environment: string;
    responseCode: string | null;
    userId?: string;
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
