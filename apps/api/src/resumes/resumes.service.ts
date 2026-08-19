import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode, type ResumeContent } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';

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

  async create(userId: string, dto: { targetJobTitle?: string; template?: string }) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: { user: true, skills: true, education: true, experiences: true },
    });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    const content = this.contentFromPassport(candidate, dto.targetJobTitle);
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
    const record = await this.get(userId, id);
    return { html: renderHtml(record.content, record.template), fileName: `${record.title.replace(/\s+/g, '-')}.html` };
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

function renderHtml(content: ResumeContent, template: string) {
  const accent = template === 'MODERN' ? '#e07a3d' : '#004043';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${content.fullName}</title>
  <style>body{font-family:Arial,sans-serif;color:#123132;max-width:720px;margin:24px auto;padding:24px;border:1px solid #d7ecec}
  h1{color:${accent};margin:0} h2{color:#004043;border-bottom:1px solid #d7ecec;padding-bottom:4px}</style></head>
  <body><h1>${content.fullName}</h1><p>${content.city || ''} ${content.phone || ''}</p>
  <h2>SUMMARY</h2><p>${content.summary}</p>
  <h2>SKILLS</h2><p>${content.skills.join(' | ')}</p>
  <h2>EXPERIENCE</h2>${content.experiences.map((item) => `<p><strong>${item.jobTitle}</strong> — ${item.company}<br>${item.description || ''}</p>`).join('')}
  <h2>EDUCATION</h2>${content.education.map((item) => `<p>${item.qualification} ${item.institution || ''} ${item.yearCompleted || ''}</p>`).join('')}
  </body></html>`;
}
