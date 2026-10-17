import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AdminTestimonialsController,
  TestimonialsController,
} from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';

@Module({
  imports: [NotificationsModule],
  controllers: [TestimonialsController, AdminTestimonialsController],
  providers: [TestimonialsService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
