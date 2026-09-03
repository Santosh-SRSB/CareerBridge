import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [IntelligenceModule, MatchingModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
