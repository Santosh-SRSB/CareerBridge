import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ErrorCode,
  analyzeResumeContent,
  extractFacts,
  type ResumeContent,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { ResumeExtractorService } from './resume-extractor.service';
import { parseExtractedResumeText } from './parse-extracted-resume';

@Injectable()
export class ResumeProcessorService {
  private readonly logger = new Logger(ResumeProcessorService.name);
  private readonly inflight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractor: ResumeExtractorService,
    private readonly aiGateway: AiGatewayService,
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

      const extraction = await this.extractor.extract(
        buffer,
        resume.sourceMimeType || 'application/octet-stream',
        resume.sourceFileName || 'resume',
      );

      if (!extraction.text.trim()) {
        throw new Error(`Text extraction failed (${extraction.extractor}): ${extraction.notes.join('; ')}`);
      }

      const content = parseExtractedResumeText(extraction.text);
      const rawText = extraction.text.slice(0, 80000);
      const analysis = analyzeResumeContent(content, rawText);

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

      const overall =
        typeof (aiReview as { score?: number } | null)?.score === 'number'
          ? Math.round(Number((aiReview as { score: number }).score))
          : analysis.score;

      const extractionMeta = {
        extractor: extraction.extractor,
        mimeType: extraction.mimeType,
        fileName: extraction.fileName,
        pageCount: extraction.pageCount,
        confidence: extraction.confidence,
        notes: extraction.notes,
        textPreview: extraction.text.slice(0, 500),
        aiReview,
        processedAt: new Date().toISOString(),
      };

      await this.prisma.resume.update({
        where: { id: resumeId },
        data: {
          rawText,
          summary: content.summary || resume.summary,
          contentJson: JSON.stringify(content),
          score: overall,
          extractionMetaJson: JSON.stringify(extractionMeta),
          processingStatus: 'COMPLETED',
          processingError: null,
        },
      });

      await this.persistAnalysis(resumeId, content, rawText, overall, aiReview);

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

      this.logger.log(`Resume ${resumeId} processing completed via ${extraction.extractor}`);
      return { ok: true, extractor: extraction.extractor };
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
