import { Module } from '@nestjs/common';
import { EmployersController } from './employers.controller';
import { EmployersService } from './employers.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [IntelligenceModule, MatchingModule],
  controllers: [EmployersController],
  providers: [EmployersService],
})
export class EmployersModule {}
