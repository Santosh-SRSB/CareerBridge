import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CloudTasksService {
  private readonly logger = new Logger(CloudTasksService.name);
  private tasksClient: any = null;

  constructor(private readonly config: ConfigService) {
    void this.init();
  }

  private async init() {
    try {
      const { CloudTasksClient } = await import('@google-cloud/tasks');
      this.tasksClient = new CloudTasksClient({
        projectId: this.config.get<string>('GCP_PROJECT_ID') || undefined,
        keyFilename: this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS') || undefined,
      });
      this.logger.log('Cloud Tasks client initialized');
    } catch (err) {
      this.logger.warn(
        `Cloud Tasks SDK unavailable (${(err as Error).message}). Using local async fallback.`,
      );
    }
  }

  /**
   * Enqueue a resume processing job.
   * Production: Google Cloud Tasks HTTP target.
   * Local/dev: run handler asynchronously in-process.
   */
  async enqueueResumeProcessing(
    resumeId: string,
    userId: string,
    localHandler: () => Promise<unknown>,
  ) {
    const project = this.config.get<string>('GCP_PROJECT_ID', '');
    const location = this.config.get<string>('GCP_REGION', 'asia-south1');
    const queue = this.config.get<string>('CLOUD_TASKS_RESUME_QUEUE', '');
    const workerUrl = this.config.get<string>('RESUME_WORKER_URL', '');

    if (this.tasksClient && project && queue && workerUrl) {
      try {
        const parent = this.tasksClient.queuePath(project, location, queue);
        const task = {
          httpRequest: {
            httpMethod: 'POST' as const,
            url: workerUrl,
            headers: { 'Content-Type': 'application/json' },
            body: Buffer.from(JSON.stringify({ resumeId, userId })).toString('base64'),
          },
        };
        await this.tasksClient.createTask({ parent, task });
        this.logger.log(`Enqueued Cloud Task for resume ${resumeId}`);
        return { mode: 'cloud-tasks' as const };
      } catch (err) {
        this.logger.error(`Cloud Tasks enqueue failed: ${(err as Error).message}. Falling back locally.`);
      }
    }

    setImmediate(() => {
      void localHandler().catch((err) =>
        this.logger.error(`Local resume processor failed for ${resumeId}: ${(err as Error).message}`),
      );
    });
    this.logger.log(`Queued local async processing for resume ${resumeId}`);
    return { mode: 'local' as const };
  }

  /**
   * WhatsApp / interview notification jobs.
   * Prefer Cloud Tasks; fall back to local async (or delayed timer for reminders).
   */
  async enqueueWhatsAppJob(
    payload: Record<string, unknown>,
    localHandler: () => Promise<unknown>,
    scheduleTime?: Date,
  ) {
    const project = this.config.get<string>('GCP_PROJECT_ID', '');
    const location = this.config.get<string>('GCP_REGION', 'asia-south1');
    const queue =
      this.config.get<string>('CLOUD_TASKS_WHATSAPP_QUEUE', '') ||
      this.config.get<string>('CLOUD_TASKS_RESUME_QUEUE', '');
    const workerUrl =
      this.config.get<string>('WHATSAPP_WORKER_URL', '') ||
      this.config.get<string>('API_PUBLIC_URL', '') + '/api/v1/whatsapp/tasks/run';

    if (this.tasksClient && project && queue && workerUrl.startsWith('http')) {
      try {
        const parent = this.tasksClient.queuePath(project, location, queue);
        const task: Record<string, unknown> = {
          httpRequest: {
            httpMethod: 'POST',
            url: workerUrl,
            headers: {
              'Content-Type': 'application/json',
              'X-WhatsApp-Task-Secret': this.config.get<string>('WHATSAPP_TASK_SECRET', '') || '',
            },
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
          },
        };
        if (scheduleTime && scheduleTime.getTime() > Date.now() + 5_000) {
          task.scheduleTime = {
            seconds: Math.floor(scheduleTime.getTime() / 1000),
          };
        }
        await this.tasksClient.createTask({ parent, task });
        this.logger.log(`Enqueued WhatsApp Cloud Task ${JSON.stringify(payload)}`);
        return { mode: 'cloud-tasks' as const };
      } catch (err) {
        this.logger.error(
          `WhatsApp Cloud Tasks enqueue failed: ${(err as Error).message}. Falling back locally.`,
        );
      }
    }

    const delayMs = scheduleTime ? Math.max(0, scheduleTime.getTime() - Date.now()) : 0;
    // Local reminders: only auto-fire if within 2 hours (avoid 24h setTimeout in process).
    if (delayMs > 2 * 60 * 60 * 1000) {
      this.logger.log(
        `Deferred local WhatsApp job (too far for in-process timer): ${JSON.stringify(payload)} at ${scheduleTime?.toISOString()}`,
      );
      return { mode: 'deferred-local' as const };
    }

    const run = () => {
      void localHandler().catch((err) =>
        this.logger.error(`Local WhatsApp job failed: ${(err as Error).message}`),
      );
    };
    if (delayMs > 0) setTimeout(run, delayMs);
    else setImmediate(run);
    this.logger.log(`Queued local WhatsApp job ${JSON.stringify(payload)} delayMs=${delayMs}`);
    return { mode: 'local' as const };
  }
}
