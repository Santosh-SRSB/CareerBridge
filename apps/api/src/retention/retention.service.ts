import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import {
  RETENTION_BATCH_SIZE,
  RETENTION_DEFAULTS,
  RETENTION_SETTING_KEYS,
} from './retention.constants';

export type RetentionPurgeResult = {
  ranAt: string;
  resumesDeleted: number;
  resumeFilesRemoved: number;
  whatsappDeleted: number;
  aiInteractionsDeleted: number;
  auditLogsDeleted: number;
  windows: {
    resumeDays: number;
    whatsappDays: number;
    aiInteractionDays: number;
    auditLogDays: number;
  };
};

function parsePositiveDays(raw: string | undefined | null, fallback: number): number {
  const n = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Automatic data retention (Harsh Sinha / product policy):
 * - Resumes: delete after 365 days
 * - WhatsApp messages: delete after 90 days (hiring selection/rejection window)
 * - AI interactions: delete after 90 days
 * - Audit logs: delete after 365 days
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storage?: StorageService,
  ) {}

  onModuleInit() {
    const enabled = (process.env.RETENTION_PURGE_ENABLED ?? 'true').toLowerCase() !== 'false';
    if (!enabled) {
      this.logger.log('Automatic retention purge is disabled (RETENTION_PURGE_ENABLED=false).');
      return;
    }
    const intervalMs = Number(process.env.RETENTION_PURGE_INTERVAL_MS || 24 * 60 * 60 * 1000);
    const startupDelayMs = Number(process.env.RETENTION_PURGE_STARTUP_DELAY_MS || 5 * 60 * 1000);
    setTimeout(() => {
      void this.runSafe('startup');
    }, Math.max(0, startupDelayMs));
    this.timer = setInterval(() => {
      void this.runSafe('interval');
    }, Math.max(60_000, intervalMs));
    this.logger.log(
      `Retention purge scheduled (startup delay ${startupDelayMs}ms, interval ${intervalMs}ms).`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async runSafe(reason: string) {
    try {
      const result = await this.runAll();
      this.logger.log(
        `Retention purge (${reason}): resumes=${result.resumesDeleted} whatsapp=${result.whatsappDeleted} ai=${result.aiInteractionsDeleted} audit=${result.auditLogsDeleted}`,
      );
    } catch (err) {
      this.logger.error(`Retention purge failed (${reason}): ${(err as Error).message}`);
    }
  }

  async resolveWindows(now = new Date()) {
    const keys = Object.values(RETENTION_SETTING_KEYS);
    const rows = await this.prisma.platformSetting.findMany({ where: { key: { in: [...keys] } } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const resumeDays = parsePositiveDays(map[RETENTION_SETTING_KEYS.resumeDays], RETENTION_DEFAULTS.resumeDays);
    const whatsappDays = parsePositiveDays(
      map[RETENTION_SETTING_KEYS.whatsappDays],
      RETENTION_DEFAULTS.whatsappDays,
    );
    const aiInteractionDays = parsePositiveDays(
      map[RETENTION_SETTING_KEYS.aiInteractionDays],
      RETENTION_DEFAULTS.aiInteractionDays,
    );
    const auditLogDays = parsePositiveDays(
      map[RETENTION_SETTING_KEYS.auditLogDays],
      RETENTION_DEFAULTS.auditLogDays,
    );
    return {
      resumeDays,
      whatsappDays,
      aiInteractionDays,
      auditLogDays,
      resumeBefore: daysAgo(resumeDays, now),
      whatsappBefore: daysAgo(whatsappDays, now),
      aiBefore: daysAgo(aiInteractionDays, now),
      auditBefore: daysAgo(auditLogDays, now),
    };
  }

  async runAll(): Promise<RetentionPurgeResult> {
    if (this.running) {
      return {
        ranAt: new Date().toISOString(),
        resumesDeleted: 0,
        resumeFilesRemoved: 0,
        whatsappDeleted: 0,
        aiInteractionsDeleted: 0,
        auditLogsDeleted: 0,
        windows: { ...RETENTION_DEFAULTS },
      };
    }
    this.running = true;
    try {
      const windows = await this.resolveWindows();
      const resumes = await this.purgeExpiredResumes(windows.resumeBefore);
      const whatsappDeleted = await this.purgeExpiredWhatsApp(windows.whatsappBefore);
      const aiInteractionsDeleted = await this.purgeExpiredAiInteractions(windows.aiBefore);
      const auditLogsDeleted = await this.purgeExpiredAuditLogs(windows.auditBefore);
      return {
        ranAt: new Date().toISOString(),
        resumesDeleted: resumes.deleted,
        resumeFilesRemoved: resumes.filesRemoved,
        whatsappDeleted,
        aiInteractionsDeleted,
        auditLogsDeleted,
        windows: {
          resumeDays: windows.resumeDays,
          whatsappDays: windows.whatsappDays,
          aiInteractionDays: windows.aiInteractionDays,
          auditLogDays: windows.auditLogDays,
        },
      };
    } finally {
      this.running = false;
    }
  }

  /** Hard-delete resumes older than the cutoff (applications keep history via SetNull on resumeId). */
  async purgeExpiredResumes(before: Date): Promise<{ deleted: number; filesRemoved: number }> {
    let deleted = 0;
    let filesRemoved = 0;
    for (;;) {
      const batch = await this.prisma.resume.findMany({
        where: { createdAt: { lt: before } },
        select: { id: true, pdfStoragePath: true, sourceStoragePath: true },
        take: RETENTION_BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      });
      if (!batch.length) break;

      const ids = batch.map((r) => r.id);
      await this.prisma.embeddingChunk.deleteMany({ where: { resumeId: { in: ids } } });
      await this.prisma.profileEmbedding.deleteMany({ where: { entityId: { in: ids } } });
      await this.prisma.embedding.deleteMany({ where: { entityId: { in: ids } } });
      // Clear child lineage pointers so deletes are not blocked by self-FK.
      await this.prisma.resume.updateMany({
        where: { parentResumeId: { in: ids } },
        data: { parentResumeId: null },
      });
      await this.prisma.resumeOptimization.updateMany({
        where: { resultResumeId: { in: ids } },
        data: { resultResumeId: null },
      });
      await this.prisma.resume.deleteMany({ where: { id: { in: ids } } });
      deleted += ids.length;

      if (this.storage?.isConfigured()) {
        for (const row of batch) {
          for (const path of [row.pdfStoragePath, row.sourceStoragePath]) {
            if (!path) continue;
            const ok = await this.storage.deleteFile(path).catch(() => false);
            if (ok) filesRemoved += 1;
          }
        }
      }
      if (batch.length < RETENTION_BATCH_SIZE) break;
    }
    return { deleted, filesRemoved };
  }

  /**
   * WhatsApp: retain for 90 days covering selection/rejection communication, then auto-delete.
   * Messages past the cutoff are removed regardless of delivery status.
   */
  async purgeExpiredWhatsApp(before: Date): Promise<number> {
    let deleted = 0;
    for (;;) {
      const batch = await this.prisma.whatsAppMessage.findMany({
        where: { createdAt: { lt: before } },
        select: { id: true },
        take: RETENTION_BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      });
      if (!batch.length) break;
      const result = await this.prisma.whatsAppMessage.deleteMany({
        where: { id: { in: batch.map((r) => r.id) } },
      });
      deleted += result.count;
      if (batch.length < RETENTION_BATCH_SIZE) break;
    }
    return deleted;
  }

  async purgeExpiredAiInteractions(before: Date): Promise<number> {
    let deleted = 0;
    for (;;) {
      const batch = await this.prisma.aiInteraction.findMany({
        where: { createdAt: { lt: before } },
        select: { id: true },
        take: RETENTION_BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      });
      if (!batch.length) break;
      const result = await this.prisma.aiInteraction.deleteMany({
        where: { id: { in: batch.map((r) => r.id) } },
      });
      deleted += result.count;
      if (batch.length < RETENTION_BATCH_SIZE) break;
    }
    return deleted;
  }

  async purgeExpiredAuditLogs(before: Date): Promise<number> {
    let deleted = 0;
    for (;;) {
      const batch = await this.prisma.auditLog.findMany({
        where: { createdAt: { lt: before } },
        select: { id: true },
        take: RETENTION_BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      });
      if (!batch.length) break;
      const result = await this.prisma.auditLog.deleteMany({
        where: { id: { in: batch.map((r) => r.id) } },
      });
      deleted += result.count;
      if (batch.length < RETENTION_BATCH_SIZE) break;
    }
    return deleted;
  }
}
