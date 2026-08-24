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
