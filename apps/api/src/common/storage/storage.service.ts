import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UploadOptions {
  contentType?: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

export interface SignedUrlOptions {
  action: 'read' | 'write';
  expiresInMinutes?: number;
  contentType?: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private storageClient: any = null;
  private bucketName: string;
  private projectId: string;

  constructor(private readonly config: ConfigService) {
    this.bucketName = this.config.get<string>('GCS_BUCKET', 'srsbbucket');
    this.projectId = this.config.get<string>('GCP_PROJECT_ID', '');
    this.initClient();
  }

  private async initClient() {
    try {
      // Dynamic import to allow running even if @google-cloud/storage is not installed yet
      // Uses Google Cloud Application Default Credentials (ADC)
      const { Storage } = await import('@google-cloud/storage');
      this.storageClient = new Storage({
        projectId: this.projectId || undefined,
      });
      this.logger.log(`Initialized Google Cloud Storage client for bucket: ${this.bucketName}`);
    } catch (err) {
      this.logger.warn(
        `Google Cloud Storage SDK not loaded (${(err as Error).message}). Storage operations will operate in fallback mode.`,
      );
    }
  }

  /**
   * Check if GCS client is ready
   */
  isConfigured(): boolean {
    return Boolean(this.storageClient);
  }

  /**
   * Upload buffer directly to GCS
   */
  async uploadFile(
    destinationPath: string,
    buffer: Buffer,
    options?: UploadOptions,
  ): Promise<{ publicUrl: string; gcsUri: string }> {
    if (!this.storageClient) {
      this.logger.warn(`GCS not initialized, returning virtual URL for: ${destinationPath}`);
      return {
        publicUrl: `https://storage.googleapis.com/${this.bucketName}/${destinationPath}`,
        gcsUri: `gs://${this.bucketName}/${destinationPath}`,
      };
    }

    const bucket = this.storageClient.bucket(this.bucketName);
    const file = bucket.file(destinationPath);

    await file.save(buffer, {
      contentType: options?.contentType || 'application/octet-stream',
      metadata: options?.metadata,
      resumable: false,
    });

    return {
      publicUrl: `https://storage.googleapis.com/${this.bucketName}/${destinationPath}`,
      gcsUri: `gs://${this.bucketName}/${destinationPath}`,
    };
  }

  /**
   * Generate a signed V4 URL for secure client uploads or temporary downloads
   * (Volume 2 HLD Section 2.10.4)
   */
  async getSignedUrl(
    filePath: string,
    options: SignedUrlOptions = { action: 'read', expiresInMinutes: 15 },
  ): Promise<string> {
    if (!this.storageClient) {
      return `https://storage.googleapis.com/${this.bucketName}/${filePath}`;
    }

    const bucket = this.storageClient.bucket(this.bucketName);
    const file = bucket.file(filePath);
    const expires = Date.now() + (options.expiresInMinutes || 15) * 60 * 1000;

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: options.action,
      expires,
      contentType: options.contentType,
    });

    return url;
  }

  /**
   * Delete a file from GCS
   */
  async deleteFile(filePath: string): Promise<boolean> {
    if (!this.storageClient) return false;
    try {
      const bucket = this.storageClient.bucket(this.bucketName);
      await bucket.file(filePath).delete();
      return true;
    } catch (err) {
      this.logger.error(`Failed to delete file from GCS: ${(err as Error).message}`);
      return false;
    }
  }
}
