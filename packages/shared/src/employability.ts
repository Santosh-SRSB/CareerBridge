export type EmployabilityInputs = {
  /** Profile overview completion, 0–100. */
  profileCompletion: number;
  /** Best ATS readiness score across the candidate's active resumes, or null when none was analysed. */
  bestResumeAtsScore: number | null;
  /** Scores (0–100) of recently completed AI mock interviews, newest first. */
  mockInterviewScores: number[];
  skillsCount: number;
  hasWorkExperience: boolean;
  projectsCount: number;
  certificationsCount: number;
};

export type EmployabilityComponentKey =
  | 'profile'
  | 'resume'
  | 'interview'
  | 'skills'
  | 'experience'
  | 'certifications';

export type EmployabilityComponent = {
  key: EmployabilityComponentKey;
  label: string;
  weight: number;
  /** 0–100 for this component. */
  score: number;
  /** Contribution to the overall score (score × weight / 100). */
  points: number;
  tip: string | null;
};

export type EmployabilityBand = 'Low' | 'Developing' | 'Good' | 'Strong';

export type EmployabilityScore = {
  score: number;
  band: EmployabilityBand;
  /** False until the profile is complete enough for the score to be meaningful. */
  ready: boolean;
  components: EmployabilityComponent[];
};

export type AiFeedbackKind = 'RESUME_REVIEW' | 'RESUME_IMPROVEMENT' | 'MOCK_INTERVIEW';

/** One stored piece of feedback in the candidate's Career Passport history. */
export type AiFeedbackItem = {
  id: string;
  kind: AiFeedbackKind;
  title: string;
  at: string;
  score: number | null;
  summary: string;
  /** What the candidate did with the feedback, when recorded. */
  action: string | null;
  href: string;
};

export const EMPLOYABILITY_READY_COMPLETION = 60;
export const EMPLOYABILITY_SKILLS_TARGET = 8;
export const EMPLOYABILITY_RECENT_INTERVIEWS = 3;

const WEIGHTS: Record<EmployabilityComponentKey, number> = {
  profile: 25,
  resume: 25,
  interview: 20,
  skills: 15,
  experience: 10,
  certifications: 5,
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function employabilityBand(score: number): EmployabilityBand {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Developing';
  return 'Low';
}

/** Transparent weighted score from real profile data; no AI call. */
export function computeEmployabilityScore(input: EmployabilityInputs): EmployabilityScore {
  const recent = input.mockInterviewScores.slice(0, EMPLOYABILITY_RECENT_INTERVIEWS).map(clampPercent);
  const interviewScore = recent.length ? recent.reduce((sum, n) => sum + n, 0) / recent.length : 0;
  const experienceScore = input.hasWorkExperience ? 100 : input.projectsCount > 0 ? 60 : 0;

  const parts: Array<Omit<EmployabilityComponent, 'weight' | 'points'>> = [
    {
      key: 'profile',
      label: 'Profile completion',
      score: clampPercent(input.profileCompletion),
      tip: input.profileCompletion >= 100 ? null : 'Complete the remaining profile sections.',
    },
    {
      key: 'resume',
      label: 'Resume ATS score',
      score: clampPercent(input.bestResumeAtsScore ?? 0),
      tip:
        input.bestResumeAtsScore == null
          ? 'Create a resume and check its ATS score.'
          : input.bestResumeAtsScore < 80
            ? 'Improve your resume using the ATS suggestions.'
            : null,
    },
    {
      key: 'interview',
      label: 'Mock interview performance',
      score: clampPercent(interviewScore),
      tip: recent.length ? (interviewScore < 70 ? 'Practise more AI mock interviews.' : null) : 'Complete an AI mock interview.',
    },
    {
      key: 'skills',
      label: 'Skills',
      score: clampPercent((input.skillsCount / EMPLOYABILITY_SKILLS_TARGET) * 100),
      tip:
        input.skillsCount >= EMPLOYABILITY_SKILLS_TARGET
          ? null
          : `Add skills (${input.skillsCount}/${EMPLOYABILITY_SKILLS_TARGET}).`,
    },
    {
      key: 'experience',
      label: 'Experience or projects',
      score: experienceScore,
      tip: input.hasWorkExperience ? null : 'Add work experience, an internship or a project.',
    },
    {
      key: 'certifications',
      label: 'Certifications',
      score: clampPercent(input.certificationsCount * 50),
      tip: input.certificationsCount >= 2 ? null : 'Add a certification.',
    },
  ];

  const components = parts.map((part) => {
    const weight = WEIGHTS[part.key];
    return { ...part, weight, points: Math.round((part.score * weight) / 10) / 10 };
  });
  const score = clampPercent(components.reduce((sum, c) => sum + (c.score * c.weight) / 100, 0));

  return {
    score,
    band: employabilityBand(score),
    ready: input.profileCompletion >= EMPLOYABILITY_READY_COMPLETION,
    components,
  };
}
