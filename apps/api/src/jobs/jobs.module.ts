import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [IntelligenceModule, NotificationsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
