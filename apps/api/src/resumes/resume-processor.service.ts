import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ErrorCode,
  analyzeResumeContent,
  extractFacts,
  withNormalizedResumeData,
  type ResumeContent,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { DocumentIndexService } from '../ai/document-index.service';
import { StorageService } from '../common/storage/storage.service';
import { applyContentGroundingGate } from './content-grounding-gate';
import { attachComputedExperienceYears } from './experience-years';
import { ParseResumePipeline } from './parse-resume.pipeline';
import { sanitizeExtractedResumeText } from './layout-sanitize';
import { parsedSchemaToResumeContent } from './parsed-resume-map';
import { isParsedResumeSchemaMostlyEmpty } from './parsed-resume.schema';
import { ResumeProfileSyncService } from './resume-profile-sync.service';

@Injectable()
export class ResumeProcessorService {
  private readonly logger = new Logger(ResumeProcessorService.name);
  private readonly inflight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly parsePipeline: ParseResumePipeline,
    private readonly storage: StorageService,
    private readonly profileSync: ResumeProfileSyncService,
    private readonly documentIndex: DocumentIndexService,
  ) {}

  async processUploadedResume(resumeId: string, userId: string, fileBuffer?: Buffer) {
    if (this.inflight.has(resumeId)) {
      return { ok: true, extractor: 'none' as const, skipped: true };
    }
    this.inflight.add(resumeId);
    try {
      return await this.runProcess(resumeId, userId, fileBuffer);
    } finally {
      this.inflight.delete(resumeId);
    }
  }

  private async runProcess(resumeId: string, userId: string, fileBuffer?: Buffer) {
    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Resume was not found' });
    }

    // Idempotent skip when already completed with non-empty content (Cloud Tasks retries).
    if (resume.processingStatus === 'COMPLETED' && resume.contentJson && !fileBuffer) {
      try {
        const existing = JSON.parse(resume.contentJson) as ResumeContent;
        const thin =
          !(existing.skills?.length || existing.education?.length || existing.experiences?.length) &&
          (existing.summary || '').trim().length < 40;
        if (!thin) {
          this.logger.log(JSON.stringify({ msg: 'resume_process_skip_completed', resumeId }));
          // Parse succeeded earlier but the index may be missing or stale (outage, new chunker, edited content).
          if (!(await this.documentIndex.isResumeIndexCurrent(resumeId, existing))) {
            await this.indexParsedResume(resumeId, resume.candidateId, existing, resume.rawText || '', userId);
          }
          return { ok: true, extractor: 'cached' as const, skipped: true };
        }
      } catch {
        // continue reprocess
      }
    }

    await this.prisma.resume.update({
      where: { id: resumeId },
      data: { processingStatus: 'PROCESSING', processingError: null },
    });
    this.logger.log(
      JSON.stringify({
        msg: 'resume_process_start',
        resumeId,
        candidateId: resume.candidateId,
        userId,
        hasBuffer: Boolean(fileBuffer),
        hasStoragePath: Boolean(resume.sourceStoragePath),
      }),
    );

    try {
      let buffer = fileBuffer;
      if (!buffer && resume.sourceStoragePath) {
        buffer = await this.downloadFromGcs(resume.sourceStoragePath);
      }
      if (!buffer) {
        throw new Error('Resume source file buffer is missing');
      }

      const pipelineResult = await this.parsePipeline.parse({
        buffer,
        mimeType: resume.sourceMimeType || 'application/octet-stream',
        fileName: resume.sourceFileName || 'resume',
        userId,
      });

      if (!pipelineResult.ok && isParsedResumeSchemaMostlyEmpty(pipelineResult.data)) {
        throw new Error(
          pipelineResult.error ||
            `Text extraction failed (${pipelineResult.meta.extractor}): ${pipelineResult.meta.warnings.join('; ')}`,
        );
      }

      const candidate = await this.prisma.candidate.findUnique({
        where: { id: resume.candidateId },
        select: { firstName: true, lastName: true, totalExperienceYears: true, totalExperienceMonths: true },
      });
      const profileName = [candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ').trim();

      const rawTextSource =
        sanitizeExtractedResumeText(pipelineResult.rawText || '') || pipelineResult.rawText || '';
      const contentBase = parsedSchemaToResumeContent(pipelineResult.data);
      const gated = applyContentGroundingGate(contentBase, rawTextSource, { profileName });
      if (gated.rejected.length) {
        this.logger.warn(
          `Resume ${resumeId} grounding gate rejected ${gated.rejected.length} field(s): ${gated.rejected
            .slice(0, 8)
            .map((r) => `${r.field}=${r.value.slice(0, 40)}`)
            .join('; ')}`,
        );
      }

      // D: experience years from dated jobs (not a free-text "2+ years" claim)
      let content = attachComputedExperienceYears(withNormalizedResumeData(gated.content));
      const rawText = rawTextSource.slice(0, 80000);
      const analysis = analyzeResumeContent(content, rawText);

      const computedYears = content.fieldConfidence?.find((f) => f.field === 'totalExperienceYears');
      if (computedYears && candidate && (Number(computedYears.value) || 0) > 0) {
        const years = Number.parseInt(computedYears.value, 10) || 0;
        const monthsEntry = content.fieldConfidence?.find((f) => f.field === 'totalExperienceMonths');
        const months = monthsEntry ? Number.parseInt(monthsEntry.value, 10) || 0 : 0;
        // Only fill candidate totals when unset — never overwrite a larger manual value with a thin parse.
        const existing =
          (candidate.totalExperienceYears || 0) + (candidate.totalExperienceMonths || 0) / 12;
        const computed = years + months / 12;
        if (existing < 0.5 && computed >= 0.5) {
          await this.prisma.candidate.update({
            where: { id: resume.candidateId },
            data: { totalExperienceYears: years, totalExperienceMonths: months },
          });
        }
      }

      let aiReview: unknown = null;
      if (this.aiGateway.isConfigured()) {
        try {
          aiReview = await this.aiGateway.reviewResume(content, resume.targetJobTitle || undefined, {
            userId,
          });
        } catch (err) {
          this.logger.warn(`AI review failed for ${resumeId}: ${(err as Error).message}`);
        }
      }

      // Persist ATS Readiness from content analysis only.
      // AI review score stays in extractionMeta — it is a quality opinion, not ATS readiness,
      // and often clusters around the same value for different resumes.
      const atsScore = analysis.score;

      const extractionMeta = {
        extractor: pipelineResult.meta.extractor,
        mimeType: resume.sourceMimeType,
        fileName: resume.sourceFileName,
        layoutMode: pipelineResult.meta.layoutMode,
        notes: pipelineResult.meta.warnings,
        textPreview: (pipelineResult.rawTextPreview || rawText).slice(0, 500),
        groundingRejected:
          pipelineResult.meta.groundingRejected || gated.rejected.slice(0, 40),
        parsePartial: pipelineResult.meta.partial,
        aiReview,
        processedAt: new Date().toISOString(),
      };

      await this.prisma.resume.update({
        where: { id: resumeId },
        data: {
          rawText,
          summary: content.summary || resume.summary,
          contentJson: JSON.stringify(content),
          score: atsScore,
          extractionMetaJson: JSON.stringify(extractionMeta),
          processingStatus: 'COMPLETED',
          processingError: null,
        },
      });

      try {
        await this.persistAnalysis(resumeId, content, rawText, atsScore, aiReview);
      } catch (err) {
        // Extraction already persisted — ATS report failure must not flip status to FAILED.
        this.logger.warn(
          JSON.stringify({
            msg: 'resume_ats_persist_failed',
            resumeId,
            error: (err as Error).message?.slice(0, 300),
          }),
        );
      }

      try {
        await this.profileSync.syncFromParsedResume({
          candidateId: resume.candidateId,
          content,
          resumeId,
        });
      } catch (err) {
        this.logger.warn(
          JSON.stringify({
            msg: 'resume_profile_sync_failed',
            resumeId,
            error: (err as Error).message?.slice(0, 240),
          }),
        );
      }

      // Embeddings for hybrid matching + RAG (Gateway → Gemini only).
      try {
        await this.aiGateway.upsertEmbedding({
          entityType: 'RESUME',
          entityId: resumeId,
          text: [content.summary || '', content.skills?.join(', ') || '', rawText.slice(0, 4000)]
            .filter(Boolean)
            .join('\n'),
          userId,
        });
        await this.aiGateway.upsertEmbedding({
          entityType: 'CANDIDATE',
          entityId: resume.candidateId,
          text: this.aiGateway.buildCandidateEmbedText({
            city: content.city,
            skills: content.skills || [],
            about: content.summary,
            experienceSummary: rawText.slice(0, 2000),
          }),
          userId,
        });
      } catch (err) {
        this.logger.warn(`Embedding after resume process failed: ${(err as Error).message}`);
      }

      await this.indexParsedResume(resumeId, resume.candidateId, content, rawText, userId);

      this.logger.log(
        JSON.stringify({
          msg: 'resume_process_completed',
          resumeId,
          candidateId: resume.candidateId,
          extractor: pipelineResult.meta.extractor,
          layoutMode: pipelineResult.meta.layoutMode,
        }),
      );
      return { ok: true, extractor: pipelineResult.meta.extractor };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        JSON.stringify({ msg: 'resume_process_failed', resumeId, error: message.slice(0, 500) }),
      );
      await this.prisma.resume.update({
        where: { id: resumeId },
        data: {
          processingStatus: 'FAILED',
          processingError: message.slice(0, 2000),
        },
      });
      return { ok: false, error: message };
    }
  }

  /** Keep the RAG index in step with edited content; unchanged chunks reuse their stored vectors. */
  async reindexIfStale(resumeId: string, candidateId: string, content: ResumeContent, rawText: string, userId: string) {
    if (await this.documentIndex.isResumeIndexCurrent(resumeId, content)) return;
    await this.indexParsedResume(resumeId, candidateId, content, rawText, userId);
  }

  /** Index failures are logged only; they never change the resume's parse status. */
  private async indexParsedResume(
    resumeId: string,
    candidateId: string,
    content: ResumeContent,
    rawText: string,
    userId: string,
  ) {
    try {
      const indexResult = await this.documentIndex.indexResume({
        resumeId,
        candidateId,
        content,
        userId,
        city: content.city,
        about: content.summary,
        skills: content.skills || [],
        experienceSummary: rawText.slice(0, 2000),
      });
      this.logger.log(
        JSON.stringify({
          msg: 'resume_index_result',
          resumeId,
          ok: indexResult.ok,
          chunkCount: indexResult.chunkCount,
          error: indexResult.error?.slice(0, 200),
        }),
      );
    } catch (err) {
      this.logger.warn(
        JSON.stringify({
          msg: 'resume_index_failed',
          resumeId,
          error: (err as Error).message?.slice(0, 240),
        }),
      );
    }
  }

  private async downloadFromGcs(path: string): Promise<Buffer> {
    if (this.storage.isConfigured()) {
      return this.storage.downloadFile(path);
    }
    const { Storage } = await import('@google-cloud/storage');
    const bucketName = process.env.GCS_BUCKET || 'srsbbucket';
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID || undefined,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined,
    });
    const [buf] = await storage.bucket(bucketName).file(path).download();
    return buf;
  }

  private async persistAnalysis(
    resumeId: string,
    content: ResumeContent,
    rawText: string,
    overallScore: number,
    aiReview: unknown,
  ) {
    const analysis = analyzeResumeContent(content, rawText);
    const facts = extractFacts(content, rawText);
    await this.prisma.resumeIssue.deleteMany({ where: { resumeId } });
    await this.prisma.resumeFact.deleteMany({ where: { resumeId } });

    const reportData = {
      scoreType: analysis.scoreType,
      overallScore,
      label: analysis.label,
      sectionJson: JSON.stringify(analysis.sections),
      issuesJson: JSON.stringify({
        deterministic: analysis.issues,
        aiReview,
      }),
      highPriority: analysis.highPriority,
      mediumPriority: analysis.mediumPriority,
      goodSections: analysis.goodSections,
      recommendedPlanId: analysis.recommendedPlanId,
    };

    // Prefer find+update/create over upsert — DEV DB may lack the unique index Prisma expects.
    const existing = await this.prisma.resumeAtsReport.findFirst({ where: { resumeId } });
    if (existing) {
      await this.prisma.resumeAtsReport.update({
        where: { id: existing.id },
        data: reportData,
      });
    } else {
      await this.prisma.resumeAtsReport.create({
        data: { resumeId, ...reportData },
      });
    }

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
  }
}
