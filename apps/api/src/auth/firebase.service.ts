import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import * as admin from 'firebase-admin';

type ServiceAccountShape = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {
    const fromFile = this.loadServiceAccountFile();
    const projectId =
      fromFile?.project_id || this.config.get<string>('FIREBASE_PROJECT_ID') || undefined;
    const clientEmail =
      fromFile?.client_email || this.config.get<string>('FIREBASE_CLIENT_EMAIL') || undefined;
    const privateKey = (
      fromFile?.private_key || this.config.get<string>('FIREBASE_PRIVATE_KEY') || ''
    ).replace(/\\n/g, '\n');

    if (admin.apps.length) {
      this.app = admin.app();
      this.logger.log(`Firebase Admin reusing existing app for project ${projectId || 'default'}`);
      return;
    }

    if (projectId && clientEmail && privateKey) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
      this.logger.log(`Firebase Admin initialized with service-account cert for ${projectId}`);
      return;
    }

    // Cloud Run / GCE: prefer Application Default Credentials (runtime SA).
    const gcpProject =
      this.config.get<string>('GCP_PROJECT_ID') ||
      this.config.get<string>('FIREBASE_PROJECT_ID') ||
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT;
    try {
      this.app = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        ...(gcpProject ? { projectId: gcpProject } : {}),
      });
      this.logger.log(
        `Firebase Admin initialized with Application Default Credentials${gcpProject ? ` (${gcpProject})` : ''}`,
      );
    } catch (err) {
      this.app = null;
      this.logger.warn(
        `Firebase Admin is not configured (${err instanceof Error ? err.message : String(err)}). ` +
          'Set FIREBASE_* / FIREBASE_SERVICE_ACCOUNT_PATH, or run on GCP with a runtime service account.',
      );
    }
  }

  private loadServiceAccountFile(): ServiceAccountShape | null {
    const configured = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (!configured?.trim()) return null;
    const path = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
    if (!existsSync(path)) {
      this.logger.warn(`FIREBASE_SERVICE_ACCOUNT_PATH not found: ${path}`);
      return null;
    }
    try {
      let text = readFileSync(path, 'utf8');
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      text = text.replace(/^\uFEFF/, '').replace(/^\?+/, '').trim();
      return JSON.parse(text) as ServiceAccountShape;
    } catch (err) {
      this.logger.warn(
        `Could not read FIREBASE_SERVICE_ACCOUNT_PATH: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  isConfigured() {
    return Boolean(this.app);
  }

  async verifyIdToken(idToken: string) {
    if (!this.app) {
      throw new ServiceUnavailableException({
        code: 'INTERNAL_ERROR',
        message:
          'Phone OTP verification is not available on the server. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_* in apps/api/.env, then restart the API.',
      });
    }
    try {
      return await this.app.auth().verifyIdToken(idToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`verifyIdToken failed: ${msg}`);
      throw new ServiceUnavailableException({
        code: 'UNAUTHORIZED',
        message: 'We could not verify your OTP with Firebase. Request a new OTP and try again.',
      });
    }
  }

  /**
   * Send FCM push to one or more device tokens. Invalid tokens are returned for cleanup.
   */
  async sendPush(input: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<{ successCount: number; invalidTokens: string[] }> {
    if (!this.app || !input.tokens.length) {
      return { successCount: 0, invalidTokens: [] };
    }

    const invalidTokens: string[] = [];
    let successCount = 0;

    try {
      const response = await this.app.messaging().sendEachForMulticast({
        tokens: input.tokens,
        notification: {
          title: input.title,
          body: input.body,
        },
        data: {
          ...(input.data || {}),
        },
        webpush: {
          fcmOptions: {
            link: input.data?.link || '/notifications',
          },
          notification: {
            title: input.title,
            body: input.body,
            icon: '/srsb-mark.png',
          },
        },
      });

      successCount = response.successCount;
      response.responses.forEach((result, index) => {
        if (result.success) return;
        const code = result.error?.code || '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token') ||
          code.includes('invalid-argument')
        ) {
          invalidTokens.push(input.tokens[index]);
        } else {
          this.logger.warn(`FCM send failed: ${code} ${result.error?.message || ''}`);
        }
      });
    } catch (err) {
      this.logger.warn(`FCM multicast failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { successCount, invalidTokens };
  }
}
