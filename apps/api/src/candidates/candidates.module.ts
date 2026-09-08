import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { MatchingModule } from '../matching/matching.module';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [MatchingModule, StorageModule],
  controllers: [CandidatesController],
  providers: [CandidatesService],
})
export class CandidatesModule {}
