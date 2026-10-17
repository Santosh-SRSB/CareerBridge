import { Module } from '@nestjs/common';
import { HumanMocksController } from './human-mocks.controller';
import { HumanMocksService } from './human-mocks.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [IntelligenceModule, AuthModule],
  controllers: [HumanMocksController],
  providers: [HumanMocksService],
})
export class HumanMocksModule {}
