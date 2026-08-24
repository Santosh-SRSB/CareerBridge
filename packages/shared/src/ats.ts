import type { ResumeContent } from './marketplace';

export const ATS_SCORE_TYPE = 'ATS_READINESS' as const;

export const ATS_SECTION_WEIGHTS = {
  contact: 10,
  structure: 10,
  formatting: 12,
  summary: 10,
  experience: 18,
  skills: 12,
  education: 8,
  certifications: 5,
  projects: 5,
  readability: 5,
  consistency: 5,
} as const;

export type AtsSectionKey = keyof typeof ATS_SECTION_WEIGHTS;

export const ATS_SECTION_LABELS: Record<AtsSectionKey, string> = {
  contact: 'Contact Information',
  structure: 'Structure',
  formatting: 'Formatting',
  summary: 'Professional Summary',
  experience: 'Work Experience',
  skills: 'Skills',
  education: 'Education',
  certifications: 'Certifications',
  projects: 'Projects',
  readability: 'Readability',
  consistency: 'Consistency',
};

export const ATS_ENHANCE_PLANS = [
  { id: 'band-70', label: 'Optimize toward 70–75 ATS Readiness', minScore: 70, maxScore: 75, amount: 49 },
  { id: 'band-75', label: 'Optimize toward 75–80 ATS Readiness', minScore: 75, maxScore: 80, amount: 79 },
  { id: 'band-80', label: 'Optimize toward 80–85 ATS Readiness', minScore: 80, maxScore: 85, amount: 129 },
  { id: 'band-85', label: 'Optimize toward 85–90 ATS Readiness', minScore: 85, maxScore: 90, amount: 199 },
  { id: 'band-90', label: 'Optimize toward 90+ ATS Readiness', minScore: 90, maxScore: 100, amount: 299 },
] as const;

export type AtsEnhancePlan = (typeof ATS_ENHANCE_PLANS)[number];

export type AtsIssueSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export type AtsIssue = {
  id: string;
  section: string;
  sectionKey: AtsSectionKey;
  severity: AtsIssueSeverity;
  problem: string;
  location: string;
  why: string;
  recommendation: string;
  originalExample?: string;
  suggestedExample?: string;
};

export type AtsSectionScore = {
  key: AtsSectionKey;
  name: string;
  score: number;
  tone: 'good' | 'warn' | 'bad';
};

export type AtsFact = {
  id: string;
  type: string;
  value: string;
  source: string;
  section: string;
};

export type ResumeChangeRecord = {
  id: string;
  section: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  validation: 'PASS' | 'FAIL' | 'REVIEW';
  factIds: string[];
};

export type ResumeAnalysis = {
  score: number;
  scoreType: typeof ATS_SCORE_TYPE;
  label: string;
  complete: string[];
  improve: string[];
  suggestions: Array<{ id: string; text: string }>;
  sections: AtsSectionScore[];
  highPriority: number;
  mediumPriority: number;
  goodSections: number;
  issues: AtsIssue[];
  recommendedPlanId: string;
  disclaimer: string;
};

const GENERIC_VERBS = /\b(worked on|responsible for|helped with|involved in|duties included|various tasks)\b/i;
const ALLOWED_STYLE =
  /\b(developed|maintained|implemented|supported|assisted|collaborated|coordinated|prepared|documented|wrote|built|created|delivered|provided|handled|processed|helped|contributed)\b/i;
const INFLATED =
  /\b(architected|pioneered|spearheaded|revolutionized|transformed|scaled|scalable|world-class|industry-leading|100,?000|million users|led a team|managed a team of)\b/i;

export function atsReadinessLabel(score: number) {
  if (score >= 85) return 'Strong';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs Improvement';
}

export function sectionTone(score: number): AtsSectionScore['tone'] {
  if (score >= 85) return 'good';
  if (score >= 70) return 'warn';
  return 'bad';
}

export function recommendAtsPlanId(score: number) {
  const lift = Math.min(18, Math.max(8, Math.round((100 - score) * 0.4)));
  const target = Math.min(94, score + lift);
  const plan =
    ATS_ENHANCE_PLANS.find((item) => target >= item.minScore && target <= item.maxScore) ||
    ATS_ENHANCE_PLANS[ATS_ENHANCE_PLANS.length - 1];
  return plan.id;
}

export function extractFacts(content: ResumeContent, rawText = ''): AtsFact[] {
  const facts: AtsFact[] = [];
  const push = (type: string, value: string, source: string, section: string) => {
    const clean = value.trim();
    if (!clean) return;
    facts.push({
      id: `f${facts.length + 1}`,
      type,
      value: clean,
      source: source.slice(0, 240),
      section,
    });
  };

  if (content.fullName) push('name', content.fullName, content.fullName, 'contact');
  if (content.phone) push('phone', content.phone, content.phone, 'contact');
  if (content.city) push('location', content.city, content.city, 'contact');
  if (content.email) push('email', content.email, content.email, 'contact');
  content.skills.forEach((skill) => push('skill', skill, skill, 'skills'));
  content.languages.forEach((lang) => push('language', lang, lang, 'languages'));
  (content.certifications || []).forEach((item) => push('certification', item, item, 'certifications'));
  content.education.forEach((item) => {
    push('degree', item.qualification, item.qualification, 'education');
    if (item.institution) push('institution', item.institution, item.institution, 'education');
    if (item.yearCompleted) push('year', String(item.yearCompleted), String(item.yearCompleted), 'education');
  });
  content.experiences.forEach((item) => {
    if (item.company) push('company', item.company, item.company, 'experience');
    if (item.jobTitle) push('title', item.jobTitle, item.jobTitle, 'experience');
    if (item.description) {
      push('responsibility', item.description, item.description, 'experience');
      for (const metric of item.description.match(/\d+(?:[.,]\d+)?%?|\d+\+/g) || []) {
        push('metric', metric, item.description, 'experience');
      }
    }
  });
  (content.projects || []).forEach((item) => {
    push('project', item.name, item.name, 'projects');
    if (item.description) push('responsibility', item.description, item.description, 'projects');
  });
  for (const metric of rawText.match(/\d+(?:[.,]\d+)?%?|\d+\+/g) || []) {
    push('metric', metric, metric, 'raw');
  }
  return facts;
}

export function validateRewrite(
  originalText: string,
  suggestedText: string,
  facts: AtsFact[],
): { result: 'PASS' | 'FAIL' | 'REVIEW'; reason: string } {
  const original = originalText.trim();
  const suggested = suggestedText.trim();
  if (!suggested || suggested === original) return { result: 'PASS', reason: 'Unchanged or empty suggestion skipped.' };
  if (INFLATED.test(suggested) && !INFLATED.test(original)) {
    return { result: 'FAIL', reason: 'Suggested text adds unsupported seniority, scale, or metrics.' };
  }

  const originalNumbers = numbersIn(original);
  const factNumbers = new Set(facts.filter((item) => item.type === 'metric').map((item) => normalizeToken(item.value)));
  for (const num of numbersIn(suggested)) {
    if (!originalNumbers.has(num) && !factNumbers.has(num)) {
      return { result: 'FAIL', reason: `New number "${num}" is not in the original resume.` };
    }
  }

  const allowedSkills = new Set(
    facts
      .filter((item) => item.type === 'skill' || item.type === 'responsibility' || item.type === 'project')
      .map((item) => item.value.toLowerCase()),
  );
  const originalLower = `${original} ${facts.map((item) => item.value).join(' ')}`.toLowerCase();
  const newSkillHits = (suggested.match(/\b[A-Z][A-Za-z+#.]{1,20}\b/g) || []).filter((token) => {
    const lower = token.toLowerCase();
    if (lower.length < 3) return false;
    if (originalLower.includes(lower)) return false;
    if ([...allowedSkills].some((skill) => skill.includes(lower))) return false;
    return /react|python|java|sql|excel|aws|node|docker|kubernetes|tableau/i.test(token);
  });
  if (newSkillHits.length) {
    return { result: 'FAIL', reason: `New skill "${newSkillHits[0]}" is not supported by the original resume.` };
  }

  if (suggested.length > original.length * 3 && original.length > 12) {
    return { result: 'REVIEW', reason: 'Suggestion is much longer than the original and needs a human check.' };
  }

  return { result: 'PASS', reason: 'Wording improved without new facts.' };
}

export function factPreservationScore(originalFacts: AtsFact[], changes: ResumeChangeRecord[]) {
  const failed = changes.filter((item) => item.validation === 'FAIL').length;
  const total = Math.max(1, originalFacts.length);
  const kept = Math.max(0, total - failed);
  return Math.round((kept / total) * 100);
}

export function analyzeResumeContent(content: ResumeContent, rawText = ''): ResumeAnalysis {
  const issues: AtsIssue[] = [];
  const add = (issue: Omit<AtsIssue, 'id'>) => {
    issues.push({ ...issue, id: `i${issues.length + 1}` });
  };

  const contactBits = [content.fullName, content.phone, content.email, content.city].filter(Boolean).length;
  let contact = contactBits >= 3 ? 95 : contactBits === 2 ? 72 : 40;
  if (!content.phone) {
    add({
      section: ATS_SECTION_LABELS.contact,
      sectionKey: 'contact',
      severity: 'HIGH',
      problem: 'Phone number is missing or not readable as text.',
      location: 'Contact Information',
      why: 'ATS software and recruiters cannot parse a phone number that is only in an image or header graphic.',
      recommendation: 'Add your phone number as plain text in the header.',
    });
  }
  if (!content.fullName) {
    contact = Math.min(contact, 35);
    add({
      section: ATS_SECTION_LABELS.contact,
      sectionKey: 'contact',
      severity: 'HIGH',
      problem: 'Full name is missing.',
      location: 'Contact Information',
      why: 'Applicant tracking systems use the name field to create the candidate profile.',
      recommendation: 'Put your full name in plain text at the top of the resume.',
    });
  }

  const hasSummary = Boolean(content.summary && content.summary.trim().length >= 40);
  const genericSummary = /hardworking|team player|looking for a challenging|to utilize my skills/i.test(
    content.summary || '',
  );
  let summary = hasSummary ? 82 : 48;
  if (!hasSummary) {
    add({
      section: ATS_SECTION_LABELS.summary,
      sectionKey: 'summary',
      severity: 'HIGH',
      problem: 'Professional summary is missing or too short.',
      location: 'Professional Summary',
      why: 'A short, specific summary helps ATS and recruiters understand your direction without a job description.',
      recommendation: 'Write 2–3 sentences using your real role, skills, and city already on the resume.',
    });
  } else if (genericSummary) {
    summary = 65;
    add({
      section: ATS_SECTION_LABELS.summary,
      sectionKey: 'summary',
      severity: 'MEDIUM',
      problem: 'Summary is too generic.',
      location: 'Professional Summary',
      why: 'Generic phrases do not add searchable skills or experience signals.',
      recommendation: 'Make the summary more specific using experience and skills already present in the resume.',
    });
  }

  let experience = content.experiences.length ? 78 : 42;
  if (!content.experiences.length) {
    add({
      section: ATS_SECTION_LABELS.experience,
      sectionKey: 'experience',
      severity: 'HIGH',
      problem: 'No work experience, internship, or equivalent section was parsed.',
      location: 'Work Experience',
      why: 'Without roles and bullets, ATS has little to index besides skills.',
      recommendation: 'Add internships, projects, or volunteer roles using only real history.',
    });
  }
  content.experiences.forEach((item, index) => {
    const bullets = (item.description || '')
      .split(/\n|•/)
      .map((row) => row.trim())
      .filter(Boolean);
    const generic = bullets.filter((row) => GENERIC_VERBS.test(row) || row.split(/\s+/).length < 6);
    if (generic.length) {
      experience = Math.min(experience, 58);
      const sample = generic[0];
      add({
        section: ATS_SECTION_LABELS.experience,
        sectionKey: 'experience',
        severity: 'HIGH',
        problem: 'Several bullets are too generic.',
        location: `${item.company || 'Role'} → ${item.jobTitle || 'Position'} → Bullet ${bullets.indexOf(sample) + 1 || 1}`,
        why: 'Generic descriptions provide less useful information for ATS parsing and recruiters.',
        recommendation: 'Use stronger action-oriented wording based only on the experience already provided.',
        originalExample: sample,
        suggestedExample: strengthenBullet(sample),
      });
    }
    if (!item.company || !item.jobTitle) {
      experience = Math.min(experience, 62);
      add({
        section: ATS_SECTION_LABELS.experience,
        sectionKey: 'experience',
        severity: 'MEDIUM',
        problem: 'A role is missing company or job title.',
        location: `Work Experience item ${index + 1}`,
        why: 'ATS systems map candidates using employer names and titles as structured fields.',
        recommendation: 'Add the employer name and job title as plain text.',
      });
    }
  });

  const experienceText = content.experiences.map((item) => `${item.jobTitle} ${item.description || ''}`).join(' ');
  const missingSkills = mentionedSkills(experienceText).filter(
    (skill) => !content.skills.some((item) => item.toLowerCase().includes(skill.toLowerCase())),
  );
  let skills = content.skills.length >= 6 ? 86 : content.skills.length >= 3 ? 72 : 50;
  if (missingSkills.length) {
    skills = Math.min(skills, 72);
    add({
      section: ATS_SECTION_LABELS.skills,
      sectionKey: 'skills',
      severity: 'MEDIUM',
      problem: `${missingSkills[0]} appears in experience but is missing from Skills.`,
      location: 'Skills',
      why: 'Many ATS keyword filters read the Skills section separately from experience bullets.',
      recommendation: `Consider adding ${missingSkills[0]} to your Skills section because it is already mentioned in your experience.`,
    });
  }
  if (!content.skills.length) {
    skills = 40;
    add({
      section: ATS_SECTION_LABELS.skills,
      sectionKey: 'skills',
      severity: 'HIGH',
      problem: 'Skills section is empty or was not parsed.',
      location: 'Skills',
      why: 'Skill lists are one of the most common ATS keyword sources.',
      recommendation: 'List skills already evidenced in your experience or education, as plain text.',
    });
  }

  const education = content.education.length ? 90 : 45;
  if (!content.education.length) {
    add({
      section: ATS_SECTION_LABELS.education,
      sectionKey: 'education',
      severity: 'MEDIUM',
      problem: 'Education section is missing.',
      location: 'Education',
      why: 'Degree and institution are standard ATS fields for screening.',
      recommendation: 'Add qualification and school name as text, not as a logo.',
    });
  }

  const certifications = (content.certifications || []).length ? 80 : 70;
  const projects = (content.projects || []).length || /project/i.test(experienceText) ? 78 : 68;

  const raw = rawText || '';
  let formatting = 84;
  if (/\|.+\|/.test(raw) || /\t\t/.test(raw)) {
    formatting = 62;
    add({
      section: ATS_SECTION_LABELS.formatting,
      sectionKey: 'formatting',
      severity: 'HIGH',
      problem: 'Important information appears inside a complex layout (columns or tables).',
      location: 'Formatting',
      why: 'Multi-column tables and text boxes often parse out of order or drop text.',
      recommendation: 'Use a simple ATS-readable single-column structure.',
    });
  }
  if (raw && !content.phone && /contact/i.test(raw)) {
    formatting = Math.min(formatting, 64);
    add({
      section: ATS_SECTION_LABELS.formatting,
      sectionKey: 'formatting',
      severity: 'MEDIUM',
      problem: 'Contact details may sit in a header graphic or icon instead of text.',
      location: 'Header / footer',
      why: 'ATS often ignores headers, footers, and icon-only contact rows.',
      recommendation: 'Repeat email and phone in the main body as selectable text.',
    });
  }

  const structure = [hasSummary, content.experiences.length, content.skills.length, content.education.length].filter(
    Boolean,
  ).length;
  const structureScore = [42, 58, 70, 82, 90][structure];

  const allText = `${content.summary} ${experienceText} ${content.skills.join(' ')}`;
  const readability = allText.length > 280 && allText.split(/\s+/).length < 900 ? 82 : 68;
  const headingSet = [hasSummary, content.experiences.length > 0, content.skills.length > 0, content.education.length > 0];
  const consistency = headingSet.every(Boolean) ? 86 : 70;

  const sectionValues: Record<AtsSectionKey, number> = {
    contact,
    structure: structureScore,
    formatting,
    summary,
    experience,
    skills,
    education,
    certifications,
    projects,
    readability,
    consistency,
  };

  let weighted = 0;
  let weightTotal = 0;
  (Object.keys(ATS_SECTION_WEIGHTS) as AtsSectionKey[]).forEach((key) => {
    weighted += sectionValues[key] * ATS_SECTION_WEIGHTS[key];
    weightTotal += ATS_SECTION_WEIGHTS[key];
  });
  const score = clamp(Math.round(weighted / weightTotal));

  const sections: AtsSectionScore[] = (Object.keys(ATS_SECTION_WEIGHTS) as AtsSectionKey[]).map((key) => ({
    key,
    name: ATS_SECTION_LABELS[key],
    score: clamp(sectionValues[key]),
    tone: sectionTone(sectionValues[key]),
  }));

  const highPriority = issues.filter((item) => item.severity === 'HIGH').length;
  const mediumPriority = issues.filter((item) => item.severity === 'MEDIUM').length;
  const goodSections = sections.filter((item) => item.tone === 'good').length;
  const complete = sections.filter((item) => item.tone === 'good').map((item) => item.name);
  const improve = sections.filter((item) => item.tone !== 'good').map((item) => item.name);
  const suggestions = issues.slice(0, 5).map((item) => ({ id: item.id, text: item.recommendation }));

  return {
    score,
    scoreType: ATS_SCORE_TYPE,
    label: atsReadinessLabel(score),
    complete,
    improve,
    suggestions,
    sections,
    highPriority,
    mediumPriority,
    goodSections,
    issues,
    recommendedPlanId: recommendAtsPlanId(score),
    disclaimer:
      'This is an ATS Readiness Score for parsing and resume quality. It is not a Job Match Score and is not the score from every vendor ATS.',
  };
}

export function strengthenBullet(text: string) {
  const trimmed = text.replace(/^[-•\s]+/, '').trim();
  if (/^worked on\b/i.test(trimmed)) {
    return trimmed.replace(/^worked on\b/i, 'Developed and maintained');
  }
  if (/^responsible for\b/i.test(trimmed)) {
    return trimmed.replace(/^responsible for\b/i, 'Handled');
  }
  if (/^helped with\b/i.test(trimmed)) {
    return trimmed.replace(/^helped with\b/i, 'Supported');
  }
  if (ALLOWED_STYLE.test(trimmed)) return trimmed;
  return `Developed ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

export function applySafeOptimizations(content: ResumeContent, facts: AtsFact[]) {
  const next: ResumeContent = JSON.parse(JSON.stringify(content)) as ResumeContent;
  const changes: ResumeChangeRecord[] = [];

  if (next.summary && /hardworking|team player|looking for a challenging/i.test(next.summary)) {
    const original = next.summary;
    const skillLine = next.skills.slice(0, 3).join(', ') || 'the skills listed on this resume';
    const suggested = `${next.fullName || 'This candidate'} brings ${skillLine}${
      next.city ? ` and is based in ${next.city}` : ''
    }. Ready to contribute using experience already listed below.`;
    const check = validateRewrite(original, suggested, facts);
    if (check.result === 'PASS') {
      next.summary = suggested;
      changes.push({
        id: `c${changes.length + 1}`,
        section: 'Professional Summary',
        originalText: original,
        suggestedText: suggested,
        reason: 'Made the summary more specific using existing name, skills, and city.',
        validation: 'PASS',
        factIds: facts.filter((item) => ['name', 'skill', 'location'].includes(item.type)).map((item) => item.id),
      });
    }
  }

  next.experiences = next.experiences.map((item) => {
    if (!item.description) return item;
    const lines = item.description.split(/\n/);
    const rewritten = lines.map((line) => {
      const original = line.trim();
      if (!GENERIC_VERBS.test(original)) return line;
      const suggested = strengthenBullet(original);
      const check = validateRewrite(original, suggested, facts);
      if (check.result !== 'PASS') return line;
      changes.push({
        id: `c${changes.length + 1}`,
        section: 'Work Experience',
        originalText: original,
        suggestedText: suggested,
        reason: 'Improved action-oriented language.',
        validation: 'PASS',
        factIds: facts.filter((fact) => fact.section === 'experience').map((fact) => fact.id),
      });
      return suggested;
    });
    return { ...item, description: rewritten.join('\n') };
  });

  const mentioned = mentionedSkills(
    next.experiences.map((item) => `${item.jobTitle} ${item.description || ''}`).join(' '),
  );
  mentioned.forEach((skill) => {
    if (!next.skills.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      next.skills = [...next.skills, skill];
      changes.push({
        id: `c${changes.length + 1}`,
        section: 'Skills',
        originalText: next.skills.filter((item) => item !== skill).join(', '),
        suggestedText: skill,
        reason: `${skill} was already mentioned in experience, so it was added to Skills.`,
        validation: 'PASS',
        factIds: facts.filter((item) => item.type === 'skill' || item.type === 'responsibility').map((item) => item.id),
      });
    }
  });

  return { content: next, changes };
}

function mentionedSkills(text: string) {
  const catalog = ['React', 'Python', 'Java', 'SQL', 'MS Excel', 'Excel', 'JavaScript', 'TypeScript', 'AWS', 'Node'];
  return catalog.filter((skill) => new RegExp(`\\b${skill.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text));
}

function numbersIn(text: string) {
  return new Set((text.match(/\d+(?:[.,]\d+)?%?|\d+\+/g) || []).map(normalizeToken));
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/,/g, '');
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
