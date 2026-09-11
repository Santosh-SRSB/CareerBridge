export const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'] as const;

export const WORK_MODES = ['ONSITE', 'HYBRID', 'REMOTE'] as const;

export const JOB_EXPERIENCE_RANGES = [
  'Fresher',
  '0 - 1 Years',
  '1 - 2 Years',
  '2 - 4 Years',
  '3 - 5 Years',
  '5 - 8 Years',
  '8+ Years',
] as const;

export const JOB_EDUCATION_LEVELS = [
  'Any',
  "10th / Secondary",
  "12th / Higher Secondary",
  'Diploma',
  "Bachelor's Degree",
  "Master's Degree",
  'Doctorate',
] as const;

export const JOB_DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Sales',
  'Marketing',
  'Customer Support',
  'Human Resources',
  'Finance',
  'Operations',
  'IT / Technology',
  'Legal',
  'Administration',
  'Healthcare',
  'Hospitality',
  'Logistics',
  'Retail',
] as const;

export const SCREENING_QUESTION_TYPES = ['YES_NO', 'SHORT_TEXT', 'SINGLE_CHOICE'] as const;

export const JOB_SKILL_SUGGESTIONS = [
  'Communication',
  'Customer Service',
  'MS Excel',
  'Sales',
  'Data Entry',
  'React',
  'Node.js',
  'SQL',
  'AWS',
  'JavaScript',
  'Python',
  'Java',
  'TypeScript',
  'HTML / CSS',
  'Teamwork',
] as const;

export type WorkMode = (typeof WORK_MODES)[number];
export type ScreeningQuestionType = (typeof SCREENING_QUESTION_TYPES)[number];

export type ScreeningQuestion = {
  id: string;
  prompt: string;
  type: ScreeningQuestionType;
  options?: string[];
  required?: boolean;
};

export type ScreeningAnswer = {
  questionId: string;
  answer: string;
  prompt?: string;
};

export type CreateJobPayload = {
  title: string;
  description: string;
  city: string;
  category: string;
  department?: string;
  hiringManager?: string;
  openings?: number;
  workMode?: string;
  educationMin?: string;
  salaryMin?: number;
  salaryMax?: number;
  jobType?: string;
  experience?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  benefits?: string;
  screeningQuestions?: ScreeningQuestion[];
  publish?: boolean;
};

export const TECH_JOB_CATEGORIES = [
  'Technology',
  'Software Development',
  'Data / Analytics',
  'IT Support',
  'Product / Design',
  'Engineering',
  'Cybersecurity',
  'QA / Testing',
] as const;
export const NON_TECH_JOB_CATEGORIES = [
  'Customer Service',
  'Retail',
  'Sales',
  'Office/Admin',
  'Delivery/Logistics',
  'Education',
  'Healthcare',
  'Hospitality',
  'Finance / Accounting',
  'Human Resources',
  'Manufacturing',
  'Marketing',
] as const;
export const JOB_CATEGORIES = [...TECH_JOB_CATEGORIES, ...NON_TECH_JOB_CATEGORIES] as const;

export const INDIAN_CITIES = [
  'Agra',
  'Ahmedabad',
  'Ajmer',
  'Amritsar',
  'Aurangabad',
  'Bengaluru',
  'Bhopal',
  'Bhubaneswar',
  'Chandigarh',
  'Chennai',
  'Coimbatore',
  'Dehradun',
  'Delhi',
  'Faridabad',
  'Ghaziabad',
  'Goa',
  'Gurugram',
  'Guwahati',
  'Gwalior',
  'Hubballi',
  'Hyderabad',
  'Indore',
  'Jaipur',
  'Jalandhar',
  'Jammu',
  'Jamshedpur',
  'Jodhpur',
  'Kanpur',
  'Kochi',
  'Kolkata',
  'Kota',
  'Lucknow',
  'Ludhiana',
  'Madurai',
  'Mangaluru',
  'Meerut',
  'Mumbai',
  'Mysuru',
  'Nagpur',
  'Nashik',
  'Navi Mumbai',
  'Noida',
  'Patna',
  'Prayagraj',
  'Pune',
  'Raipur',
  'Rajkot',
  'Ranchi',
  'Salem',
  'Srinagar',
  'Surat',
  'Thane',
  'Thiruvananthapuram',
  'Tiruchirappalli',
  'Udaipur',
  'Vadodara',
  'Varanasi',
  'Vijayawada',
  'Visakhapatnam',
  'Warangal',
] as const;

export type IndianCity = (typeof INDIAN_CITIES)[number];

export function isListedIndianCity(city: string) {
  return (INDIAN_CITIES as readonly string[]).includes(city);
}

export function isListedJobCategory(category: string) {
  return (JOB_CATEGORIES as readonly string[]).includes(category);
}

export const CAREERBRIDGE_RESUME_TEMPLATE = 'resume-template-01' as const;

export const RESUME_TEMPLATES = [
  'CLASSIC',
  'MODERN',
  'SIMPLE',
  'ats-minimal',
  'ats-classic',
  'ats-professional',
  'ats-executive',
  'ats-modern',
  'photo-professional',
  'photo-executive',
  'photo-modern',
  'photo-corporate',
  'photo-elegant',
  'resume-template-01',
] as const;

export const ATS_PHOTO_TEMPLATES = [
  { id: 'photo-professional', name: 'Photo Professional' },
  { id: 'photo-executive', name: 'Photo Executive' },
  { id: 'photo-modern', name: 'Photo Modern' },
  { id: 'photo-corporate', name: 'Photo Corporate' },
  { id: 'photo-elegant', name: 'Photo Elegant' },
] as const;

export const ATS_PLAIN_TEMPLATES = [
  { id: 'ats-classic', name: 'ATS Classic' },
  { id: 'ats-professional', name: 'ATS Professional' },
  { id: 'ats-executive', name: 'ATS Executive' },
  { id: 'ats-minimal', name: 'ATS Minimal' },
  { id: 'ats-modern', name: 'ATS Modern' },
] as const;

export function resolveResumeTemplateId(id?: string | null) {
  const value = (id || '').trim();
  // CareerBridge master template — extract user data, always render in our design.
  if (!value || value === 'resume-template-01' || value === 'CAREERBRIDGE' || value === 'master') {
    return CAREERBRIDGE_RESUME_TEMPLATE;
  }
  if (value === 'CLASSIC') return 'ats-classic';
  if (value === 'MODERN') return 'ats-modern';
  if (value === 'SIMPLE') return 'ats-minimal';
  return value;
}

export function resumeTemplateHasPhoto(id?: string | null) {
  return resolveResumeTemplateId(id).startsWith('photo-');
}

export const INTERVIEW_TYPES = [
  { value: 'HR', label: 'HR / General' },
  { value: 'CUSTOMER_SERVICE', label: 'Customer Service' },
  { value: 'SITUATIONAL', label: 'Situational' },
] as const;
export const APPLICATION_STATUSES = [
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'SELECTED',
  'REJECTED',
  'WITHDRAWN',
  'HIRED',
] as const;

export type JobType = (typeof JOB_TYPES)[number];
export type JobCategory = (typeof JOB_CATEGORIES)[number];
export type ResumeTemplate = (typeof RESUME_TEMPLATES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type JobMatch = {
  score: number;
  skillScore: number;
  locationScore: number;
  categoryScore: number;
  experienceScore: number;
  reasons: string[];
  gaps: string[];
};

export type JobCard = {
  id: string;
  title: string;
  companyName: string;
  city: string;
  salaryMin: number | null;
  salaryMax: number | null;
  jobType: string;
  category: string;
  requiredSkills: string[];
  preferredSkills: string[];
  /** Required experience label from the employer job post (e.g. Fresher, 1-3 years). */
  experience?: string | null;
  match?: JobMatch;
  saved?: boolean;
};

export type JobDetail = JobCard & {
  description: string;
  experience: string | null;
  benefits: string | null;
  status: string;
  applied: boolean;
};

export type PagedJobs = {
  items: JobCard[];
  page: number;
  pageSize: number;
  total: number;
};

export type ResumeContent = {
  fullName: string;
  city: string | null;
  phone: string | null;
  email?: string | null;
  summary: string;
  skills: string[];
  education: Array<{ qualification: string; institution: string | null; yearCompleted: number | null }>;
  experiences: Array<{
    company: string;
    jobTitle: string;
    description: string | null;
    isInternship: boolean;
  }>;
  languages: string[];
  /**
   * Certifications — prefer structured objects; legacy string[] (name only) still accepted.
   */
  certifications?: Array<
    | string
    | {
        name: string;
        issuer?: string | null;
        date?: string | null;
        url?: string | null;
      }
  >;
  /** Structured achievements — kept separate from certifications. */
  achievements?: Array<{
    title: string;
    organization?: string | null;
    description?: string | null;
    date?: string | null;
  }>;
  projects?: Array<{
    name: string;
    description: string | null;
    url?: string | null;
    /** Optional bullet points — kept separate from description to avoid duplication. */
    bullets?: string[];
  }>;
  includePhoto?: boolean;
  /** ADDITIVE optional normalized blob — existing fields above remain source of truth for legacy readers. */
  resumeData?: import('./resume-data').NormalizedResumeData;
};

export type ResumeRecord = {
  id: string;
  title: string;
  targetJobTitle: string | null;
  template: string;
  summary: string | null;
  content: ResumeContent;
  /** Extracted plain text when available (upload / OCR). Used for file size hints. */
  rawText?: string | null;
  score: number;
  version: number;
  kind?: 'ORIGINAL' | 'OPTIMIZED';
  parentResumeId?: string | null;
  updatedAt: string;
  archivedAt?: string | null;
  applicationCount?: number;
  pdfStoragePath?: string | null;
  pdfStorageUri?: string | null;
  pdfPublicUrl?: string | null;
  pdfUploadedAt?: string | null;
  analysis?: import('./ats').ResumeAnalysis;
  plans?: Array<{ id: string; label: string; minScore: number; maxScore: number; amount: number }>;
};

export type ApplicationRecord = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  resumeId: string | null;
  resumeVersion: number | null;
  job: JobCard;
  timeline: Array<{ status: string; at: string; done: boolean }>;
};

export type InterviewQuestion = {
  index: number;
  prompt: string;
  snippet?: string | null;
  thinkSeconds?: number;
};

export type InterviewFeedback = {
  score: number;
  communication: number;
  structure: number;
  relevance: number;
  confidence: number;
  strengths: string[];
  improvements: string[];
};

export type LiveInterviewTurn = {
  role: 'ai' | 'candidate';
  text: string;
  at: string;
  questionNumber?: number;
};

export type LiveInterviewQuestion = {
  id: string;
  number: number;
  text: string;
  category: string;
  difficulty: string;
  askedAt: string;
  answer?: string;
  answeredAt?: string;
  answerDurationSec?: number;
  answerMode?: 'TEXT' | 'AUDIO';
  analysis?: string;
  improvedAnswer?: string;
  score?: number;
  strengths?: string[];
  weaknesses?: string[];
  snippet?: string | null;
  thinkSeconds?: number;
};

export type InterviewWarning = {
  type: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'HIGH';
  at: string;
};

export type InterviewReport = {
  overallScore: number;
  communication: number;
  behaviour: number;
  listening: number;
  recommendation: 'Strongly Recommended' | 'Recommended' | 'Needs Improvement' | 'Not Ready';
  summary: string;
  strengths: string[];
  weaknesses: string[];
  dos: string[];
  donts: string[];
  answeredCount: number;
  totalPlanned: number;
  integrity: {
    tabSwitches: number;
    faceMissing: number;
    multipleFaces: number;
    micIssues: number;
    abuseWarnings?: number;
    nonsenseWarnings?: number;
  };
};

export type InterviewSession = {
  id: string;
  jobRole: string;
  interviewType: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  questionIndex: number;
  totalQuestions: number;
  conductWarning?: string | null;
  conductTerminated?: boolean;
  currentQuestion: InterviewQuestion | null;
  score: number | null;
  feedback: InterviewFeedback | null;
  mode?: 'CLASSIC' | 'LIVE_AI' | 'HUMAN';
  source?: 'PASSPORT' | 'UPLOAD' | null;
  startAt?: string | null;
  endAt?: string | null;
  durationSec?: number | null;
  durationLimitMin?: number | null;
  difficulty?: string | null;
  transcript?: LiveInterviewTurn[];
  liveQuestions?: LiveInterviewQuestion[];
  warnings?: InterviewWarning[];
  report?: InterviewReport | null;
  candidateName?: string | null;
  communicationScore?: number | null;
  behaviourScore?: number | null;
  listeningScore?: number | null;
  focusStacks?: string[];
};

export const HUMAN_MOCK_RULES = [
  'Pay the interview fee first. This checkout is static for now.',
  'After payment, choose Technical or Non-technical interview.',
  'Then enter your name, email, and time to schedule.',
  'The live room opens only 5 minutes before your booked time.',
  'After the live room, we generate a transcript. Download or copy it, then see your score.',
];

export const HUMAN_INTERVIEW_TRACKS = ['TECHNICAL', 'NON_TECHNICAL'] as const;
export type HumanInterviewTrack = (typeof HUMAN_INTERVIEW_TRACKS)[number];

export const HUMAN_INTERVIEW_TRACK_OPTIONS = [
  { track: 'TECHNICAL' as const, label: 'Technical interview' },
  { track: 'NON_TECHNICAL' as const, label: 'Non-technical interview' },
];

export function humanInterviewerPublicLabel(track?: string | null) {
  if (track === 'TECHNICAL') return 'Technical interviewer';
  if (track === 'NON_TECHNICAL') return 'Non-technical interviewer';
  return 'Interviewer';
}

export const HUMAN_INTERVIEW_PRICE_INR = 199;

export const HUMAN_INTERVIEW_OPEN_BEFORE_MS = 5 * 60 * 1000;

export function humanInterviewOpensAt(scheduledAt: string | Date) {
  return new Date(new Date(scheduledAt).getTime() - HUMAN_INTERVIEW_OPEN_BEFORE_MS);
}

export function humanInterviewJoinState(scheduledAt: string | Date, now = Date.now()) {
  const start = new Date(scheduledAt).getTime();
  const opensAt = start - HUMAN_INTERVIEW_OPEN_BEFORE_MS;
  const remainingMs = Math.max(0, opensAt - now);
  return {
    canJoin: now >= opensAt,
    opensAt: new Date(opensAt).toISOString(),
    remainingMs,
  };
}

export function formatInterviewCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}

export function humanInterviewRoleFromPassport(profile: {
  careerInterests: string[];
  experiences: { jobTitle: string }[];
  skills: { name: string }[];
}) {
  const latestJob =
    profile.experiences[profile.experiences.length - 1]?.jobTitle?.trim() ||
    profile.experiences[0]?.jobTitle?.trim();
  return latestJob || profile.careerInterests[0]?.trim() || profile.skills[0]?.name?.trim() || null;
}

export function humanInterviewTypeFromRole(role: string): 'HR' | 'CUSTOMER_SERVICE' | 'SITUATIONAL' {
  const text = role.toLowerCase();
  if (/(customer|retail|sales|hospitality)/.test(text)) return 'CUSTOMER_SERVICE';
  if (/(hr|human resource|recruit)/.test(text)) return 'HR';
  return 'SITUATIONAL';
}

export type HumanMockStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';

export type HumanMockSession = {
  id: string;
  jobRole: string;
  interviewType: string;
  interviewTrack?: HumanInterviewTrack | null;
  scheduledAt: string;
  status: HumanMockStatus;
  candidateName: string | null;
  candidateEmail: string | null;
  interviewerName: string | null;
  interviewerEmail: string | null;
  emailSent: boolean;
  joinUrl: string;
  interviewerJoinUrl: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  interviewerJoined: boolean;
  transcript: string | null;
  score: number | null;
  feedback: InterviewFeedback | null;
};

export const SKILL_ASSESSMENT_MAX_QUESTIONS = 6;
export const SKILL_ASSESSMENT_TYPED_COUNT = 3;
export const SKILL_ASSESSMENT_RECORDED_COUNT = 3;
export const SKILL_ASSESSMENT_PACK_CREDITS = 3;
export const SKILL_ASSESSMENT_PACK_PRICE_INR = 99;

export const SKILL_ASSESSMENT_RULES = [
  'This is separate from mock interview. Questions come from your Career Passport resume and skills.',
  'You will answer 3 objective questions, then 3 questions by voice recording.',
  'Sit facing the camera with your head straight and both shoulders visible.',
  'Use good light. Do not sit with a window or bright light behind you.',
  'Look at the camera. Do not look down at another phone or notes.',
  'Do not use ChatGPT, Gemini, or any AI tool during the assessment.',
  'Do not read answers from another screen, book, or person.',
  'Keep a voice answer between 8 and 20 seconds. Speak clearly in your own words.',
  'We analyse the clip for face, voice, and length, then discard it. Only your score is saved.',
];

export type SkillAssessmentQuestionKind = 'MCQ' | 'TYPED' | 'SPOKEN';

export type SkillAssessmentQuestion = {
  index: number;
  prompt: string;
  skill: string;
  kind: SkillAssessmentQuestionKind;
  options: string[];
};

export type SkillAssessmentResult = {
  prompt: string;
  skill: string;
  kind: SkillAssessmentQuestionKind;
  correct: boolean;
};

export type SkillAssessmentFeedback = {
  score: number;
  correct: number;
  total: number;
  strengths: string[];
  improvements: string[];
  results: SkillAssessmentResult[];
};

export type SkillAssessmentSession = {
  id: string;
  skills: string[];
  resumeScore: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  questionIndex: number;
  totalQuestions: number;
  currentQuestion: SkillAssessmentQuestion | null;
  score: number | null;
  feedback: SkillAssessmentFeedback | null;
};

export type SkillAssessmentAccess = {
  credits: number;
  completedCount: number;
  canStart: boolean;
  packCredits: number;
  packPriceInr: number;
};

export type EmployerVerificationStatus =
  | 'UNVERIFIED'
  | 'KYC_COMPLETE'
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED';

export type EmployerProfile = {
  id: string;
  companyName: string;
  industry: string | null;
  city: string | null;
  contactName: string | null;
  gstNumber: string | null;
  cin: string | null;
  website: string | null;
  panNumber: string | null;
  workEmail: string | null;
  designation: string | null;
  verificationStatus: EmployerVerificationStatus;
  verified: boolean;
};

export type EmployerJobSummary = {
  id: string;
  title: string;
  city: string;
  status: string;
  applicantCount: number;
  publishedAt: string | null;
  createdAt: string;
};

export type JobSkillProfile = {
  jobId: string;
  source: 'MANUAL' | 'AI_EXTRACTED' | 'HYBRID' | string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceYearsMin: number;
  educationMin: string | null;
  interviewReadinessMin: number;
  extractionRaw?: Record<string, unknown>;
};

export type CandidateMatchRank = {
  id: string;
  jobId: string;
  applicationId: string | null;
  rank: number | null;
  totalScore: number;
  skillsScore: number;
  experienceScore: number;
  interviewReadinessScore: number;
  reasons: string[];
  gaps: string[];
  computedAt: string;
  candidate: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    skills: string[];
  } | null;
};

export type HiringOutcomeRecord = {
  id: string;
  applicationId: string;
  jobId: string;
  candidateId: string;
  outcome: string;
  notes: string | null;
  decidedAt: string;
};

export type EmployerPaymentRecord = {
  id: string;
  jobId: string | null;
  hiringOutcomeId: string | null;
  amountPaise: number;
  currency: string;
  status: string;
  provider: string | null;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type EmployerKycPayload = {
  gstNumber: string;
  cin: string;
  website: string;
  panNumber: string;
};

export type EmployerAffiliationPayload = {
  companyName: string;
  workEmail: string;
  designation: string;
};

export type EmployerDashboard = {
  openJobs: number;
  applications: number;
  shortlisted: number;
  interviews: number;
  recent: Array<{
    candidateName: string;
    jobTitle: string;
    status: string;
    applicationId: string;
    jobId?: string;
  }>;
};

export type EmployerApplication = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  candidate: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    skills: string[];
    highestEducation: string | null;
  };
  job: { id: string; title: string };
  match?: JobMatch;
  screeningAnswers?: Array<{ questionId: string; prompt?: string; answer: string }>;
};

export type EmployerCandidateSearchResult = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  highestEducation: string | null;
  experienceYears: number;
  profileCompletion: number;
  skills: string[];
  latestRole: { title: string; company: string } | null;
  matchScore: number | null;
  appliedToEmployer: boolean;
  applicationId?: string | null;
};

/** Job posting fee in paise (₹999). Each paid unit unlocks a batch of matched profiles. */
export const EMPLOYER_JOB_POSTING_FEE_PAISE = 99900;
export const EMPLOYER_CANDIDATES_PER_POSTING_FEE = 10;

export function employerCandidateUnlockLimit(amountPaise: number) {
  if (amountPaise < EMPLOYER_JOB_POSTING_FEE_PAISE) return 0;
  return Math.floor(amountPaise / EMPLOYER_JOB_POSTING_FEE_PAISE) * EMPLOYER_CANDIDATES_PER_POSTING_FEE;
}

export type EmployerCandidateSearchResponse = {
  jobId: string;
  unlocked: boolean;
  unlockLimit: number;
  totalMatched: number;
  candidates: EmployerCandidateSearchResult[];
};

export type EmployerCandidatePassport = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  state: string | null;
  highestEducation: string | null;
  experienceYears: number;
  experienceMonths: number;
  profileCompletion: number;
  about: string | null;
  openToRelocating: boolean;
  skills: string[];
  education: Array<{
    qualification: string;
    institution: string | null;
    fieldOfStudy: string | null;
    yearCompleted: number | null;
  }>;
  experiences: Array<{
    company: string;
    jobTitle: string;
    isInternship: boolean;
    stillInCompany: boolean;
  }>;
  hasResume: boolean;
  resumeId: string | null;
  application: {
    id: string;
    status: string;
    jobId: string;
    jobTitle: string;
  } | null;
  match: { score: number; reasons: string[]; gaps: string[] } | null;
  view: 'CONTROLLED_PASSPORT';
};

export type EmployerInterviewStatus =
  | 'PROPOSED'
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'RESCHEDULE_REQUESTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type EmployerInterviewRecord = {
  id: string;
  applicationId: string;
  jobId: string;
  candidateId: string;
  scheduledAt: string;
  durationMin: number;
  mode: string;
  location: string | null;
  status: EmployerInterviewStatus;
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
  applicationStatus: string;
  candidate: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    skills: string[];
  };
  job: { id: string; title: string };
};

export type CatalogSkill = {
  id: string;
  name: string;
  category: string;
};

export type AdminDashboard = {
  candidates: number;
  activeCandidates: number;
  employers: number;
  openJobs: number;
  applications: number;
  interviews: number;
};
