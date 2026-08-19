import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ErrorCode } from '@careerbridge/shared';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get('SMTP_USER') && this.config.get('SMTP_PASS'));
  }

  async sendOtp(to: string, otp: string) {
    if (!this.isConfigured()) {
      throw new HttpException(
        {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Email OTP is not configured. Set SMTP_USER and SMTP_PASS in apps/api/.env.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const host = this.config.get('SMTP_HOST') || 'smtp.gmail.com';
    const port = Number(this.config.get('SMTP_PORT') || 587);
    const user = this.config.get<string>('SMTP_USER')!;
    const pass = this.config.get<string>('SMTP_PASS')!;
    const from = this.config.get('SMTP_FROM') || `CareerBridge <${user}>`;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({
        from,
        to,
        subject: `${otp} is your CareerBridge verification code`,
        text: `Your CareerBridge OTP is ${otp}. It expires in 5 minutes. If you did not request this, ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; color: #123132;">
            <h1 style="color: #004043; font-size: 22px;">CareerBridge</h1>
            <p>Use this one-time password to verify your email.</p>
            <p style="font-size: 32px; letter-spacing: 6px; font-weight: 700; color: #004043;">${otp}</p>
            <p style="color: #5b6f70;">This code expires in 5 minutes.</p>
          </div>
        `,
      });
      this.logger.log(`OTP email sent to ${to}`);
    } catch {
      this.logger.error('Failed to send OTP email');
      throw new HttpException(
        {
          code: ErrorCode.INTERNAL_ERROR,
          message:
            'We could not send the email OTP. Check SMTP settings, or use a Gmail App Password.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
