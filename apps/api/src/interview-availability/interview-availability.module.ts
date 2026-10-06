import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InterviewAvailabilityService } from './interview-availability.service';

@Module({
  imports: [NotificationsModule, AuthModule],
  providers: [InterviewAvailabilityService],
  exports: [InterviewAvailabilityService],
})
export class InterviewAvailabilityModule {}
