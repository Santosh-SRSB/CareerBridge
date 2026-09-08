import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

/** Matches the folders already created in the GCS bucket (flat — no nested dirs). */
export const GCS_RESUMES_FOLDER = 'resumes';
export const GCS_IMAGES_FOLDER = 'Images';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private storageClient: import('@google-cloud/storage').Storage | null = null;
  private initError: string | null = null;
  private bucketName: string;
  private projectId: string;

  constructor(private readonly config: ConfigService) {
    this.bucketName = this.config.get<string>('GCS_BUCKET', 'srsbbucket');
    this.projectId = this.config.get<string>('GCP_PROJECT_ID', '');
  }

  async onModuleInit() {
    await this.initClient();
  }

  private async initClient() {
    try {
      const { Storage } = await import('@google-cloud/storage');
      const keyFile = this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
      this.storageClient = new Storage({
        projectId: this.projectId || undefined,
        keyFilename: keyFile || undefined,
      });
      this.logger.log(
        `Google Cloud Storage ready (bucket: ${this.bucketName}, project: ${this.projectId || 'default'})`,
      );
    } catch (err) {
      this.initError = (err as Error).message;
      this.storageClient = null;
      this.logger.error(
        `Google Cloud Storage failed to initialize: ${this.initError}. ` +
          'Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.storageClient);
  }

  getConfigurationError(): string | null {
    if (this.storageClient) return null;
    return (
      this.initError ||
      'Google Cloud Storage is not configured. Install @google-cloud/storage and set GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  /**
   * Flat object key: `resumes/harsh.pdf` or `Images/photo.jpg` — never nested folders.
   * Optional uniquePart avoids collisions while staying in the same folder.
   */
  buildFlatObjectPath(
    folder: typeof GCS_RESUMES_FOLDER | typeof GCS_IMAGES_FOLDER,
    fileName: string,
    uniquePart?: string,
  ): string {
    const cleaned = (fileName || 'file')
      .replace(/\\/g, '/')
      .split('/')
      .pop()!
      .replace(/[^\w.\-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 120);

    const lastDot = cleaned.lastIndexOf('.');
    const base = lastDot > 0 ? cleaned.slice(0, lastDot) : cleaned || 'file';
    const ext = lastDot > 0 ? cleaned.slice(lastDot) : '';
    const unique = uniquePart?.replace(/[^\w.\-]+/g, '_').slice(0, 40);
    const finalName = unique ? `${base}-${unique}${ext}` : `${base}${ext}`;
    return `${folder}/${finalName}`;
  }

  resumeObjectPath(fileName: string, uniquePart?: string) {
    return this.buildFlatObjectPath(GCS_RESUMES_FOLDER, fileName, uniquePart);
  }

  imageObjectPath(fileName: string, uniquePart?: string) {
    return this.buildFlatObjectPath(GCS_IMAGES_FOLDER, fileName, uniquePart);
  }

  async uploadFile(
    destinationPath: string,
    buffer: Buffer,
    options?: UploadOptions,
  ): Promise<{ publicUrl: string; gcsUri: string }> {
    if (!this.storageClient) {
      const message = this.getConfigurationError() || 'Google Cloud Storage is not configured.';
      this.logger.error(`GCS upload skipped for ${destinationPath}: ${message}`);
      throw new Error(message);
    }

    try {
      const bucket = this.storageClient.bucket(this.bucketName);
      const file = bucket.file(destinationPath);

      await file.save(buffer, {
        contentType: options?.contentType || 'application/octet-stream',
        metadata: options?.metadata,
        resumable: false,
      });

      const gcsUri = `gs://${this.bucketName}/${destinationPath}`;
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${destinationPath}`;
      this.logger.log(`Uploaded ${destinationPath} to ${gcsUri} (${buffer.length} bytes)`);
      return { publicUrl, gcsUri };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`GCS upload failed for ${destinationPath}: ${message}`);
      throw new Error(`Failed to upload file to Google Cloud Storage: ${message}`);
    }
  }

  async getSignedUrl(
    filePath: string,
    options: SignedUrlOptions = { action: 'read', expiresInMinutes: 15 },
  ): Promise<string> {
    if (!this.storageClient) {
      throw new Error(this.getConfigurationError() || 'Google Cloud Storage is not configured.');
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

  async deleteFile(filePath: string): Promise<boolean> {
    if (!this.storageClient) return false;
    try {
      const bucket = this.storageClient.bucket(this.bucketName);
      await bucket.file(filePath).delete();
      this.logger.log(`Deleted ${filePath} from GCS`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to delete file from GCS (${filePath}): ${(err as Error).message}`);
      return false;
    }
  }
}
