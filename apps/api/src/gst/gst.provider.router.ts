import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IrisIrpGstProvider, type GstProviderLookupResult } from './gst.provider';
import { GstinApiProvider } from './gst.provider.gstinapi';

/**
 * Routes GST lookups:
 * 1. gstinapi.in when GSTINAPI_KEY is set (recommended for demos / low volume)
 * 2. IRIS IRP / local mock otherwise
 */
@Injectable()
export class GstProviderRouter {
  private readonly logger = new Logger(GstProviderRouter.name);

  constructor(
    private readonly config: ConfigService,
    private readonly iris: IrisIrpGstProvider,
    private readonly gstinApi: GstinApiProvider,
  ) {
    if (this.gstinApi.isConfigured()) {
      this.logger.log('GST provider: gstinapi.in (GSTINAPI_KEY configured)');
    } else {
      this.logger.log('GST provider: IRIS IRP / mock (set GSTINAPI_KEY to use gstinapi.in)');
    }
  }

  async getGstinDetails(gstin: string): Promise<GstProviderLookupResult> {
    if (this.gstinApi.isConfigured()) {
      return this.gstinApi.getGstinDetails(gstin);
    }
    return this.iris.getGstinDetails(gstin);
  }

  activeProviderName() {
    return this.gstinApi.isConfigured() ? 'GSTINAPI' : 'IRIS_IRP';
  }
}
