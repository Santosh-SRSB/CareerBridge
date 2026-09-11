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

/** Common tech tokens we can detect in project text when technologies[] is thin. */
const KNOWN_TECH = [
  'AWS',
  'Azure',
  'GCP',
  'Docker',
  'Kubernetes',
  'GitLab CI',
  'GitHub Actions',
  'Jenkins',
  'Terraform',
  'React',
  'ReactJS',
  'Next.js',
  'Node.js',
  'NodeJS',
  'Express',
  'Spring Boot',
  'Spring boot',
  'Hibernate',
  'JPA',
  'Microservices',
  'REST',
  'GraphQL',
  'MongoDB',
  'PostgreSQL',
  'MySQL',
  'Redis',
  'Kafka',
  'Python',
  'Java',
  'JavaScript',
  'TypeScript',
  'C++',
  'C#',
  'Go',
  'Kotlin',
  'Swift',
  'Android',
  'Flutter',
  'HTML',
  'CSS',
  'Tailwind',
  'Git',
  'GitHub',
  'GitLab',
  'Linux',
  'Nginx',
  'Firebase',
  'OpenAI',
  'Generative AI',
  'Machine Learning',
  'TensorFlow',
  'PyTorch',
  'Power BI',
  'Tableau',
  'Excel',
  'SQL',
  'NoSQL',
  'Maven',
  'Gradle',
  'XML',
  'Android Studio',
];

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

export function atsScoreBandMessage(score: number): string {
  if (score >= 80) return 'Impressive';
  if (score >= 70) return 'Good one';
  if (score >= 60) return 'Not bad';
  return 'Improvement needed';
}

function normToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]/g, '')
    .trim();
}

/** True when text is advisory copy, not ready-to-paste resume content. */
export function isAdviceOnlyText(text: string, currentText = ''): boolean {
  const t = text.trim();
  if (!t) return true;
  if (currentText.trim() && t.toLowerCase() === currentText.trim().toLowerCase()) return true;

  const advicePatterns = [
    /^(present\b|experience is present|skills are|education is|contact (looks|section)|add a |make it |use clear|looks (clear|usable|ats)|missing from|fix ats|simplify layout|strengthen |consider |you should|try to|needs work|fix needed)/i,
    /\b(is present|looks clear|for ats parsing|plain-text bullets|raise your score)\b/i,
    /^\d+\s*project\(s\)\s*evaluated/i,
    /^\d+\s*certification\(s\)\s*listed/i,
    /^\d+\/\d+\s*required skills/i,
  ];
  if (advicePatterns.some((re) => re.test(t))) return true;

  // Short tip without looking like a resume paragraph/list
  if (t.length < 48 && /improve|consider|should|add more|make sure/i.test(t)) return true;
  return false;
}

function listedSkills(resume: MasterResumeDocument): string[] {
  return (resume.technicalSkills || [])
    .flatMap((g) => g.skills)
    .map((s) => s.trim())
    .filter(Boolean);
}

function projectCorpus(resume: MasterResumeDocument): string {
  return (resume.projects || [])
    .map((p) =>
      [p.name, p.description, ...(p.technologies || []), ...(p.bullets || [])].filter(Boolean).join(' '),
    )
    .join(' ');
}

/** Skills/technologies mentioned in projects but not listed in Skills. */
export function findProjectSkillsMissingFromSkills(resume: MasterResumeDocument): string[] {
  const skills = listedSkills(resume);
  const skillNorms = new Set(skills.map(normToken).filter(Boolean));
  const found = new Map<string, string>();

  for (const project of resume.projects || []) {
    for (const tech of project.technologies || []) {
      const clean = tech.trim();
      if (!clean) continue;
      const n = normToken(clean);
      if (!n || skillNorms.has(n)) continue;
      // soft match: "ReactJS" vs "React"
      const softHit = [...skillNorms].some(
        (s) => s.includes(n) || n.includes(s) || (s.length > 2 && n.length > 2 && (s.startsWith(n) || n.startsWith(s))),
      );
      if (softHit) continue;
      if (!found.has(n)) found.set(n, clean);
    }
  }

  const corpus = projectCorpus(resume);
  if (corpus.trim()) {
    for (const tech of KNOWN_TECH) {
      const n = normToken(tech);
      if (!n || found.has(n) || skillNorms.has(n)) continue;
      if (new RegExp(`\\b${escapeRegExp(tech)}\\b`, 'i').test(corpus)) {
        found.set(n, tech);
      }
    }
  }

  return [...found.values()];
}

function experienceCorpus(resume: MasterResumeDocument): string {
  return (resume.experience || [])
    .map((row) =>
      [row.jobTitle, row.company, ...(row.responsibilities || [])].filter(Boolean).join(' '),
    )
    .join(' ');
}

/** ADDITIVE: skills mentioned in experience descriptions but missing from Skills. */
export function findExperienceSkillsMissingFromSkills(resume: MasterResumeDocument): string[] {
  const skills = listedSkills(resume);
  const skillNorms = new Set(skills.map(normToken).filter(Boolean));
  const found = new Map<string, string>();
  const corpus = experienceCorpus(resume);
  if (!corpus.trim()) return [];

  for (const tech of KNOWN_TECH) {
    const n = normToken(tech);
    if (!n || skillNorms.has(n)) continue;
    const softHit = [...skillNorms].some(
      (s) => s.includes(n) || n.includes(s) || (s.length > 2 && n.length > 2 && (s.startsWith(n) || n.startsWith(s))),
    );
    if (softHit) continue;
    if (new RegExp(`\\b${escapeRegExp(tech)}\\b`, 'i').test(corpus)) {
      found.set(n, tech);
    }
  }
  return [...found.values()];
}

/** Combined project + experience skill mismatches. */
export function findMentionedSkillsMissingFromSkills(resume: MasterResumeDocument): string[] {
  const merged = new Map<string, string>();
  for (const skill of [
    ...findProjectSkillsMissingFromSkills(resume),
    ...findExperienceSkillsMissingFromSkills(resume),
  ]) {
    const n = normToken(skill);
    if (n && !merged.has(n)) merged.set(n, skill);
  }
  return [...merged.values()];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type SummaryQualityIssue = {
  issue: string;
  improvedText?: string;
  /** True when wording is weak/informal and needs a real rewrite, not a tiny patch. */
  needsRewrite?: boolean;
};

/** True when the only change is punctuation, spacing, or capitalization. */
export function isTrivialTextChange(before: string, after: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  return norm(before) === norm(after);
}

function isWeakSummary(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.length < 70) return true;
  if (
    /\b(tech guy|all the required skills|ready to take up|hard[- ]working|team player|passionate individual|looking for a (challenging|job)|to work in a|fresher with)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  // Informal first-person openers that are too generic for ATS
  if (/^i am a\b/i.test(t) && t.length < 200) return true;
  if (/^i am\b/i.test(t) && /\b(guy|person|individual)\b/i.test(t)) return true;
  return false;
}

function estimateExperienceLabel(resume: MasterResumeDocument): string {
  const rows = resume.experience || [];
  if (!rows.length) return '';
  // Prefer explicit span from first role dates when possible
  const start = rows[rows.length - 1]?.startDate?.trim();
  const end = rows[0]?.isCurrent ? 'Present' : rows[0]?.endDate?.trim();
  if (start) {
    const startYear = Number((start.match(/\d{4}/) || [])[0]);
    const endYear = end && end !== 'Present' ? Number((end.match(/\d{4}/) || [])[0]) : new Date().getFullYear();
    if (Number.isFinite(startYear) && Number.isFinite(endYear) && endYear >= startYear) {
      const years = Math.max(1, endYear - startYear);
      return years === 1 ? '1+ year' : `${years}+ years`;
    }
  }
  return 'hands-on';
}

/** Build a professional summary from resume facts (never invent employers/skills). */
export function rewriteSummaryFromResume(resume: MasterResumeDocument): string | null {
  const title =
    resume.experience?.[0]?.jobTitle?.trim() ||
    (/full\s*stack/i.test(resume.summary || '') ? 'Full Stack Developer' : '') ||
    'Software Developer';
  const company = resume.experience?.[0]?.company?.trim();
  const expLabel = estimateExperienceLabel(resume);
  const skills = listedSkills(resume).slice(0, 8);
  const project = (resume.projects || []).find(
    (p) => p.name?.trim() && !/^project$/i.test(p.name.trim()),
  );
  const projectBit = project
    ? ` Notable project work includes ${project.name.trim()}${
        (project.technologies || []).filter(Boolean).length
          ? ` (${project.technologies.filter(Boolean).slice(0, 4).join(', ')})`
          : ''
      }.`
    : '';

  const skillBit = skills.length ? ` Skilled in ${skills.join(', ')}.` : '';
  const companyBit = company ? ` at ${company}` : '';
  const expBit = expLabel ? ` with ${expLabel} of experience` : '';

  const draft =
    `${title}${companyBit}${expBit}, focused on building and maintaining reliable web and application solutions.${skillBit}${projectBit}`.replace(
      /\s+/g,
      ' ',
    );

  return draft.trim();
}

/** Detect grammar/clarity problems in the written summary. */
export function analyzeSummaryQuality(summary: string): SummaryQualityIssue | null {
  const text = summary.trim();
  if (!text) return null;

  const problems: string[] = [];
  let improved = text.replace(/\s+/g, ' ').trim();

  if (/[a-z]\s{2,}[A-Za-z]/.test(text) || /\s{2,}/.test(text)) {
    problems.push('extra spaces');
  }
  if (/[^\s]\.[A-Z]/.test(text)) {
    problems.push('missing space after a period');
    improved = improved.replace(/\.([A-Z])/g, '. $1');
  }
  if (/\bi\b/.test(improved) && !/\bI\b/.test(text)) {
    // only flag lowercase i as pronoun when present as standalone
    if (/\bi\b/.test(text)) {
      problems.push('lowercase “i”');
      improved = improved.replace(/\bi\b/g, 'I');
    }
  }
  const replacements: Array<[RegExp, string, string]> = [
    [/\bteh\b/gi, 'the', 'spelling'],
    [/\brecieve\b/gi, 'receive', 'spelling'],
    [/\bexperiance\b/gi, 'experience', 'spelling'],
    [/\bdevelopement\b/gi, 'development', 'spelling'],
    [/\bmanagment\b/gi, 'management', 'spelling'],
    [/\bresponsibile\b/gi, 'responsible', 'spelling'],
    [/\bproficient in in\b/gi, 'proficient in', 'repeated word'],
    [/\bwith with\b/gi, 'with', 'repeated word'],
    [/\band and\b/gi, 'and', 'repeated word'],
    [/\bhave has\b/gi, 'has', 'grammar'],
    [/\bam have\b/gi, 'have', 'grammar'],
    [/\bi am looking for\b/gi, 'Seeking', 'weak opener'],
    [/\bi want to\b/gi, 'Aiming to', 'weak phrasing'],
  ];
  for (const [re, to, label] of replacements) {
    if (re.test(improved)) {
      problems.push(label);
      improved = improved.replace(re, to);
    }
  }

  if (/^[a-z]/.test(improved)) {
    problems.push('sentence should start with a capital letter');
    improved = improved.charAt(0).toUpperCase() + improved.slice(1);
  }
  if (!/[.!?]$/.test(improved) && improved.length > 40) {
    problems.push('missing end punctuation');
    improved = `${improved}.`;
  }
  if (/\s+,/.test(improved) || /,\S/.test(improved)) {
    problems.push('comma spacing');
    improved = improved.replace(/\s+,/g, ',').replace(/,(?!\s)/g, ', ');
  }

  const weak = isWeakSummary(text);
  if (weak) {
    problems.push('informal or vague wording');
  } else if (
    text.length < 60 ||
    /hard[- ]working|team player|looking for a job|fresher with|to work in a/i.test(text)
  ) {
    problems.push('summary is vague or too short');
  }

  if (/\b(he|she|they) is have\b/i.test(improved) || /\byears of experiences\b/i.test(improved)) {
    problems.push('grammar');
    improved = improved
      .replace(/\b(he|she|they) is have\b/gi, '$1 has')
      .replace(/\byears of experiences\b/gi, 'years of experience');
  }

  improved = improved.replace(/\s+/g, ' ').trim();
  if (!problems.length) return null;

  const uniqueIssues = [...new Set(problems)];
  const needsRewrite = weak || uniqueIssues.some((p) => /vague|informal|too short|weak/i.test(p));
  const issue = needsRewrite
    ? 'Summary is informal or vague — rewrite in a clear, professional ATS style using your real experience and skills.'
    : uniqueIssues.length === 1
      ? `Summary issue: ${uniqueIssues[0]}.`
      : `Summary needs cleanup: ${uniqueIssues.slice(0, 3).join(', ')}.`;

  const changed = improved.toLowerCase() !== text.toLowerCase();
  const trivial = changed && isTrivialTextChange(text, improved);

  // Never offer period-only / capitalization-only patches as the suggestion.
  return {
    issue,
    improvedText: changed && !trivial && !needsRewrite ? improved : undefined,
    needsRewrite,
  };
}

function experienceNeedsBullets(resume: MasterResumeDocument): boolean {
  const first = resume.experience?.[0];
  if (!first) return false;
  const bullets = (first.responsibilities || []).map((b) => b.trim()).filter(Boolean);
  if (!bullets.length) return true;
  if (bullets.every((b) => b.length < 24)) return true;
  return false;
}

/**
 * Maps AI Gateway review into Accept/Ignore cards.
 * Drops advice-only strings that would corrupt the resume if accepted.
 */
export function mapGatewayReviewToSuggestions(
  review: GatewayResumeReviewResponse | null | undefined,
  resume: MasterResumeDocument,
): ResumeAiReviewResult {
  const safeReview: GatewayResumeReviewResponse = review && typeof review === 'object' ? review : {};
  const suggestions: ResumeAiSuggestion[] = [];
  const seen = new Set<string>();

  const push = (
    partial: Omit<ResumeAiSuggestion, 'id' | 'sectionLabel' | 'suggestion'> & { id?: string },
  ) => {
    const section = partial.section;
    const improvedText = (partial.improvedText || '').trim();
    const currentText = (partial.currentText || currentTextForSection(resume, section)).trim() || '—';
    if (!improvedText || isAdviceOnlyText(improvedText, currentText)) return;
    if (isTrivialTextChange(currentText, improvedText)) return;
    const id = partial.id || `gw-${section}-${suggestions.length}`;
    if (seen.has(id)) return;
    seen.add(id);
    suggestions.push({
      id,
      section,
      sectionLabel: SECTION_LABELS[section],
      issue: partial.issue || `Improve ${SECTION_LABELS[section]}`,
      suggestion: improvedText,
      currentText,
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

  // Do not auto-merge "missingSkills" from role matching — prefer project→skills local check.

  return {
    suggestions,
    goodSections: safeReview.strengths || [],
    score: safeReview.score,
    strengths: safeReview.strengths || [],
    improvements: safeReview.improvements || [],
    missingSkills: safeReview.missingSkills || [],
  };
}

export type AtsSectionStatus = {
  key: string;
  label: string;
  status: 'good' | 'needs_work' | 'missing' | 'fix_needed';
  note: string;
  present: boolean;
  /** Exact fields absent for incomplete sections (additive). */
  missingFields?: string[];
  /** When true, excluded from sectionCompleteness scoring so existing scores stay stable. */
  scoreNeutral?: boolean;
  /** Provenance hint for the section. */
  source?: 'from_uploaded_resume' | 'added_manually' | 'ai_suggested';
};

function hasContactLink(resume: MasterResumeDocument) {
  const candidates = [
    resume.personalInfo?.linkedin,
    resume.personalInfo?.github,
    resume.personalInfo?.portfolio,
  ];
  return candidates.some((value) => {
    const v = String(value || '').trim();
    if (!v) return false;
    if (/^(linkedin|github|portfolio|website|n\/?a|-)$/i.test(v)) return false;
    return /linkedin\.com|github\.com|https?:\/\/|\w+\.\w+/i.test(v) || v.length >= 8;
  });
}

function educationHasField(resume: MasterResumeDocument) {
  return (resume.education || []).some((row) => {
    if (String(row.field || '').trim()) return true;
    // Degree often stores "B.Tech in Information Technology"
    if (/\bin\s+[A-Za-z]/.test(String(row.degree || ''))) return true;
    return false;
  });
}

function experienceLooksStrong(resume: MasterResumeDocument) {
  const rows = resume.experience || [];
  if (!rows.length) return false;
  return rows.some((row) => {
    const hasTitle = Boolean(row.jobTitle?.trim());
    const hasDates = Boolean(row.startDate?.trim() || row.isCurrent);
    const bullets = (row.responsibilities || []).map((b) => b.trim()).filter(Boolean);
    return hasTitle && hasDates && bullets.some((b) => b.length >= 24);
  });
}

function projectLooksStrong(resume: MasterResumeDocument) {
  const rows = resume.projects || [];
  if (!rows.length) return false;
  return rows.some((row) => {
    const hasName = Boolean(row.name?.trim()) && !/^project$/i.test(row.name.trim());
    const hasBody = Boolean(row.description?.trim()) || (row.bullets || []).some((b) => b.trim());
    const hasTech = (row.technologies || []).some((t) => t.trim());
    return hasName && hasBody && hasTech;
  });
}

/**
 * Document-first ATS section verdicts — shared by Check ATS report and Improve with AI.
 */
export function evaluateAtsSections(
  resume: MasterResumeDocument,
  options?: { formattingScore?: number; layoutIssues?: string[]; defaultSource?: AtsSectionStatus['source'] },
): AtsSectionStatus[] {
  const formattingScore = options?.formattingScore ?? 90;
  const layoutIssues = options?.layoutIssues || [];
  const source = options?.defaultSource;
  const sections: AtsSectionStatus[] = [];

  // Contact
  {
    const present = Boolean(
      resume.personalInfo?.fullName?.trim() ||
        resume.personalInfo?.email?.trim() ||
        resume.personalInfo?.phone?.trim(),
    );
    const hasEmail = Boolean(resume.personalInfo?.email?.trim());
    const hasPhone = Boolean(resume.personalInfo?.phone?.trim());
    const hasLocation = Boolean(resume.personalInfo?.location?.trim());
    const missingFields: string[] = [];
    if (!resume.personalInfo?.fullName?.trim()) missingFields.push('Full name');
    if (!hasEmail) missingFields.push('Email');
    if (!hasPhone) missingFields.push('Phone');
    if (!hasLocation) missingFields.push('Location');
    if (!hasContactLink(resume)) missingFields.push('LinkedIn / GitHub / Portfolio URL');
    let status: AtsSectionStatus['status'] = 'good';
    let note = 'Name, phone, email and location are detected and correctly formatted.';
    if (!present) {
      status = 'missing';
      note = 'Contact information is missing from your resume.';
    } else if (!hasEmail || !hasPhone) {
      status = 'fix_needed';
      note = 'Add both email and phone so ATS tools can parse contact details.';
    } else if (!hasContactLink(resume)) {
      status = 'needs_work';
      note = 'Add a LinkedIn, GitHub, or portfolio URL to complete contact details.';
    } else if (!hasLocation) {
      status = 'needs_work';
      note = 'Location is missing — add city/state for clearer ATS parsing.';
    } else {
      note = 'Name, phone, email, location and profile link look complete for ATS.';
    }
    sections.push({
      key: 'contact',
      label: 'Contact information',
      status,
      note,
      present,
      missingFields: status === 'good' ? [] : missingFields,
      source,
    });
  }

  // Summary
  {
    const text = resume.summary?.trim() || '';
    const present = Boolean(text);
    const quality = analyzeSummaryQuality(text);
    let status: AtsSectionStatus['status'] = 'good';
    let note = 'Professional summary is clear and reads well for ATS.';
    const missingFields: string[] = [];
    if (!present) missingFields.push('Professional summary');
    if (!present) {
      status = 'missing';
      note = 'Professional summary is missing from your resume.';
    } else if (quality?.needsRewrite || quality?.improvedText) {
      status = 'needs_work';
      note = quality.issue;
    } else if (text.length < 50) {
      status = 'needs_work';
      note = 'Summary is too short — expand with your role, strengths, and experience.';
      missingFields.push('Longer professional summary');
    } else {
      note = 'Professional summary is present, specific, and ATS-readable.';
    }
    sections.push({
      key: 'summary',
      label: 'Professional summary',
      status,
      note,
      present,
      missingFields: status === 'good' ? [] : missingFields,
      source,
    });
  }

  // Skills
  {
    const skills = listedSkills(resume);
    const present = skills.length > 0;
    const missingMentioned = findMentionedSkillsMissingFromSkills(resume);
    let status: AtsSectionStatus['status'] = 'good';
    let note = 'Skills are listed as plain text and look ATS-readable.';
    const missingFields: string[] = [];
    if (!present) {
      status = 'missing';
      note = 'Skills section is missing from your resume.';
      missingFields.push('Skills list');
    } else if (missingMentioned.length) {
      status = 'needs_work';
      note = `Add skills used in projects/experience but missing here: ${missingMentioned.slice(0, 6).join(', ')}.`;
      missingFields.push(...missingMentioned.slice(0, 8).map((s) => `Skill: ${s}`));
    } else if (skills.length < 3) {
      status = 'needs_work';
      note = 'Skills list is thin — add more relevant technical skills in plain text.';
      missingFields.push('Additional skills (at least 3 total)');
    }
    sections.push({
      key: 'skills',
      label: 'Skills',
      status,
      note,
      present,
      missingFields: status === 'good' ? [] : missingFields,
      source,
    });
  }

  // Experience
  {
    const present = (resume.experience || []).some(
      (row) => row.company.trim() || row.jobTitle.trim(),
    );
    let status: AtsSectionStatus['status'] = 'good';
    let note = 'Work experience has clear titles, dates, and plain-text bullets.';
    const missingFields: string[] = [];
    if (!present) {
      status = 'missing';
      note = 'Work experience is missing from your resume.';
      missingFields.push('At least one work experience entry');
    } else if (!experienceLooksStrong(resume)) {
      status = 'needs_work';
      note = 'Add clearer job titles, dates, and plain-text accomplishment bullets.';
      const first = resume.experience?.[0];
      if (first && !first.jobTitle?.trim()) missingFields.push('Job title');
      if (first && !first.startDate?.trim() && !first.isCurrent) missingFields.push('Start date');
      if (first && !(first.responsibilities || []).some((b) => b.trim().length >= 24)) {
        missingFields.push('Accomplishment bullets');
      }
    }
    sections.push({
      key: 'experience',
      label: 'Work experience',
      status,
      note,
      present,
      missingFields: status === 'good' ? [] : missingFields,
      source,
    });
  }

  // Education
  {
    const present = (resume.education || []).some(
      (row) => row.degree.trim() || row.institution.trim(),
    );
    let status: AtsSectionStatus['status'] = 'good';
    let note = 'Degree, institution and field of study are clearly readable.';
    const missingFields: string[] = [];
    if (!present) {
      status = 'missing';
      note = 'Education is missing from your resume.';
      missingFields.push('Degree', 'Institution');
    } else if (!educationHasField(resume)) {
      status = 'needs_work';
      note = 'Field of study is not specified — add it so education parses completely.';
      missingFields.push('Field of study');
    } else {
      const degree = resume.education[0]?.degree?.trim() || '';
      if (/^[A-Za-z]$/.test(degree)) {
        status = 'fix_needed';
        note = 'Degree title looks truncated — fix it in Education (e.g. B.Tech).';
        missingFields.push('Complete degree title');
      }
    }
    sections.push({
      key: 'education',
      label: 'Education',
      status,
      note,
      present,
      missingFields: status === 'good' ? [] : missingFields,
      source,
    });
  }

  // Projects — always listed; empty projects are scoreNeutral so existing scores stay stable
  {
    const hasProjects = (resume.projects || []).some(
      (row) => row.name.trim() || row.description.trim(),
    );
    if (hasProjects) {
      let status: AtsSectionStatus['status'] = 'good';
      let note = 'Projects include name, technologies, and description in plain text.';
      const missingFields: string[] = [];
      if (!projectLooksStrong(resume)) {
        status = 'needs_work';
        note = 'Strengthen projects with a clear name, tech stack, and description.';
        const first = resume.projects?.[0];
        if (first && !first.name?.trim()) missingFields.push('Project name');
        if (first && !(first.technologies || []).some((t) => t.trim())) missingFields.push('Technologies');
        if (first && !first.description?.trim() && !(first.bullets || []).some((b) => b.trim())) {
          missingFields.push('Project description');
        }
      }
      sections.push({
        key: 'projects',
        label: 'Projects',
        status,
        note,
        present: true,
        missingFields: status === 'good' ? [] : missingFields,
        source,
      });
    } else {
      sections.push({
        key: 'projects',
        label: 'Projects',
        status: 'missing',
        note: 'Projects section is empty — optional but recommended for ATS.',
        present: false,
        missingFields: ['At least one project'],
        scoreNeutral: true,
        source,
      });
    }
  }

  // Certifications — always listed; empty is scoreNeutral
  {
    const hasCerts = (resume.certifications || []).some((row) => row.name.trim());
    if (hasCerts) {
      const count = resume.certifications.filter((c) => c.name.trim()).length;
      sections.push({
        key: 'certifications',
        label: 'Certifications',
        status: 'good',
        note: `${count} certification${count === 1 ? '' : 's'} listed in plain text.`,
        present: true,
        missingFields: [],
        source,
      });
    } else {
      sections.push({
        key: 'certifications',
        label: 'Certifications',
        status: 'missing',
        note: 'No certifications listed — optional for many roles.',
        present: false,
        missingFields: ['Certification name'],
        scoreNeutral: true,
        source,
      });
    }
  }

  // Formatting
  if (layoutIssues.length) {
    sections.push({
      key: 'formatting',
      label: 'Formatting & layout',
      status: 'fix_needed',
      note: layoutIssues[0],
      present: true,
      missingFields: layoutIssues.slice(0, 5),
      source,
    });
  } else {
    sections.push({
      key: 'formatting',
      label: 'Formatting & layout',
      status: formattingScore >= 75 ? 'good' : 'needs_work',
      note:
        formattingScore >= 75
          ? 'Layout looks ATS-friendly with readable plain-text sections.'
          : 'Simplify layout so ATS parsers can read every section.',
      present: true,
      missingFields: formattingScore >= 75 ? [] : ['ATS-friendly plain-text layout'],
      source,
    });
  }

  return sections;
}

/**
 * Builds accurate Improve-with-AI suggestions aligned with ATS section verdicts.
 */
export function buildAccurateImproveSuggestions(
  resume: MasterResumeDocument,
  gateway: GatewayResumeReviewResponse | null | undefined,
  atsSections: AtsSectionStatus[] = [],
): ResumeAiReviewResult {
  const mapped = mapGatewayReviewToSuggestions(gateway, resume);
  const sections =
    atsSections.length > 0
      ? atsSections
      : evaluateAtsSections(resume);
  const suggestions: ResumeAiSuggestion[] = [];
  const seenSections = new Set<string>();

  const add = (item: ResumeAiSuggestion) => {
    if (!item.improvedText?.trim() || isAdviceOnlyText(item.improvedText, item.currentText)) return;
    if (seenSections.has(item.section)) return;
    seenSections.add(item.section);
    suggestions.push(item);
  };

  const problemKeys = new Set(
    sections.filter((s) => s.status !== 'good').map((s) => s.key),
  );

  // 1) Summary — prefer meaningful rewrite (never period-only patches)
  const gwSummary = mapped.suggestions.find((s) => s.section === 'summary');
  const summaryAnalysis = analyzeSummaryQuality(resume.summary || '');
  const currentSummary = resume.summary?.trim() || '';
  const localRewrite = rewriteSummaryFromResume(resume);

  const pickSummarySuggestion = (): ResumeAiSuggestion | null => {
    if (
      gwSummary &&
      !isAdviceOnlyText(gwSummary.improvedText, gwSummary.currentText) &&
      !isTrivialTextChange(currentSummary, gwSummary.improvedText)
    ) {
      return {
        ...gwSummary,
        issue:
          summaryAnalysis?.issue ||
          sections.find((s) => s.key === 'summary')?.note ||
          gwSummary.issue,
      };
    }
    if (
      summaryAnalysis?.improvedText &&
      !isTrivialTextChange(currentSummary, summaryAnalysis.improvedText)
    ) {
      return {
        id: 'local-summary-quality',
        section: 'summary',
        sectionLabel: SECTION_LABELS.summary,
        issue: summaryAnalysis.issue,
        suggestion: summaryAnalysis.improvedText,
        currentText: currentSummary || '—',
        improvedText: summaryAnalysis.improvedText,
        canRegenerate: true,
      };
    }
    if (
      (summaryAnalysis?.needsRewrite || problemKeys.has('summary') || summaryAnalysis) &&
      localRewrite &&
      !isTrivialTextChange(currentSummary, localRewrite) &&
      !isAdviceOnlyText(localRewrite, currentSummary)
    ) {
      return {
        id: 'local-summary-rewrite',
        section: 'summary',
        sectionLabel: SECTION_LABELS.summary,
        issue:
          summaryAnalysis?.issue ||
          'Summary is informal or vague — rewrite in a professional ATS style.',
        suggestion: localRewrite,
        currentText: currentSummary || '—',
        improvedText: localRewrite,
        canRegenerate: true,
      };
    }
    return null;
  };

  if (problemKeys.has('summary') || summaryAnalysis) {
    const summarySuggestion = pickSummarySuggestion();
    if (summarySuggestion) add(summarySuggestion);
  }

  // 2) Skills — project + experience → skills gaps (ADDITIVE experience coverage)
  const missingMentionedSkills = findMentionedSkillsMissingFromSkills(resume);
  if (missingMentionedSkills.length) {
    const existing = listedSkills(resume);
    const merged = [...existing];
    for (const skill of missingMentionedSkills) {
      if (!merged.some((s) => normToken(s) === normToken(skill))) merged.push(skill);
    }
    add({
      id: 'local-skills-from-mentions',
      section: 'skills',
      sectionLabel: SECTION_LABELS.skills,
      issue: `Used in projects/experience but missing from Skills: ${missingMentionedSkills.join(', ')}.`,
      suggestion: merged.join(', '),
      currentText: existing.join(', ') || '—',
      improvedText: merged.join(', '),
      canRegenerate: false,
    });
  }

  // 3) Experience — only if ATS flagged and gateway has real rewrite
  const gwExp = mapped.suggestions.find((s) => s.section === 'experience');
  if (problemKeys.has('experience') && gwExp && !isAdviceOnlyText(gwExp.improvedText, gwExp.currentText)) {
    add({
      ...gwExp,
      issue: experienceNeedsBullets(resume)
        ? 'Experience bullets need clearer plain-text accomplishments.'
        : gwExp.issue,
    });
  }

  // 4) Other gateway sections only when ATS flagged that section
  for (const item of mapped.suggestions) {
    if (item.section === 'summary' || item.section === 'experience' || item.section === 'skills') {
      continue;
    }
    const key =
      item.section === 'achievements'
        ? 'certifications'
        : item.section === 'contact'
          ? 'contact'
          : item.section;
    if (!problemKeys.has(key) && !problemKeys.has(item.section)) continue;
    add(item);
  }

  // Good sections: ATS goods only (ignore role-match AI strengths)
  const goodSections = sections
    .filter((s) => s.status === 'good')
    .map((s) => s.label);

  return {
    suggestions,
    goodSections,
    score: mapped.score,
    strengths: goodSections,
    improvements: mapped.improvements,
    missingSkills: missingMentionedSkills,
  };
}
