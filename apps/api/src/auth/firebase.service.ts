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

    if (projectId && clientEmail && privateKey) {
      this.app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
          });
      this.logger.log(`Firebase Admin initialized for project ${projectId}`);
    } else {
      this.logger.warn(
        'Firebase Admin is not configured. Set FIREBASE_* or FIREBASE_SERVICE_ACCOUNT_PATH.',
      );
    }
  }

  private loadServiceAccountFile(): ServiceAccountShape | null {
    const configured = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (!configured) return null;
    const path = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
    if (!existsSync(path)) {
      this.logger.warn(`FIREBASE_SERVICE_ACCOUNT_PATH not found: ${path}`);
      return null;
    }
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccountShape;
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
        message: 'We could not verify your number right now. Please try again.',
      });
    }
    return this.app.auth().verifyIdToken(idToken);
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
