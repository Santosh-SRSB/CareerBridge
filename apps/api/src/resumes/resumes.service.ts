import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ATS_ENHANCE_PLANS,
  ErrorCode,
  analyzeResumeContent,
  applySafeOptimizations,
  extractFacts,
  factPreservationScore,
  type ResumeAnalysis,
  type ResumeChangeRecord,
  type ResumeContent,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { renderResumePdf } from './resume-pdf';
import { ResumeOptimizeAi } from './resume-optimize-ai';
import { analyzeRoleResume, rewriteRoleResume, recommendCareerRoles } from './ats-engine';
import { resolveResumeTemplateId } from '@careerbridge/shared';

@Injectable()
export class ResumesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
    private readonly optimizeAi: ResumeOptimizeAi,
  ) {}

  async list(userId: string) {
    const candidate = await this.requireCandidate(userId);
    const rows = await this.prisma.resume.findMany({
      where: { candidateId: candidate.id },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async create(
    userId: string,
    dto: {
      targetJobTitle?: string;
      title?: string;
      template?: string;
      includePhoto?: boolean;
      blank?: boolean;
      content?: Record<string, unknown>;
    },
  ) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: { user: true, skills: true, education: true, experiences: true },
    });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    let content: ResumeContent & { _manual?: boolean; data?: Record<string, unknown> };
    if (dto.content && typeof dto.content === 'object') {
      content = normalizeStoredContent(dto.content);
    } else if (dto.blank) {
      content = blankManualContent(dto.includePhoto !== false);
    } else {
      content = this.contentFromPassport(candidate, dto.targetJobTitle);
    }
    if (dto.includePhoto === false) content.includePhoto = false;
    if (dto.includePhoto === true) content.includePhoto = true;
    const title =
      (dto.title && dto.title.trim()) ||
      (dto.blank || dto.content ? 'Untitled resume' : dto.targetJobTitle ? `${dto.targetJobTitle} Resume` : 'General Resume');
    const created = await this.prisma.resume.create({
      data: {
        candidateId: candidate.id,
        title,
        targetJobTitle: dto.targetJobTitle || null,
        template: resolveResumeTemplateId(dto.template || 'ats-minimal'),
        summary: content.summary,
        contentJson: JSON.stringify(content),
        score: 0,
        kind: 'ORIGINAL',
      },
    });
    const analysis = await this.persistAnalysis(created.id, content, '');
    return this.toRecord({ ...created, score: analysis.score }, analysis);
  }

  async upload(
    userId: string,
    dto: {
      fileName?: string;
      targetJobTitle?: string;
      content: Partial<ResumeContent>;
      rawText?: string;
      template?: string;
      includePhoto?: boolean;
    },
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
    if (dto.includePhoto === false) content.includePhoto = false;
    if (dto.includePhoto === true) content.includePhoto = true;
    const rawText = (dto.rawText || '').slice(0, 80000);
    const baseName = (dto.fileName || 'Uploaded resume').replace(/\.[^.]+$/, '').trim() || 'Uploaded resume';
    const created = await this.prisma.resume.create({
      data: {
        candidateId: candidate.id,
        title: baseName,
        targetJobTitle: dto.targetJobTitle || content.experiences[0]?.jobTitle || null,
        template: resolveResumeTemplateId(dto.template || 'ats-minimal'),
        summary: content.summary,
        contentJson: JSON.stringify(content),
        rawText,
        score: 0,
        kind: 'ORIGINAL',
      },
    });
    const analysis = await this.persistAnalysis(created.id, content, rawText);
    return this.toRecord({ ...created, score: analysis.score }, analysis);
  }

  async enhance(userId: string, id: string) {
    const record = await this.analyze(userId, id);
    return {
      ...record,
      plans: ATS_ENHANCE_PLANS.map((plan) => ({ ...plan })),
    };
  }

  async get(userId: string, id: string) {
    return this.analyze(userId, id);
  }

  async update(
    userId: string,
    id: string,
    dto: {
      title?: string;
      targetJobTitle?: string;
      template?: string;
      summary?: string;
      content?: Record<string, unknown>;
    },
  ) {
    const resume = await this.requireResume(userId, id);
    let content = parseContent(resume.contentJson);
    if (dto.content && typeof dto.content === 'object') {
      content = normalizeStoredContent(dto.content);
    }
    if (dto.summary !== undefined) content.summary = dto.summary;
    const analysis = analyzeResumeContent(content, resume.rawText || '');
    const updated = await this.prisma.resume.update({
      where: { id: resume.id },
      data: {
        title: dto.title ?? resume.title,
        targetJobTitle: dto.targetJobTitle ?? resume.targetJobTitle,
        template: dto.template ? resolveResumeTemplateId(dto.template) : resume.template,
        summary: content.summary,
        contentJson: JSON.stringify(content),
        score: analysis.score,
        version: resume.kind === 'ORIGINAL' ? resume.version : resume.version + 1,
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
    const resume = await this.requireResume(userId, id);
    const content = parseContent(resume.contentJson);
    const analysis = await this.persistAnalysis(resume.id, content, resume.rawText || '');
    return this.toRecord({ ...resume, score: analysis.score }, analysis);
  }

  async issues(userId: string, id: string) {
    const record = await this.analyze(userId, id);
    return {
      highPriority: record.analysis?.highPriority ?? 0,
      mediumPriority: record.analysis?.mediumPriority ?? 0,
      goodSections: record.analysis?.goodSections ?? 0,
      issues: record.analysis?.issues ?? [],
    };
  }

  async optimizationOptions(userId: string, id: string) {
    const record = await this.analyze(userId, id);
    return {
      score: record.score,
      recommendedPlanId: record.analysis?.recommendedPlanId,
      disclaimer: record.analysis?.disclaimer,
      plans: ATS_ENHANCE_PLANS.map((plan) => ({ ...plan })),
    };
  }

  async startOptimization(userId: string, id: string, planId: string) {
    const plan = ATS_ENHANCE_PLANS.find((item) => item.id === planId);
    if (!plan) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Choose a valid optimization target.' });
    }
    const source = await this.requireResume(userId, id);
    const content = parseContent(source.contentJson);
    const before = analyzeResumeContent(content, source.rawText || '');
    const facts = extractFacts(content, source.rawText || '');
    const optimization = await this.prisma.resumeOptimization.create({
      data: {
        sourceResumeId: source.id,
        planId: plan.id,
        targetMin: plan.minScore,
        targetMax: plan.maxScore,
        status: 'RUNNING',
        beforeScore: before.score,
        updatedAt: new Date(),
      },
    });

    try {
      const ai = await this.optimizeAi.rewrite(content, before.issues, facts);
      const used = ai && ai.changes.length ? ai : applySafeOptimizations(content, facts);
      const after = analyzeResumeContent(used.content, source.rawText || '');
      const preservation = factPreservationScore(facts, used.changes);
      const result = await this.prisma.resume.create({
        data: {
          candidateId: source.candidateId,
          title: `${source.title} (ATS optimized)`,
          targetJobTitle: source.targetJobTitle,
          template: source.template,
          summary: used.content.summary,
          contentJson: JSON.stringify(used.content),
          rawText: source.rawText,
          score: after.score,
          kind: 'OPTIMIZED',
          parentResumeId: source.id,
          version: source.version + 1,
        },
      });
      await this.persistAnalysis(result.id, used.content, source.rawText || '');
      const improvements = improvementLabels(used.changes);
      const updated = await this.prisma.resumeOptimization.update({
        where: { id: optimization.id },
        data: {
          resultResumeId: result.id,
          status: 'COMPLETED',
          afterScore: after.score,
          factPreservation: preservation,
          improvementsJson: JSON.stringify(improvements),
          changesJson: JSON.stringify(used.changes),
        },
      });
      return this.toOptimization(updated, before.score, after.score);
    } catch {
      await this.prisma.resumeOptimization.update({
        where: { id: optimization.id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Optimization could not finish. Your original resume was not changed.',
      });
    }
  }

  async getOptimization(userId: string, id: string, optId: string) {
    await this.requireResume(userId, id);
    const row = await this.prisma.resumeOptimization.findFirst({
      where: { id: optId, sourceResumeId: id },
    });
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Optimization was not found' });
    }
    return this.toOptimization(row, row.beforeScore, row.afterScore);
  }

  async versions(userId: string, id: string) {
    const resume = await this.requireResume(userId, id);
    const rootId = resume.parentResumeId || resume.id;
    const rows = await this.prisma.resume.findMany({
      where: {
        candidateId: resume.candidateId,
        OR: [{ id: rootId }, { parentResumeId: rootId }],
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async changes(userId: string, id: string) {
    await this.requireResume(userId, id);
    const row = await this.prisma.resumeOptimization.findFirst({
      where: { OR: [{ sourceResumeId: id }, { resultResumeId: id }] },
      orderBy: { createdAt: 'desc' },
    });
    const list = row ? (JSON.parse(row.changesJson || '[]') as ResumeChangeRecord[]) : [];
    return { changes: list, factPreservation: row?.factPreservation ?? null };
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
        rawText: resume.rawText,
        score: resume.score,
        kind: 'ORIGINAL',
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

  async careerGuidance(
    userId: string,
    input: { resumeId?: string; resume?: Record<string, unknown> },
  ) {
    let payload = input.resume;
    if (input.resumeId) {
      const resume = await this.requireResume(userId, input.resumeId);
      const content = parseContent(resume.contentJson);
      payload = input.resume || toRoleAtsResume(content, resume.targetJobTitle);
    }
    if (!payload) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Resume data is required.' });
    }
    return recommendCareerRoles(payload);
  }

  async roleAnalyze(
    userId: string,
    input: {
      resumeId?: string;
      targetRole: string;
      jobDescription?: string;
      templateId?: string;
      resume?: Record<string, unknown>;
    },
  ) {
    const targetRole = input.targetRole?.trim();
    if (!targetRole) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Enter a target job role.' });
    }
    let templateId = input.templateId || 'ats-minimal';
    let payload = input.resume;
    if (input.resumeId) {
      const resume = await this.requireResume(userId, input.resumeId);
      const content = parseContent(resume.contentJson);
      templateId = resolveResumeTemplateId(input.templateId || resume.template);
      payload = toRoleAtsResume(content, resume.targetJobTitle);
    }
    if (!payload) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Resume data is required.' });
    }
    return analyzeRoleResume({
      targetRole,
      jobDescription: input.jobDescription || '',
      templateId,
      resume: payload,
    });
  }

  async roleRewrite(
    userId: string,
    input: {
      resumeId?: string;
      targetRole: string;
      jobDescription?: string;
      templateId?: string;
      resume?: Record<string, unknown>;
      analysis?: Record<string, unknown> | null;
    },
  ) {
    const targetRole = input.targetRole?.trim();
    if (!targetRole) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Enter a target job role.' });
    }
    let templateId = input.templateId || 'ats-minimal';
    let payload = input.resume;
    let ownedId: string | null = input.resumeId || null;
    if (input.resumeId) {
      const resume = await this.requireResume(userId, input.resumeId);
      ownedId = resume.id;
      const content = parseContent(resume.contentJson);
      templateId = resolveResumeTemplateId(input.templateId || resume.template);
      payload = input.resume || toRoleAtsResume(content, resume.targetJobTitle);
    }
    if (!payload) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Resume data is required.' });
    }
    const result = rewriteRoleResume({
      targetRole,
      jobDescription: input.jobDescription || '',
      templateId,
      resume: payload,
      analysis: input.analysis || null,
    });
    return { ...result, resumeId: ownedId };
  }

  private async persistAnalysis(resumeId: string, content: ResumeContent, rawText: string) {
    const analysis = analyzeResumeContent(content, rawText);
    const facts = extractFacts(content, rawText);
    await this.prisma.resumeIssue.deleteMany({ where: { resumeId } });
    await this.prisma.resumeFact.deleteMany({ where: { resumeId } });
    await this.prisma.resumeAtsReport.upsert({
      where: { resumeId },
      create: {
        resumeId,
        scoreType: analysis.scoreType,
        overallScore: analysis.score,
        label: analysis.label,
        sectionJson: JSON.stringify(analysis.sections),
        issuesJson: JSON.stringify(analysis.issues),
        highPriority: analysis.highPriority,
        mediumPriority: analysis.mediumPriority,
        goodSections: analysis.goodSections,
        recommendedPlanId: analysis.recommendedPlanId,
        updatedAt: new Date(),
      },
      update: {
        overallScore: analysis.score,
        label: analysis.label,
        sectionJson: JSON.stringify(analysis.sections),
        issuesJson: JSON.stringify(analysis.issues),
        highPriority: analysis.highPriority,
        mediumPriority: analysis.mediumPriority,
        goodSections: analysis.goodSections,
        recommendedPlanId: analysis.recommendedPlanId,
      },
    });
    if (analysis.issues.length) {
      await this.prisma.resumeIssue.createMany({
        data: analysis.issues.map((item) => ({
          resumeId,
          section: item.section,
          severity: item.severity,
          problem: item.problem,
          location: item.location,
          why: item.why,
          recommendation: item.recommendation,
          originalExample: item.originalExample || null,
          suggestedExample: item.suggestedExample || null,
        })),
      });
    }
    if (facts.length) {
      await this.prisma.resumeFact.createMany({
        data: facts.map((item) => ({
          resumeId,
          factType: item.type,
          value: item.value.slice(0, 500),
          source: item.source.slice(0, 1000),
          section: item.section,
        })),
      });
    }
    await this.prisma.resume.update({ where: { id: resumeId }, data: { score: analysis.score } });
    return analysis;
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

  private toOptimization(
    row: {
      id: string;
      sourceResumeId: string;
      resultResumeId: string | null;
      planId: string;
      targetMin: number;
      targetMax: number;
      status: string;
      beforeScore: number;
      afterScore: number | null;
      factPreservation: number | null;
      improvementsJson: string;
      changesJson: string;
    },
    beforeScore: number,
    afterScore: number | null,
  ) {
    const plan = ATS_ENHANCE_PLANS.find((item) => item.id === row.planId);
    return {
      id: row.id,
      sourceResumeId: row.sourceResumeId,
      resultResumeId: row.resultResumeId,
      planId: row.planId,
      targetLabel: plan?.label || 'Optimization',
      targetMin: row.targetMin,
      targetMax: row.targetMax,
      status: row.status,
      beforeScore,
      afterScore,
      improvement: afterScore == null ? null : afterScore - beforeScore,
      factPreservation: row.factPreservation,
      improvements: JSON.parse(row.improvementsJson || '[]') as string[],
      changes: JSON.parse(row.changesJson || '[]') as ResumeChangeRecord[],
      guaranteed: false,
    };
  }

  private toRecord(
    row: {
      id: string;
      title: string;
      targetJobTitle: string | null;
      template: string;
      summary: string | null;
      contentJson: string;
      score: number;
      version: number;
      updatedAt: Date;
      kind?: string;
      parentResumeId?: string | null;
    },
    analysis?: ResumeAnalysis,
  ) {
    return {
      id: row.id,
      title: row.title,
      targetJobTitle: row.targetJobTitle,
      template: row.template,
      summary: row.summary,
      content: parseContent(row.contentJson),
      score: row.score,
      version: row.version,
      kind: row.kind || 'ORIGINAL',
      parentResumeId: row.parentResumeId ?? null,
      updatedAt: row.updatedAt.toISOString(),
      analysis,
    };
  }
}

function improvementLabels(changes: ResumeChangeRecord[]) {
  const labels = new Set<string>();
  for (const change of changes) {
    if (change.validation !== 'PASS') continue;
    if (/summary/i.test(change.section)) labels.add('Improved professional summary');
    else if (/experience/i.test(change.section)) labels.add('Improved experience bullets');
    else if (/skill/i.test(change.section)) labels.add('Organized skills');
    else labels.add(`Improved ${change.section.toLowerCase()}`);
  }
  if (!labels.size) labels.add('Improved readability');
  return [...labels];
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
            typeof yearRaw === 'number' ? yearRaw : Number.parseInt(asString(yearRaw), 10) || null;
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
  const certifications = Array.isArray(data.certifications)
    ? data.certifications.map((item) => asString(item)).filter(Boolean)
    : [];
  const projects = Array.isArray(data.projects)
    ? data.projects
        .map((row) => {
          const item = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
          return { name: asString(item.name), description: asString(item.description) || null };
        })
        .filter((row) => row.name)
    : [];
  return {
    fullName: asString(data.fullName) || fallback.fullName || 'Candidate',
    city: asString(data.city) || fallback.city,
    phone: asString(data.phone) || fallback.phone,
    email: asString(data.email) || null,
    summary: asString(data.summary),
    skills,
    education,
    experiences,
    languages,
    certifications,
    projects,
  };
}

function parseContent(raw: string): ResumeContent {
  try {
    return normalizeStoredContent(JSON.parse(raw) as Record<string, unknown>);
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

function emptyFriendData() {
  return {
    fullName: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: '',
    photo: '',
    summary: '',
    skills: [] as string[],
    experience: [] as unknown[],
    education: [] as unknown[],
    projects: [] as unknown[],
    certifications: [] as unknown[],
    careerGaps: [] as unknown[],
    targetRole: '',
    jobDescription: '',
  };
}

function blankManualContent(includePhoto: boolean): ResumeContent & { _manual?: boolean; data?: Record<string, unknown> } {
  const data = emptyFriendData();
  return {
    _manual: true,
    data,
    includePhoto,
    fullName: '',
    city: null,
    phone: null,
    email: null,
    summary: '',
    skills: [],
    education: [],
    experiences: [],
    languages: [],
    certifications: [],
    projects: [],
  };
}

function friendDataToContent(data: Record<string, unknown>, includePhoto?: boolean): ResumeContent & {
  _manual?: boolean;
  data?: Record<string, unknown>;
} {
  const skills = Array.isArray(data.skills) ? data.skills.map((item) => String(item || '').trim()).filter(Boolean) : [];
  const experience = Array.isArray(data.experience) ? data.experience : [];
  const education = Array.isArray(data.education) ? data.education : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const certifications = Array.isArray(data.certifications) ? data.certifications : [];
  return {
    _manual: true,
    data,
    includePhoto: includePhoto ?? Boolean(data.photo),
    fullName: String(data.fullName || ''),
    city: data.location ? String(data.location) : null,
    phone: data.phone ? String(data.phone) : null,
    email: data.email ? String(data.email) : null,
    summary: String(data.summary || ''),
    skills,
    education: education.map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const year = Number.parseInt(String(row.endDate || ''), 10);
      return {
        qualification: String(row.degree || row.qualification || ''),
        institution: String(row.institution || row.school || '') || null,
        yearCompleted: Number.isFinite(year) ? year : null,
      };
    }),
    experiences: experience.map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const bullets = Array.isArray(row.bullets)
        ? row.bullets.map((line) => String(line || '').trim()).filter(Boolean)
        : [];
      return {
        company: String(row.company || ''),
        jobTitle: String(row.role || row.jobTitle || ''),
        description: bullets.length ? bullets.join('\n') : row.description ? String(row.description) : null,
        isInternship: false,
      };
    }),
    languages: [],
    certifications: certifications
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return String(row.name || '').trim();
      })
      .filter(Boolean),
    projects: projects.map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        name: String(row.name || row.title || ''),
        description: row.description ? String(row.description) : null,
      };
    }),
  };
}

function normalizeStoredContent(raw: Record<string, unknown>): ResumeContent & {
  _manual?: boolean;
  data?: Record<string, unknown>;
} {
  if (raw._manual && raw.data && typeof raw.data === 'object') {
    return friendDataToContent(raw.data as Record<string, unknown>, raw.includePhoto as boolean | undefined);
  }
  if (Array.isArray(raw.experience) && !Array.isArray(raw.experiences)) {
    return friendDataToContent(raw, raw.includePhoto as boolean | undefined);
  }
  return raw as unknown as ResumeContent;
}

function toRoleAtsResume(content: ResumeContent & { _manual?: boolean; data?: Record<string, unknown> }, title?: string | null) {
  if (content._manual && content.data && typeof content.data === 'object') {
    return {
      ...content.data,
      title: (content.data.title as string) || title || '',
    };
  }
  return {
    fullName: content.fullName || '',
    title: title || '',
    email: content.email || '',
    phone: content.phone || '',
    location: content.city || '',
    linkedin: '',
    website: '',
    photo: '',
    summary: content.summary || '',
    skills: content.skills || [],
    experience: (content.experiences || []).map((item) => ({
      company: item.company,
      role: item.jobTitle,
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      bullets: item.description
        ? item.description
            .split(/\n|•/)
            .map((line) => line.trim())
            .filter(Boolean)
        : [],
    })),
    education: (content.education || []).map((item, index) => ({
      id: `education-${index}`,
      institution: item.institution || '',
      school: item.institution || '',
      degree: item.qualification || '',
      fieldOfStudy: '',
      endDate: item.yearCompleted ? String(item.yearCompleted) : '',
    })),
    projects: (content.projects || []).map((item) => ({
      name: item.name,
      title: item.name,
      description: item.description || '',
      technologies: [],
      bullets: [],
      url: '',
    })),
    certifications: (content.certifications || []).map((name) => ({
      name,
      issuer: '',
      date: '',
      url: '',
    })),
  };
}
