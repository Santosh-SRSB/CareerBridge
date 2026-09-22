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
import { ResumeExtractorService } from './resume-extractor.service';
import { parseResumeTextWithLlm } from './structure-resume-content';

@Injectable()
export class ResumeProcessorService {
  private readonly logger = new Logger(ResumeProcessorService.name);
  private readonly inflight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractor: ResumeExtractorService,
    private readonly aiGateway: AiGatewayService,
    private readonly documentIndex: DocumentIndexService,
    private readonly storage: StorageService,
  ) {}

  async processUploadedResume(resumeId: string, userId: string, fileBuffer?: Buffer) {
    if (this.inflight.has(resumeId)) {
      return { ok: true, extractor: 'document-ai' as const, skipped: true };
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
      if (!buffer) {
        if (!resume.sourceStoragePath) {
          throw new Error(
            'Resume file is missing from Cloud Storage. Re-upload the resume and try again.',
          );
        }
        buffer = await this.storage.downloadFile(resume.sourceStoragePath);
      }

      const extraction = await this.extractor.extract(
        buffer,
        resume.sourceMimeType || 'application/octet-stream',
        resume.sourceFileName || 'resume',
      );

      if (!extraction.text.trim()) {
        throw new Error(
          `Document AI returned empty text. ${extraction.notes.join('; ') || 'Check processor and billing.'}`,
        );
      }

      if (!this.aiGateway.isConfigured()) {
        throw new Error('AI Gateway is not configured. Set GEMINI_API_KEY to parse resumes.');
      }

      const parsed = await parseResumeTextWithLlm(
        extraction.text,
        (text) => this.aiGateway.structureResumeText(text, { userId }),
        // Keep retries short so candidates are not stuck on "Reading your resume".
        { attempts: 2, delayMs: 400 },
      );

      const content = withNormalizedResumeData(parsed);
      const rawText = extraction.text.slice(0, 80000);
      const analysis = analyzeResumeContent(content, rawText);
      const atsScore = analysis.score;
      const extractionMeta = {
        extractor: extraction.extractor,
        mimeType: extraction.mimeType,
        fileName: extraction.fileName,
        pageCount: extraction.pageCount,
        confidence: extraction.confidence,
        notes: extraction.notes,
        textChars: extraction.text.length,
        processedAt: new Date().toISOString(),
      };

      // Mark COMPLETED as soon as parse + profile sync finish. AI review + RAG
      // indexing are slower and must not block the candidate upload UX.
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

      await this.persistAnalysis(resumeId, content, rawText, atsScore, null);
      await this.syncCandidateProfile(resume.candidateId, content);

      this.logger.log(
        `Resume ${resumeId} processing completed via Document AI + LLM (post-work deferred)`,
      );

      void this.runPostParseWork({
        resumeId,
        candidateId: resume.candidateId,
        userId,
        content,
        rawText,
        atsScore,
        targetJobTitle: resume.targetJobTitle,
        extractionMeta,
      }).catch((err) => {
        this.logger.warn(
          `Resume ${resumeId} post-parse work failed: ${(err as Error).message}`,
        );
      });

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

  /** AI review + embeddings after COMPLETED — must not block upload UX. */
  private async runPostParseWork(input: {
    resumeId: string;
    candidateId: string;
    userId: string;
    content: ResumeContent;
    rawText: string;
    atsScore: number;
    targetJobTitle: string | null;
    extractionMeta: Record<string, unknown>;
  }) {
    let aiReview: unknown = null;
    try {
      aiReview = await this.aiGateway.reviewResume(
        input.content,
        input.targetJobTitle || undefined,
        { userId: input.userId },
      );
    } catch (err) {
      this.logger.warn(`AI review failed for ${input.resumeId}: ${(err as Error).message}`);
    }

    const indexed = await this.documentIndex.indexResume({
      resumeId: input.resumeId,
      candidateId: input.candidateId,
      content: input.content,
      userId: input.userId,
      city: input.content.city,
      about: input.content.summary,
      skills: input.content.skills || [],
      experienceSummary: [
        ...(input.content.experiences || []).map((row) =>
          [row.jobTitle, row.company, row.description].filter(Boolean).join(' '),
        ),
      ]
        .join('\n')
        .slice(0, 2000),
    });

    if (!indexed.ok) {
      this.logger.warn(
        `Resume ${input.resumeId} indexed with warnings: ${indexed.error || 'Embedding failed'}`,
      );
    }

    await this.prisma.resume.update({
      where: { id: input.resumeId },
      data: {
        extractionMetaJson: JSON.stringify({
          ...input.extractionMeta,
          aiReview,
          indexing: indexed.ok
            ? { ok: true, chunkCount: indexed.chunkCount }
            : { ok: false, error: indexed.error || 'Embedding failed' },
        }),
      },
    });

    if (aiReview) {
      await this.persistAnalysis(
        input.resumeId,
        input.content,
        input.rawText,
        input.atsScore,
        aiReview,
      );
    }

    this.logger.log(
      `Resume ${input.resumeId} post-parse done (chunks=${indexed.chunkCount ?? 0})`,
    );
  }

  /** Push structured resume fields into the candidate profile after successful parse. */
  private async syncCandidateProfile(candidateId: string, content: ResumeContent) {
    const nameParts = (content.fullName || '').trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

    const projects = (content.projects || [])
      .map((p) => ({
        title: p.name || '',
        role: (p as { role?: string | null }).role || null,
        description: p.description || null,
        url: p.url || null,
        technologies: p.technologies || [],
      }))
      .filter((p) => p.title.length >= 2);

    const certifications = (content.certifications || [])
      .map((c) => {
        if (typeof c === 'string') {
          return { name: c.trim(), issuer: null as string | null, date: null as string | null };
        }
        return {
          name: String(c.name || '').trim(),
          issuer: c.issuer || null,
          date: c.date || null,
        };
      })
      .filter((c) => c.name);

    const links = content.links
      ? {
          linkedin: content.links.linkedin || undefined,
          github: content.links.github || undefined,
          portfolio: content.links.portfolio || undefined,
          website: content.links.website || undefined,
        }
      : undefined;

    const dobRaw = content.personalDetails?.dateOfBirth?.trim();
    let dateOfBirth: Date | undefined;
    if (dobRaw) {
      const parsed = new Date(dobRaw);
      if (!Number.isNaN(parsed.getTime())) dateOfBirth = parsed;
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.candidate.findUnique({
        where: { id: candidateId },
        select: { totalExperienceYears: true, totalExperienceMonths: true },
      });
      const paidJobs = (content.experiences || []).filter((row) => !row.isInternship);
      let inferredYears = 0;
      const now = new Date();
      for (const row of paidJobs) {
        if (!row.startDate) continue;
        const start = new Date(row.startDate);
        if (Number.isNaN(start.getTime())) continue;
        const end = row.isCurrent || !row.endDate ? now : new Date(row.endDate);
        if (Number.isNaN(end.getTime()) || end < start) continue;
        inferredYears +=
          (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      }
      inferredYears = Math.floor(Math.max(0, inferredYears) / 12);
      const keptYears = Math.max(existing?.totalExperienceYears || 0, inferredYears);

      await tx.candidate.update({
        where: { id: candidateId },
        data: {
          ...(firstName ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
          ...(content.city?.trim() ? { city: content.city.trim() } : {}),
          ...(content.state?.trim() ? { state: content.state.trim() } : {}),
          ...(content.summary?.trim() ? { about: content.summary.trim() } : {}),
          ...(dateOfBirth ? { dateOfBirth } : {}),
          ...(content.personalDetails?.gender?.trim()
            ? { gender: content.personalDetails.gender.trim() }
            : {}),
          ...(projects.length ? { projects: JSON.stringify(projects) } : {}),
          ...(certifications.length ? { certifications: JSON.stringify(certifications) } : {}),
          ...(links && (links.linkedin || links.github || links.portfolio || links.website)
            ? { profileLinks: JSON.stringify(links) }
            : {}),
          ...((content.experiences?.length || 0) > 0
            ? {
                hasExperience: content.experiences!.some((row) => !row.isInternship)
                  ? 'YES'
                  : 'INTERNSHIP',
                experienceLevel: content.experiences!.some((row) => !row.isInternship)
                  ? 'experienced'
                  : 'fresher',
                ...(keptYears > 0 ? { totalExperienceYears: keptYears } : {}),
              }
            : {}),
          source: 'resume',
        },
      });

      // Prefer resume contact phone on the linked user when empty.
      // (Login phone is auth identity — never overwrite here.)

      const skills = [...new Set((content.skills || []).map((s) => s.trim()).filter(Boolean))];
      if (skills.length) {
        await tx.candidateSkill.deleteMany({ where: { candidateId } });
        await tx.candidateSkill.createMany({
          data: skills.slice(0, 80).map((name) => ({ candidateId, name })),
          skipDuplicates: true,
        });
      }

      const education = (content.education || []).filter(
        (row) => row.qualification?.trim() || row.institution?.trim(),
      );
      if (education.length) {
        await tx.candidateEducation.deleteMany({ where: { candidateId } });
        await tx.candidateEducation.createMany({
          data: education.slice(0, 12).map((row) => ({
            candidateId,
            qualification: row.qualification?.trim() || 'Education',
            institution: row.institution?.trim() || null,
            yearCompleted: row.yearCompleted ?? null,
          })),
        });
      }

      const experiences = (content.experiences || []).filter(
        (row) => row.company?.trim() || row.jobTitle?.trim() || row.description?.trim(),
      );
      if (experiences.length) {
        await tx.candidateExperience.deleteMany({ where: { candidateId } });
        await tx.candidateExperience.createMany({
          data: experiences.slice(0, 20).map((row) => {
            const start = row.startDate ? new Date(row.startDate) : null;
            const end = row.endDate ? new Date(row.endDate) : null;
            return {
              candidateId,
              company: row.company?.trim() || 'Company',
              jobTitle: row.jobTitle?.trim() || 'Role',
              description: row.description?.trim() || null,
              isInternship: Boolean(row.isInternship),
              stillInCompany: Boolean(row.isCurrent),
              startDate: start && !Number.isNaN(start.getTime()) ? start : null,
              endDate: end && !Number.isNaN(end.getTime()) ? end : null,
            };
          }),
        });
      }
    });

    this.logger.log(`Candidate profile synced from resume for ${candidateId}`);
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
