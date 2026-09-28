import { Injectable, Logger } from '@nestjs/common';
import type { ResumeContent } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Maps extracted ResumeContent onto Candidate passport tables.
 * Fill-empty / merge strategy — never wipe richer manual profile data.
 */
@Injectable()
export class ResumeProfileSyncService {
  private readonly logger = new Logger(ResumeProfileSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncFromParsedResume(input: {
    candidateId: string;
    content: ResumeContent;
    resumeId: string;
  }): Promise<{ synced: string[] }> {
    const synced: string[] = [];
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: input.candidateId },
      include: {
        skills: { select: { id: true, name: true } },
        education: { select: { id: true } },
        experiences: { select: { id: true } },
      },
    });
    if (!candidate) return { synced };

    const content = input.content;
    const data: Record<string, unknown> = {};

    const nameParts = String(content.fullName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (nameParts.length && !candidate.firstName?.trim()) {
      data.firstName = nameParts[0];
      data.lastName = nameParts.slice(1).join(' ') || candidate.lastName;
      synced.push('name');
    }
    if (content.city?.trim() && !candidate.city?.trim()) {
      data.city = content.city.trim();
      synced.push('city');
    }
    if (content.state?.trim() && !candidate.state?.trim()) {
      data.state = content.state.trim();
      synced.push('state');
    }
    if (content.summary?.trim() && !candidate.about?.trim()) {
      data.about = content.summary.trim().slice(0, 4000);
      synced.push('about');
    }

    // Profile links JSON — merge missing keys only
    let links: Record<string, string> = {};
    try {
      links = JSON.parse(candidate.profileLinks || '{}') as Record<string, string>;
    } catch {
      links = {};
    }
    const fromContent = content.links || {};
    let linksChanged = false;
    for (const key of ['linkedin', 'github', 'portfolio', 'website'] as const) {
      const next = (fromContent as Record<string, string | undefined>)[key]?.trim();
      if (next && !String(links[key] || '').trim()) {
        links[key] = next;
        linksChanged = true;
      }
    }
    if (linksChanged) {
      data.profileLinks = JSON.stringify(links);
      synced.push('profileLinks');
    }

    // Certifications / projects JSON on candidate when empty arrays
    let certs: unknown[] = [];
    let projects: unknown[] = [];
    try {
      certs = JSON.parse(candidate.certifications || '[]') as unknown[];
    } catch {
      certs = [];
    }
    try {
      projects = JSON.parse(candidate.projects || '[]') as unknown[];
    } catch {
      projects = [];
    }
    if ((!Array.isArray(certs) || certs.length === 0) && (content.certifications?.length || 0) > 0) {
      data.certifications = JSON.stringify(
        (content.certifications || []).map((c) =>
          typeof c === 'string' ? { name: c } : { name: c.name, issuer: c.issuer, date: c.date, url: c.url },
        ),
      );
      synced.push('certifications');
    }
    if ((!Array.isArray(projects) || projects.length === 0) && (content.projects?.length || 0) > 0) {
      data.projects = JSON.stringify(
        (content.projects || []).map((p) => ({
          name: p.name,
          description: p.description,
          url: p.url,
          technologies: p.technologies || [],
        })),
      );
      synced.push('projects');
    }

    if (Object.keys(data).length) {
      await this.prisma.candidate.update({
        where: { id: input.candidateId },
        data,
      });
    }

    // Skills: add missing (never delete existing)
    const existingSkillNames = new Set(
      candidate.skills.map((s) => s.name.trim().toLowerCase()).filter(Boolean),
    );
    const newSkills = (content.skills || [])
      .map((s) => String(s || '').trim())
      .filter((s) => s && !existingSkillNames.has(s.toLowerCase()))
      .slice(0, 40);
    if (newSkills.length) {
      await this.prisma.candidateSkill.createMany({
        data: newSkills.map((name) => ({ candidateId: input.candidateId, name })),
        skipDuplicates: true,
      });
      synced.push(`skills:+${newSkills.length}`);
    }

    // Education: only seed when candidate has none
    if (candidate.education.length === 0 && (content.education?.length || 0) > 0) {
      await this.prisma.candidateEducation.createMany({
        data: content.education.slice(0, 12).map((ed) => ({
          candidateId: input.candidateId,
          qualification: ed.qualification || 'Education',
          institution: ed.institution || null,
          fieldOfStudy: ed.fieldOfStudy || null,
          yearCompleted: ed.yearCompleted ?? null,
          startDate: ed.startDate || null,
          endDate: ed.endDate || null,
        })),
      });
      synced.push(`education:${content.education.length}`);
    }

    // Experience: only seed when candidate has none
    if (candidate.experiences.length === 0 && (content.experiences?.length || 0) > 0) {
      for (const exp of content.experiences.slice(0, 20)) {
        await this.prisma.candidateExperience.create({
          data: {
            candidateId: input.candidateId,
            company: exp.company || 'Company',
            jobTitle: exp.jobTitle || 'Role',
            description: exp.description || null,
            isInternship: Boolean(exp.isInternship),
            stillInCompany: Boolean(exp.isCurrent),
            startDate: parseLooseDate(exp.startDate),
            endDate: exp.isCurrent ? null : parseLooseDate(exp.endDate),
          },
        });
      }
      synced.push(`experiences:${content.experiences.length}`);
    }

    this.logger.log(
      JSON.stringify({
        msg: 'resume_profile_sync',
        resumeId: input.resumeId,
        candidateId: input.candidateId,
        synced,
      }),
    );
    return { synced };
  }
}

function parseLooseDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  // YYYY or YYYY-MM
  if (/^\d{4}$/.test(raw)) return new Date(`${raw}-01-01T00:00:00.000Z`);
  if (/^\d{4}-\d{2}$/.test(raw)) return new Date(`${raw}-01T00:00:00.000Z`);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
