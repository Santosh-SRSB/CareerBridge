import { Module } from '@nestjs/common';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { InterviewAiService } from './interview-ai.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [IntelligenceModule],
  controllers: [InterviewsController],
  providers: [InterviewsService, InterviewAiService],
})
export class InterviewsModule {}
