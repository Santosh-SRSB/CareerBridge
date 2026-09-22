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
import { applyContentGroundingGate } from './content-grounding-gate';
import { attachComputedExperienceYears } from './experience-years';
import { ParseResumePipeline } from './parse-resume.pipeline';
import { sanitizeExtractedResumeText } from './layout-sanitize';
import { parsedSchemaToResumeContent } from './parsed-resume-map';
import { isParsedResumeSchemaMostlyEmpty } from './parsed-resume.schema';

@Injectable()
export class ResumeProcessorService {
  private readonly logger = new Logger(ResumeProcessorService.name);
  private readonly inflight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly parsePipeline: ParseResumePipeline,
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

    await this.prisma.resume.update({
      where: { id: resumeId },
      data: { processingStatus: 'PROCESSING', processingError: null },
    });

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

      await this.persistAnalysis(resumeId, content, rawText, atsScore, aiReview);

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

      this.logger.log(
        `Resume ${resumeId} processing completed via ${pipelineResult.meta.extractor}/${pipelineResult.meta.layoutMode}`,
      );
      return { ok: true, extractor: pipelineResult.meta.extractor };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resume ${resumeId} processing failed: ${message}`);
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

  private async downloadFromGcs(path: string): Promise<Buffer> {
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
    await this.prisma.resumeAtsReport.upsert({
      where: { resumeId },
      create: {
        resumeId,
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
        updatedAt: new Date(),
      },
      update: {
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
  }
}
