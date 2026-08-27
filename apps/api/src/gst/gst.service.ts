import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GstConfigService } from './gst.config';
import { GstConfigError, GstProviderError, gstValidationException } from './gst.errors';
import { IrisIrpGstProvider } from './gst.provider';
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
};

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
    try {
      const result = await this.provider.getGstinDetails(gstin);
      const status = result.status;
      const verified = verifiedFromStatus(status);

      const payload: GstVerifyResult =
        status === 'UNKNOWN'
          ? {
              success: false,
              verified: false,
              status: 'UNKNOWN',
              message: 'GSTIN verification is temporarily unavailable. Please try again.',
            }
          : {
              success: true,
              verified,
              status,
            };

      await this.safeAudit({
        gstin,
        verificationStatus: payload.status,
        verified: payload.verified,
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
          environment: cfg.environment,
          responseCode:
            err instanceof GstProviderError ? String(err.httpStatus ?? 'ERR') : 'CONFIG',
          userId,
        });
        return {
          success: false,
          verified: false,
          status: 'UNKNOWN',
          message: 'GSTIN verification is temporarily unavailable. Please try again.',
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
  }) {
    try {
      await this.prisma.gstVerificationAudit.create({
        data: {
          gstin: input.gstin,
          verificationStatus: input.verificationStatus,
          verified: input.verified,
          provider: 'IRIS_IRP',
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
