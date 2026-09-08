import type { MasterResumeDocument } from './master-resume.types';

export type ResumeAiSection =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'skills'
  | 'education'
  | 'projects'
  | 'achievements';

export interface ResumeAiSuggestion {
  id: string;
  section: ResumeAiSection;
  sectionLabel: string;
  issue: string;
  suggestion: string;
  currentText: string;
  improvedText: string;
  canRegenerate?: boolean;
}

export interface ResumeAiReviewResult {
  suggestions: ResumeAiSuggestion[];
  goodSections: string[];
  score?: number;
  strengths?: string[];
  improvements?: string[];
  missingSkills?: string[];
}

export type GatewayResumeReviewResponse = {
  score?: number;
  strengths?: string[];
  improvements?: string[];
  missingSkills?: string[];
  suggestedSections?: Record<string, string>;
  suggestions?: Array<{
    section?: string;
    issue?: string;
    currentText?: string;
    improvedText?: string;
  }>;
};

const SECTION_LABELS: Record<ResumeAiSection, string> = {
  contact: 'Contact',
  summary: 'Professional Summary',
  experience: 'Experience',
  skills: 'Skills',
  education: 'Education',
  projects: 'Projects',
  achievements: 'Achievements',
};

function normalizeSection(raw: string | undefined): ResumeAiSection {
  const key = (raw || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (key.includes('summary') || key.includes('objective') || key.includes('about')) return 'summary';
  if (key.includes('experience') || key.includes('work') || key.includes('employment')) return 'experience';
  if (key.includes('skill')) return 'skills';
  if (key.includes('educat') || key.includes('degree') || key.includes('school')) return 'education';
  if (key.includes('project')) return 'projects';
  if (key.includes('achiev') || key.includes('award') || key.includes('certif')) return 'achievements';
  if (key.includes('contact') || key.includes('personal')) return 'contact';
  return 'summary';
}

function currentTextForSection(resume: MasterResumeDocument, section: ResumeAiSection): string {
  switch (section) {
    case 'summary':
      return resume.summary || '';
    case 'skills':
      return (resume.technicalSkills || []).flatMap((g) => g.skills).filter(Boolean).join(', ');
    case 'experience': {
      const first = (resume.experience || [])[0];
      if (!first) return '';
      return [first.jobTitle, first.company, ...(first.responsibilities || [])]
        .filter(Boolean)
        .join(' — ');
    }
    case 'education': {
      const first = (resume.education || [])[0];
      if (!first) return '';
      return [first.degree, first.field, first.institution].filter(Boolean).join(' — ');
    }
    case 'projects': {
      const first = (resume.projects || [])[0];
      if (!first) return '';
      return [first.name, first.description, ...(first.bullets || [])].filter(Boolean).join(' — ');
    }
    case 'achievements':
      return [
        ...(resume.achievements || []).map((a) => a.title || a.description).filter(Boolean),
        ...(resume.certifications || []).map((c) => c.name).filter(Boolean),
      ].join('\n');
    case 'contact':
      return [
        resume.personalInfo?.fullName,
        resume.personalInfo?.email,
        resume.personalInfo?.phone,
        resume.personalInfo?.location,
      ]
        .filter(Boolean)
        .join(' · ');
    default:
      return '';
  }
}

/**
 * Maps AI Gateway + RAG review response into Accept/Ignore suggestion cards.
 * No local heuristic review — Gateway is the source of suggestions.
 */
export function mapGatewayReviewToSuggestions(
  review: GatewayResumeReviewResponse | null | undefined,
  resume: MasterResumeDocument,
): ResumeAiReviewResult {
  const safeReview: GatewayResumeReviewResponse = review && typeof review === 'object' ? review : {};
  const suggestions: ResumeAiSuggestion[] = [];
  const seen = new Set<string>();

  const push = (partial: Omit<ResumeAiSuggestion, 'id' | 'sectionLabel' | 'suggestion'> & { id?: string }) => {
    const section = partial.section;
    const improvedText = (partial.improvedText || '').trim();
    if (!improvedText) return;
    const id = partial.id || `gw-${section}-${suggestions.length}`;
    if (seen.has(id)) return;
    seen.add(id);
    suggestions.push({
      id,
      section,
      sectionLabel: SECTION_LABELS[section],
      issue: partial.issue || `Improve ${SECTION_LABELS[section]}`,
      suggestion: improvedText,
      currentText: (partial.currentText || currentTextForSection(resume, section)).trim() || '—',
      improvedText,
      canRegenerate: true,
    });
  };

  for (const item of safeReview.suggestions || []) {
    const section = normalizeSection(item.section);
    push({
      section,
      issue: item.issue || `Improve ${SECTION_LABELS[section]}`,
      currentText: item.currentText || currentTextForSection(resume, section),
      improvedText: item.improvedText || '',
    });
  }

  for (const [sectionKey, text] of Object.entries(safeReview.suggestedSections || {})) {
    const section = normalizeSection(sectionKey);
    push({
      id: `gw-section-${sectionKey}`,
      section,
      issue: `Enhance ${SECTION_LABELS[section]}`,
      currentText: currentTextForSection(resume, section),
      improvedText: text,
    });
  }

  if ((safeReview.missingSkills || []).length) {
    const existing = (resume.technicalSkills || []).flatMap((g) => g.skills).filter(Boolean);
    const merged = [...new Set([...existing, ...(safeReview.missingSkills || [])])];
    push({
      id: 'gw-missing-skills',
      section: 'skills',
      issue: 'Add missing skills for your target role',
      currentText: existing.join(', '),
      improvedText: merged.join(', '),
    });
  }

  // Last resort: turn free-text improvements into summary wording tips only when nothing actionable returned
  if (suggestions.length === 0) {
    for (const [index, improvement] of (safeReview.improvements || []).entries()) {
      const text = improvement.trim();
      if (!text) continue;
      push({
        id: `gw-improvement-${index}`,
        section: 'summary',
        issue: 'Suggested improvement',
        currentText: resume.summary || '—',
        improvedText: text,
      });
    }
  }

  return {
    suggestions,
    goodSections: safeReview.strengths || [],
    score: safeReview.score,
    strengths: safeReview.strengths || [],
    improvements: safeReview.improvements || [],
    missingSkills: safeReview.missingSkills || [],
  };
}
