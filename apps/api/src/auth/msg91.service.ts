import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@careerbridge/shared';

type Msg91Response = {
  type?: string;
  message?: string;
  request_id?: string;
};

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get('MSG91_AUTH_KEY')?.trim());
  }

  normalizeMobile(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.startsWith('0') && digits.length === 11) return `91${digits.slice(1)}`;
    return digits;
  }

  private requireTemplateId() {
    const templateId = this.config.get('MSG91_TEMPLATE_ID')?.trim();
    if (!templateId) {
      throw new HttpException(
        {
          code: ErrorCode.INTERNAL_ERROR,
          message:
            'SMS OTP is not fully configured. Add MSG91_TEMPLATE_ID in apps/api/.env (MSG91 dashboard → OTP → Templates, DLT template with ##OTP##).',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return templateId;
  }

  private async callMsg91(path: string, init: RequestInit) {
    const authkey = this.config.get('MSG91_AUTH_KEY')?.trim();
    if (!authkey) {
      throw new HttpException(
        {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Mobile OTP is not configured. Set MSG91_AUTH_KEY in apps/api/.env.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const response = await fetch(`https://control.msg91.com${path}`, {
      ...init,
      headers: {
        authkey,
        accept: 'application/json',
        ...(init.headers || {}),
      },
    });

    const raw = await response.text();
    let parsed: Msg91Response | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as Msg91Response) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok || (parsed?.type && parsed.type !== 'success')) {
      const detail = parsed?.message || raw || `HTTP ${response.status}`;
      this.logger.error(`MSG91 ${path} failed: ${detail}`);
      throw new HttpException(
        {
          code: ErrorCode.INTERNAL_ERROR,
          message:
            parsed?.message ||
            "We couldn't send the OTP right now. Check MSG91 template/DLT settings and try again.",
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return parsed;
  }

  /** MSG91 generates and sends the 4-digit OTP (required for India DLT). */
  async sendOtp(phone: string) {
    const templateId = this.requireTemplateId();
    const mobile = this.normalizeMobile(phone);
    if (mobile.length < 11) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'Enter a valid mobile number.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const params = new URLSearchParams({
      template_id: templateId,
      mobile,
      otp_length: '4',
      otp_expiry: '5',
    });

    try {
      const parsed = await this.callMsg91(`/api/v5/otp?${params.toString()}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      this.logger.log(`MSG91 OTP requested for ${mobile} (request_id=${parsed?.request_id || 'n/a'})`);
      return parsed?.request_id || null;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`MSG91 send OTP error: ${detail}`);
      throw new HttpException(
        {
          code: ErrorCode.INTERNAL_ERROR,
          message: "We couldn't send the OTP right now. Please try again later.",
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async verifyOtp(phone: string, otp: string) {
    const mobile = this.normalizeMobile(phone);
    const params = new URLSearchParams({ mobile, otp: otp.trim() });

    try {
      await this.callMsg91(`/api/v5/otp/verify?${params.toString()}`, { method: 'GET' });
      this.logger.log(`MSG91 OTP verified for ${mobile}`);
      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        const status = error.getStatus();
        if (status === HttpStatus.BAD_GATEWAY) {
          throw new HttpException(
            { code: ErrorCode.INVALID_OTP, message: 'Incorrect OTP. Please check the code and try again.' },
            HttpStatus.BAD_REQUEST,
          );
        }
        throw error;
      }
      throw new HttpException(
        { code: ErrorCode.INVALID_OTP, message: 'Incorrect OTP. Please check the code and try again.' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
