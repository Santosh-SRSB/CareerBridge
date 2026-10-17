import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../auth/firebase.service';
import {
  NOTIFICATION_TEMPLATES,
  NOTIFICATION_TEMPLATE_KEYS,
  isNotificationTemplateKey,
  renderTemplateText,
  unknownTemplateVariables,
  type NotificationTemplateKey,
} from './notification-templates';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  /**
   * `title`/`body` are the rendered built-in text. When `templateKey` is set and an admin has saved an
   * active override for it, the override is rendered with `templateVars` instead.
   */
  async create(input: {
    userId: string;
    title: string;
    body: string;
    type?: string;
    link?: string | null;
    templateKey?: NotificationTemplateKey;
    templateVars?: Record<string, string | null | undefined>;
  }) {
    const { title, body } = await this.resolveText(input);
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title,
        body,
        type: input.type || 'SYSTEM',
        link: input.link || null,
      },
    });

    await this.pushToUser(input.userId, {
      title,
      body,
      type: input.type || 'SYSTEM',
      link: input.link || '/notifications',
      notificationId: row.id,
    }).catch(() => undefined);

    return row;
  }

  private async resolveText(input: {
    title: string;
    body: string;
    templateKey?: NotificationTemplateKey;
    templateVars?: Record<string, string | null | undefined>;
  }) {
    if (!input.templateKey) {
      return { title: input.title, body: input.body };
    }
    try {
      const override = await this.prisma.notificationTemplate.findUnique({ where: { key: input.templateKey } });
      if (!override || !override.active) return { title: input.title, body: input.body };
      const vars = input.templateVars || {};
      const title = renderTemplateText(override.title, vars).trim();
      const body = renderTemplateText(override.body, vars).trim();
      return { title: title || input.title, body: body || input.body };
    } catch (err) {
      this.logger.warn(
        `Notification template ${input.templateKey} lookup failed; using default text: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { title: input.title, body: input.body };
    }
  }

  async listTemplates() {
    const overrides = await this.prisma.notificationTemplate.findMany();
    const byKey = new Map(overrides.map((row) => [row.key, row]));
    return NOTIFICATION_TEMPLATE_KEYS.map((key) => {
      const def = NOTIFICATION_TEMPLATES[key];
      const override = byKey.get(key);
      return {
        key,
        label: def.label,
        audience: def.audience,
        variables: [...def.variables],
        defaultTitle: def.title,
        defaultBody: def.body,
        title: override?.title ?? def.title,
        body: override?.body ?? def.body,
        active: override?.active ?? true,
        customized: Boolean(override),
        updatedAt: override?.updatedAt?.toISOString() ?? null,
      };
    });
  }

  async updateTemplate(actorId: string, key: string, input: { title: string; body: string; active?: boolean }) {
    if (!isNotificationTemplateKey(key)) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Template was not found.' });
    }
    const title = input.title?.trim() || '';
    const body = input.body?.trim() || '';
    if (title.length < 2 || title.length > 120) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Title must be 2 to 120 characters.' });
    }
    if (body.length < 5 || body.length > 1000) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Message must be 5 to 1000 characters.' });
    }
    const unknown = unknownTemplateVariables(key, `${title} ${body}`);
    if (unknown.length) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Unknown placeholder: ${unknown.map((name) => `{{${name}}}`).join(', ')}. Allowed: ${NOTIFICATION_TEMPLATES[key].variables
          .map((name) => `{{${name}}}`)
          .join(', ')}.`,
      });
    }
    const before = await this.prisma.notificationTemplate.findUnique({ where: { key } });
    const row = await this.prisma.notificationTemplate.upsert({
      where: { key },
      create: { key, title, body, active: input.active ?? true, updatedBy: actorId },
      update: { title, body, active: input.active ?? true, updatedBy: actorId },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'NOTIFICATION_TEMPLATE_UPDATED',
        resourceType: 'NOTIFICATION_TEMPLATE',
        resourceId: key,
        oldValue: before ? JSON.stringify({ title: before.title, body: before.body, active: before.active }) : null,
        newValue: JSON.stringify({ title: row.title, body: row.body, active: row.active }),
      },
    });
    return (await this.listTemplates()).find((item) => item.key === key)!;
  }

  async resetTemplate(actorId: string, key: string) {
    if (!isNotificationTemplateKey(key)) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Template was not found.' });
    }
    const before = await this.prisma.notificationTemplate.findUnique({ where: { key } });
    if (before) {
      await this.prisma.notificationTemplate.delete({ where: { key } });
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'NOTIFICATION_TEMPLATE_RESET',
          resourceType: 'NOTIFICATION_TEMPLATE',
          resourceId: key,
          oldValue: JSON.stringify({ title: before.title, body: before.body, active: before.active }),
          newValue: null,
        },
      });
    }
    return (await this.listTemplates()).find((item) => item.key === key)!;
  }

  async registerDeviceToken(userId: string, token: string, platform = 'WEB') {
    const cleaned = token.trim();
    if (!cleaned) {
      return { success: false };
    }
    await this.prisma.deviceToken.upsert({
      where: { userId_token: { userId, token: cleaned } },
      create: { userId, token: cleaned, platform: platform || 'WEB' },
      update: { platform: platform || 'WEB', updatedAt: new Date() },
    });
    return { success: true };
  }

  async unregisterDeviceToken(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { userId, token: token.trim() },
    });
    return { success: true };
  }

  async listForUser(userId: string, limit = 30) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });
    const unreadCount = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return {
      items: rows.map((row) => this.toView(row)),
      unreadCount,
      pushConfigured: this.firebase.isConfigured(),
    };
  }

  async markRead(userId: string, id: string) {
    const row = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Notification was not found',
      });
    }
    if (!row.readAt) {
      await this.prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  private async pushToUser(
    userId: string,
    payload: { title: string; body: string; type: string; link: string; notificationId: string },
  ) {
    if (!this.firebase.isConfigured()) return;

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (!devices.length) return;

    const { invalidTokens } = await this.firebase.sendPush({
      tokens: devices.map((d) => d.token),
      title: payload.title,
      body: payload.body,
      data: {
        type: payload.type,
        link: payload.link,
        notificationId: payload.notificationId,
      },
    });

    if (invalidTokens.length) {
      await this.prisma.deviceToken.deleteMany({
        where: { userId, token: { in: invalidTokens } },
      });
    }
  }

  private toView(row: {
    id: string;
    title: string;
    body: string;
    type: string;
    link: string | null;
    readAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      type: row.type,
      link: row.link,
      read: Boolean(row.readAt),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
