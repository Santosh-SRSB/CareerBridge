import { Module } from '@nestjs/common';
import { GstConfigService } from './gst.config';
import { GstController } from './gst.controller';
import { IrisIrpGstProvider } from './gst.provider';
import { GstService } from './gst.service';

@Module({
  controllers: [GstController],
  providers: [GstConfigService, IrisIrpGstProvider, GstService],
  exports: [GstService],
})
export class GstModule {}
