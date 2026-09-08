import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { UserType } from '../prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookService } from './whatsapp.webhook.service';
import { InterviewWhatsAppService } from './interview-whatsapp.service';
import type { ReminderKind } from './whatsapp.types';

class SendTestDto {
  @IsString()
  @MinLength(8)
  to!: string;

  @IsOptional()
  @IsString()
  body?: string;
}

class SendInviteDto {
  @IsString()
  @MinLength(2)
  candidateName!: string;

  @IsString()
  @MinLength(8)
  to!: string;

  @IsString()
  @MinLength(2)
  jobTitle!: string;

  @IsString()
  interviewDate!: string;

  @IsString()
  interviewTime!: string;

  @IsOptional()
  @IsString()
  interviewId?: string;

  @IsOptional()
  durationMin?: number;
}

class SimulateWebhookDto {
  @IsIn(['CONFIRM', 'RESCHEDULE', 'SLOT', 'DECLINE'])
  action!: 'CONFIRM' | 'RESCHEDULE' | 'SLOT' | 'DECLINE';

  @IsString()
  interviewId!: string;

  @IsOptional()
  @IsString()
  slotIso?: string;

  @IsOptional()
  @IsString()
  fromPhone?: string;
}

class ReminderDto {
  @IsString()
  interviewId!: string;

  @IsIn(['24h', '2h', '15m'])
  kind!: ReminderKind;
}

@ApiTags('admin-whatsapp')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
@Controller('admin/integrations/whatsapp')
export class WhatsAppAdminController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly webhook: WhatsAppWebhookService,
    private readonly interviewNotify: InterviewWhatsAppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  status() {
    return {
      connection: this.whatsapp.getConnectionStatus(),
      events: this.whatsapp.events.list(40),
    };
  }

  @Get('events')
  events(@Query('limit') limit?: string) {
    return { items: this.whatsapp.events.list(Number(limit) || 50) };
  }

  @Post('events/clear')
  clearEvents() {
    this.whatsapp.events.clear();
    return { ok: true };
  }

  @Post('test/connection')
  testConnection() {
    return this.whatsapp.testConnection();
  }

  @Post('test/send')
  async sendTest(@Body() dto: SendTestDto) {
    return this.whatsapp.sendText({
      to: dto.to,
      body: dto.body || 'This is a test message from the CareerBridge Resume & Jobs platform.',
      messageType: 'test_text',
    });
  }

  @Post('test/invitation')
  async sendInvitation(@Body() dto: SendInviteDto) {
    const scheduledAt = parseDateTime(dto.interviewDate, dto.interviewTime);
    const interviewId = dto.interviewId || `test_${Date.now()}`;

    // Optional: create a lightweight test interview row if a real UUID employer interview is not provided
    let persistedId = interviewId;
    if (!dto.interviewId) {
      this.whatsapp.events.push({
        kind: 'INFO',
        summary: `Test invitation without DB interview id — using ${interviewId}`,
      });
    } else {
      persistedId = dto.interviewId;
    }

    const sent = await this.whatsapp.sendInterviewInvitation({
      to: dto.to,
      candidateName: dto.candidateName,
      jobTitle: dto.jobTitle,
      scheduledAt,
      durationMin: dto.durationMin || 20,
      interviewId: persistedId,
    });
    return { ...sent, interviewId: persistedId, scheduledAt: scheduledAt.toISOString() };
  }

  @Post('test/simulate-webhook')
  simulate(@Body() dto: SimulateWebhookDto) {
    return this.webhook.simulateButton(dto);
  }

  @Post('test/reminder')
  reminder(@Body() dto: ReminderDto) {
    return this.webhook.sendReminderNow(dto.interviewId, dto.kind);
  }

  @Post('test/resend-invite')
  resend(@Body() body: { interviewId: string }) {
    return this.interviewNotify.sendInvitationNow(body.interviewId);
  }

  @Get('messages')
  async messages(@Query('limit') limit?: string) {
    const take = Math.min(Number(limit) || 30, 100);
    const rows = await this.prisma.whatsAppMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
    return { items: rows };
  }
}

function parseDateTime(dateRaw: string, timeRaw: string) {
  // Accept "2026-08-25" + "11:00" / "11:00 AM"
  const datePart = dateRaw.trim();
  let hours = 11;
  let minutes = 0;
  const ampm = timeRaw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (ampm) {
    hours = Number(ampm[1]);
    minutes = Number(ampm[2]);
    const mer = ampm[3]?.toUpperCase();
    if (mer === 'PM' && hours < 12) hours += 12;
    if (mer === 'AM' && hours === 12) hours = 0;
  }
  const iso = `${datePart}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+05:30`;
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  return value;
}
