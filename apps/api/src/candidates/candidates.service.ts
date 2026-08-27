import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ErrorCode,
  PASSPORT_SECTION_COPY,
  type PassportSection,
  normalizeHttpUrl,
  optionalUrlError,
  yearNumberError,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
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
} from './dto/update-candidate.dto';

type CandidateRecord = Awaited<ReturnType<CandidatesService['loadCandidate']>>;

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    return this.toProfile(await this.loadCandidate(userId));
  }

  async completion(userId: string) {
    const candidate = await this.loadCandidate(userId);
    const sections = buildSections(candidate);
    return {
      percentage: candidate.profileCompletion,
      onboardingCompleted: candidate.onboardingCompleted,
      sections,
      missing: sections.filter((item) => !item.done && item.weight > 0).map((item) => item.label),
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
    await this.loadCandidate(userId);
    const names = dto.fullName?.trim().split(/\s+/).filter(Boolean);
    const careerInterests = dto.careerInterests
      ? JSON.stringify(dto.careerInterests.slice(0, 3))
      : undefined;

    await this.prisma.candidate.update({
      where: { userId },
      data: {
        ...(names?.length
          ? { firstName: names[0], lastName: names.slice(1).join(' ') || null }
          : {}),
        ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
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
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl || null } : {}),
        ...(dto.links !== undefined ? { profileLinks: JSON.stringify(cleanLinks(dto.links)) } : {}),
      },
    });

    return this.recompute(userId);
  }

  async savePassport(userId: string, dto: SavePassportDto) {
    const candidate = await this.loadCandidate(userId);
    const education = (dto.education ?? []).filter((row) => row.qualification?.trim());
    const skills = [...new Set((dto.skills ?? []).map((item) => item.trim()).filter(Boolean))];
    const jobs =
      dto.experienceLevel === 'fresher'
        ? []
        : (dto.experience ?? []).filter(
            (row) => row.company?.trim() || row.jobTitle?.trim() || row.description?.trim(),
          );
    const years = Number.parseInt(dto.totalExperienceYears || '0', 10) || 0;
    const months = Number.parseInt(dto.totalExperienceMonths || '0', 10) || 0;
    const firstEdu = education[0];
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
          highestEducation: firstEdu?.qualification.trim() || candidate.highestEducation,
          stillInCollege: Boolean(dto.stillInCollege),
          educationStart: dto.educationStart?.trim() || null,
          educationEnd: dto.stillInCollege ? null : dto.educationEnd?.trim() || null,
          experienceLevel: dto.experienceLevel || 'fresher',
          totalExperienceYears: years,
          totalExperienceMonths: months,
          gapReason: dto.gapReason?.trim() || null,
          gapMonths:
            typeof dto.gapMonths === 'number' && Number.isFinite(dto.gapMonths)
              ? Math.max(0, Math.floor(dto.gapMonths))
              : null,
          source: dto.source === 'resume' ? 'resume' : 'manual',
          hasExperience:
            dto.experienceLevel === 'experienced'
              ? jobs.some((row) => row.isInternship) && !jobs.some((row) => !row.isInternship)
                ? 'INTERNSHIP'
                : 'YES'
              : 'NONE',
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
            qualification: row.qualification.trim(),
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

    return this.recompute(userId);
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
      },
    });
    if (!candidate.hasExperience) {
      await this.prisma.candidate.update({
        where: { userId },
        data: { hasExperience: dto.isInternship ? 'INTERNSHIP' : 'YES' },
      });
    }
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
    const candidate = await this.loadCandidate(userId);
    const items = parseRecords(candidate.certifications);
    items.push({
      id: randomUUID(),
      name: dto.name.trim(),
      issuer: dto.issuer?.trim() || null,
      year: dto.year ?? null,
      credentialId: dto.credentialId?.trim() || null,
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
    const onboardingCompleted = Boolean(
      candidate.firstName &&
        (candidate.highestEducation || candidate.education.length > 0),
    );
    const updated = await this.prisma.candidate.update({
      where: { userId },
      data: { profileCompletion, onboardingCompleted },
      include: { education: true, skills: true, experiences: true, user: { select: { phone: true, email: true } } },
    });
    return this.toProfile(updated);
  }

  private toProfile(candidate: NonNullable<CandidateRecord>) {
    return {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      city: candidate.city,
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
  if (key === 'personal') return Boolean(candidate.firstName);
  if (key === 'education') return Boolean(candidate.highestEducation || candidate.education.length);
  if (key === 'skills') return candidate.skills.length > 0;
  if (key === 'experience') {
    return (
      candidate.hasExperience === 'NONE' ||
      candidate.hasExperience === 'YES' ||
      candidate.hasExperience === 'INTERNSHIP' ||
      candidate.experiences.length > 0
    );
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
  return buildSections(candidate)
    .filter((item) => item.done)
    .reduce((sum, item) => sum + item.weight, 0);
}
