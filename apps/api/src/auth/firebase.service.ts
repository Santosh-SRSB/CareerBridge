import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      this.app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
          });
    } else {
      this.logger.warn('Firebase Admin is not configured. OTP will require AUTH_DEV_OTP=true.');
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
}
