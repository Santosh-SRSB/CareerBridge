import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAccountDeletionService } from './admin-account-deletion.service';
import { AuthModule } from '../auth/auth.module';
import { EmployersModule } from '../employers/employers.module';

@Module({
  imports: [AuthModule, EmployersModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAccountDeletionService],
})
export class AdminModule {}
