import { Module } from '@nestjs/common';
import { EmployersController } from './employers.controller';
import { EmployersService } from './employers.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { MatchingModule } from '../matching/matching.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ResumesModule } from '../resumes/resumes.module';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { TestimonialsModule } from '../testimonials/testimonials.module';

@Module({
  imports: [
    IntelligenceModule,
    MatchingModule,
    WhatsAppModule,
    NotificationsModule,
    ResumesModule,
    AuthModule,
    JobsModule,
    TestimonialsModule,
  ],
  controllers: [EmployersController],
  providers: [EmployersService],
})
export class EmployersModule {}
