import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
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
    const pdf = await renderPdf(record.content, record.template);
    return {
      pdf,
      fileName: `${record.title.replace(/[^\w]+/g, '-')}.pdf`,
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

function ascii(value: string) {
  return value.normalize('NFKD').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = ascii(text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function renderPdf(content: ResumeContent, template: string) {
  const doc = await PDFDocument.create();
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 48;
  const width = pageSize[0] - margin * 2;
  const accent = template === 'MODERN' ? rgb(0.94, 0.35, 0.14) : rgb(0.05, 0.2, 0.25);
  const ink = rgb(0.07, 0.19, 0.25);
  const muted = rgb(0.35, 0.44, 0.46);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const ensure = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
  };

  const write = (text: string, font: PDFFont, size: number, color = ink, gap = 4) => {
    const lines = wrapText(font, text, size, width);
    for (const line of lines) {
      ensure(size + gap);
      page.drawText(line, { x: margin, y: y - size, size, font, color });
      y -= size + gap;
    }
  };

  const heading = (label: string) => {
    ensure(28);
    y -= 10;
    page.drawText(label, { x: margin, y: y - 12, size: 11, font: bold, color: accent });
    y -= 16;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageSize[0] - margin, y },
      thickness: 0.8,
      color: rgb(0.84, 0.89, 0.9),
    });
    y -= 10;
  };

  write(content.fullName || 'Career Passport Resume', bold, 22, accent, 6);
  const contact = [content.city, content.phone].filter(Boolean).join('  ·  ');
  if (contact) write(contact, regular, 10, muted, 4);

  if (content.summary) {
    heading('SUMMARY');
    write(content.summary, regular, 10, ink, 5);
  }

  if (content.skills.length) {
    heading('SKILLS');
    write(content.skills.join('  |  '), regular, 10, ink, 5);
  }

  if (content.experiences.length) {
    heading('EXPERIENCE');
    for (const item of content.experiences) {
      write(`${item.jobTitle}  —  ${item.company}${item.isInternship ? ' (Internship)' : ''}`, bold, 11, ink, 4);
      if (item.description) write(item.description, regular, 10, muted, 5);
      y -= 4;
    }
  }

  if (content.education.length) {
    heading('EDUCATION');
    for (const item of content.education) {
      write(
        [item.qualification, item.institution, item.yearCompleted ? String(item.yearCompleted) : '']
          .filter(Boolean)
          .join('  ·  '),
        regular,
        10,
        ink,
        5,
      );
    }
  }

  if (content.languages.length) {
    heading('LANGUAGES');
    write(content.languages.join('  |  '), regular, 10, ink, 5);
  }

  return Buffer.from(await doc.save()).toString('base64');
}
