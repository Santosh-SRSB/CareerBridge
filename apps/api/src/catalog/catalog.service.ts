import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_EXPERIENCE_LEVELS,
  DEFAULT_JOB_CATEGORY_ITEMS,
  DEFAULT_LANGUAGES,
  ErrorCode,
  type CatalogItem,
  type CatalogKind,
  type CatalogSeedItem,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_CITY_ROWS, INDIA_STATE_ROWS } from '../locations/india-locations.data';

const SEEDED_KEY_PREFIX = 'catalog.seeded.';

function defaultsFor(kind: CatalogKind): CatalogSeedItem[] {
  switch (kind) {
    case 'JOB_CATEGORY':
      return DEFAULT_JOB_CATEGORY_ITEMS;
    case 'EXPERIENCE_LEVEL':
      return DEFAULT_EXPERIENCE_LEVELS;
    case 'LANGUAGE':
      return DEFAULT_LANGUAGES;
    case 'LOCATION_CITY':
      return Object.values(DEFAULT_CITY_ROWS)
        .flat()
        .map((city) => ({ value: city.id, label: city.name, parentValue: city.stateId }));
  }
}

function slugValue(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

type CatalogRow = {
  id: string;
  kind: string;
  value: string;
  label: string;
  parentValue: string | null;
  sortOrder: number;
  active: boolean;
};

export type CatalogWriteInput = {
  label: string;
  value?: string;
  parentValue?: string | null;
  sortOrder?: number;
  active?: boolean;
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Seeds built-in defaults once per kind; later admin deletions are never re-seeded. */
  private async ensureSeeded(kind: CatalogKind) {
    const key = `${SEEDED_KEY_PREFIX}${kind}`;
    const marker = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (marker) return;
    const defaults = defaultsFor(kind);
    await this.prisma.platformCatalogItem.createMany({
      data: defaults.map((item, index) => ({
        kind,
        value: item.value,
        label: item.label,
        parentValue: item.parentValue ?? null,
        sortOrder: index,
        active: true,
      })),
      skipDuplicates: true,
    });
    await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: new Date().toISOString() },
      update: {},
    });
  }

  private toView(row: CatalogRow): CatalogItem {
    return {
      id: row.id,
      kind: row.kind as CatalogKind,
      value: row.value,
      label: row.label,
      parentValue: row.parentValue,
      sortOrder: row.sortOrder,
      active: row.active,
    };
  }

  async list(kind: CatalogKind, options: { includeInactive?: boolean; parentValue?: string } = {}) {
    await this.ensureSeeded(kind);
    const rows = await this.prisma.platformCatalogItem.findMany({
      where: {
        kind,
        ...(options.includeInactive ? {} : { active: true }),
        ...(options.parentValue ? { parentValue: options.parentValue } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    return rows.map((row) => this.toView(row));
  }

  async isActiveValue(kind: CatalogKind, value: string): Promise<boolean> {
    await this.ensureSeeded(kind);
    const row = await this.prisma.platformCatalogItem.findFirst({
      where: { kind, active: true, OR: [{ value }, { label: value }] },
      select: { id: true },
    });
    return Boolean(row);
  }

  async findByValue(kind: CatalogKind, value: string): Promise<CatalogItem | null> {
    await this.ensureSeeded(kind);
    const row = await this.prisma.platformCatalogItem.findFirst({ where: { kind, value } });
    return row ? this.toView(row) : null;
  }

  private validateInput(kind: CatalogKind, input: CatalogWriteInput, partial: boolean) {
    const label = input.label?.trim();
    if (!partial || input.label !== undefined) {
      if (!label || label.length < 2 || label.length > 80) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Name must be 2 to 80 characters.',
        });
      }
    }
    if (kind === 'LOCATION_CITY' && (!partial || input.parentValue !== undefined)) {
      const state = INDIA_STATE_ROWS.find((row) => row.id === input.parentValue);
      if (!state) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Select the state this city belongs to.',
        });
      }
    }
    if (kind === 'JOB_CATEGORY' && input.parentValue != null && !['TECH', 'NON_TECH'].includes(input.parentValue)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Category group must be Tech or Non-tech.',
      });
    }
    return label;
  }

  async create(actorId: string, kind: CatalogKind, input: CatalogWriteInput) {
    await this.ensureSeeded(kind);
    const label = this.validateInput(kind, input, false)!;
    const value =
      kind === 'LOCATION_CITY' || kind === 'EXPERIENCE_LEVEL'
        ? input.value?.trim() || slugValue(label)
        : input.value?.trim() || label;
    const clash = await this.prisma.platformCatalogItem.findFirst({
      where: { kind, OR: [{ value }, { label: { equals: label, mode: 'insensitive' } }] },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        code: ErrorCode.DUPLICATE_RESOURCE,
        message: `"${label}" already exists.`,
      });
    }
    const last = await this.prisma.platformCatalogItem.findFirst({
      where: { kind },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const row = await this.prisma.platformCatalogItem.create({
      data: {
        kind,
        value,
        label,
        parentValue: input.parentValue ?? (kind === 'JOB_CATEGORY' ? 'NON_TECH' : null),
        sortOrder: input.sortOrder ?? (last ? last.sortOrder + 1 : 0),
        active: input.active ?? true,
      },
    });
    await this.audit(actorId, 'CATALOG_ITEM_CREATED', row.id, null, this.toView(row));
    return this.toView(row);
  }

  async update(actorId: string, kind: CatalogKind, id: string, input: CatalogWriteInput) {
    const existing = await this.prisma.platformCatalogItem.findFirst({ where: { id, kind } });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Item was not found.' });
    }
    const label = this.validateInput(kind, input, true);
    if (label && label.toLowerCase() !== existing.label.toLowerCase()) {
      const clash = await this.prisma.platformCatalogItem.findFirst({
        where: { kind, id: { not: id }, label: { equals: label, mode: 'insensitive' } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException({ code: ErrorCode.DUPLICATE_RESOURCE, message: `"${label}" already exists.` });
      }
    }
    const row = await this.prisma.platformCatalogItem.update({
      where: { id },
      data: {
        ...(label ? { label } : {}),
        ...(input.parentValue !== undefined ? { parentValue: input.parentValue } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    await this.audit(actorId, 'CATALOG_ITEM_UPDATED', id, this.toView(existing), this.toView(row));
    return this.toView(row);
  }

  async remove(actorId: string, kind: CatalogKind, id: string) {
    const existing = await this.prisma.platformCatalogItem.findFirst({ where: { id, kind } });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Item was not found.' });
    }
    await this.prisma.platformCatalogItem.delete({ where: { id } });
    await this.audit(actorId, 'CATALOG_ITEM_DELETED', id, this.toView(existing), null);
    return { ok: true, id };
  }

  private async audit(actorId: string, action: string, resourceId: string, oldValue: unknown, newValue: unknown) {
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action,
        resourceType: 'PLATFORM_CATALOG',
        resourceId,
        oldValue: oldValue == null ? null : JSON.stringify(oldValue),
        newValue: newValue == null ? null : JSON.stringify(newValue),
      },
    });
  }
}
