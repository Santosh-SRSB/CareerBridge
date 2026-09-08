import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../auth/firebase.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  async create(input: {
    userId: string;
    title: string;
    body: string;
    type?: string;
    link?: string | null;
  }) {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        type: input.type || 'SYSTEM',
        link: input.link || null,
      },
    });

    await this.pushToUser(input.userId, {
      title: input.title,
      body: input.body,
      type: input.type || 'SYSTEM',
      link: input.link || '/notifications',
      notificationId: row.id,
    }).catch(() => undefined);

    return row;
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
