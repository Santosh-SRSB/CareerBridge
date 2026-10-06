import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type * as SMTPTransport from 'nodemailer/lib/smtp-transport';
import { ErrorCode } from '@careerbridge/shared';
import {
  EMAIL_BRAND_NAME,
  emailButton,
  emailLink,
  emailNote,
  emailParagraph,
  escapeHtml,
  renderBrandedEmail,
  resolveEmailLogoUrl,
} from './email-layout';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get('SMTP_USER') && this.config.get('SMTP_PASS'));
  }

  async sendOtp(to: string, otp: string) {
    if (!this.isConfigured()) {
      this.logger.error('Email OTP requested but SMTP credentials are not configured.');
      throw new HttpException(
        {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Email verification is temporarily unavailable. Please try again later.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      await this.sendMail(
        to,
        `${otp} is your ${EMAIL_BRAND_NAME} verification code`,
        `Your ${EMAIL_BRAND_NAME} OTP is ${otp}. It expires in 5 minutes. If you did not request this, ignore this email.`,
        [
          emailParagraph('Use this one-time password to verify your email.'),
          emailParagraph(escapeHtml(otp), 'font-size:32px;letter-spacing:6px;font-weight:700;color:#004043;'),
          emailNote('This code expires in 5 minutes. If you did not request this, ignore this email.'),
        ].join(''),
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
        [
          emailParagraph(`Hi ${escapeHtml(input.name)},`),
          emailParagraph(
            `Your <strong>human interview</strong> for <strong>${escapeHtml(input.jobRole)}</strong> is booked for <strong>${escapeHtml(input.whenLabel)}</strong>.`,
          ),
          emailParagraph('The live link opens <strong>only 5 minutes before</strong> this time.'),
          emailButton('Join live room', input.joinUrl),
          emailNote('After the call we generate a transcript and score. Video is not saved.'),
        ].join(''),
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
        [
          emailParagraph(`Hi ${escapeHtml(greeting)},`),
          emailParagraph(
            `Please interview <strong>${escapeHtml(input.candidateName)}</strong> for <strong>${escapeHtml(input.jobRole)}</strong> at <strong>${escapeHtml(input.whenLabel)}</strong>.`,
          ),
          emailParagraph('The live link opens <strong>only 5 minutes before</strong> this time.'),
          emailButton('Join as interviewer', input.joinUrl),
          emailNote('No CareerBridge account needed. Live video is not stored.'),
        ].join(''),
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
        [
          emailParagraph(`Hi ${escapeHtml(input.candidateName)},`),
          emailParagraph(
            `Your interview with <strong>${escapeHtml(input.companyName)}</strong> for <strong>${escapeHtml(input.jobTitle)}</strong> is <strong>confirmed</strong> for <strong>${escapeHtml(input.whenLabel)}</strong>.`,
          ),
          emailButton('Start meeting', input.meetingUrl),
          emailNote('You can also copy the link from your CareerBridge interview page.'),
        ].join(''),
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
        ? emailParagraph(`<strong>Venue:</strong> ${escapeHtml(location)}`)
        : mode === 'PHONE' && location
          ? emailParagraph(`<strong>Dial-in:</strong> ${escapeHtml(location)}`)
          : '';

    try {
      return await this.sendMail(
        input.to,
        `Interview scheduled — ${input.jobTitle}`,
        `Hi ${input.candidateName},\n\n${input.companyName} scheduled an interview for ${input.jobTitle} on ${input.whenLabel}.\n\n${detailsLines.join('\n')}\n`,
        [
          emailParagraph(`Hi ${escapeHtml(input.candidateName)},`),
          emailParagraph(
            `<strong>${escapeHtml(input.companyName)}</strong> scheduled an interview for <strong>${escapeHtml(input.jobTitle)}</strong> on <strong>${escapeHtml(input.whenLabel)}</strong>.`,
          ),
          locationHtml,
          emailButton(ctaLabel, joinUrl),
          emailNote(emailLink('View details and confirm in CareerBridge', input.portalUrl)),
        ].join(''),
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
        `Hi ${input.employerName},\n\n${input.candidateName} shared new availability for the ${input.jobTitle} interview.\n\nCandidate proposed time: ${input.preferredLabel}\n\nSchedule the interview: ${input.portalUrl}\n`,
        [
          emailParagraph(`Hi ${escapeHtml(input.employerName)},`),
          emailParagraph(
            `<strong>${escapeHtml(input.candidateName)}</strong> shared new availability for the <strong>${escapeHtml(input.jobTitle)}</strong> interview.`,
          ),
          emailParagraph(`Candidate proposed time: <strong>${escapeHtml(input.preferredLabel)}</strong>`),
          emailButton('Review in portal', input.portalUrl),
        ].join(''),
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
    /** Only for a confirmed time; a proposed new time links to the portal instead. */
    meetingUrl: string | null;
    portalUrl: string;
    approved: boolean;
  }) {
    const subject = input.approved
      ? `Reschedule approved — ${input.jobTitle}`
      : `Interview rescheduled — ${input.jobTitle}`;
    const lead = input.approved
      ? `Your preferred time was approved. The interview is confirmed for ${input.whenLabel}.`
      : `${input.companyName} proposed a new time for ${input.jobTitle}: ${input.whenLabel}. Please confirm in CareerBridge.`;
    const href = (input.approved && input.meetingUrl) || input.portalUrl;
    const linkLine = input.approved && input.meetingUrl ? `Meeting link: ${input.meetingUrl}` : `Confirm the new time: ${input.portalUrl}`;
    try {
      return await this.sendMail(
        input.to,
        subject,
        `Hi ${input.candidateName},\n\n${lead}\n\n${linkLine}\n`,
        [
          emailParagraph(`Hi ${escapeHtml(input.candidateName)},`),
          emailParagraph(escapeHtml(lead)),
          emailButton('Open interview', href),
        ].join(''),
      );
    } catch {
      this.logger.error('Failed to send candidate reschedule update email');
      return false;
    }
  }

  async sendEmployerInterviewCancelled(input: {
    to: string;
    candidateName: string;
    companyName: string;
    jobTitle: string;
    whenLabel: string;
    reason?: string | null;
  }) {
    const lead = `${input.companyName} cancelled your interview for ${input.jobTitle} scheduled for ${input.whenLabel}.`;
    const reason = input.reason?.trim();
    try {
      return await this.sendMail(
        input.to,
        `Interview cancelled — ${input.jobTitle}`,
        `Hi ${input.candidateName},\n\n${lead}\n${reason ? `\nReason: ${reason}\n` : ''}\nYou can see the update in CareerBridge.\n`,
        [
          emailParagraph(`Hi ${escapeHtml(input.candidateName)},`),
          emailParagraph(escapeHtml(lead)),
          reason ? emailParagraph(`Reason: ${escapeHtml(reason)}`) : '',
        ].join(''),
      );
    } catch {
      this.logger.error('Failed to send interview cancellation email');
      return false;
    }
  }

  /** SMTP_FROM (default "SRSB CareerBridge <SMTP_USER>") and optional SMTP_REPLY_TO. */
  senderHeaders() {
    const user = this.config.get<string>('SMTP_USER') || '';
    const from = this.config.get<string>('SMTP_FROM')?.trim() || `${EMAIL_BRAND_NAME} <${user}>`;
    const replyTo = this.config.get<string>('SMTP_REPLY_TO')?.trim() || undefined;
    return { from, replyTo };
  }

  renderHtml(subject: string, bodyHtml: string) {
    return renderBrandedEmail({
      title: subject,
      bodyHtml,
      logoUrl: resolveEmailLogoUrl({
        EMAIL_LOGO_URL: this.config.get<string>('EMAIL_LOGO_URL'),
        PUBLIC_WEB_URL: this.config.get<string>('PUBLIC_WEB_URL'),
      }),
      supportEmail: this.senderHeaders().replyTo,
    });
  }

  protected createTransport(options: SMTPTransport.Options) {
    return nodemailer.createTransport(options);
  }

  private async sendMail(to: string, subject: string, text: string, bodyHtml: string) {
    if (!this.isConfigured()) {
      this.logger.error(`Email not sent ("${subject}"): SMTP is not configured (SMTP_USER / SMTP_PASS missing).`);
      return false;
    }
    const host = this.config.get('SMTP_HOST') || 'smtp.gmail.com';
    const port = Number(this.config.get('SMTP_PORT') || 587);
    const user = this.config.get<string>('SMTP_USER')!;
    const pass = this.config.get<string>('SMTP_PASS')!;
    const { from, replyTo } = this.senderHeaders();
    const transporter = this.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user, pass },
      tls: {
        minVersion: 'TLSv1.2',
      },
    });
    await transporter.sendMail({ from, to, subject, text, html: this.renderHtml(subject, bodyHtml), ...(replyTo ? { replyTo } : {}) });
    return true;
  }
}
