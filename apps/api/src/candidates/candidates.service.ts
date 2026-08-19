import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode, PASSPORT_SECTION_COPY, type PassportSection } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  EducationDto,
  ExperienceDto,
  SkillDto,
  UpdateCandidateDto,
  UpdateEducationDto,
  UpdateExperienceDto,
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
        ...(dto.preferredLanguage !== undefined ? { preferredLanguage: dto.preferredLanguage } : {}),
        ...(dto.dateOfBirth !== undefined
          ? { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }
          : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender || null } : {}),
        ...(dto.openToRelocating !== undefined ? { openToRelocating: dto.openToRelocating } : {}),
        ...(dto.highestEducation !== undefined ? { highestEducation: dto.highestEducation } : {}),
        ...(careerInterests !== undefined ? { careerInterests } : {}),
        ...(dto.hasExperience !== undefined ? { hasExperience: dto.hasExperience } : {}),
      },
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

  private async loadCandidate(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: { education: true, skills: true, experiences: true },
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
        candidate.city &&
        candidate.highestEducation &&
        parseInterests(candidate.careerInterests).length > 0 &&
        candidate.hasExperience,
    );
    const updated = await this.prisma.candidate.update({
      where: { userId },
      data: { profileCompletion, onboardingCompleted },
      include: { education: true, skills: true, experiences: true },
    });
    return this.toProfile(updated);
  }

  private toProfile(candidate: NonNullable<CandidateRecord>) {
    return {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      city: candidate.city,
      preferredLanguage: candidate.preferredLanguage,
      dateOfBirth: candidate.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      gender: candidate.gender,
      openToRelocating: candidate.openToRelocating,
      highestEducation: candidate.highestEducation,
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
      })),
    };
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
  if (key === 'personal') return Boolean(candidate.firstName && candidate.city);
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
  return false;
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
