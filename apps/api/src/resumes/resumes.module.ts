import { Module } from '@nestjs/common';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import { ResumeOptimizeAi } from './resume-optimize-ai';
import { ResumeExtractorService } from './resume-extractor.service';
import { ResumeProcessorService } from './resume-processor.service';
import { CloudTasksService } from '../common/tasks/cloud-tasks.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [IntelligenceModule, StorageModule],
  controllers: [ResumesController],
  providers: [
    ResumesService,
    ResumeOptimizeAi,
    ResumeExtractorService,
    ResumeProcessorService,
    CloudTasksService,
  ],
  exports: [ResumesService],
})
export class ResumesModule {}
