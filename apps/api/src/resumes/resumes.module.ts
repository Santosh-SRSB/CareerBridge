import { Module } from '@nestjs/common';
import { ResumesController } from './resumes.controller';
import { ParseResumeController } from './parse-resume.controller';
import { ResumesService } from './resumes.service';
import { ResumeOptimizeAi } from './resume-optimize-ai';
import { ResumeExtractorService } from './resume-extractor.service';
import { ResumeProcessorService } from './resume-processor.service';
import { ParseResumePipeline } from './parse-resume.pipeline';
import { CloudTasksService } from '../common/tasks/cloud-tasks.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [IntelligenceModule, StorageModule],
  controllers: [ResumesController, ParseResumeController],
  providers: [
    ResumesService,
    ResumeOptimizeAi,
    ResumeExtractorService,
    ResumeProcessorService,
    ParseResumePipeline,
    CloudTasksService,
  ],
  exports: [ResumesService, ParseResumePipeline],
})
export class ResumesModule {}
