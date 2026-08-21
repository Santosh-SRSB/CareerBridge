import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode, type ResumeContent, ATS_ENHANCE_PLANS } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { renderResumePdf } from './resume-pdf';

@Injectable()
export class ResumesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
  ) {}

  async list(userId: string) {
    const candidate = await this.requireCandidate(userId);
    const rows = await this.prisma.resume.findMany({
      where: { candidateId: candidate.id },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async create(userId: string, dto: { targetJobTitle?: string; template?: string; includePhoto?: boolean }) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: { user: true, skills: true, education: true, experiences: true },
    });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    const content = this.contentFromPassport(candidate, dto.targetJobTitle);
    if (dto.includePhoto === false) content.includePhoto = false;
    if (dto.includePhoto === true) content.includePhoto = true;
    const analysis = this.intelligence.analyzeResume(content);
    const title = dto.targetJobTitle ? `${dto.targetJobTitle} Resume` : 'General Resume';
    const created = await this.prisma.resume.create({
      data: {
        candidateId: candidate.id,
        title,
        targetJobTitle: dto.targetJobTitle || null,
        template: dto.template || 'CLASSIC',
        summary: content.summary,
        contentJson: JSON.stringify(content),
        score: analysis.score,
      },
    });
    return this.toRecord(created, analysis);
  }

  async upload(
    userId: string,
    dto: { fileName?: string; targetJobTitle?: string; content: Partial<ResumeContent> },
  ) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    const content = sanitizeUploadedContent(dto.content, {
      fullName: [candidate.firstName, candidate.lastName].filter(Boolean).join(' '),
      city: candidate.city,
      phone: candidate.user.phone,
    });
    const analysis = this.intelligence.analyzeResume(content);
    const baseName = (dto.fileName || 'Uploaded resume').replace(/\.[^.]+$/, '').trim() || 'Uploaded resume';
    const created = await this.prisma.resume.create({
      data: {
        candidateId: candidate.id,
        title: baseName,
        targetJobTitle: dto.targetJobTitle || content.experiences[0]?.jobTitle || null,
        template: 'CLASSIC',
        summary: content.summary,
        contentJson: JSON.stringify(content),
        score: analysis.score,
      },
    });
    return this.toRecord(created, analysis);
  }

  async enhance(userId: string, id: string) {
    const record = await this.get(userId, id);
    return {
      ...record,
      plans: ATS_ENHANCE_PLANS.map((plan) => ({ ...plan })),
    };
  }

  async get(userId: string, id: string) {
    const resume = await this.requireResume(userId, id);
    const content = parseContent(resume.contentJson);
    return this.toRecord(resume, this.intelligence.analyzeResume(content));
  }

  async update(userId: string, id: string, dto: { title?: string; targetJobTitle?: string; template?: string; summary?: string }) {
    const resume = await this.requireResume(userId, id);
    const content = parseContent(resume.contentJson);
    if (dto.summary !== undefined) content.summary = dto.summary;
    const analysis = this.intelligence.analyzeResume(content);
    const updated = await this.prisma.resume.update({
      where: { id: resume.id },
      data: {
        title: dto.title ?? resume.title,
        targetJobTitle: dto.targetJobTitle ?? resume.targetJobTitle,
        template: dto.template ?? resume.template,
        summary: content.summary,
        contentJson: JSON.stringify(content),
        score: analysis.score,
        version: resume.version + 1,
      },
    });
    return this.toRecord(updated, analysis);
  }

  async remove(userId: string, id: string) {
    const resume = await this.requireResume(userId, id);
    await this.prisma.resume.delete({ where: { id: resume.id } });
    return { deleted: true };
  }

  async analyze(userId: string, id: string) {
    return this.get(userId, id);
  }

  async duplicate(userId: string, id: string) {
    const resume = await this.requireResume(userId, id);
    const copy = await this.prisma.resume.create({
      data: {
        candidateId: resume.candidateId,
        title: `${resume.title} copy`,
        targetJobTitle: resume.targetJobTitle,
        template: resume.template,
        summary: resume.summary,
        contentJson: resume.contentJson,
        score: resume.score,
      },
    });
    return this.toRecord(copy);
  }

  async download(userId: string, id: string) {
    const resume = await this.requireResume(userId, id);
    const candidate = await this.requireCandidate(userId);
    const content = parseContent(resume.contentJson);
    const includePhoto = content.includePhoto !== false;
    const pdf = await renderResumePdf(
      content,
      resume.template,
      includePhoto ? candidate.photoUrl : null,
    );
    return {
      pdf: pdf.toString('base64'),
      fileName: `${resume.title.replace(/\s+/g, '-')}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  private contentFromPassport(
    candidate: {
      firstName: string | null;
      lastName: string | null;
      city: string | null;
      preferredLanguage: string | null;
      user: { phone: string };
      skills: Array<{ name: string }>;
      education: Array<{ qualification: string; institution: string | null; yearCompleted: number | null }>;
      experiences: Array<{ company: string; jobTitle: string; description: string | null; isInternship: boolean }>;
    },
    targetJobTitle?: string,
  ) {
    const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'Candidate';
    return this.intelligence.buildResumeContent({
      fullName,
      city: candidate.city,
      phone: candidate.user.phone,
      language: candidate.preferredLanguage,
      skills: candidate.skills.map((item) => item.name),
      education: candidate.education,
      experiences: candidate.experiences,
      targetJobTitle,
    });
  }

  private async requireCandidate(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
    });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    return candidate;
  }

  private async requireResume(userId: string, id: string) {
    const candidate = await this.requireCandidate(userId);
    const resume = await this.prisma.resume.findFirst({ where: { id, candidateId: candidate.id } });
    if (!resume) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Resume was not found' });
    }
    return resume;
  }

  private toRecord(row: {
    id: string;
    title: string;
    targetJobTitle: string | null;
    template: string;
    summary: string | null;
    contentJson: string;
    score: number;
    version: number;
    updatedAt: Date;
  }, analysis?: ReturnType<IntelligenceService['analyzeResume']>) {
    return {
      id: row.id,
      title: row.title,
      targetJobTitle: row.targetJobTitle,
      template: row.template,
      summary: row.summary,
      content: parseContent(row.contentJson),
      score: row.score,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
      analysis,
    };
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeUploadedContent(
  raw: Partial<ResumeContent> | Record<string, unknown>,
  fallback: { fullName: string; city: string | null; phone: string | null },
): ResumeContent {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const education = Array.isArray(data.education)
    ? data.education
        .map((row) => {
          const item = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
          const yearRaw = item.yearCompleted;
          const yearCompleted =
            typeof yearRaw === 'number'
              ? yearRaw
              : Number.parseInt(asString(yearRaw), 10) || null;
          return {
            qualification: asString(item.qualification),
            institution: asString(item.institution) || null,
            yearCompleted,
          };
        })
        .filter((row) => row.qualification)
    : [];
  const experiences = Array.isArray(data.experiences)
    ? data.experiences
        .map((row) => {
          const item = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
          return {
            company: asString(item.company),
            jobTitle: asString(item.jobTitle),
            description: asString(item.description) || null,
            isInternship: Boolean(item.isInternship),
          };
        })
        .filter((row) => row.company || row.jobTitle)
    : [];
  const skills = Array.isArray(data.skills) ? data.skills.map((item) => asString(item)).filter(Boolean) : [];
  const languages = Array.isArray(data.languages)
    ? data.languages.map((item) => asString(item)).filter(Boolean)
    : [];
  return {
    fullName: asString(data.fullName) || fallback.fullName || 'Candidate',
    city: asString(data.city) || fallback.city,
    phone: asString(data.phone) || fallback.phone,
    summary: asString(data.summary),
    skills,
    education,
    experiences,
    languages,
  };
}

function parseContent(raw: string): ResumeContent {
  try {
    return JSON.parse(raw) as ResumeContent;
  } catch {
    return {
      fullName: '',
      city: null,
      phone: null,
      summary: '',
      skills: [],
      education: [],
      experiences: [],
      languages: [],
    };
  }
}
