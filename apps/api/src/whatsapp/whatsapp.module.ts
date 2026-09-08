import { Module } from '@nestjs/common';
import { CloudTasksService } from '../common/tasks/cloud-tasks.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppAdminController } from './whatsapp.admin.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookService } from './whatsapp.webhook.service';
import { InterviewWhatsAppService } from './interview-whatsapp.service';

@Module({
  controllers: [WhatsAppController, WhatsAppAdminController],
  providers: [WhatsAppService, WhatsAppWebhookService, InterviewWhatsAppService, CloudTasksService],
  exports: [WhatsAppService, WhatsAppWebhookService, InterviewWhatsAppService],
})
export class WhatsAppModule {}
