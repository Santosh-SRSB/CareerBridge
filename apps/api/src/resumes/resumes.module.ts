import { Module } from '@nestjs/common';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import { ResumeOptimizeAi } from './resume-optimize-ai';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [IntelligenceModule],
  controllers: [ResumesController],
  providers: [ResumesService, ResumeOptimizeAi],
})
export class ResumesModule {}
