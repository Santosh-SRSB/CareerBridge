import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
  deriveExperienceFlags,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { StorageService } from '../common/storage/storage.service';
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
} from './dto/update-candidate.dto';

type CandidateRecord = Awaited<ReturnType<CandidatesService['loadCandidate']>>;

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly aiGateway: AiGatewayService,
    private readonly storage: StorageService,
  ) {}

  async me(userId: string) {
    return this.withReadablePhoto(this.toProfile(await this.loadCandidate(userId)));
  }

  /** Multipart profile photo upload — avoids large JSON data-URL payloads. */
  async uploadPhotoFile(
    userId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
  ) {
    const mime = (file.mimetype || '').toLowerCase();
    if (!mime.startsWith('image/jpeg') && !mime.startsWith('image/jpg') && !mime.startsWith('image/png')) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Please upload a JPG or PNG photo.',
      });
    }
    if (!file.buffer?.length || file.size > 5 * 1024 * 1024) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Photo must be under 5 MB.',
      });
    }

    const candidate = await this.loadCandidate(userId);
    const previousPath = this.gcsPathFromPhotoUrl(candidate.photoUrl);
    const ext = mime.includes('png') ? '.png' : '.jpg';
    let storedUrl: string;

    if (this.storage.isConfigured()) {
      try {
        // Stable key per candidate so replace overwrites instead of leaving orphans.
        const path = this.storage.imageObjectPath(`profile-photo${ext}`, candidate.id.slice(0, 8));
        const uploaded = await this.storage.uploadFile(path, file.buffer, {
          contentType: mime.includes('png') ? 'image/png' : 'image/jpeg',
          isPublic: true,
          metadata: { candidateId: candidate.id, source: 'profile-photo' },
        });
        storedUrl = uploaded.publicUrl;
        await this.deleteReplacedProfilePhotos(candidate.id, previousPath, path);
      } catch (err) {
        this.logger.error(
          `Profile photo multipart GCS upload failed for ${candidate.id}: ${(err as Error).message}`,
        );
        storedUrl = `data:${mime.includes('png') ? 'image/png' : 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
      }
    } else {
      storedUrl = `data:${mime.includes('png') ? 'image/png' : 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
    }

    await this.prisma.candidate.update({
      where: { userId },
      data: { photoUrl: storedUrl },
    });
    this.logger.log(`Saved profile photo for candidate ${candidate.id} (${file.size} bytes)`);
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

    let photoUrl = dto.photoUrl;
    if (dto.photoUrl !== undefined && dto.photoUrl) {
      photoUrl = await this.persistProfilePhoto(candidate.id, dto.photoUrl);
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
        ...(dto.preferredWorkCity !== undefined
          ? {
              preferredWorkCity: dto.preferredWorkCity.trim(),
              ...(dto.city === undefined ? { city: dto.preferredWorkCity.trim() } : {}),
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
        ...(careerInterests !== undefined ? { careerInterests } : {}),
        ...(dto.hasExperience !== undefined ? { hasExperience: dto.hasExperience } : {}),
        ...(dto.experienceLevel !== undefined ? { experienceLevel: dto.experienceLevel } : {}),
        ...(dto.totalExperienceYears !== undefined
          ? { totalExperienceYears: Number.parseInt(dto.totalExperienceYears, 10) || 0 }
          : {}),
        ...(dto.totalExperienceMonths !== undefined
          ? { totalExperienceMonths: Number.parseInt(dto.totalExperienceMonths, 10) || 0 }
          : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: photoUrl || null } : {}),
        ...(dto.links !== undefined ? { profileLinks: JSON.stringify(cleanLinks(dto.links)) } : {}),
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

  /** Store profile photos flat under Images/ in GCS (overwrite stable key per candidate). */
  private async persistProfilePhoto(candidateId: string, photoUrl: string): Promise<string> {
    const dataUrl = photoUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+)(?:;[^,]*)?;base64,([\s\S]+)$/i);
    if (!dataUrl) {
      return photoUrl;
    }
    if (!this.storage.isConfigured()) {
      return photoUrl;
    }

    try {
      const mime = dataUrl[1].toLowerCase();
      const ext =
        mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : mime.includes('gif') ? '.gif' : '.jpg';
      const buffer = Buffer.from(dataUrl[2], 'base64');
      const previous = await this.prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { photoUrl: true },
      });
      const previousPath = this.gcsPathFromPhotoUrl(previous?.photoUrl);
      const path = this.storage.imageObjectPath(`profile-photo${ext}`, candidateId.slice(0, 8));
      const uploaded = await this.storage.uploadFile(path, buffer, {
        contentType: mime,
        isPublic: true,
        metadata: { candidateId, source: 'profile-photo' },
      });
      await this.deleteReplacedProfilePhotos(candidateId, previousPath, path);
      return uploaded.publicUrl;
    } catch (err) {
      this.logger.error(
        `Profile photo GCS upload failed for ${candidateId}: ${(err as Error).message}`,
      );
      // Keep the data URL so the photo still saves and displays if GCS fails.
      return photoUrl;
    }
  }

  private gcsPathFromPhotoUrl(photoUrl: string | null | undefined): string | null {
    if (!photoUrl) return null;
    const match = photoUrl.match(/^https?:\/\/storage\.googleapis\.com\/[^/]+\/(.+?)(?:\?|$)/i);
    if (!match?.[1]) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  /** Remove the previous object (and jpg/png twin) when a new profile photo replaces it. */
  private async deleteReplacedProfilePhotos(
    candidateId: string,
    previousPath: string | null,
    nextPath: string,
  ) {
    if (!this.storage.isConfigured()) return;
    const prefix = candidateId.slice(0, 8);
    const candidates = new Set<string>();
    if (previousPath && previousPath !== nextPath) candidates.add(previousPath);
    // Drop the other extension on the stable key (jpg ↔ png).
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const) {
      const twin = this.storage.imageObjectPath(`profile-photo${ext === '.jpeg' ? '.jpg' : ext}`, prefix);
      if (twin !== nextPath) candidates.add(twin);
    }
    // Legacy timestamped keys: Images/photo-{ts}-{id}.ext
    if (previousPath && /\/photo-\d+-/.test(previousPath) && previousPath !== nextPath) {
      candidates.add(previousPath);
    }
    for (const path of candidates) {
      await this.storage.deleteFile(path);
    }
  }

  /** Turn private GCS object URLs into browser-readable URLs (signed, or data URL fallback). */
  private async resolvePhotoUrl(photoUrl: string | null | undefined): Promise<string | null> {
    if (!photoUrl) return null;
    if (photoUrl.startsWith('data:') || photoUrl.startsWith('blob:')) return photoUrl;
    if (!this.storage.isConfigured()) return photoUrl;

    const match = photoUrl.match(
      /^https?:\/\/storage\.googleapis\.com\/[^/]+\/(.+?)(?:\?|$)/i,
    );
    if (!match?.[1]) return photoUrl;

    const objectPath = decodeURIComponent(match[1]);

    try {
      return await this.storage.getSignedUrl(objectPath, {
        action: 'read',
        expiresInMinutes: 60 * 24 * 7,
      });
    } catch (err) {
      this.logger.warn(`Could not sign photo URL: ${(err as Error).message}`);
    }

    // Uniform bucket ACL + missing client_email → public URL 403s in the browser.
    // Download via the same credentials that uploaded and return a data URL.
    try {
      const buffer = await this.storage.downloadFile(objectPath);
      const lower = objectPath.toLowerCase();
      const mime = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.gif')
            ? 'image/gif'
            : 'image/jpeg';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (err) {
      this.logger.warn(`Could not download photo for display: ${(err as Error).message}`);
      return photoUrl;
    }
  }

  private async withReadablePhoto<T extends { photoUrl?: string | null }>(profile: T): Promise<T> {
    return {
      ...profile,
      photoUrl: await this.resolvePhotoUrl(profile.photoUrl),
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
