export const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'] as const;
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
export const RESUME_TEMPLATES = ['CLASSIC', 'MODERN', 'SIMPLE'] as const;
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
  match?: JobMatch;
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
};

export type ResumeRecord = {
  id: string;
  title: string;
  targetJobTitle: string | null;
  template: string;
  summary: string | null;
  content: ResumeContent;
  score: number;
  version: number;
  updatedAt: string;
  analysis?: ResumeAnalysis;
};

export type ResumeAnalysis = {
  score: number;
  complete: string[];
  improve: string[];
  suggestions: Array<{ id: string; text: string }>;
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
};

export type InterviewSession = {
  id: string;
  jobRole: string;
  interviewType: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  questionIndex: number;
  totalQuestions: number;
  currentQuestion: InterviewQuestion | null;
  score: number | null;
  feedback: InterviewFeedback | null;
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

export const HUMAN_MOCK_RULES = [
  'Pay the interview fee first. This checkout is static for now.',
  'Then enter your name, email, and time to schedule.',
  'The interviewer gets the join link at priyakum2120@gmail.com.',
  'The live room opens only 5 minutes before your booked time.',
  'After the live room, we generate a transcript. Download or copy it, then see your score.',
];

export const HUMAN_INTERVIEWER = {
  name: 'Priya Kumari',
  email: 'priyakum2120@gmail.com',
};

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

export type EmployerProfile = {
  id: string;
  companyName: string;
  industry: string | null;
  city: string | null;
  contactName: string | null;
  verified: boolean;
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
