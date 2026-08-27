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

    try {
      await this.sendMail(
        to,
        `${otp} is your CareerBridge verification code`,
        `Your CareerBridge OTP is ${otp}. It expires in 5 minutes. If you did not request this, ignore this email.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 480px; color: #123132;">
            <h1 style="color: #004043; font-size: 22px;">CareerBridge</h1>
            <p>Use this one-time password to verify your email.</p>
            <p style="font-size: 32px; letter-spacing: 6px; font-weight: 700; color: #004043;">${otp}</p>
            <p style="color: #5b6f70;">This code expires in 5 minutes.</p>
          </div>
        `,
      );
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

  async sendHumanMockInvite(input: {
    to: string;
    name: string;
    jobRole: string;
    whenLabel: string;
    joinUrl: string;
    interviewerJoinUrl: string;
  }) {
    try {
      const sent = await this.sendMail(
        input.to,
        `Your human interview is booked — ${input.jobRole}`,
        `Hi ${input.name},\n\nYour CareerBridge human interview for ${input.jobRole} is scheduled at ${input.whenLabel}.\n\nThe live link opens only 5 minutes before that time.\nJoin the live room: ${input.joinUrl}\n\nKeep your camera on and speak clearly. After the call we generate a transcript and score. Video is not saved.\n`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0c3340;">
            <h1 style="font-size: 22px;">CareerBridge</h1>
            <p>Hi ${input.name},</p>
            <p>Your <strong>human interview</strong> for <strong>${input.jobRole}</strong> is booked for <strong>${input.whenLabel}</strong>.</p>
            <p>The live link opens <strong>only 5 minutes before</strong> this time.</p>
            <p><a href="${input.joinUrl}" style="display:inline-block;background:#1ec8c0;color:#0c3340;padding:12px 18px;border-radius:999px;font-weight:700;text-decoration:none;">Join live room</a></p>
            <p style="color:#5b6f70;font-size:13px;">After the call we generate a transcript and score. Video is not saved.</p>
          </div>
        `,
      );
      if (!sent) return false;
      this.logger.log(`Human interview invite emailed to ${input.to}`);
      return true;
    } catch {
      this.logger.error('Failed to send human interview invite email');
      return false;
    }
  }

  async sendHumanInterviewInterviewerInvite(input: {
    to: string;
    interviewerName: string;
    candidateName: string;
    jobRole: string;
    whenLabel: string;
    joinUrl: string;
  }) {
    const greeting = input.interviewerName || 'there';
    try {
      const sent = await this.sendMail(
        input.to,
        `Please interview ${input.candidateName} for ${input.jobRole}`,
        `Hi ${greeting},\n\nYou are invited to a CareerBridge human interview with ${input.candidateName} for ${input.jobRole} at ${input.whenLabel}.\n\nThe live link opens only 5 minutes before that time.\nJoin the live room: ${input.joinUrl}\n\nNo account needed. Video is not recorded.\n`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0c3340;">
            <h1 style="font-size: 22px;">CareerBridge</h1>
            <p>Hi ${greeting},</p>
            <p>Please interview <strong>${input.candidateName}</strong> for <strong>${input.jobRole}</strong> at <strong>${input.whenLabel}</strong>.</p>
            <p>The live link opens <strong>only 5 minutes before</strong> this time.</p>
            <p><a href="${input.joinUrl}" style="display:inline-block;background:#1ec8c0;color:#0c3340;padding:12px 18px;border-radius:999px;font-weight:700;text-decoration:none;">Join as interviewer</a></p>
            <p style="color:#5b6f70;font-size:13px;">No CareerBridge account needed. Live video is not stored.</p>
          </div>
        `,
      );
      if (!sent) return false;
      this.logger.log(`Human interview interviewer invite emailed to ${input.to}`);
      return true;
    } catch {
      this.logger.error('Failed to send interviewer invite email');
      return false;
    }
  }

  private async sendMail(to: string, subject: string, text: string, html: string) {
    if (!this.isConfigured()) return false;
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
    await transporter.sendMail({ from, to, subject, text, html });
    return true;
  }
}
