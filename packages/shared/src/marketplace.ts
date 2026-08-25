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
  department?: string | null;
  hiringManager?: string | null;
  openings?: number;
  workMode?: string | null;
  educationMin?: string | null;
  screeningQuestions?: ScreeningQuestion[];
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
  certifications?: string[];
  projects?: Array<{ name: string; description: string | null }>;
  includePhoto?: boolean;
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
  kind?: 'ORIGINAL' | 'OPTIMIZED';
  parentResumeId?: string | null;
  updatedAt: string;
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
    jobId: string;
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
  screeningAnswers?: ScreeningAnswer[];
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
