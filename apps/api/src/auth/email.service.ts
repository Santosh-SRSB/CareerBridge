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
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send OTP email: ${detail}`);
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

  async sendEmployerInterviewConfirmation(input: {
    to: string;
    candidateName: string;
    companyName: string;
    jobTitle: string;
    whenLabel: string;
    meetingUrl: string;
  }) {
    try {
      return await this.sendMail(
        input.to,
        `Interview confirmed — ${input.jobTitle}`,
        `Hi ${input.candidateName},\n\nYour interview with ${input.companyName} for ${input.jobTitle} is confirmed for ${input.whenLabel}.\n\nStart / join: ${input.meetingUrl}\n`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0c3340;">
            <h1 style="font-size: 22px;">CareerBridge</h1>
            <p>Hi ${input.candidateName},</p>
            <p>Your interview with <strong>${input.companyName}</strong> for <strong>${input.jobTitle}</strong> is <strong>confirmed</strong> for <strong>${input.whenLabel}</strong>.</p>
            <p><a href="${input.meetingUrl}" style="display:inline-block;background:#25d366;color:#fff;padding:12px 18px;border-radius:999px;font-weight:700;text-decoration:none;">Start meeting</a></p>
            <p style="color:#5b6f70;font-size:13px;">You can also copy the link from your CareerBridge interview page.</p>
          </div>
        `,
      );
    } catch {
      this.logger.error('Failed to send interview confirmation email');
      return false;
    }
  }

  async sendEmployerInterviewScheduled(input: {
    to: string;
    candidateName: string;
    companyName: string;
    jobTitle: string;
    whenLabel: string;
    mode: string;
    portalUrl: string;
    meetingUrl: string;
    location?: string | null;
  }) {
    const mode = (input.mode || 'VIDEO').toUpperCase();
    const location = (input.location || '').trim();
    const joinUrl = /^https?:\/\//i.test(location) ? location : input.meetingUrl;
    const detailsLines: string[] = [];
    if (mode === 'IN_PERSON' && location) detailsLines.push(`Venue: ${location}`);
    if (mode === 'PHONE' && location) detailsLines.push(`Dial-in: ${location}`);
    if (mode === 'VIDEO' || /^https?:\/\//i.test(location)) {
      detailsLines.push(`Meeting link: ${joinUrl}`);
    }
    detailsLines.push(`View / confirm in CareerBridge: ${input.portalUrl}`);

    const ctaLabel = mode === 'VIDEO' || /^https?:\/\//i.test(location) ? 'Join meeting' : 'Open interview';
    const locationHtml =
      mode === 'IN_PERSON' && location
        ? `<p><strong>Venue:</strong> ${location}</p>`
        : mode === 'PHONE' && location
          ? `<p><strong>Dial-in:</strong> ${location}</p>`
          : '';

    try {
      return await this.sendMail(
        input.to,
        `Interview scheduled — ${input.jobTitle}`,
        `Hi ${input.candidateName},\n\n${input.companyName} scheduled an interview for ${input.jobTitle} on ${input.whenLabel}.\n\n${detailsLines.join('\n')}\n`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0c3340;">
            <h1 style="font-size: 22px;">CareerBridge</h1>
            <p>Hi ${input.candidateName},</p>
            <p><strong>${input.companyName}</strong> scheduled an interview for <strong>${input.jobTitle}</strong> on <strong>${input.whenLabel}</strong>.</p>
            ${locationHtml}
            <p><a href="${joinUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 18px;border-radius:999px;font-weight:700;text-decoration:none;">${ctaLabel}</a></p>
            <p style="color:#5b6f70;font-size:13px;"><a href="${input.portalUrl}" style="color:#0f766e;">View details and confirm in CareerBridge</a></p>
          </div>
        `,
      );
    } catch {
      this.logger.error('Failed to send interview scheduled email');
      return false;
    }
  }

  async sendEmployerInterviewRescheduleRequest(input: {
    to: string;
    employerName: string;
    candidateName: string;
    jobTitle: string;
    preferredLabel: string;
    portalUrl: string;
  }) {
    try {
      return await this.sendMail(
        input.to,
        `Reschedule request — ${input.jobTitle}`,
        `Hi ${input.employerName},\n\n${input.candidateName} requested to reschedule the interview for ${input.jobTitle} to ${input.preferredLabel}.\n\nApprove or propose another time: ${input.portalUrl}\n`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0c3340;">
            <h1 style="font-size: 22px;">CareerBridge</h1>
            <p>Hi ${input.employerName},</p>
            <p><strong>${input.candidateName}</strong> requested to reschedule the interview for <strong>${input.jobTitle}</strong> to <strong>${input.preferredLabel}</strong>.</p>
            <p><a href="${input.portalUrl}" style="display:inline-block;background:#004043;color:#fff;padding:12px 18px;border-radius:999px;font-weight:700;text-decoration:none;">Review in portal</a></p>
          </div>
        `,
      );
    } catch {
      this.logger.error('Failed to send employer reschedule email');
      return false;
    }
  }

  async sendEmployerInterviewRescheduleUpdate(input: {
    to: string;
    candidateName: string;
    companyName: string;
    jobTitle: string;
    whenLabel: string;
    meetingUrl: string;
    approved: boolean;
  }) {
    const subject = input.approved
      ? `Reschedule approved — ${input.jobTitle}`
      : `Interview rescheduled — ${input.jobTitle}`;
    const lead = input.approved
      ? `Your preferred time was approved. The interview is confirmed for ${input.whenLabel}.`
      : `${input.companyName} proposed a new time for ${input.jobTitle}: ${input.whenLabel}. Please confirm in CareerBridge.`;
    try {
      return await this.sendMail(
        input.to,
        subject,
        `Hi ${input.candidateName},\n\n${lead}\n\nMeeting link: ${input.meetingUrl}\n`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0c3340;">
            <h1 style="font-size: 22px;">CareerBridge</h1>
            <p>Hi ${input.candidateName},</p>
            <p>${lead}</p>
            <p><a href="${input.meetingUrl}" style="display:inline-block;background:#1ec8c0;color:#0c3340;padding:12px 18px;border-radius:999px;font-weight:700;text-decoration:none;">Open interview</a></p>
          </div>
        `,
      );
    } catch {
      this.logger.error('Failed to send candidate reschedule update email');
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
      requireTLS: port === 587,
      auth: { user, pass },
      tls: {
        minVersion: 'TLSv1.2',
      },
    });
    await transporter.sendMail({ from, to, subject, text, html });
    return true;
  }
}
