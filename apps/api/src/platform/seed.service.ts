import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, hashPlatformPassword } from '../auth/password.util';

const SKILLS: Array<[string, string]> = [
  ['Customer Service', 'Service Industry'],
  ['Communication', 'Service Industry'],
  ['Complaint Handling', 'Service Industry'],
  ['CRM', 'Service Industry'],
  ['POS', 'Retail'],
  ['Inventory', 'Retail'],
  ['Merchandising', 'Retail'],
  ['MS Excel', 'Office'],
  ['Data Entry', 'Office'],
  ['Sales', 'Sales'],
  ['JavaScript', 'Technology'],
  ['TypeScript', 'Technology'],
  ['React', 'Technology'],
  ['Node.js', 'Technology'],
  ['Python', 'Technology'],
  ['SQL', 'Technology'],
  ['Java', 'Technology'],
  ['AWS', 'Technology'],
  ['Docker', 'Technology'],
  ['Git', 'Technology'],
  ['Manual Testing', 'QA / Testing'],
  ['Selenium', 'QA / Testing'],
  ['UI Design', 'Product / Design'],
  ['Figma', 'Product / Design'],
  ['Excel Accounting', 'Finance / Accounting'],
  ['Tally', 'Finance / Accounting'],
  ['Recruitment', 'Human Resources'],
  ['Digital Marketing', 'Marketing'],
  ['Content Writing', 'Marketing'],
  ['Nursing', 'Healthcare'],
];

type SeedJob = {
  title: string;
  city: string;
  category: string;
  salaryMin: number;
  salaryMax: number;
  experience: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  description: string;
};

const MARKETPLACE_JOBS: SeedJob[] = [
  {
    title: 'Junior Frontend Developer',
    city: 'Bengaluru',
    category: 'Software Development',
    salaryMin: 30000,
    salaryMax: 45000,
    experience: 'Fresher',
    requiredSkills: ['JavaScript', 'React', 'HTML', 'CSS'],
    preferredSkills: ['TypeScript', 'Git'],
    description:
      'Build UI screens for CareerBridge products using React. Work with designers and backend engineers. Freshers with strong JS fundamentals welcome.',
  },
  {
    title: 'Backend Node.js Developer',
    city: 'Hyderabad',
    category: 'Software Development',
    salaryMin: 35000,
    salaryMax: 55000,
    experience: '1 - 2 Years',
    requiredSkills: ['Node.js', 'JavaScript', 'SQL'],
    preferredSkills: ['TypeScript', 'AWS'],
    description:
      'Design and maintain REST APIs, auth flows, and database models. Collaborate with frontend and QA on releases.',
  },
  {
    title: 'Full Stack Engineer',
    city: 'Pune',
    category: 'Technology',
    salaryMin: 40000,
    salaryMax: 70000,
    experience: '1 - 2 Years',
    requiredSkills: ['React', 'Node.js', 'SQL', 'Git'],
    preferredSkills: ['Docker', 'AWS'],
    description:
      'Own features end-to-end across React and Node.js services. Write clean code, review PRs, and ship weekly.',
  },
  {
    title: 'Python Data Analyst',
    city: 'Bengaluru',
    category: 'Data / Analytics',
    salaryMin: 32000,
    salaryMax: 50000,
    experience: '0 - 1 Years',
    requiredSkills: ['Python', 'SQL', 'MS Excel'],
    preferredSkills: ['Communication'],
    description:
      'Clean datasets, build dashboards, and share hiring insights with product and ops teams.',
  },
  {
    title: 'IT Support Associate',
    city: 'Chennai',
    category: 'IT Support',
    salaryMin: 18000,
    salaryMax: 28000,
    experience: 'Fresher',
    requiredSkills: ['Communication', 'CRM'],
    preferredSkills: ['MS Excel'],
    description:
      'Troubleshoot laptops, printers, and basic network issues for office staff. Document tickets in CRM.',
  },
  {
    title: 'QA Tester',
    city: 'Bengaluru',
    category: 'QA / Testing',
    salaryMin: 25000,
    salaryMax: 40000,
    experience: '0 - 1 Years',
    requiredSkills: ['Manual Testing', 'Communication'],
    preferredSkills: ['Selenium', 'Git'],
    description:
      'Write test cases, run regression suites, and log bugs clearly for engineering teams.',
  },
  {
    title: 'UI/UX Designer',
    city: 'Mumbai',
    category: 'Product / Design',
    salaryMin: 30000,
    salaryMax: 50000,
    experience: '1 - 2 Years',
    requiredSkills: ['Figma', 'UI Design', 'Communication'],
    preferredSkills: ['Content Writing'],
    description:
      'Design clean mobile and web flows for employer and candidate journeys. Prototype and hand off to engineering.',
  },
  {
    title: 'Cybersecurity Analyst Intern',
    city: 'Gurugram',
    category: 'Cybersecurity',
    salaryMin: 20000,
    salaryMax: 30000,
    experience: 'Fresher',
    requiredSkills: ['Communication', 'Git'],
    preferredSkills: ['Python'],
    description:
      'Assist with vulnerability scans, access reviews, and security awareness content. Mentorship provided.',
  },
  {
    title: 'Customer Service Executive',
    city: 'Chennai',
    category: 'Customer Service',
    salaryMin: 18000,
    salaryMax: 24000,
    experience: 'Fresher',
    requiredSkills: ['Communication', 'Customer Service'],
    preferredSkills: ['CRM'],
    description:
      'Handle customer queries by phone and chat. Help with orders, complaints and basic account questions.',
  },
  {
    title: 'Retail Associate',
    city: 'Chennai',
    category: 'Retail',
    salaryMin: 15000,
    salaryMax: 20000,
    experience: 'Fresher',
    requiredSkills: ['Customer Service', 'Sales'],
    preferredSkills: ['POS'],
    description:
      'Support store operations, help shoppers find products, and keep the floor organised.',
  },
  {
    title: 'Sales Executive',
    city: 'Madurai',
    category: 'Sales',
    salaryMin: 16000,
    salaryMax: 22000,
    experience: 'Fresher',
    requiredSkills: ['Sales', 'Communication'],
    preferredSkills: ['CRM'],
    description:
      'Speak with local customers, explain product benefits, and help the team meet monthly targets.',
  },
  {
    title: 'Office Administrator',
    city: 'Coimbatore',
    category: 'Office/Admin',
    salaryMin: 17000,
    salaryMax: 25000,
    experience: '0 - 1 Years',
    requiredSkills: ['MS Excel', 'Data Entry', 'Communication'],
    preferredSkills: ['CRM'],
    description:
      'Manage schedules, visitor logs, invoices, and day-to-day office coordination.',
  },
  {
    title: 'Delivery Coordinator',
    city: 'Bengaluru',
    category: 'Delivery/Logistics',
    salaryMin: 18000,
    salaryMax: 26000,
    experience: 'Fresher',
    requiredSkills: ['Communication', 'MS Excel'],
    preferredSkills: ['CRM'],
    description:
      'Coordinate last-mile deliveries, update tracking sheets, and resolve rider issues.',
  },
  {
    title: 'Accounts Executive',
    city: 'Hyderabad',
    category: 'Finance / Accounting',
    salaryMin: 22000,
    salaryMax: 32000,
    experience: '0 - 1 Years',
    requiredSkills: ['Tally', 'Excel Accounting', 'MS Excel'],
    preferredSkills: ['Communication'],
    description:
      'Maintain ledgers, prepare GST worksheets, and support month-end closing.',
  },
  {
    title: 'HR Recruiter',
    city: 'Pune',
    category: 'Human Resources',
    salaryMin: 25000,
    salaryMax: 40000,
    experience: '1 - 2 Years',
    requiredSkills: ['Recruitment', 'Communication', 'MS Excel'],
    preferredSkills: ['CRM'],
    description:
      'Source candidates, screen resumes, schedule interviews, and update ATS notes.',
  },
  {
    title: 'Digital Marketing Associate',
    city: 'Delhi',
    category: 'Marketing',
    salaryMin: 22000,
    salaryMax: 35000,
    experience: '0 - 1 Years',
    requiredSkills: ['Digital Marketing', 'Content Writing', 'Communication'],
    preferredSkills: ['MS Excel'],
    description:
      'Run social campaigns, write short creatives, and track lead metrics weekly.',
  },
  {
    title: 'Hospital Front Desk',
    city: 'Chennai',
    category: 'Healthcare',
    salaryMin: 16000,
    salaryMax: 22000,
    experience: 'Fresher',
    requiredSkills: ['Communication', 'Customer Service'],
    preferredSkills: ['Data Entry'],
    description:
      'Greet patients, manage appointments, and keep reception records accurate.',
  },
  {
    title: 'Hotel Guest Relations',
    city: 'Goa',
    category: 'Hospitality',
    salaryMin: 18000,
    salaryMax: 28000,
    experience: '0 - 1 Years',
    requiredSkills: ['Communication', 'Customer Service'],
    preferredSkills: ['Sales'],
    description:
      'Check guests in/out, handle requests politely, and escalate issues to duty managers.',
  },
];

type SeedCandidate = {
  firstName: string;
  lastName: string;
  city: string;
  phone: string;
  email: string;
  skills: string[];
  interests: string[];
  hasExperience: boolean;
  years: number;
};

const MARKETPLACE_CANDIDATES: SeedCandidate[] = [
  {
    firstName: 'Asha',
    lastName: 'Ravi',
    city: 'Bengaluru',
    phone: '+919900000101',
    email: 'asha.ravi@demo.careerbridge.local',
    skills: ['JavaScript', 'React', 'Git', 'Communication'],
    interests: ['Software Development', 'Technology'],
    hasExperience: true,
    years: 1,
  },
  {
    firstName: 'Vikram',
    lastName: 'Singh',
    city: 'Hyderabad',
    phone: '+919900000102',
    email: 'vikram.singh@demo.careerbridge.local',
    skills: ['Node.js', 'SQL', 'JavaScript', 'Docker'],
    interests: ['Software Development'],
    hasExperience: true,
    years: 2,
  },
  {
    firstName: 'Meera',
    lastName: 'Iyer',
    city: 'Pune',
    phone: '+919900000103',
    email: 'meera.iyer@demo.careerbridge.local',
    skills: ['Python', 'SQL', 'MS Excel', 'Communication'],
    interests: ['Data / Analytics'],
    hasExperience: false,
    years: 0,
  },
  {
    firstName: 'Arjun',
    lastName: 'Nair',
    city: 'Chennai',
    phone: '+919900000104',
    email: 'arjun.nair@demo.careerbridge.local',
    skills: ['Communication', 'Customer Service', 'CRM'],
    interests: ['Customer Service'],
    hasExperience: true,
    years: 1,
  },
  {
    firstName: 'Sneha',
    lastName: 'Patel',
    city: 'Mumbai',
    phone: '+919900000105',
    email: 'sneha.patel@demo.careerbridge.local',
    skills: ['Figma', 'UI Design', 'Communication'],
    interests: ['Product / Design'],
    hasExperience: true,
    years: 2,
  },
  {
    firstName: 'Rahul',
    lastName: 'Das',
    city: 'Bengaluru',
    phone: '+919900000106',
    email: 'rahul.das@demo.careerbridge.local',
    skills: ['Manual Testing', 'Selenium', 'Git', 'Communication'],
    interests: ['QA / Testing'],
    hasExperience: true,
    years: 1,
  },
  {
    firstName: 'Priya',
    lastName: 'Menon',
    city: 'Madurai',
    phone: '+919900000107',
    email: 'priya.menon@demo.careerbridge.local',
    skills: ['Sales', 'Communication', 'CRM'],
    interests: ['Sales', 'Retail'],
    hasExperience: false,
    years: 0,
  },
  {
    firstName: 'Karan',
    lastName: 'Joshi',
    city: 'Delhi',
    phone: '+919900000108',
    email: 'karan.joshi@demo.careerbridge.local',
    skills: ['Digital Marketing', 'Content Writing', 'MS Excel'],
    interests: ['Marketing'],
    hasExperience: true,
    years: 1,
  },
  {
    firstName: 'Ananya',
    lastName: 'Sharma',
    city: 'Pune',
    phone: '+919900000109',
    email: 'ananya.sharma@demo.careerbridge.local',
    skills: ['Recruitment', 'Communication', 'MS Excel'],
    interests: ['Human Resources'],
    hasExperience: true,
    years: 2,
  },
  {
    firstName: 'Imran',
    lastName: 'Khan',
    city: 'Hyderabad',
    phone: '+919900000110',
    email: 'imran.khan@demo.careerbridge.local',
    skills: ['Tally', 'Excel Accounting', 'MS Excel'],
    interests: ['Finance / Accounting'],
    hasExperience: true,
    years: 1,
  },
];

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.skills();
    await this.superAdmin();
    await this.locations();
    await this.demoEmployerAndJobs();
    await this.demoCandidatesAndApplications();
  }

  private async skills() {
    for (const [name, category] of SKILLS) {
      await this.prisma.skill.upsert({
        where: { name },
        update: { category },
        create: { name, category },
      });
    }
  }

  /** Exactly one Super Admin from env — password stored as strong scrypt hash only. */
  private async superAdmin() {
    const email = (this.config.get<string>('SUPER_ADMIN_EMAIL') || 'superadmin@careerbridge.local')
      .trim()
      .toLowerCase();
    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD') || 'SuperAdmin12345';
    const phone = this.config.get<string>('SUPER_ADMIN_PHONE') || '+919999999000';

    const existing = await this.prisma.user.findFirst({
      where: { userType: 'SUPER_ADMIN' },
    });

    if (existing) {
      const sync = this.config.get('SUPER_ADMIN_SYNC_PASSWORD') === 'true';
      if (sync && password) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            email,
            phone,
            passwordHash: await hashPlatformPassword(password),
          },
        });
      }
      return;
    }

    const legacy = await this.prisma.user.findFirst({
      where: { email: 'admin@careerbridge.local', userType: 'PLATFORM_ADMIN' },
    });
    if (legacy && legacy.externalAuthId === 'seed_admin') {
      await this.prisma.user.update({
        where: { id: legacy.id },
        data: {
          email,
          phone,
          passwordHash: await hashPlatformPassword(password),
          userType: 'SUPER_ADMIN',
          externalAuthId: 'seed_super_admin',
        },
      });
      return;
    }

    await this.prisma.user.create({
      data: {
        email,
        phone,
        passwordHash: await hashPlatformPassword(password),
        externalAuthId: 'seed_super_admin',
        userType: 'SUPER_ADMIN',
      },
    });
  }

  private async locations() {
    const count = await this.prisma.state.count().catch(() => 0);
    if (count > 0) return;

    const catalog: Record<string, string[]> = {
      'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur'],
      Delhi: ['New Delhi', 'Delhi'],
      Goa: ['Panaji', 'Margao'],
      Gujarat: ['Ahmedabad', 'Surat', 'Vadodara'],
      Haryana: ['Gurugram', 'Faridabad'],
      Karnataka: ['Bengaluru', 'Mysuru', 'Hubballi'],
      Kerala: ['Kochi', 'Thiruvananthapuram'],
      Maharashtra: ['Mumbai', 'Pune', 'Nagpur'],
      'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai'],
      Telangana: ['Hyderabad', 'Warangal'],
      'Uttar Pradesh': ['Lucknow', 'Noida', 'Kanpur'],
      'West Bengal': ['Kolkata', 'Howrah'],
    };

    for (const [name, cities] of Object.entries(catalog)) {
      const state = await this.prisma.state.create({
        data: { name, active: true },
      });
      for (const city of cities) {
        await this.prisma.city.create({
          data: { stateId: state.id, name: city, active: true },
        });
      }
    }
  }

  private async demoEmployerAndJobs() {
    const email = 'employer@abc-services.local';
    let user = await this.prisma.user.findFirst({ where: { email }, include: { employer: true } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          phone: '+919999999001',
          passwordHash: await hashPassword('Employer12345'),
          externalAuthId: 'seed_employer_abc',
          userType: 'EMPLOYER_ADMIN',
          employer: {
            create: {
              companyName: 'ABC Services',
              industry: 'Staffing & Technology',
              city: 'Chennai',
              contactName: 'Priya Sharma',
              gstNumber: '33ABCDE1234F1Z5',
              cin: 'U72900TN2015PTC123456',
              website: 'https://www.abc-services.local',
              panNumber: 'ABCDE1234F',
              workEmail: 'employer@abc-services.local',
              designation: 'Talent Acquisition Manager',
              verificationStatus: 'VERIFIED',
              verified: true,
            },
          },
        },
        include: { employer: true },
      });
    }
    const employerId = user.employer?.id;
    if (!employerId) return;

    for (const job of MARKETPLACE_JOBS) {
      const existing = await this.prisma.job.findFirst({
        where: { employerId, title: job.title, city: job.city },
      });
      if (existing) continue;
      await this.prisma.job.create({
        data: {
          employerId,
          title: job.title,
          description: job.description,
          city: job.city,
          category: job.category,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          jobType: 'FULL_TIME',
          experience: job.experience,
          requiredSkills: JSON.stringify(job.requiredSkills),
          preferredSkills: JSON.stringify(job.preferredSkills || []),
          benefits: 'Weekly offs, on-the-job training, PF',
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
    }
  }

  private async demoCandidatesAndApplications() {
    const jobs = await this.prisma.job.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'asc' },
      take: 40,
    });
    if (!jobs.length) return;

    const candidateIds: string[] = [];
    for (const [index, item] of MARKETPLACE_CANDIDATES.entries()) {
      let user = await this.prisma.user.findFirst({
        where: { email: item.email, userType: 'CANDIDATE' },
        include: { candidate: true },
      });
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: item.email,
            phone: item.phone,
            passwordHash: await hashPassword('Candidate12345'),
            externalAuthId: `seed_candidate_${index + 1}`,
            userType: 'CANDIDATE',
            candidate: {
              create: {
                firstName: item.firstName,
                lastName: item.lastName,
                city: item.city,
                preferredLanguage: 'English',
                careerInterests: JSON.stringify(item.interests),
                hasExperience: item.hasExperience ? 'yes' : 'no',
                totalExperienceYears: item.years,
                profileCompletion: 70,
                onboardingCompleted: true,
                skills: {
                  create: item.skills.map((name) => ({ name })),
                },
              },
            },
          },
          include: { candidate: true },
        });
      }
      if (user.candidate?.id) candidateIds.push(user.candidate.id);
    }

    for (const candidateId of candidateIds) {
      const candidate = await this.prisma.candidate.findUnique({
        where: { id: candidateId },
        include: { skills: true },
      });
      if (!candidate) continue;
      const skillNames = new Set(candidate.skills.map((s) => s.name.toLowerCase()));
      const interest = parseJsonList(candidate.careerInterests);
      const matchedJobs = jobs.filter((job) => {
        const required = parseJsonList(job.requiredSkills).map((s) => s.toLowerCase());
        const skillHit = required.some((s) => skillNames.has(s));
        const categoryHit = interest.some(
          (i) => i.toLowerCase() === job.category.toLowerCase(),
        );
        return skillHit || categoryHit;
      });
      const targets = (matchedJobs.length ? matchedJobs : jobs).slice(0, 4);
      for (const job of targets) {
        const existing = await this.prisma.application.findFirst({
          where: { candidateId, jobId: job.id },
        });
        if (existing) continue;
        await this.prisma.application.create({
          data: {
            candidateId,
            jobId: job.id,
            status: 'APPLIED',
            screeningAnswersJson: '[]',
          },
        });
      }
    }
  }
}

function parseJsonList(raw: string | null | undefined) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
