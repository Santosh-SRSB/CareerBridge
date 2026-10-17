import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CatalogAdminController, CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CatalogController, CatalogAdminController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
