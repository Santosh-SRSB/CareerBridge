import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookService } from './whatsapp.webhook.service';
import { InterviewWhatsAppService } from './interview-whatsapp.service';
import type { ReminderKind } from './whatsapp.types';

@ApiTags('whatsapp')
@SkipThrottle()
@Controller()
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly webhook: WhatsAppWebhookService,
    private readonly interviewNotify: InterviewWhatsAppService,
  ) {}

  /**
   * Meta webhook verification.
   * Callback URL (either works):
   *   https://<host>/api/v1/whatsapp/webhook
   *   https://<host>/api/v1/webhooks/whatsapp
   */
  @Public()
  @Get(['whatsapp/webhook', 'webhooks/whatsapp'])
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verified = this.whatsapp.verifyWebhook(mode, verifyToken, challenge);
    if (!verified) throw new ForbiddenException('Webhook verification failed.');
    return res.status(200).contentType('text/plain').send(String(verified));
  }

  /** Incoming WhatsApp messages and delivery status updates. */
  @Public()
  @Post(['whatsapp/webhook', 'webhooks/whatsapp'])
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: false }))
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const raw = req.rawBody;
    if (!this.whatsapp.validateSignature(raw, signature)) {
      throw new ForbiddenException('Invalid WhatsApp webhook signature.');
    }
    await this.webhook.handleWebhook(body);
    return { status: 'received' };
  }

  /** Cloud Tasks worker entry (optional). Protected by shared secret. */
  @Public()
  @Post('whatsapp/tasks/run')
  @HttpCode(200)
  async runTask(
    @Headers('x-whatsapp-task-secret') secret: string | undefined,
    @Body() body: { type?: string; interviewId?: string; kind?: ReminderKind },
  ) {
    const expected = process.env.WHATSAPP_TASK_SECRET || '';
    if (expected && secret !== expected) {
      throw new ForbiddenException('Invalid task secret.');
    }
    if (body.type === 'interview_invitation' && body.interviewId) {
      return this.interviewNotify.sendInvitationNow(body.interviewId);
    }
    if (body.type === 'interview_reminder' && body.interviewId && body.kind) {
      return this.webhook.sendReminderNow(body.interviewId, body.kind);
    }
    return { ok: false, reason: 'unknown_task' };
  }
}
