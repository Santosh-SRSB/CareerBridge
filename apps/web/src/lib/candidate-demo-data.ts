import type { ApplicationRecord, JobCard, JobDetail } from '@careerbridge/shared';

const demoMatch = (score: number) => ({
  score,
  skillScore: score,
  locationScore: score - 2,
  categoryScore: score - 1,
  experienceScore: score - 3,
  reasons: ['Strong skill overlap', 'Location matches your preference'],
  gaps: [],
});

export const DEMO_JOBS: JobDetail[] = [
  {
    id: 'demo-job-1',
    title: 'Customer Service Executive',
    companyName: 'ABC Services',
    city: 'Chennai',
    salaryMin: 18000,
    salaryMax: 22000,
    jobType: 'FULL_TIME',
    category: 'Customer Service',
    requiredSkills: ['English', 'Communication', 'Basic Computer Skills'],
    preferredSkills: ['MS Excel', 'Customer handling'],
    match: demoMatch(86),
    description:
      'Handle customer queries via phone, email, and chat. Resolve issues politely, document cases accurately, and coordinate with internal teams to close requests on time.',
    experience: '0–2 years',
    benefits: 'PF, health cover, performance incentives',
    status: 'PUBLISHED',
    applied: false,
  },
  {
    id: 'demo-job-2',
    title: 'Front Office Executive',
    companyName: 'ABC Services',
    city: 'Chennai',
    salaryMin: 16000,
    salaryMax: 20000,
    jobType: 'FULL_TIME',
    category: 'Operations',
    requiredSkills: ['Communication', 'MS Excel', 'Front desk handling'],
    preferredSkills: ['Hospitality'],
    match: demoMatch(78),
    description:
      'Manage front desk operations, greet visitors, schedule appointments, and support daily office coordination.',
    experience: '0–1 years',
    benefits: 'PF, paid leave',
    status: 'PUBLISHED',
    applied: true,
  },
  {
    id: 'demo-job-3',
    title: 'Retail Associate',
    companyName: 'Retail Hub',
    city: 'Bengaluru',
    salaryMin: 15000,
    salaryMax: 19000,
    jobType: 'FULL_TIME',
    category: 'Retail',
    requiredSkills: ['Sales', 'Communication'],
    preferredSkills: ['POS billing'],
    match: demoMatch(72),
    description: 'Assist customers on the shop floor, manage billing, and maintain display standards.',
    experience: 'Fresher welcome',
    benefits: 'Staff discount, incentives',
    status: 'PUBLISHED',
    applied: false,
  },
  {
    id: 'demo-job-4',
    title: 'Sales Executive',
    companyName: 'ABC Services',
    city: 'Hyderabad',
    salaryMin: 18000,
    salaryMax: 24000,
    jobType: 'FULL_TIME',
    category: 'Sales',
    requiredSkills: ['Negotiation', 'Communication', 'Field sales'],
    preferredSkills: ['Two-wheeler license'],
    match: demoMatch(81),
    description: 'Generate leads, follow up with prospects, and close sales for assigned territory.',
    experience: '1–3 years',
    benefits: 'Travel allowance, incentives',
    status: 'PUBLISHED',
    applied: false,
  },
  {
    id: 'demo-job-5',
    title: 'Delivery Coordinator',
    companyName: 'LogiMove',
    city: 'Chennai',
    salaryMin: 17000,
    salaryMax: 21000,
    jobType: 'FULL_TIME',
    category: 'Logistics',
    requiredSkills: ['Coordination', 'MS Excel'],
    preferredSkills: ['Route planning'],
    match: demoMatch(69),
    description: 'Track deliveries, coordinate riders, and update customers on order status.',
    experience: '0–2 years',
    benefits: 'PF, night shift allowance',
    status: 'PUBLISHED',
    applied: false,
  },
];

export const DEMO_APPLICATIONS: ApplicationRecord[] = [
  {
    id: 'demo-app-1',
    status: 'SHORTLISTED',
    createdAt: '2026-09-10T10:00:00.000Z',
    resumeId: 'resume-demo',
    resumeVersion: 1,
    job: DEMO_JOBS[0],
    timeline: [
      { status: 'APPLIED', at: '2026-09-10T10:00:00.000Z', done: true },
      { status: 'UNDER_REVIEW', at: '2026-09-11T10:00:00.000Z', done: true },
      { status: 'SHORTLISTED', at: '2026-09-12T10:00:00.000Z', done: true },
      { status: 'INTERVIEW', at: '', done: false },
      { status: 'SELECTED', at: '', done: false },
    ],
  },
  {
    id: 'demo-app-2',
    status: 'REJECTED',
    createdAt: '2026-09-08T10:00:00.000Z',
    resumeId: 'resume-demo',
    resumeVersion: 1,
    job: DEMO_JOBS[1],
    timeline: [
      { status: 'APPLIED', at: '2026-09-08T10:00:00.000Z', done: true },
      { status: 'UNDER_REVIEW', at: '2026-09-09T10:00:00.000Z', done: true },
      { status: 'REJECTED', at: '2026-09-11T10:00:00.000Z', done: true },
    ],
  },
];

export type ScheduledJobInterview = {
  id: string;
  jobTitle: string;
  companyName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'RESCHEDULE_REQUESTED';
  location: string;
  mode: 'IN_PERSON' | 'VIDEO';
  applicationId: string;
};

export const DEMO_SCHEDULED_INTERVIEWS: ScheduledJobInterview[] = [
  {
    id: 'demo-int-1',
    jobTitle: 'Customer Service Executive',
    companyName: 'ABC Services',
    scheduledDate: '2026-09-12',
    scheduledTime: '11:00 AM',
    status: 'CONFIRMED',
    location: 'ABC Services Office, Chennai',
    mode: 'IN_PERSON',
    applicationId: 'demo-app-1',
  },
];

export function filterDemoJobs(params: {
  q?: string;
  location?: string;
  category?: string;
  jobType?: string;
}): { items: JobCard[]; total: number } {
  const q = params.q?.trim().toLowerCase() || '';
  const location = params.location?.trim().toLowerCase() || '';
  const category = params.category?.trim().toLowerCase() || '';
  const jobType = params.jobType?.trim() || '';

  const items = DEMO_JOBS.filter((job) => {
    const haystack = [
      job.title,
      job.companyName,
      job.city,
      job.category,
      ...job.requiredSkills,
    ]
      .join(' ')
      .toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (location && location !== 'all' && !job.city.toLowerCase().includes(location)) return false;
    if (category && category !== 'all' && !job.category.toLowerCase().includes(category)) return false;
    if (jobType && job.jobType !== jobType) return false;
    return true;
  });

  return { items, total: items.length > 0 ? 124 : 0 };
}

export function getDemoJob(id: string): JobDetail | null {
  return DEMO_JOBS.find((job) => job.id === id) ?? null;
}

export function getDemoApplication(id: string): ApplicationRecord | null {
  return DEMO_APPLICATIONS.find((app) => app.id === id) ?? null;
}

export function getDemoScheduledInterview(id: string): ScheduledJobInterview | null {
  return DEMO_SCHEDULED_INTERVIEWS.find((item) => item.id === id) ?? null;
}
