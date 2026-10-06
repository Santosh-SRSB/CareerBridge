import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ErrorCode,
  PASSPORT_SECTION_COPY,
  computeProfileOverviewCompletion,
  profileOverviewMissingLabels,
  type PassportSection,
  normalizeHttpUrl,
  optionalUrlError,
  yearNumberError,
  computeCareerGapAfterHighestEducation,
  computeTimelineCareerGaps,
  formatGapDurationFromDays,
  formatGapDateRange,
  CAREER_GAP_REASONS,
  deriveExperienceFlags,
  computeEmployabilityScore,
  EMPLOYABILITY_RECENT_INTERVIEWS,
  type AiFeedbackItem,
  CANDIDATE_MAX_SKILLS,
  CANDIDATE_MAX_SKILLS_MESSAGE,
  employmentStatusNeedsExperience,
  parseExperienceRange,
  parseSkippedSteps,
  validateExpectedSalaryRange,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { MatchingService } from '../matching/matching.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { StorageService } from '../common/storage/storage.service';
import { TestimonialsService } from '../testimonials/testimonials.service';
import {
  EducationDto,
  ExperienceDto,
  SkillDto,
  UpdateCandidateDto,
  UpdateEducationDto,
  UpdateExperienceDto,
  SavePassportDto,
  CertificationDto,
  ProjectDto,
  AnalyzeCareerGapDto,
  ExplainCareerGapDto,
} from './dto/update-candidate.dto';
import { CareerGapReason, CareerGapStatus } from '../prisma/client';

const MAX_PREFERRED_WORK_CITIES = 5;
import {
  PHOTO_VALIDATION_MESSAGES,
  canonicalProfilePhotoPaths,
  isSafeInlinePhoto,
  ownedProfilePhotoPath,
  profilePhotoPath,
  profilePhotoUrl,
  readOwnedProfilePhotoDataUrl,
  validateProfilePhoto,
} from './profile-photo.util';

type CandidateRecord = Awaited<ReturnType<CandidatesService['loadCandidate']>>;

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly aiGateway: AiGatewayService,
    private readonly storage: StorageService,
    private readonly testimonials: TestimonialsService,
    private readonly catalog: CatalogService,
  ) {}

  async me(userId: string) {
    return this.withReadablePhoto(this.toProfile(await this.loadCandidate(userId)));
  }

  /** Multipart profile photo upload — the only way a photo reference is written. */
  async uploadPhotoFile(
    userId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
  ) {
    const verdict = await validateProfilePhoto(file);
    if (!verdict.ok) {
      const body = { code: ErrorCode.VALIDATION_ERROR, message: PHOTO_VALIDATION_MESSAGES[verdict.reason] };
      if (verdict.reason === 'too_large') throw new PayloadTooLargeException(body);
      throw new BadRequestException(body);
    }

    const candidate = await this.loadCandidate(userId);
    if (!this.storage.isConfigured()) {
      this.logger.error(`Profile photo upload rejected for ${candidate.id}: storage not configured`);
      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Photo storage is unavailable right now. Your existing photo was kept.',
      });
    }

    const path = profilePhotoPath(candidate.id, verdict.type);
    try {
      await this.storage.uploadFile(path, file.buffer, {
        contentType: verdict.contentType,
        metadata: { candidateId: candidate.id, source: 'profile-photo' },
      });
    } catch (err) {
      this.logger.error(`Profile photo GCS upload failed for ${candidate.id}: ${(err as Error).message}`);
      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Could not save your photo right now. Your existing photo was kept.',
      });
    }

    const photoUrl = profilePhotoUrl(this.storage.getBucketName(), candidate.id, verdict.type);
    await this.prisma.candidate.update({ where: { id: candidate.id }, data: { photoUrl } });
    await this.removeStaleProfilePhotos(candidate.id, candidate.photoUrl, path);
    this.logger.log(`Saved profile photo for candidate ${candidate.id} (${file.buffer.length} bytes)`);
    return this.recompute(userId);
  }

  async completion(userId: string) {
    const candidate = await this.loadCandidate(userId);
    const sections = buildSections(candidate);
    const percentage = computeProfileOverviewCompletion(sections, candidate.skills.length);
    return {
      percentage,
      onboardingCompleted: candidate.onboardingCompleted,
      sections,
      missing: profileOverviewMissingLabels(sections, candidate.skills.length),
    };
  }

  async employability(userId: string) {
    const candidate = await this.loadCandidate(userId);
    const sections = buildSections(candidate);
    const [resumes, interviews] = await Promise.all([
      this.prisma.resume.findMany({
        where: { candidateId: candidate.id, archivedAt: null },
        select: { analysis: { select: { overallScore: true } } },
      }),
      this.prisma.interview.findMany({
        where: { candidateId: candidate.id, status: 'COMPLETED', score: { not: null } },
        orderBy: { updatedAt: 'desc' },
        take: EMPLOYABILITY_RECENT_INTERVIEWS,
        select: { score: true },
      }),
    ]);
    const atsScores = resumes
      .map((row) => row.analysis?.overallScore)
      .filter((score): score is number => typeof score === 'number');
    return computeEmployabilityScore({
      profileCompletion: computeProfileOverviewCompletion(sections, candidate.skills.length),
      bestResumeAtsScore: atsScores.length ? Math.max(...atsScores) : null,
      mockInterviewScores: interviews.map((row) => row.score as number),
      skillsCount: candidate.skills.length,
      hasWorkExperience: candidate.experiences.length > 0,
      projectsCount: parseRecords(candidate.projects).length,
      certificationsCount: parseRecords(candidate.certifications).length,
    });
  }

  /** Stored feedback only (resume reviews, AI improvements, mock interview reports); nothing is generated here. */
  async aiFeedback(userId: string): Promise<AiFeedbackItem[]> {
    const candidate = await this.loadCandidate(userId);
    const [reports, improvements, interviews] = await Promise.all([
      this.prisma.resumeAtsReport.findMany({
        where: { resume: { candidateId: candidate.id } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: { resume: { select: { id: true, title: true } } },
      }),
      this.prisma.resumeOptimization.findMany({
        where: { source: { candidateId: candidate.id }, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          sourceResumeId: true,
          resultResumeId: true,
          beforeScore: true,
          afterScore: true,
          improvementsJson: true,
          createdAt: true,
          source: { select: { title: true } },
        },
      }),
      this.prisma.interview.findMany({
        where: { candidateId: candidate.id, status: 'COMPLETED', reportJson: { not: null } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { id: true, jobRole: true, score: true, reportJson: true, updatedAt: true },
      }),
    ]);

    const improvedResumeIds = new Set(improvements.map((row) => row.sourceResumeId));
    const items: AiFeedbackItem[] = [
      ...reports.map((row) => ({
        id: `review-${row.id}`,
        kind: 'RESUME_REVIEW' as const,
        title: `Resume review: ${row.resume.title}`,
        at: row.updatedAt.toISOString(),
        score: row.overallScore,
        summary: `${row.label}. ${row.highPriority} high-priority and ${row.mediumPriority} medium-priority suggestions.`,
        action: improvedResumeIds.has(row.resume.id) ? 'Improved with AI' : null,
        href: `/ats?resumeId=${encodeURIComponent(row.resume.id)}`,
      })),
      ...improvements.map((row) => {
        const changes = parseStringList(row.improvementsJson);
        return {
          id: `improvement-${row.id}`,
          kind: 'RESUME_IMPROVEMENT' as const,
          title: `AI resume improvement: ${row.source.title}`,
          at: row.createdAt.toISOString(),
          score: row.afterScore,
          summary:
            row.afterScore != null
              ? `ATS score ${row.beforeScore} → ${row.afterScore}.${changes.length ? ` ${changes.slice(0, 2).join('; ')}` : ''}`
              : `Started from ATS score ${row.beforeScore}.`,
          action: row.resultResumeId ? 'Saved as a new resume version' : null,
          href: `/ats?resumeId=${encodeURIComponent(row.resultResumeId || row.sourceResumeId)}`,
        };
      }),
      ...interviews.map((row) => {
        const report = parseInterviewReportSummary(row.reportJson);
        return {
          id: `interview-${row.id}`,
          kind: 'MOCK_INTERVIEW' as const,
          title: `Mock interview: ${row.jobRole}`,
          at: row.updatedAt.toISOString(),
          score: row.score,
          summary:
            [report.recommendation, report.summary].filter(Boolean).join('. ').slice(0, 400) ||
            'Interview report available.',
          action: null,
          href: `/interviews/${row.id}/report`,
        };
      }),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  }

  /**
   * Career gap after the candidate's highest education only.
   * Optional body overrides use wizard journey dates; otherwise profile rows are used.
   */
  async analyzeCareerGap(userId: string, dto: AnalyzeCareerGapDto = {}) {
    const candidate = await this.loadCandidate(userId);
    const education =
      dto.education?.length
        ? dto.education.map((row) => ({
            qualification: row.qualification,
            startDate: row.startDate,
            endDate: row.endDate,
            yearCompleted: row.yearCompleted,
            isCurrent: row.isCurrent,
          }))
        : [
            ...candidate.education.map((row) => ({
              qualification: row.qualification,
              startDate: row.startDate,
              endDate: row.endDate,
              yearCompleted: row.yearCompleted,
              isCurrent: false,
            })),
            ...(candidate.highestEducation
              ? [
                  {
                    qualification: candidate.highestEducation,
                    startDate: candidate.educationStart,
                    endDate: candidate.stillInCollege ? null : candidate.educationEnd,
                    yearCompleted: null as number | null,
                    isCurrent: Boolean(candidate.stillInCollege),
                  },
                ]
              : []),
          ];

    const toDateStr = (value: Date | string | null | undefined) => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return String(value).slice(0, 10);
    };

    const experience =
      dto.experience?.length
        ? dto.experience.map((row) => ({
            startDate: row.startDate,
            endDate: row.endDate,
            stillInCompany: row.stillInCompany,
            isCurrent: row.isCurrent,
          }))
        : candidate.experiences.map((row) => ({
            startDate: toDateStr(row.startDate),
            endDate: toDateStr(row.endDate),
            stillInCompany: row.stillInCompany,
            isCurrent: false,
          }));

    const result = computeCareerGapAfterHighestEducation({ education, experience });

    if (dto.persist) {
      const gapReason = result.hasGap ? (dto.gapReason?.trim() || candidate.gapReason || null) : null;
      await this.prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          gapMonths: result.hasGap ? result.gapMonths : 0,
          gapReason: result.hasGap ? gapReason : null,
        },
      });
    }

    return {
      ...result,
      message: result.hasGap
        ? `You have a gap of ${result.gapLabel}. Please explain why this gap is OK.`
        : null,
      savedGapReason: candidate.gapReason,
    };
  }

  /**
   * Recalculate timeline gaps between employment/internship activities and sync DB idempotently.
   * Preserves explanations when the same start/end dates still exist.
   */
  async syncTimelineCareerGaps(userId: string) {
    const candidate = await this.loadCandidate(userId);
    const toDateStr = (value: Date | string | null | undefined) => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return String(value).slice(0, 10);
    };

    const eduRow = candidate.education[0];
    const educationEndDate =
      candidate.stillInCollege
        ? null
        : candidate.educationEnd ||
          eduRow?.endDate ||
          (eduRow?.yearCompleted != null ? `${eduRow.yearCompleted}-06` : null);

    const analysis = computeTimelineCareerGaps({
      activities: candidate.experiences.map((row) => ({
        id: row.id,
        startDate: toDateStr(row.startDate),
        endDate: toDateStr(row.endDate),
        stillInCompany: row.stillInCompany,
        isCurrent: false,
      })),
      educationEndDate,
      stillStudying: Boolean(candidate.stillInCollege),
    });

    const existing = await this.prisma.careerGap.findMany({
      where: { candidateId: candidate.id },
    });
    const existingByKey = new Map(
      existing.map((row) => [
        `${toDateStr(row.gapStartDate)}|${toDateStr(row.gapEndDate)}`,
        row,
      ]),
    );
    const keepKeys = new Set<string>();

    for (const gap of analysis.gaps) {
      const key = `${gap.gapStartDate}|${gap.gapEndDate}`;
      keepKeys.add(key);
      const prev = existingByKey.get(key);
      if (prev) {
        await this.prisma.careerGap.update({
          where: { id: prev.id },
          data: {
            gapDays: gap.gapDays,
            previousActivityId: gap.previousActivityId,
            nextActivityId: gap.nextActivityId,
          },
        });
      } else {
        await this.prisma.careerGap.create({
          data: {
            candidateId: candidate.id,
            gapStartDate: new Date(gap.gapStartDate),
            gapEndDate: new Date(gap.gapEndDate),
            gapDays: gap.gapDays,
            previousActivityId: gap.previousActivityId,
            nextActivityId: gap.nextActivityId,
            status: CareerGapStatus.UNEXPLAINED,
          },
        });
      }
    }

    const staleIds = existing
      .filter((row) => !keepKeys.has(`${toDateStr(row.gapStartDate)}|${toDateStr(row.gapEndDate)}`))
      .map((row) => row.id);
    if (staleIds.length) {
      await this.prisma.careerGap.deleteMany({
        where: { id: { in: staleIds }, candidateId: candidate.id },
      });
    }

    // Keep legacy scalar fields in sync for passport/course nudges.
    await this.prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        gapMonths: analysis.totalGaps
          ? Math.floor(analysis.totalGapDays / 30)
          : 0,
        gapReason:
          analysis.totalGaps === 0
            ? null
            : candidate.gapReason,
      },
    });

    return this.listCareerGaps(userId, { skipSync: true });
  }

  async listCareerGaps(userId: string, opts?: { skipSync?: boolean }) {
    try {
      if (!opts?.skipSync) {
        return await this.syncTimelineCareerGaps(userId);
      }
      const candidate = await this.loadCandidate(userId);
      const rows = await this.prisma.careerGap.findMany({
        where: { candidateId: candidate.id },
        orderBy: { gapStartDate: 'asc' },
      });
      const toDateStr = (value: Date) => value.toISOString().slice(0, 10);
      const gaps = rows.map((row) => ({
        id: row.id,
        startDate: toDateStr(row.gapStartDate),
        endDate: toDateStr(row.gapEndDate),
        dateRangeLabel: formatGapDateRange(toDateStr(row.gapStartDate), toDateStr(row.gapEndDate)),
        gapDays: row.gapDays,
        duration: formatGapDurationFromDays(row.gapDays),
        reason: row.reason,
        reasonDetails: row.reasonDetails,
        status: row.status,
        previousActivityId: row.previousActivityId,
        nextActivityId: row.nextActivityId,
      }));
      const totalGapDays = gaps.reduce((sum, g) => sum + g.gapDays, 0);
      return {
        totalGaps: gaps.length,
        totalGapDays,
        totalGapDuration: formatGapDurationFromDays(totalGapDays),
        gaps,
      };
    } catch (error) {
      this.logger.warn(
        `Career gap list failed for ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        totalGaps: 0,
        totalGapDays: 0,
        totalGapDuration: formatGapDurationFromDays(0),
        gaps: [],
      };
    }
  }

  async explainCareerGap(userId: string, gapId: string, dto: ExplainCareerGapDto) {
    const candidate = await this.loadCandidate(userId);
    const gap = await this.prisma.careerGap.findFirst({
      where: { id: gapId, candidateId: candidate.id },
    });
    if (!gap) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Career gap was not found',
      });
    }

    await this.applyGapExplanation(candidate.id, [gap.id], dto);
    return this.listCareerGaps(userId, { skipSync: true });
  }

  /** Apply one shared reason to every current career gap for this candidate. */
  async explainAllCareerGaps(userId: string, dto: ExplainCareerGapDto) {
    const candidate = await this.loadCandidate(userId);
    await this.syncTimelineCareerGaps(userId);
    const gaps = await this.prisma.careerGap.findMany({
      where: { candidateId: candidate.id },
      select: { id: true },
    });
    if (!gaps.length) {
      return this.listCareerGaps(userId, { skipSync: true });
    }
    await this.applyGapExplanation(
      candidate.id,
      gaps.map((g) => g.id),
      dto,
    );
    return this.listCareerGaps(userId, { skipSync: true });
  }

  private async applyGapExplanation(
    candidateId: string,
    gapIds: string[],
    dto: ExplainCareerGapDto,
  ) {
    const reason = dto.reason as CareerGapReason;
    if (!CAREER_GAP_REASONS.includes(dto.reason as (typeof CAREER_GAP_REASONS)[number])) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Please select a valid reason for this career gap.',
      });
    }
    const details = dto.reasonDetails?.trim() || '';
    if (reason === CareerGapReason.OTHER && details.length < 2) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Please specify details when the reason is Other.',
      });
    }
    if (details.length > 1000) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Additional details must be under 1000 characters.',
      });
    }

    await this.prisma.careerGap.updateMany({
      where: { id: { in: gapIds }, candidateId },
      data: {
        reason,
        reasonDetails: details || null,
        status: CareerGapStatus.EXPLAINED,
      },
    });

    const explained = await this.prisma.careerGap.findMany({
      where: { candidateId, status: CareerGapStatus.EXPLAINED },
      orderBy: { gapStartDate: 'asc' },
    });
    const reasonLabel = dto.reason;
    const summary =
      explained.length === 0
        ? null
        : explained.length === 1
          ? `${formatGapDateRange(
              explained[0].gapStartDate.toISOString().slice(0, 10),
              explained[0].gapEndDate.toISOString().slice(0, 10),
            )} — ${reasonLabel}`
          : `${explained.length} career gaps (${formatGapDurationFromDays(
              explained.reduce((s, g) => s + g.gapDays, 0),
            )}) — ${reasonLabel}${details ? `: ${details}` : ''}`;

    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { gapReason: summary },
    });
  }

  async listEducation(userId: string) {
    return (await this.me(userId)).education;
  }

  async listSkills(userId: string) {
    return (await this.me(userId)).skills;
  }

  async listExperience(userId: string) {
    return (await this.me(userId)).experiences;
  }

  async updateMe(userId: string, dto: UpdateCandidateDto) {
    const candidate = await this.loadCandidate(userId);
    const names = dto.fullName?.trim().split(/\s+/).filter(Boolean);
    const careerInterests = dto.careerInterests
      ? JSON.stringify(dto.careerInterests.slice(0, 3))
      : undefined;

    if (dto.photoUrl !== undefined && dto.photoUrl !== null && dto.photoUrl !== '') {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'photoUrl can only be cleared here. Upload photos via POST /candidates/me/photo.',
      });
    }
    const preferredCities =
      dto.preferredWorkCity !== undefined
        ? dto.preferredWorkCity.split(',').map((city) => city.trim()).filter(Boolean)
        : undefined;
    if (preferredCities && preferredCities.length > MAX_PREFERRED_WORK_CITIES) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `You can select up to ${MAX_PREFERRED_WORK_CITIES} locations`,
      });
    }
    if (dto.expectedSalaryMin !== undefined || dto.expectedSalaryMax !== undefined) {
      const min = dto.expectedSalaryMin !== undefined ? dto.expectedSalaryMin : candidate.expectedSalaryMin;
      const max = dto.expectedSalaryMax !== undefined ? dto.expectedSalaryMax : candidate.expectedSalaryMax;
      const salaryError = validateExpectedSalaryRange(min, max);
      if (salaryError) {
        throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: salaryError });
      }
    }
    let experienceRangeYears: number | undefined;
    if (dto.experienceRange) {
      const level = await this.catalog.findByValue('EXPERIENCE_LEVEL', dto.experienceRange.trim());
      if (!level || (!level.active && level.value !== candidate.experienceRange)) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Please select your years of experience',
        });
      }
      experienceRangeYears = parseExperienceRange(level.label)?.min ?? 0;
    }
    const statusNeedsExperience =
      dto.employmentStatus !== undefined ? employmentStatusNeedsExperience(dto.employmentStatus) : undefined;
    if (statusNeedsExperience === true && !dto.experienceRange && !candidate.experienceRange) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Please select your years of experience',
      });
    }
    await this.prisma.candidate.update({
      where: { userId },
      data: {
        ...(names?.length
          ? { firstName: names[0], lastName: names.slice(1).join(' ') || null }
          : {}),
        ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.state !== undefined ? { state: dto.state.trim() || null } : {}),
        ...(preferredCities !== undefined
          ? {
              preferredWorkCity: preferredCities.join(', ') || null,
              ...(dto.city === undefined && preferredCities[0] ? { city: preferredCities[0] } : {}),
            }
          : {}),
        ...(dto.about !== undefined ? { about: dto.about.trim() || null } : {}),
        ...(dto.preferredLanguage !== undefined ? { preferredLanguage: dto.preferredLanguage } : {}),
        ...(dto.dateOfBirth !== undefined
          ? { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }
          : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender || null } : {}),
        ...(dto.openToRelocating !== undefined ? { openToRelocating: dto.openToRelocating } : {}),
        ...(dto.highestEducation !== undefined ? { highestEducation: dto.highestEducation } : {}),
        ...(dto.educationEnd !== undefined
          ? { educationEnd: dto.educationEnd?.trim() || null }
          : {}),
        ...(dto.stillInCollege !== undefined ? { stillInCollege: dto.stillInCollege } : {}),
        ...(careerInterests !== undefined ? { careerInterests } : {}),
        ...(dto.hasExperience !== undefined ? { hasExperience: dto.hasExperience } : {}),
        ...(dto.noticePeriod !== undefined
          ? { noticePeriod: dto.noticePeriod?.trim() || null }
          : {}),
        ...(dto.experienceLevel !== undefined ? { experienceLevel: dto.experienceLevel } : {}),
        ...(dto.totalExperienceYears !== undefined
          ? { totalExperienceYears: Number.parseInt(dto.totalExperienceYears, 10) || 0 }
          : {}),
        ...(dto.totalExperienceMonths !== undefined
          ? { totalExperienceMonths: Number.parseInt(dto.totalExperienceMonths, 10) || 0 }
          : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: null } : {}),
        ...(dto.links !== undefined ? { profileLinks: JSON.stringify(cleanLinks(dto.links)) } : {}),
        ...(dto.employmentStatus !== undefined
          ? {
              employmentStatus: dto.employmentStatus,
              stillInCollege: dto.employmentStatus === 'STUDENT',
              ...(statusNeedsExperience
                ? { hasExperience: 'YES', experienceLevel: 'experienced' }
                : {
                    hasExperience: 'NONE',
                    experienceLevel: 'fresher',
                    experienceRange: null,
                    totalExperienceYears: 0,
                    totalExperienceMonths: 0,
                  }),
            }
          : {}),
        ...(dto.experienceRange !== undefined && statusNeedsExperience !== false
          ? dto.experienceRange
            ? {
                experienceRange: dto.experienceRange.trim(),
                totalExperienceYears: experienceRangeYears ?? 0,
                totalExperienceMonths: 0,
              }
            : { experienceRange: null }
          : {}),
        ...(dto.expectedSalaryMin !== undefined ? { expectedSalaryMin: dto.expectedSalaryMin } : {}),
        ...(dto.expectedSalaryMax !== undefined ? { expectedSalaryMax: dto.expectedSalaryMax } : {}),
        ...(dto.preferredJobTypes !== undefined
          ? { preferredJobTypes: JSON.stringify([...new Set(dto.preferredJobTypes)]) }
          : {}),
        ...(dto.onboardingSkippedSteps !== undefined
          ? { onboardingSkippedSteps: JSON.stringify(parseSkippedSteps(dto.onboardingSkippedSteps)) }
          : {}),
        ...(dto.onboardingCompleted !== undefined ? { onboardingCompleted: dto.onboardingCompleted } : {}),
        ...(dto.dashboardReached !== undefined ? { dashboardReached: dto.dashboardReached } : {}),
        ...(dto.whatsappOptIn !== undefined
          ? {
              whatsappOptIn: dto.whatsappOptIn,
              whatsappOptInAt: dto.whatsappOptIn ? new Date() : null,
              whatsappOptInSource: dto.whatsappOptIn ? 'candidate_profile' : null,
            }
          : {}),
        ...(dto.whatsappNumber !== undefined
          ? { whatsappNumber: dto.whatsappNumber?.trim() || null }
          : {}),
      },
    });
    if (dto.photoUrl !== undefined) {
      await this.removeStaleProfilePhotos(candidate.id, candidate.photoUrl, null);
    }

    const profile = await this.recompute(userId);
    if (dto.onboardingCompleted === true) {
      await this.matching.recomputeMatchesForPublishedJobs().catch(() => undefined);
    }
    return profile;
  }

  async savePassport(userId: string, dto: SavePassportDto) {
    const candidate = await this.loadCandidate(userId);
    const education = (dto.education ?? []).filter(
      (row) => row.qualification?.trim() || row.institution?.trim(),
    );
    const skills = [...new Set((dto.skills ?? []).map((item) => item.trim()).filter(Boolean))];
    const incomingExperience = (dto.experience ?? []).filter(
      (row) => row.company?.trim() || row.jobTitle?.trim() || row.description?.trim(),
    );
    const paidJobs = incomingExperience.filter((row) => !row.isInternship);
    const internshipJobs = incomingExperience.filter((row) => Boolean(row.isInternship));
    // Fresher / internship-only: keep internship rows; do not wipe them on fresher save.
    const jobs =
      dto.experienceLevel === 'fresher'
        ? internshipJobs
        : paidJobs.length
          ? incomingExperience
          : internshipJobs;
    const years = Number.parseInt(dto.totalExperienceYears || '0', 10) || 0;
    const months = Number.parseInt(dto.totalExperienceMonths || '0', 10) || 0;
    const firstEdu = education[0];
    const resolvedLevel =
      paidJobs.length > 0 ? 'experienced' : dto.experienceLevel === 'experienced' && paidJobs.length === 0
        ? 'fresher'
        : dto.experienceLevel || (paidJobs.length ? 'experienced' : 'fresher');
    const hasExperienceFlag =
      paidJobs.length > 0 ? 'YES' : internshipJobs.length > 0 || jobs.some((r) => r.isInternship) ? 'INTERNSHIP' : 'NONE';
    const careerInterests = [...new Set((dto.careerInterests ?? []).map((item) => item.trim()).filter(Boolean))].slice(
      0,
      8,
    );
    const existingProjects = parseRecords(candidate.projects);
    const incomingProjects = (dto.projects ?? [])
      .map((row) => ({
        title: row.title?.trim() || '',
        role: row.role?.trim() || null,
        year: typeof row.year === 'number' && Number.isFinite(row.year) ? row.year : null,
        description: row.description?.trim() || null,
        url: normalizeHttpUrl(row.url),
      }))
      .filter((row) => row.title.length >= 2);
    const projectSeed =
      incomingProjects.length && existingProjects.length === 0
        ? JSON.stringify(
            incomingProjects.map((row) => ({
              id: randomUUID(),
              title: row.title,
              role: row.role,
              year: row.year,
              description: row.description,
              url: row.url,
            })),
          )
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.candidate.update({
        where: { userId },
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim() || null,
          ...(dto.city !== undefined ? { city: dto.city.trim() || null } : {}),
          ...(dto.about !== undefined ? { about: dto.about.trim() || null } : {}),
          ...(careerInterests.length
            ? { careerInterests: JSON.stringify(careerInterests) }
            : {}),
          highestEducation:
            firstEdu?.qualification?.trim() ||
            firstEdu?.institution?.trim() ||
            candidate.highestEducation,
          stillInCollege: Boolean(dto.stillInCollege),
          educationStart: dto.educationStart?.trim() || null,
          educationEnd: dto.stillInCollege ? null : dto.educationEnd?.trim() || null,
          experienceLevel: resolvedLevel,
          totalExperienceYears: years,
          totalExperienceMonths: months,
          gapReason: dto.gapReason?.trim() || null,
          gapMonths:
            typeof dto.gapMonths === 'number' && Number.isFinite(dto.gapMonths)
              ? Math.max(0, Math.floor(dto.gapMonths))
              : null,
          source: dto.source === 'resume' ? 'resume' : 'manual',
          hasExperience: hasExperienceFlag,
          ...(projectSeed ? { projects: projectSeed } : {}),
        },
      });
      await tx.candidateEducation.deleteMany({ where: { candidateId: candidate.id } });
      await tx.candidateSkill.deleteMany({ where: { candidateId: candidate.id } });
      await tx.candidateExperience.deleteMany({ where: { candidateId: candidate.id } });
      if (education.length) {
        await tx.candidateEducation.createMany({
          data: education.map((row) => ({
            candidateId: candidate.id,
            qualification: row.qualification?.trim() || row.institution?.trim() || 'Education',
            institution: row.institution?.trim() || null,
            fieldOfStudy: row.fieldOfStudy?.trim() || null,
            yearCompleted: yearFrom(row.yearCompleted || row.endDate || ''),
            startDate: row.startDate?.trim() || dto.educationStart?.trim() || null,
            endDate: dto.stillInCollege ? null : row.endDate?.trim() || dto.educationEnd?.trim() || null,
          })),
        });
      }
      if (skills.length) {
        await tx.candidateSkill.createMany({
          data: skills.map((name) => ({ candidateId: candidate.id, name })),
        });
      }
      if (jobs.length) {
        await tx.candidateExperience.createMany({
          data: jobs.map((row) => ({
            candidateId: candidate.id,
            company: row.company?.trim() || (row.isInternship ? 'Internship' : 'Company'),
            jobTitle: row.jobTitle?.trim() || (row.isInternship ? 'Intern' : 'Role'),
            startDate: parseOptionalDate(row.startDate),
            endDate: row.stillInCompany ? null : parseOptionalDate(row.endDate),
            description: row.description?.trim() || null,
            isInternship: Boolean(row.isInternship),
            stillInCompany: Boolean(row.stillInCompany),
          })),
        });
      }
    });

    const profile = await this.recompute(userId);

    // Keep candidate embedding fresh for hybrid matching (Gateway → Gemini).
    try {
      const fresh = await this.prisma.candidate.findUnique({
        where: { id: candidate.id },
        include: { skills: true },
      });
      if (fresh) {
        await this.aiGateway.upsertEmbedding({
          entityType: 'CANDIDATE',
          entityId: fresh.id,
          text: this.aiGateway.buildCandidateEmbedText({
            city: fresh.city,
            skills: fresh.skills.map((s) => s.name),
            careerInterests: (() => {
              try {
                return JSON.parse(fresh.careerInterests || '[]') as string[];
              } catch {
                return [];
              }
            })(),
            about: fresh.about,
          }),
          userId,
        });
      }
    } catch {
      /* non-blocking */
    }

    if (candidate.onboardingCompleted) {
      await this.matching.recomputeMatchesForPublishedJobs().catch(() => undefined);
    }
    return profile;
  }

  async addEducation(userId: string, dto: EducationDto) {
    const candidate = await this.loadCandidate(userId);
    await this.prisma.candidateEducation.create({
      data: {
        candidateId: candidate.id,
        qualification: dto.qualification.trim(),
        institution: dto.institution?.trim() || null,
        fieldOfStudy: dto.fieldOfStudy?.trim() || null,
        yearCompleted: dto.yearCompleted ?? null,
      },
    });
    if (!candidate.highestEducation) {
      await this.prisma.candidate.update({
        where: { userId },
        data: { highestEducation: dto.qualification.trim() },
      });
    }
    return this.recompute(userId);
  }

  async updateEducation(userId: string, educationId: string, dto: UpdateEducationDto) {
    const candidate = await this.loadCandidate(userId);
    const existing = await this.prisma.candidateEducation.findFirst({
      where: { id: educationId, candidateId: candidate.id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Education record was not found',
      });
    }
    await this.prisma.candidateEducation.update({
      where: { id: educationId },
      data: {
        ...(dto.qualification !== undefined ? { qualification: dto.qualification.trim() } : {}),
        ...(dto.institution !== undefined ? { institution: dto.institution.trim() || null } : {}),
        ...(dto.fieldOfStudy !== undefined ? { fieldOfStudy: dto.fieldOfStudy.trim() || null } : {}),
        ...(dto.yearCompleted !== undefined ? { yearCompleted: dto.yearCompleted } : {}),
      },
    });
    return this.recompute(userId);
  }

  async removeEducation(userId: string, educationId: string) {
    const candidate = await this.loadCandidate(userId);
    await this.prisma.candidateEducation.deleteMany({
      where: { id: educationId, candidateId: candidate.id },
    });
    return this.recompute(userId);
  }

  async addSkill(userId: string, dto: SkillDto) {
    const candidate = await this.loadCandidate(userId);
    const name = dto.name.trim();
    const alreadyAdded = candidate.skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase());
    if (!alreadyAdded && candidate.skills.length >= CANDIDATE_MAX_SKILLS) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: CANDIDATE_MAX_SKILLS_MESSAGE });
    }
    await this.prisma.candidateSkill.upsert({
      where: { candidateId_name: { candidateId: candidate.id, name } },
      update: {},
      create: { candidateId: candidate.id, name },
    });
    return this.recompute(userId);
  }

  async removeSkill(userId: string, skillId: string) {
    const candidate = await this.loadCandidate(userId);
    await this.prisma.candidateSkill.deleteMany({
      where: { id: skillId, candidateId: candidate.id },
    });
    return this.recompute(userId);
  }

  async addExperience(userId: string, dto: ExperienceDto) {
    const candidate = await this.loadCandidate(userId);
    await this.prisma.candidateExperience.create({
      data: {
        candidateId: candidate.id,
        company: dto.company.trim(),
        jobTitle: dto.jobTitle.trim(),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        description: dto.description?.trim() || null,
        isInternship: Boolean(dto.isInternship),
        stillInCompany: Boolean(dto.stillInCompany),
      },
    });
    await this.prisma.candidate.update({
      where: { userId },
      data: {
        hasExperience: dto.isInternship
          ? candidate.hasExperience === 'YES'
            ? 'YES'
            : 'INTERNSHIP'
          : 'YES',
        experienceLevel: dto.isInternship ? candidate.experienceLevel || 'fresher' : 'experienced',
      },
    });
    return this.recompute(userId);
  }

  async updateExperience(userId: string, experienceId: string, dto: UpdateExperienceDto) {
    const candidate = await this.loadCandidate(userId);
    const existing = await this.prisma.candidateExperience.findFirst({
      where: { id: experienceId, candidateId: candidate.id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Experience record was not found',
      });
    }
    await this.prisma.candidateExperience.update({
      where: { id: experienceId },
      data: {
        ...(dto.company !== undefined ? { company: dto.company.trim() } : {}),
        ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle.trim() } : {}),
        ...(dto.startDate !== undefined ? { startDate: dto.startDate ? new Date(dto.startDate) : null } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.isInternship !== undefined ? { isInternship: dto.isInternship } : {}),
        ...(dto.stillInCompany !== undefined ? { stillInCompany: dto.stillInCompany } : {}),
      },
    });
    return this.recompute(userId);
  }

  async removeExperience(userId: string, experienceId: string) {
    const candidate = await this.loadCandidate(userId);
    await this.prisma.candidateExperience.deleteMany({
      where: { id: experienceId, candidateId: candidate.id },
    });
    return this.recompute(userId);
  }

  async addCertification(userId: string, dto: CertificationDto) {
    rejectIf(yearNumberError(dto.year));
    rejectIf(optionalUrlError(dto.url || ''));
    const candidate = await this.loadCandidate(userId);
    const items = parseRecords(candidate.certifications);
    items.push({
      id: randomUUID(),
      name: dto.name.trim(),
      issuer: dto.issuer?.trim() || null,
      year: dto.year ?? null,
      credentialId: dto.credentialId?.trim() || null,
      // ADDITIVE optional certificate URL
      url: normalizeHttpUrl(dto.url),
    });
    await this.prisma.candidate.update({
      where: { userId },
      data: { certifications: JSON.stringify(items) },
    });
    return this.recompute(userId);
  }

  async removeCertification(userId: string, certificationId: string) {
    const candidate = await this.loadCandidate(userId);
    const items = parseRecords(candidate.certifications).filter((item) => item.id !== certificationId);
    await this.prisma.candidate.update({
      where: { userId },
      data: { certifications: JSON.stringify(items) },
    });
    return this.recompute(userId);
  }

  async addProject(userId: string, dto: ProjectDto) {
    rejectIf(yearNumberError(dto.year));
    rejectIf(optionalUrlError(dto.url || ''));
    const candidate = await this.loadCandidate(userId);
    const items = parseRecords(candidate.projects);
    items.push({
      id: randomUUID(),
      title: dto.title.trim(),
      role: dto.role?.trim() || null,
      year: dto.year ?? null,
      description: dto.description?.trim() || null,
      url: normalizeHttpUrl(dto.url),
    });
    await this.prisma.candidate.update({
      where: { userId },
      data: { projects: JSON.stringify(items) },
    });
    return this.recompute(userId);
  }

  async removeProject(userId: string, projectId: string) {
    const candidate = await this.loadCandidate(userId);
    const items = parseRecords(candidate.projects).filter((item) => item.id !== projectId);
    await this.prisma.candidate.update({
      where: { userId },
      data: { projects: JSON.stringify(items) },
    });
    return this.recompute(userId);
  }

  /**
   * Delete superseded photo objects. Only this candidate's own keys are ever deleted — never a path
   * taken verbatim from the stored reference. A legacy 8-char key is deleted only when it was this
   * candidate's reference and no other candidate still points at it (the short key can collide).
   */
  private async removeStaleProfilePhotos(candidateId: string, previousStored: string | null, keepPath: string | null) {
    if (!this.storage.isConfigured()) return;
    const doomed = new Set(canonicalProfilePhotoPaths(candidateId).filter((path) => path !== keepPath));
    const previous = ownedProfilePhotoPath(previousStored, candidateId, this.storage.getBucketName());
    if (previous?.legacy && previous.path !== keepPath) {
      const sharedWith = await this.prisma.candidate.count({
        where: { id: { not: candidateId }, photoUrl: previousStored },
      });
      if (sharedWith === 0) doomed.add(previous.path);
    }
    for (const path of doomed) {
      await this.storage.deleteFile(path);
    }
  }

  /** Browser-readable URL for the candidate's own photo only (signed URL, else inline data URL). */
  private async resolvePhotoUrl(candidateId: string, stored: string | null | undefined): Promise<string | null> {
    if (!stored) return null;
    if (isSafeInlinePhoto(stored)) return stored;
    if (!this.storage.isConfigured()) return null;
    const owned = ownedProfilePhotoPath(stored, candidateId, this.storage.getBucketName());
    if (!owned) {
      this.logger.warn(`Ignoring non-owned photo reference for candidate ${candidateId}`);
      return null;
    }
    try {
      return await this.storage.getSignedUrl(owned.path, { action: 'read', expiresInMinutes: 60 * 24 * 7 });
    } catch {
      // Cloud Run ADC has no signing key; fall back to an inline copy of the owned object.
    }
    return readOwnedProfilePhotoDataUrl(this.storage, candidateId, stored);
  }

  private async withReadablePhoto<T extends { id: string; photoUrl?: string | null }>(profile: T): Promise<T> {
    return {
      ...profile,
      photoUrl: await this.resolvePhotoUrl(profile.id, profile.photoUrl),
    };
  }

  private async loadCandidate(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: { education: true, skills: true, experiences: true, user: { select: { phone: true, email: true } } },
    });
    if (!candidate) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Candidate profile was not found',
      });
    }
    return candidate;
  }

  private async recompute(userId: string) {
    const candidate = await this.loadCandidate(userId);
    const previousCompletion = candidate.profileCompletion || 0;
    const profileCompletion = computeCompletion(candidate);
    const flags = deriveExperienceFlags({
      hasExperience: candidate.hasExperience,
      experienceLevel: candidate.experienceLevel,
      experiences: candidate.experiences,
    });
    const updated = await this.prisma.candidate.update({
      where: { userId },
      data: {
        profileCompletion,
        hasExperience: flags.hasExperience,
        experienceLevel: flags.experienceLevel,
      },
      include: { education: true, skills: true, experiences: true, user: { select: { phone: true, email: true } } },
    });
    if (previousCompletion < 80 && profileCompletion >= 80) {
      await this.testimonials.markEligible(userId, 'PROFILE_80_COMPLETE').catch(() => undefined);
    }
    return this.withReadablePhoto(this.toProfile(updated));
  }

  private toProfile(candidate: NonNullable<CandidateRecord>) {
    return {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      city: candidate.city,
      state: candidate.state,
      preferredWorkCity: candidate.preferredWorkCity || candidate.city,
      phone: candidate.user?.phone || null,
      email: candidate.user?.email || null,
      preferredLanguage: candidate.preferredLanguage,
      dateOfBirth: candidate.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      gender: candidate.gender,
      openToRelocating: candidate.openToRelocating,
      highestEducation: candidate.highestEducation,
      stillInCollege: candidate.stillInCollege,
      educationStart: candidate.educationStart,
      educationEnd: candidate.educationEnd,
      experienceLevel: candidate.experienceLevel,
      totalExperienceYears: candidate.totalExperienceYears,
      totalExperienceMonths: candidate.totalExperienceMonths,
      gapReason: candidate.gapReason,
      gapMonths: candidate.gapMonths ?? null,
      source: candidate.source,
      about: candidate.about || null,
      careerInterests: parseInterests(candidate.careerInterests),
      hasExperience: candidate.hasExperience,
      noticePeriod: candidate.noticePeriod ?? null,
      employmentStatus: candidate.employmentStatus ?? null,
      experienceRange: candidate.experienceRange ?? null,
      expectedSalaryMin: candidate.expectedSalaryMin ?? null,
      expectedSalaryMax: candidate.expectedSalaryMax ?? null,
      preferredJobTypes: parseInterests(candidate.preferredJobTypes),
      onboardingSkippedSteps: parseSkippedSteps(candidate.onboardingSkippedSteps).filter(
        (step) => !onboardingStepAnswered(candidate, step),
      ),
      profileCompletion: candidate.profileCompletion,
      onboardingCompleted: candidate.onboardingCompleted,
      dashboardReached: candidate.dashboardReached,
      whatsappOptIn: candidate.whatsappOptIn,
      whatsappNumber: candidate.whatsappNumber,
      whatsappVerified: candidate.whatsappVerified,
      education: candidate.education.map((item) => ({
        id: item.id,
        qualification: item.qualification,
        institution: item.institution,
        fieldOfStudy: item.fieldOfStudy,
        yearCompleted: item.yearCompleted,
        startDate: item.startDate,
        endDate: item.endDate,
      })),
      skills: candidate.skills.map((item) => ({ id: item.id, name: item.name })),
      experiences: candidate.experiences.map((item) => ({
        id: item.id,
        company: item.company,
        jobTitle: item.jobTitle,
        startDate: item.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: item.endDate?.toISOString().slice(0, 10) ?? null,
        description: item.description,
        isInternship: item.isInternship,
        stillInCompany: item.stillInCompany,
      })),
      certifications: parseRecords(candidate.certifications) as Array<{
        id: string;
        name: string;
        issuer: string | null;
        year: number | null;
        credentialId: string | null;
        url?: string | null;
      }>,
      projects: parseRecords(candidate.projects) as Array<{
        id: string;
        title: string;
        role: string | null;
        year: number | null;
        description: string | null;
        url: string | null;
      }>,
      photoUrl: candidate.photoUrl || null,
      links: parseLinks(candidate.profileLinks),
    };
  }
}

function yearFrom(value: string) {
  const match = value.match(/^(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1970 && year <= 2100 ? year : null;
}

function parseOptionalDate(value?: string) {
  const raw = value?.trim();
  if (!raw) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whether the data an onboarding step collects is present (a skipped step stops being flagged once filled). */
function onboardingStepAnswered(candidate: NonNullable<CandidateRecord>, step: number): boolean {
  switch (step) {
    case 1:
      return Boolean(candidate.state?.trim() || candidate.city?.trim() || candidate.preferredWorkCity?.trim());
    case 2:
      return Boolean(candidate.employmentStatus);
    case 3:
      return (
        parseInterests(candidate.careerInterests).length > 0 ||
        parseInterests(candidate.preferredJobTypes).length > 0 ||
        candidate.expectedSalaryMin != null ||
        candidate.expectedSalaryMax != null
      );
    case 4:
      return candidate.skills.length > 0;
    default:
      return true;
  }
}

function parseInterests(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function sectionDone(candidate: NonNullable<CandidateRecord>, key: PassportSection['key']) {
  if (key === 'personal') {
    return Boolean(candidate.firstName?.trim() && candidate.city?.trim() && candidate.dateOfBirth);
  }
  if (key === 'education') {
    if (candidate.highestEducation?.trim()) return true;
    return candidate.education.some(
      (row) => Boolean(row.qualification?.trim()) || Boolean(row.institution?.trim()),
    );
  }
  if (key === 'skills') return candidate.skills.length >= 3;
  if (key === 'experience') {
    if (!candidate.hasExperience) return false;
    if (candidate.hasExperience === 'NONE') return true;
    return candidate.experiences.length > 0;
  }
  if (key === 'preferences') return parseInterests(candidate.careerInterests).length > 0;
  if (key === 'languages') return Boolean(candidate.preferredLanguage);
  if (key === 'certifications') return parseRecords(candidate.certifications).length > 0;
  if (key === 'projects') return parseRecords(candidate.projects).length > 0;
  if (key === 'photo') return Boolean(candidate.photoUrl);
  if (key === 'links') return Object.values(parseLinks(candidate.profileLinks)).some(Boolean);
  return false;
}

function parseRecords(raw: string): Array<{ id: string } & Record<string, unknown>> {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && 'id' in item) : [];
  } catch {
    return [];
  }
}

function parseStringList(raw: string | null | undefined): string[] {
  try {
    const value = JSON.parse(raw || '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>;
          return String(row.title ?? row.label ?? row.text ?? row.description ?? '');
        }
        return '';
      })
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseInterviewReportSummary(raw: string | null): { summary: string; recommendation: string | null } {
  try {
    const value = JSON.parse(raw || '{}') as { summary?: unknown; recommendation?: unknown };
    return {
      summary: typeof value.summary === 'string' ? value.summary.trim() : '',
      recommendation: typeof value.recommendation === 'string' ? value.recommendation : null,
    };
  } catch {
    return { summary: '', recommendation: null };
  }
}

function parseLinks(raw: string) {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== 'object') return {};
    return cleanLinks({
      linkedin: typeof value.linkedin === 'string' ? value.linkedin : undefined,
      github: typeof value.github === 'string' ? value.github : undefined,
      portfolio: typeof value.portfolio === 'string' ? value.portfolio : undefined,
      website: typeof value.website === 'string' ? value.website : undefined,
    });
  } catch {
    return {};
  }
}

function cleanLinks(input: {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  website?: string;
}) {
  return {
    ...(normalizeHttpUrl(input.linkedin) ? { linkedin: normalizeHttpUrl(input.linkedin)! } : {}),
    ...(normalizeHttpUrl(input.github) ? { github: normalizeHttpUrl(input.github)! } : {}),
    ...(normalizeHttpUrl(input.portfolio) ? { portfolio: normalizeHttpUrl(input.portfolio)! } : {}),
    ...(normalizeHttpUrl(input.website) ? { website: normalizeHttpUrl(input.website)! } : {}),
  };
}

function rejectIf(message: string | null) {
  if (message) {
    throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message });
  }
}

function buildSections(candidate: NonNullable<CandidateRecord>): PassportSection[] {
  return (Object.keys(PASSPORT_SECTION_COPY) as Array<keyof typeof PASSPORT_SECTION_COPY>).map(
    (key) => ({
      key,
      ...PASSPORT_SECTION_COPY[key],
      done: sectionDone(candidate, key),
    }),
  );
}

function computeCompletion(candidate: NonNullable<CandidateRecord>) {
  const sections = buildSections(candidate);
  return computeProfileOverviewCompletion(sections, candidate.skills.length);
}
