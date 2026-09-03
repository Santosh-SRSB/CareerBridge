import { Module } from '@nestjs/common';
import { GstConfigService } from './gst.config';
import { GstController } from './gst.controller';
import { IrisIrpGstProvider } from './gst.provider';
import { GstinApiProvider } from './gst.provider.gstinapi';
import { GstProviderRouter } from './gst.provider.router';
import { GstService } from './gst.service';

@Module({
  controllers: [GstController],
  providers: [
    GstConfigService,
    IrisIrpGstProvider,
    GstinApiProvider,
    GstProviderRouter,
    { provide: 'GstProvider', useExisting: GstProviderRouter },
    GstService,
  ],
  exports: [GstService],
})
export class GstModule {}
