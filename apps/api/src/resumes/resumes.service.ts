import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { AiGatewayService } from '../ai/ai-gateway.service';
import { StorageService } from '../common/storage/storage.service';
import { CloudTasksService } from '../common/tasks/cloud-tasks.service';
import { renderResumePdf } from './resume-pdf';
import { ResumeOptimizeAi } from './resume-optimize-ai';
import { ResumeProcessorService } from './resume-processor.service';
import { analyzeRoleResume, rewriteRoleResume, recommendCareerRoles } from './ats-engine';
import { resolveResumeTemplateId, CAREERBRIDGE_RESUME_TEMPLATE } from '@careerbridge/shared';
import { isThinResumeContent, parseExtractedResumeText } from './parse-extracted-resume';

@Injectable()
export class ResumesService {
  private readonly logger = new Logger(ResumesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
    private readonly optimizeAi: ResumeOptimizeAi,
    private readonly aiGateway: AiGatewayService,
    private readonly storage: StorageService,
    private readonly cloudTasks: CloudTasksService,
    private readonly processor: ResumeProcessorService,
  ) {}

  async list(userId: string) {
    const candidate = await this.requireCandidate(userId);
    const rows = await this.prisma.resume.findMany({
      where: { candidateId: candidate.id, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
    // Recompute ATS readiness from current content so list scores stay in sync
    // (avoids stale values like every resume stuck at 77 after an old scoring bug).
    return Promise.all(
      rows.map(async (row) => {
        const content = hydrateResumeContent(parseContent(row.contentJson), row.rawText);
        const analysis = analyzeResumeContent(content, row.rawText || '');
        if (row.score !== analysis.score) {
          await this.prisma.resume.update({
            where: { id: row.id },
            data: { score: analysis.score },
          });
        }
        return this.toRecord({ ...row, score: analysis.score }, analysis, row._count.applications);
      }),
    );
  }

  /**
   * Structure raw resume text via AI Gateway (Gemini only). Used by web parse route.
   */
  async structureText(rawText: string) {
    const text = (rawText || '').trim();
    if (!text) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Resume text is required',
      });
    }

    if (this.aiGateway.isConfigured()) {
      const structured = await this.aiGateway.structureResumeText(text);
      if (structured) {
        return {
          ...structured,
          stillInCollege: false,
          educationStart: '',
          educationEnd: '',
          experienceLevel:
            structured.experience?.length > 0 ? ('experienced' as const) : ('fresher' as const),
          totalExperienceYears: '',
          totalExperienceMonths: '',
          gapReason: '',
          source: 'resume' as const,
        };
      }
    }

    // Deterministic fallback when Gemini is unavailable — never OpenAI.
    const parsed = parseExtractedResumeText(text);
    const nameParts = (parsed.fullName || '').trim().split(/\s+/).filter(Boolean);
    return {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      city: parsed.city || '',
      about: parsed.summary || '',
      education: (parsed.education || []).map((row) => ({
        qualification: row.qualification || '',
        institution: row.institution || '',
        fieldOfStudy: '',
        yearCompleted: row.yearCompleted != null ? String(row.yearCompleted) : '',
      })),
      stillInCollege: false,
      educationStart: '',
      educationEnd: '',
      experienceLevel:
        (parsed.experiences || []).length > 0 ? ('experienced' as const) : ('fresher' as const),
      totalExperienceYears: '',
      totalExperienceMonths: '',
      experience: (parsed.experiences || []).map((row) => ({
        company: row.company || '',
        jobTitle: row.jobTitle || '',
        isInternship: Boolean(row.isInternship),
        description: row.description || '',
      })),
      projects: (parsed.projects || []).map((row) => ({
        title: row.name || '',
        role: '',
        year: '',
        description: row.description || '',
        url: '',
      })),
      gapReason: '',
      skills: parsed.skills || [],
      careerInterests: [],
      source: 'resume' as const,
    };
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
      summary?: string;
      parentResumeId?: string;
      kind?: 'ORIGINAL' | 'OPTIMIZED';
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
    if (dto.summary !== undefined) {
      content.summary = dto.summary;
    }
    if (dto.includePhoto === false) content.includePhoto = false;
    if (dto.includePhoto === true) content.includePhoto = true;

    let parentResumeId: string | null = null;
    let version = 1;
    let kind: 'ORIGINAL' | 'OPTIMIZED' = dto.kind === 'OPTIMIZED' ? 'OPTIMIZED' : 'ORIGINAL';
    if (dto.parentResumeId) {
      const parent = await this.prisma.resume.findFirst({
        where: { id: dto.parentResumeId, candidateId: candidate.id, archivedAt: null },
      });
      if (!parent) {
        throw new NotFoundException({
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: 'Parent resume was not found',
        });
      }
      parentResumeId = parent.parentResumeId || parent.id;
      const siblings = await this.prisma.resume.count({
        where: {
          candidateId: candidate.id,
          OR: [{ id: parentResumeId }, { parentResumeId }],
        },
      });
      version = siblings + 1;
      kind = 'OPTIMIZED';
    }

    const title =
      (dto.title && dto.title.trim()) ||
      (dto.blank || dto.content ? 'Untitled resume' : dto.targetJobTitle ? `${dto.targetJobTitle} Resume` : 'General Resume');
    const created = await this.prisma.resume.create({
      data: {
        candidateId: candidate.id,
        title,
        targetJobTitle: dto.targetJobTitle || null,
        template: resolveResumeTemplateId(dto.template || CAREERBRIDGE_RESUME_TEMPLATE),
        summary: content.summary,
        contentJson: JSON.stringify(content),
        score: 0,
        kind,
        parentResumeId,
        version,
      },
    });
    const analysis = await this.persistAnalysis(created.id, content, '');
    await this.safeSyncPdfForResume(created.id, userId, 'create');
    const fresh = await this.prisma.resume.findUniqueOrThrow({ where: { id: created.id } });
    return this.toRecord({ ...fresh, score: analysis.score }, analysis);
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
        template: resolveResumeTemplateId(dto.template || CAREERBRIDGE_RESUME_TEMPLATE),
        summary: content.summary,
        contentJson: JSON.stringify(content),
        rawText,
        score: 0,
        kind: 'ORIGINAL',
      },
    });
    const analysis = await this.persistAnalysis(created.id, content, rawText);
    await this.safeSyncPdfForResume(created.id, userId, 'create');
    const fresh = await this.prisma.resume.findUniqueOrThrow({ where: { id: created.id } });
    return this.toRecord({ ...fresh, score: analysis.score }, analysis);
  }

  async uploadFile(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    targetJobTitle?: string,
  ) {
    const candidate = await this.requireCandidate(userId);
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];
    const mime = (file.mimetype || '').toLowerCase();
    const name = file.originalname || 'resume.pdf';
    const okExt = /\.(pdf|doc|docx|png|jpe?g)$/i.test(name);
    if (!allowed.includes(mime) && !okExt) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Upload a PDF, Word document, or clear image (PNG/JPG).',
      });
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Resume file must be 8MB or smaller.',
      });
    }

    const baseName = name.replace(/\.[^.]+$/, '').trim() || 'Uploaded resume';
    const created = await this.prisma.resume.create({
      data: {
        candidateId: candidate.id,
        title: baseName,
        targetJobTitle: targetJobTitle || null,
        template: resolveResumeTemplateId(CAREERBRIDGE_RESUME_TEMPLATE),
        summary: null,
        contentJson: JSON.stringify({
          fullName: [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'Candidate',
          city: candidate.city,
          phone: null,
          email: null,
          summary: '',
          skills: [],
          education: [],
          experiences: [],
          languages: [],
        }),
        score: 0,
        kind: 'ORIGINAL',
        sourceKind: 'UPLOAD',
        sourceFileName: name,
        sourceMimeType: mime || 'application/octet-stream',
        sourceFileSize: file.size,
        processingStatus: 'PENDING',
      },
    });

    // Flat path only: resumes/harsh.pdf (no candidate/upload subfolders)
    const storagePath = this.storage.resumeObjectPath(name, created.id.slice(0, 8));
    let storageUri: string | null = null;
    try {
      const uploaded = await this.storage.uploadFile(storagePath, file.buffer, {
        contentType: mime || 'application/octet-stream',
        metadata: {
          candidateId: candidate.id,
          resumeId: created.id,
          source: 'upload',
        },
      });
      storageUri = uploaded.gcsUri;
      await this.prisma.resume.update({
        where: { id: created.id },
        data: {
          sourceStoragePath: storagePath,
          sourceStorageUri: uploaded.gcsUri,
          pdfStoragePath: storagePath,
          pdfStorageUri: uploaded.gcsUri,
          pdfPublicUrl: uploaded.publicUrl,
          pdfUploadedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`GCS upload failed for resume ${created.id}: ${(err as Error).message}`);
      // Keep local processing with in-memory buffer even if GCS fails in local/dev.
    }

    await this.cloudTasks.enqueueResumeProcessing(created.id, userId, () =>
      this.processor.processUploadedResume(created.id, userId, file.buffer),
    );

    const fresh = await this.prisma.resume.findUniqueOrThrow({ where: { id: created.id } });
    return {
      ...this.toRecord(fresh),
      processingStatus: fresh.processingStatus,
      processingError: fresh.processingError,
      sourceStorageUri: storageUri || fresh.sourceStorageUri,
    };
  }

  async processingStatus(userId: string, id: string) {
    const resume = await this.requireResume(userId, id);
    const status = resume.processingStatus || 'READY';
    const staleMs = Date.now() - new Date(resume.updatedAt).getTime();
    if ((status === 'PENDING' || status === 'PROCESSING') && staleMs > 8000) {
      void this.processor.processUploadedResume(id, userId).catch((err) => {
        this.logger.error(`Retry processing failed for ${id}: ${(err as Error).message}`);
      });
    }
    return {
      id: resume.id,
      processingStatus: status,
      processingError: resume.processingError,
      score: resume.score,
      message:
        status === 'COMPLETED'
          ? 'Resume analysed successfully.'
          : status === 'FAILED'
            ? resume.processingError || 'Processing failed.'
            : status === 'PROCESSING'
              ? 'Extracting text and analysing with AI…'
              : status === 'PENDING'
                ? 'Queued for processing…'
                : 'Ready',
    };
  }

  async processWorker(payload: { resumeId: string; userId: string }) {
    return this.processor.processUploadedResume(payload.resumeId, payload.userId);
  }

  async savePrimary(
    userId: string,
    dto: {
      title?: string;
      targetJobTitle?: string;
      template?: string;
      content: Record<string, unknown>;
      resumeId?: string;
      skipCloudSync?: boolean;
    },
  ) {
    const candidate = await this.requireCandidate(userId);
    const content = normalizeStoredContent(dto.content);
    const title =
      (dto.title && dto.title.trim()) ||
      (dto.targetJobTitle ? `${dto.targetJobTitle} Resume` : `${content.fullName || 'My'} Resume`);
    const template = resolveResumeTemplateId(dto.template || CAREERBRIDGE_RESUME_TEMPLATE);

    let resumeId = dto.resumeId;
    if (resumeId) {
      await this.requireResume(userId, resumeId);
    } else {
      const existing = await this.prisma.resume.findFirst({
        where: { candidateId: candidate.id, kind: 'ORIGINAL', parentResumeId: null },
        orderBy: { updatedAt: 'desc' },
      });
      resumeId = existing?.id;
    }

    let row;
    if (resumeId) {
      const current = await this.requireResume(userId, resumeId);
      const analysis = analyzeResumeContent(content, current.rawText || '');
      row = await this.prisma.resume.update({
        where: { id: resumeId },
        data: {
          title,
          targetJobTitle: dto.targetJobTitle || current.targetJobTitle,
          template,
          summary: content.summary,
          contentJson: JSON.stringify(content),
          score: analysis.score,
        },
      });
      await this.persistAnalysis(row.id, content, current.rawText || '');
    } else {
      row = await this.prisma.resume.create({
        data: {
          candidateId: candidate.id,
          title,
          targetJobTitle: dto.targetJobTitle || null,
          template,
          summary: content.summary,
          contentJson: JSON.stringify(content),
          score: 0,
          kind: 'ORIGINAL',
        },
      });
      await this.persistAnalysis(row.id, content, '');
    }

    let storage: {
      pdfStoragePath: string;
      pdfStorageUri: string;
      pdfPublicUrl: string;
    } | null = null;
    let storageError: string | null = null;
    if (!dto.skipCloudSync) {
      try {
        storage = await this.syncPdfForResume(row.id, userId);
      } catch (err) {
        storageError = err instanceof Error ? err.message : 'Cloud storage upload failed';
        this.logger.error(`savePrimary GCS sync failed for resume ${row.id}: ${storageError}`);
      }
    }
    const analysis = await this.analyze(userId, row.id);
    return { ...analysis, storage, storageError };
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
    await this.safeSyncPdfForResume(updated.id, userId, 'update');
    const fresh = await this.prisma.resume.findUniqueOrThrow({ where: { id: updated.id } });
    return this.toRecord(fresh, analysis);
  }

  async remove(userId: string, id: string) {
    const resume = await this.requireResume(userId, id);
    const applicationCount = await this.prisma.application.count({
      where: { resumeId: resume.id },
    });

    // Linked to applications → archive (keep history). Unused → hard delete + cloud cleanup.
    if (applicationCount > 0) {
      await this.prisma.resume.update({
        where: { id: resume.id },
        data: { archivedAt: new Date() },
      });
      return { deleted: false, archived: true, reason: 'linked_to_applications' };
    }

    if (resume.pdfStoragePath) {
      await this.storage.deleteFile(resume.pdfStoragePath).catch(() => undefined);
    }
    await this.prisma.resume.delete({ where: { id: resume.id } });
    return { deleted: true, archived: false };
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
    let storage: {
      pdfStoragePath: string;
      pdfStorageUri: string;
      pdfPublicUrl: string;
    } | null = null;
    let storageError: string | null = null;
    try {
      storage = await this.syncPdfForResume(resume.id, userId);
      this.logger.log(`Resume PDF synced to GCS for download: ${resume.id}`);
    } catch (err) {
      storageError = err instanceof Error ? err.message : 'Cloud storage upload failed';
      this.logger.error(`Download GCS sync failed for resume ${resume.id}: ${storageError}`);
    }
    const pdf = await this.readStoredPdf(resume, userId);
    const fresh = await this.prisma.resume.findUniqueOrThrow({ where: { id: resume.id } });
    return {
      pdf: pdf.toString('base64'),
      fileName: `${resume.title.replace(/\s+/g, '-')}.pdf`,
      mimeType: 'application/pdf',
      storage,
      storageError,
      pdfStoragePath: fresh.pdfStoragePath,
      pdfStorageUri: fresh.pdfStorageUri,
      pdfPublicUrl: fresh.pdfPublicUrl,
      pdfUploadedAt: fresh.pdfUploadedAt?.toISOString() || null,
    };
  }

  async aiReview(
    userId: string,
    id: string,
    input: {
      targetRole?: string;
      jobDescription?: string;
      templateId?: string;
      resume?: Record<string, unknown>;
    },
  ) {
    const resume = await this.requireResume(userId, id);
    const content = parseContent(resume.contentJson);
    const targetRole = input.targetRole?.trim() || resume.targetJobTitle || 'General Professional';

    // Try Centralized AI Gateway (Gemini) first — time-box so a hang falls back to ATS.
    if (this.aiGateway.isConfigured()) {
      try {
        const aiResult = await Promise.race([
          this.aiGateway.reviewResume(content, targetRole, { userId }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 25_000)),
        ]);
        if (aiResult) {
          return {
            score: aiResult.score,
            strengths: aiResult.strengths || [],
            improvements: aiResult.improvements || [],
            missingSkills: aiResult.missingSkills || [],
            suggestedSections: aiResult.suggestedSections || {},
            suggestions: aiResult.suggestions || [],
            provider: 'gemini',
          };
        }
      } catch {}
    }

    // Deterministic ATS fallback
    const analysis = analyzeRoleResume({
      targetRole,
      jobDescription: input.jobDescription || '',
      templateId: resolveResumeTemplateId(input.templateId || resume.template),
      resume: input.resume || toRoleAtsResume(content, targetRole),
    });

    return {
      score: analysis.score,
      strengths: analysis.strengths || [],
      improvements: (analysis.issues || []).map((i: any) => i.recommendation),
      missingSkills: analysis.missingSkills || [],
      suggestedSections: {},
      suggestions: [],
      provider: 'ats-engine',
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
    let templateId = input.templateId || CAREERBRIDGE_RESUME_TEMPLATE;
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
    let templateId = input.templateId || CAREERBRIDGE_RESUME_TEMPLATE;
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

  private async safeSyncPdfForResume(resumeId: string, userId: string, context: string) {
    try {
      return await this.syncPdfForResume(resumeId, userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resume PDF cloud sync failed (${context}) for ${resumeId}: ${message}`);
      return null;
    }
  }

  private async syncPdfForResume(resumeId: string, userId: string) {
    const resume = await this.requireResume(userId, resumeId);
    const candidate = await this.requireCandidate(userId);
    const content = parseContent(resume.contentJson);
    const includePhoto = content.includePhoto !== false;
    const pdf = await renderResumePdf(
      content,
      CAREERBRIDGE_RESUME_TEMPLATE,
      includePhoto ? candidate.photoUrl : null,
    );
    const path = this.storage.resumeObjectPath(
      `${content.fullName || 'resume'}.pdf`,
      resume.id.slice(0, 8),
    );
    const uploaded = await this.storage.uploadFile(path, pdf, {
      contentType: 'application/pdf',
      metadata: {
        candidateId: candidate.id,
        resumeId: resume.id,
      },
    });
    await this.prisma.resume.update({
      where: { id: resumeId },
      data: {
        pdfStoragePath: path,
        pdfStorageUri: uploaded.gcsUri,
        pdfPublicUrl: uploaded.publicUrl,
        pdfUploadedAt: new Date(),
      },
    });
    return {
      pdfStoragePath: path,
      pdfStorageUri: uploaded.gcsUri,
      pdfPublicUrl: uploaded.publicUrl,
    };
  }

  private async readStoredPdf(resume: { id: string; contentJson: string; template: string; candidateId: string }, userId?: string) {
    const candidate =
      userId != null
        ? await this.requireCandidate(userId)
        : await this.prisma.candidate.findUniqueOrThrow({ where: { id: resume.candidateId } });
    const content = parseContent(resume.contentJson);
    const includePhoto = content.includePhoto !== false;
    return renderResumePdf(content, CAREERBRIDGE_RESUME_TEMPLATE, includePhoto ? candidate.photoUrl : null);
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
    const resume = await this.prisma.resume.findFirst({
      where: { id, candidateId: candidate.id, archivedAt: null },
    });
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
      rawText?: string | null;
      score: number;
      version: number;
      updatedAt: Date;
      kind?: string;
      parentResumeId?: string | null;
      pdfStoragePath?: string | null;
      pdfStorageUri?: string | null;
      pdfPublicUrl?: string | null;
      pdfUploadedAt?: Date | null;
      archivedAt?: Date | null;
    },
    analysis?: ResumeAnalysis,
    applicationCount = 0,
  ) {
    const content = hydrateResumeContent(parseContent(row.contentJson), row.rawText);
    return {
      id: row.id,
      title: row.title,
      targetJobTitle: row.targetJobTitle,
      template: row.template,
      summary: content.summary || row.summary,
      content,
      score: row.score,
      version: row.version,
      kind: row.kind || 'ORIGINAL',
      parentResumeId: row.parentResumeId ?? null,
      pdfStoragePath: row.pdfStoragePath ?? null,
      pdfStorageUri: row.pdfStorageUri ?? null,
      pdfPublicUrl: row.pdfPublicUrl ?? null,
      pdfUploadedAt: row.pdfUploadedAt?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      applicationCount,
      updatedAt: row.updatedAt.toISOString(),
      analysis,
      plans: ATS_ENHANCE_PLANS.map((plan) => ({ ...plan })),
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
    ? data.certifications
        .map((row) => {
          if (typeof row === 'string') {
            const name = asString(row);
            return name ? { name, issuer: null as string | null, date: null as string | null } : null;
          }
          const item = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
          const name = asString(item.name);
          if (!name) return null;
          return {
            name,
            issuer: asString(item.issuer) || null,
            date: asString(item.date) || null,
          };
        })
        .filter((row): row is { name: string; issuer: string | null; date: string | null } => Boolean(row))
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

function hydrateResumeContent(content: ResumeContent, rawText?: string | null): ResumeContent {
  if (!rawText?.trim() || !isThinResumeContent(content)) return content;
  const parsed = parseExtractedResumeText(rawText);
  return {
    ...parsed,
    fullName: parsed.fullName || content.fullName,
    city: parsed.city || content.city,
    email: parsed.email || content.email || null,
    phone: parsed.phone || content.phone,
    skills: parsed.skills.length ? parsed.skills : content.skills,
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
        if (typeof item === 'string') {
          const name = item.trim();
          return name ? { name, issuer: null as string | null, date: null as string | null } : null;
        }
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const name = String(row.name || '').trim();
        if (!name) return null;
        return {
          name,
          issuer: String(row.issuer || '').trim() || null,
          date: String(row.date || '').trim() || null,
        };
      })
      .filter((row): row is { name: string; issuer: string | null; date: string | null } => Boolean(row)),
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
      bullets: Array.isArray(item.bullets)
        ? item.bullets.map((b) => String(b || '').trim()).filter(Boolean)
        : item.description
          ? item.description
              .split(/\n|•/)
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(1)
          : [],
      url: item.url || '',
    })),
    certifications: (content.certifications || []).map((entry) => {
      if (typeof entry === 'string') return { name: entry, issuer: '', date: '', url: '' };
      return {
        name: entry.name || '',
        issuer: entry.issuer || '',
        date: entry.date || '',
        url: entry.url || '',
      };
    }),
    achievements: (content.achievements || []).map((item) => ({
      title: item.title || '',
      organization: item.organization || '',
      description: item.description || '',
      date: item.date || '',
    })),
    languages: (content.languages || []).map((entry) => {
      const match = String(entry).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (match) return { name: match[1].trim(), level: match[2].trim() };
      return { name: String(entry), level: '' };
    }),
  };
}
