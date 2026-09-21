import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCode,
  type NearbyJobsResponse,
  lookupCityCentroid,
} from '@careerbridge/shared';
import { Prisma } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  assertValidNearbyCoords,
  isRemoteWorkMode,
  nextNearbyBucket,
  normalizeNearbyRadius,
  type NearbyQueryInput,
} from './jobs-nearby.util';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    query: { q?: string; location?: string; type?: string; category?: string; page?: number; pageSize?: number },
    userId?: string,
  ) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 50);
    const where = {
      status: 'PUBLISHED' as const,
      ...(query.location ? { city: { contains: query.location, mode: 'insensitive' as const } } : {}),
      ...(query.type ? { jobType: query.type } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              { description: { contains: query.q, mode: 'insensitive' as const } },
              { category: { contains: query.q, mode: 'insensitive' as const } },
              { requiredSkills: { contains: query.q, mode: 'insensitive' as const } },
              { preferredSkills: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        include: { employer: true },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const candidate = userId ? await this.loadCandidate(userId) : null;
    if (candidate && (query.q?.trim() || query.category?.trim())) {
      await this.recordSearchInterest(candidate.id, query.q || query.category || '').catch(() => undefined);
    }
    const savedJobIds = candidate
      ? new Set(
          (
            await this.prisma.savedJob.findMany({
              where: { candidateId: candidate.id, jobId: { in: rows.map((row) => row.id) } },
              select: { jobId: true },
            })
          ).map((row) => row.jobId),
        )
      : new Set<string>();
    const appliedJobIds = await this.appliedJobIdSet(
      candidate?.id,
      rows.map((row) => row.id),
    );
    return {
      items: rows.map((job) =>
        this.toCard(job, candidate, savedJobIds.has(job.id), null, appliedJobIds.has(job.id)),
      ),
      page,
      pageSize,
      total,
    };
  }

  async nearby(query: NearbyQueryInput, userId?: string): Promise<NearbyJobsResponse> {
    try {
      assertValidNearbyCoords(query.latitude, query.longitude);
    } catch {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'latitude and longitude must be valid WGS84 coordinates',
      });
    }

    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(Math.max(1, query.limit || 20), 50);

    if (query.remoteOnly) {
      return this.nearbyRemote(query, page, pageSize, userId);
    }

    let radius: ReturnType<typeof normalizeNearbyRadius>;
    try {
      radius = normalizeNearbyRadius(query.minDistanceKm, query.maxDistanceKm);
    } catch (err) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: err instanceof Error ? err.message : 'Invalid distance range',
      });
    }

    const distExpr = Prisma.sql`(
      6371 * acos(
        LEAST(1::float, GREATEST(-1::float,
          cos(radians(${query.latitude})) * cos(radians(j.latitude))
          * cos(radians(j.longitude) - radians(${query.longitude}))
          + sin(radians(${query.latitude})) * sin(radians(j.latitude))
        ))
      )
    )`;

    const filters: Prisma.Sql[] = [
      Prisma.sql`j.status = 'PUBLISHED'`,
      Prisma.sql`j.latitude IS NOT NULL`,
      Prisma.sql`j.longitude IS NOT NULL`,
      Prisma.sql`(j.work_mode IS NULL OR j.work_mode NOT ILIKE ${'%remote%'})`,
    ];

    if (radius.inclusiveMax) {
      filters.push(Prisma.sql`${distExpr} >= ${radius.minKm}`);
      filters.push(Prisma.sql`${distExpr} <= ${radius.maxKm}`);
    } else {
      filters.push(Prisma.sql`${distExpr} >= ${radius.minKm}`);
      filters.push(Prisma.sql`${distExpr} < ${radius.maxKm}`);
    }

    if (query.q?.trim()) {
      const like = `%${query.q.trim()}%`;
      filters.push(Prisma.sql`(
        j.title ILIKE ${like}
        OR j.description ILIKE ${like}
        OR j.category ILIKE ${like}
        OR j.required_skills ILIKE ${like}
        OR j.preferred_skills ILIKE ${like}
      )`);
    }
    if (query.type?.trim()) {
      filters.push(Prisma.sql`j.job_type = ${query.type.trim()}`);
    }
    if (query.category?.trim()) {
      filters.push(Prisma.sql`j.category = ${query.category.trim()}`);
    }
    if (query.experience?.trim()) {
      filters.push(Prisma.sql`j.experience ILIKE ${`%${query.experience.trim()}%`}`);
    }
    if (query.workMode?.trim() && !isRemoteWorkMode(query.workMode)) {
      filters.push(Prisma.sql`j.work_mode ILIKE ${`%${query.workMode.trim()}%`}`);
    }
    if (typeof query.salaryMin === 'number' && Number.isFinite(query.salaryMin)) {
      filters.push(Prisma.sql`COALESCE(j.salary_max, j.salary_min, 0) >= ${query.salaryMin}`);
    }
    if (typeof query.salaryMax === 'number' && Number.isFinite(query.salaryMax)) {
      filters.push(Prisma.sql`COALESCE(j.salary_min, j.salary_max, 0) <= ${query.salaryMax}`);
    }
    for (const skill of query.skills || []) {
      const s = skill.trim();
      if (!s) continue;
      const like = `%${s}%`;
      filters.push(Prisma.sql`(j.required_skills ILIKE ${like} OR j.preferred_skills ILIKE ${like})`);
    }

    const whereSql = Prisma.join(filters, ' AND ');
    const offset = (page - 1) * pageSize;

    type NearbyRow = {
      id: string;
      distance_km: number;
    };

    const [countRows, idRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM jobs j
        WHERE ${whereSql}
      `,
      this.prisma.$queryRaw<NearbyRow[]>`
        SELECT j.id, ${distExpr} AS distance_km
        FROM jobs j
        WHERE ${whereSql}
        ORDER BY distance_km ASC, j.published_at DESC NULLS LAST, j.id ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
    ]);

    const totalInBucket = Number(countRows[0]?.count || 0);
    const distanceById = new Map(idRows.map((row) => [row.id, Number(row.distance_km)]));
    const ids = idRows.map((row) => row.id);

    const jobs =
      ids.length === 0
        ? []
        : await this.prisma.job.findMany({
            where: { id: { in: ids } },
            include: { employer: true },
          });
    const byId = new Map(jobs.map((job) => [job.id, job]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof jobs;

    const candidate = userId ? await this.loadCandidate(userId) : null;
    if (candidate) {
      const interest = query.q?.trim() || query.category?.trim() || (query.skills || []).slice(0, 2).join(' ');
      if (interest) {
        await this.recordSearchInterest(candidate.id, interest).catch(() => undefined);
      }
    }
    const savedJobIds = candidate
      ? new Set(
          (
            await this.prisma.savedJob.findMany({
              where: { candidateId: candidate.id, jobId: { in: ids } },
              select: { jobId: true },
            })
          ).map((row) => row.jobId),
        )
      : new Set<string>();
    const appliedJobIds = await this.appliedJobIdSet(candidate?.id, ids);

    const items = ordered.map((job) =>
      this.toCard(
        job,
        candidate,
        savedJobIds.has(job.id),
        distanceById.get(job.id) ?? null,
        appliedJobIds.has(job.id),
      ),
    );

    const hasMoreInBucket = page * pageSize < totalInBucket;
    const bucket = { minKm: radius.minKm, maxKm: radius.maxKm };

    return {
      items,
      distanceBucket: bucket,
      hasMoreInBucket,
      nextPage: hasMoreInBucket ? page + 1 : null,
      nextBucket: hasMoreInBucket ? null : nextNearbyBucket(bucket),
      page,
      pageSize,
      totalInBucket,
      remoteOnly: false,
    };
  }

  private async nearbyRemote(
    query: NearbyQueryInput,
    page: number,
    pageSize: number,
    userId?: string,
  ): Promise<NearbyJobsResponse> {
    const where: Prisma.JobWhereInput = {
      status: 'PUBLISHED',
      workMode: { contains: 'remote', mode: 'insensitive' },
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
              { category: { contains: query.q, mode: 'insensitive' } },
              { requiredSkills: { contains: query.q, mode: 'insensitive' } },
              { preferredSkills: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.type ? { jobType: query.type } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.experience ? { experience: { contains: query.experience, mode: 'insensitive' } } : {}),
    };

    const [totalInBucket, rows] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        include: { employer: true },
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const candidate = userId ? await this.loadCandidate(userId) : null;
    const savedJobIds = candidate
      ? new Set(
          (
            await this.prisma.savedJob.findMany({
              where: { candidateId: candidate.id, jobId: { in: rows.map((r) => r.id) } },
              select: { jobId: true },
            })
          ).map((row) => row.jobId),
        )
      : new Set<string>();
    const appliedJobIds = await this.appliedJobIdSet(
      candidate?.id,
      rows.map((r) => r.id),
    );

    const hasMoreInBucket = page * pageSize < totalInBucket;
    return {
      items: rows.map((job) =>
        this.toCard(job, candidate, savedJobIds.has(job.id), null, appliedJobIds.has(job.id)),
      ),
      distanceBucket: { minKm: 0, maxKm: 0 },
      hasMoreInBucket,
      nextPage: hasMoreInBucket ? page + 1 : null,
      nextBucket: hasMoreInBucket ? null : { minKm: 0, maxKm: 10 },
      page,
      pageSize,
      totalInBucket,
      remoteOnly: true,
    };
  }

  async recommended(userId: string) {
    // Score against a wider published pool so recommendations reflect live employer posts.
    const result = await this.list({ page: 1, pageSize: 50 }, userId);
    return {
      ...result,
      items: [...result.items]
        .sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0))
        .slice(0, 8),
      pageSize: 8,
      total: Math.min(result.total, 8),
    };
  }

  async detail(id: string, userId?: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, include: { employer: true } });
    if (!job || job.status === 'DRAFT') {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Job was not found' });
    }
    const candidate = userId ? await this.loadCandidate(userId) : null;
    const applied = candidate
      ? Boolean(
          await this.prisma.application.findUnique({
            where: { candidateId_jobId: { candidateId: candidate.id, jobId: id } },
          }),
        )
      : false;
    const saved = candidate
      ? Boolean(
          await this.prisma.savedJob.findUnique({
            where: { candidateId_jobId: { candidateId: candidate.id, jobId: id } },
          }),
        )
      : false;
    return {
      ...this.toCard(job, candidate, saved, null, applied),
      description: job.description,
      experience: job.experience,
      benefits: job.benefits,
      status: job.status,
      applied,
    };
  }

  async matchFor(userId: string, jobId: string) {
    const detail = await this.detail(jobId, userId);
    return detail.match;
  }

  async apply(userId: string, jobId: string, resumeId?: string) {
    const candidate = await this.requireCandidate(userId);
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { employer: true },
    });
    if (!job || job.status !== 'PUBLISHED') {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'This job is not open for applications' });
    }
    const existing = await this.prisma.application.findUnique({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId } },
    });
    if (existing && existing.status !== 'WITHDRAWN') {
      throw new ConflictException({
        code: ErrorCode.DUPLICATE_RESOURCE,
        message: 'You have already applied for this job.',
      });
    }
    const resume = resumeId
      ? await this.prisma.resume.findFirst({ where: { id: resumeId, candidateId: candidate.id } })
      : await this.prisma.resume.findFirst({ where: { candidateId: candidate.id }, orderBy: { updatedAt: 'desc' } });
    const application = existing
      ? await this.prisma.application.update({
          where: { id: existing.id },
          data: { status: 'APPLIED', resumeId: resume?.id, resumeVersion: resume?.version },
        })
      : await this.prisma.application.create({
          data: {
            candidateId: candidate.id,
            jobId,
            resumeId: resume?.id,
            resumeVersion: resume?.version,
          },
        });

    const candidateName =
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'A candidate';

    await this.notifications
      .create({
        userId,
        title: 'Application submitted',
        body: `Your application for ${job.title} was sent successfully.`,
        type: 'APPLICATION',
        link: `/applications/${application.id}`,
      })
      .catch(() => undefined);

    if (job.employer?.userId) {
      await this.notifications
        .create({
          userId: job.employer.userId,
          title: 'New application',
          body: `${candidateName} applied for ${job.title}.`,
          type: 'APPLICATION',
          link: `/employer/jobs/${job.id}`,
        })
        .catch(() => undefined);
    }

    return this.applicationView(application.id);
  }

  async listSaved(userId: string) {
    const candidate = await this.requireCandidate(userId);
    const rows = await this.prisma.savedJob.findMany({
      where: { candidateId: candidate.id },
      include: { job: { include: { employer: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const published = rows.filter((row) => row.job.status === 'PUBLISHED');
    const appliedJobIds = await this.appliedJobIdSet(
      candidate.id,
      published.map((row) => row.jobId),
    );
    return {
      items: published.map((row) =>
        this.toCard(row.job, candidate, true, null, appliedJobIds.has(row.jobId)),
      ),
    };
  }

  async saveJob(userId: string, jobId: string) {
    const candidate = await this.requireCandidate(userId);
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'PUBLISHED') {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Job was not found' });
    }
    await this.prisma.savedJob.upsert({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId } },
      create: { candidateId: candidate.id, jobId },
      update: {},
    });
    return { saved: true, jobId };
  }

  async unsaveJob(userId: string, jobId: string) {
    const candidate = await this.requireCandidate(userId);
    await this.prisma.savedJob.deleteMany({
      where: { candidateId: candidate.id, jobId },
    });
    return { saved: false, jobId };
  }

  async applicationView(id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: { job: { include: { employer: true } } },
    });
    if (!application) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Application was not found' });
    }
    return {
      id: application.id,
      status: application.status,
      createdAt: application.createdAt.toISOString(),
      resumeId: application.resumeId,
      resumeVersion: application.resumeVersion,
      job: this.toCard(application.job, null, false, null, true),
    };
  }

  private async loadCandidate(userId: string) {
    return this.prisma.candidate.findUnique({
      where: { userId },
      include: {
        skills: true,
        education: true,
        experiences: true,
        resumes: {
          where: { archivedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { id: true, score: true },
        },
      },
    });
  }

  private async requireCandidate(userId: string) {
    const candidate = await this.loadCandidate(userId);
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    return candidate;
  }

  /** Remember what a candidate searched so new employer posts can alert them. */
  async recordSearchInterest(candidateId: string, rawQuery: string) {
    const query = normalizeSearchQuery(rawQuery);
    if (!query || query.length < 2) return;
    await this.prisma.candidateJobSearchInterest.upsert({
      where: { candidateId_query: { candidateId, query } },
      create: { candidateId, query, lastSearchedAt: new Date() },
      update: { lastSearchedAt: new Date() },
    });
  }

  /**
   * When an employer publishes a job, notify candidates who previously searched
   * for a matching role/keyword (or listed it in career interests).
   */
  async notifyCandidatesForPublishedJob(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { employer: { select: { companyName: true } } },
    });
    if (!job || job.status !== 'PUBLISHED') return { notified: 0 };

    const haystack = normalizeSearchQuery(`${job.title} ${job.category || ''}`);
    if (!haystack) return { notified: 0 };

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const interests = await this.prisma.candidateJobSearchInterest.findMany({
      where: { lastSearchedAt: { gte: since } },
      include: { candidate: { select: { id: true, userId: true, careerInterests: true } } },
      orderBy: { lastSearchedAt: 'desc' },
      take: 500,
    });

    const preferenceCandidates = await this.prisma.candidate.findMany({
      where: {
        onboardingCompleted: true,
        NOT: { careerInterests: '[]' },
      },
      select: { id: true, userId: true, careerInterests: true },
      take: 400,
    });

    const matchedUserIds = new Set<string>();
    const matchedMeta = new Map<string, { query: string }>();

    for (const row of interests) {
      if (!row.candidate?.userId) continue;
      if (searchMatchesJob(row.query, haystack, job.title, job.category)) {
        matchedUserIds.add(row.candidate.userId);
        matchedMeta.set(row.candidate.userId, { query: row.query });
      }
    }

    for (const candidate of preferenceCandidates) {
      if (matchedUserIds.has(candidate.userId)) continue;
      let interestsList: string[] = [];
      try {
        interestsList = JSON.parse(candidate.careerInterests || '[]') as string[];
      } catch {
        interestsList = [];
      }
      const hit = interestsList.find((item) =>
        searchMatchesJob(normalizeSearchQuery(item), haystack, job.title, job.category),
      );
      if (hit) {
        matchedUserIds.add(candidate.userId);
        matchedMeta.set(candidate.userId, { query: normalizeSearchQuery(hit) });
      }
    }

    let notified = 0;
    for (const userId of matchedUserIds) {
      if (notified >= 40) break;
      const existing = await this.prisma.notification.findFirst({
        where: { userId, type: 'JOB_MATCH', link: `/jobs/${job.id}` },
        select: { id: true },
      });
      if (existing) continue;

      const meta = matchedMeta.get(userId);
      const company = job.employer?.companyName || 'An employer';
      await this.notifications
        .create({
          userId,
          title: 'Found a job match',
          body: `${company} posted “${job.title}” — matches what you looked for${
            meta?.query ? ` (${meta.query})` : ''
          }.`,
          type: 'JOB_MATCH',
          link: `/jobs/${job.id}`,
        })
        .catch(() => undefined);
      notified += 1;
    }

    return { notified };
  }

  private async appliedJobIdSet(candidateId: string | undefined, jobIds: string[]) {
    if (!candidateId || jobIds.length === 0) return new Set<string>();
    const rows = await this.prisma.application.findMany({
      where: { candidateId, jobId: { in: jobIds } },
      select: { jobId: true },
    });
    return new Set(rows.map((row) => row.jobId));
  }

  private toCard(
    job: {
      id: string;
      title: string;
      city: string;
      salaryMin: number | null;
      salaryMax: number | null;
      jobType: string;
      category: string;
      requiredSkills: string;
      preferredSkills: string;
      experience: string | null;
      workMode?: string | null;
      publishedAt?: Date | null;
      employer: { companyName: string };
    },
    candidate?: {
      city: string | null;
      careerInterests: string;
      hasExperience: string | null;
      highestEducation?: string | null;
      totalExperienceYears?: number | null;
      totalExperienceMonths?: number | null;
      certifications?: string;
      skills: Array<{ name: string }>;
      education?: Array<{ id: string }>;
      experiences?: Array<{ id: string }>;
      resumes?: Array<{ id: string; score: number }>;
    } | null,
    saved = false,
    distanceKm: number | null = null,
    applied = false,
  ) {
    const requiredSkills = parseList(job.requiredSkills);
    const preferredSkills = parseList(job.preferredSkills);
    const match = candidate
      ? this.intelligence.match(
          {
            city: candidate.city,
            careerInterests: parseList(candidate.careerInterests),
            skills: candidate.skills.map((item) => item.name),
            hasExperience: candidate.hasExperience,
            experienceYears:
              (candidate.totalExperienceYears || 0) +
              (candidate.totalExperienceMonths || 0) / 12,
            hasEducation: Boolean(
              candidate.highestEducation?.trim() || (candidate.education?.length || 0) > 0,
            ),
            highestEducation: candidate.highestEducation || null,
            educationCount: candidate.education?.length || 0,
            hasResume: (candidate.resumes?.length || 0) > 0,
            resumeScore: candidate.resumes?.[0]?.score ?? null,
            certifications: parseList(candidate.certifications || '[]'),
          },
          {
            city: job.city,
            category: job.category,
            requiredSkills,
            preferredSkills,
            experience: job.experience,
            title: job.title,
          },
        )
      : undefined;
    return {
      id: job.id,
      title: job.title,
      companyName: job.employer.companyName,
      city: job.city,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      jobType: job.jobType,
      category: job.category,
      requiredSkills,
      preferredSkills,
      experience: job.experience,
      workMode: job.workMode ?? null,
      publishedAt: job.publishedAt?.toISOString() ?? null,
      distanceKm:
        distanceKm == null || !Number.isFinite(distanceKm)
          ? null
          : Math.round(distanceKm * 10) / 10,
      match,
      saved,
      applied,
    };
  }
}

export function parseList(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeSearchQuery(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchMatchesJob(
  query: string,
  haystack: string,
  title: string,
  category: string | null | undefined,
) {
  const q = normalizeSearchQuery(query);
  if (!q || q.length < 2) return false;
  const titleNorm = normalizeSearchQuery(title);
  const categoryNorm = normalizeSearchQuery(category || '');
  if (titleNorm.includes(q) || q.includes(titleNorm)) return true;
  if (categoryNorm && (categoryNorm.includes(q) || q.includes(categoryNorm))) return true;
  if (haystack.includes(q)) return true;
  // Token overlap for multi-word searches like "full stack developer"
  const tokens = q.split(' ').filter((t) => t.length >= 3);
  if (tokens.length >= 2) {
    const hits = tokens.filter((t) => haystack.includes(t)).length;
    return hits >= Math.ceil(tokens.length * 0.6);
  }
  return false;
}

/** Resolve lat/lng for a job city string (employer create/update). */
export function coordsForCity(city: string): { latitude: number; longitude: number } | null {
  const hit = lookupCityCentroid(city);
  return hit ? { latitude: hit.lat, longitude: hit.lng } : null;
}
