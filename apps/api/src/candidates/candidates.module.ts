import { CatalogModule } from '../catalog/catalog.module';
import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { MatchingModule } from '../matching/matching.module';
import { StorageModule } from '../common/storage/storage.module';
import { TestimonialsModule } from '../testimonials/testimonials.module';

@Module({
  imports: [MatchingModule, StorageModule, TestimonialsModule, CatalogModule],
  controllers: [CandidatesController],
  providers: [CandidatesService],
})
export class CandidatesModule {}
