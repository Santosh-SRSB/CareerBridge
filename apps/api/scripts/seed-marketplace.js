/**
 * One-shot marketplace seed (jobs + candidates + applications).
 * Run: node scripts/seed-marketplace.js
 */
const { PrismaClient } = require('../generated/prisma');
const { randomBytes, scryptSync } = require('crypto');

const p = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const SKILLS = [
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
  ['Customer Service', 'Service Industry'],
  ['Communication', 'Service Industry'],
  ['CRM', 'Service Industry'],
  ['POS', 'Retail'],
  ['Sales', 'Sales'],
  ['MS Excel', 'Office'],
  ['Data Entry', 'Office'],
];

const JOBS = [
  ['Junior Frontend Developer', 'Bengaluru', 'Software Development', 30000, 45000, 'Fresher', ['JavaScript', 'React', 'Git']],
  ['Backend Node.js Developer', 'Hyderabad', 'Software Development', 35000, 55000, '1 - 2 Years', ['Node.js', 'JavaScript', 'SQL']],
  ['Full Stack Engineer', 'Pune', 'Technology', 40000, 70000, '1 - 2 Years', ['React', 'Node.js', 'SQL', 'Git']],
  ['Python Data Analyst', 'Bengaluru', 'Data / Analytics', 32000, 50000, '0 - 1 Years', ['Python', 'SQL', 'MS Excel']],
  ['IT Support Associate', 'Chennai', 'IT Support', 18000, 28000, 'Fresher', ['Communication', 'CRM']],
  ['QA Tester', 'Bengaluru', 'QA / Testing', 25000, 40000, '0 - 1 Years', ['Manual Testing', 'Communication']],
  ['UI/UX Designer', 'Mumbai', 'Product / Design', 30000, 50000, '1 - 2 Years', ['Figma', 'UI Design', 'Communication']],
  ['Customer Service Executive', 'Chennai', 'Customer Service', 18000, 24000, 'Fresher', ['Communication', 'Customer Service']],
  ['Retail Associate', 'Chennai', 'Retail', 15000, 20000, 'Fresher', ['Customer Service', 'Sales']],
  ['Sales Executive', 'Madurai', 'Sales', 16000, 22000, 'Fresher', ['Sales', 'Communication']],
  ['Office Administrator', 'Coimbatore', 'Office/Admin', 17000, 25000, '0 - 1 Years', ['MS Excel', 'Data Entry', 'Communication']],
  ['Accounts Executive', 'Hyderabad', 'Finance / Accounting', 22000, 32000, '0 - 1 Years', ['Tally', 'Excel Accounting', 'MS Excel']],
  ['HR Recruiter', 'Pune', 'Human Resources', 25000, 40000, '1 - 2 Years', ['Recruitment', 'Communication', 'MS Excel']],
  ['Digital Marketing Associate', 'Delhi', 'Marketing', 22000, 35000, '0 - 1 Years', ['Digital Marketing', 'Content Writing', 'Communication']],
  ['Hospital Front Desk', 'Chennai', 'Healthcare', 16000, 22000, 'Fresher', ['Communication', 'Customer Service']],
  ['Hotel Guest Relations', 'Goa', 'Hospitality', 18000, 28000, '0 - 1 Years', ['Communication', 'Customer Service']],
  ['Delivery Coordinator', 'Bengaluru', 'Delivery/Logistics', 18000, 26000, 'Fresher', ['Communication', 'MS Excel']],
  ['Cybersecurity Analyst Intern', 'Gurugram', 'Cybersecurity', 20000, 30000, 'Fresher', ['Communication', 'Git']],
];

const CANDIDATES = [
  ['Asha', 'Ravi', 'Bengaluru', '+919900000101', 'asha.ravi@demo.careerbridge.local', ['JavaScript', 'React', 'Git', 'Communication'], ['Software Development'], 1],
  ['Vikram', 'Singh', 'Hyderabad', '+919900000102', 'vikram.singh@demo.careerbridge.local', ['Node.js', 'SQL', 'JavaScript'], ['Software Development'], 2],
  ['Meera', 'Iyer', 'Pune', '+919900000103', 'meera.iyer@demo.careerbridge.local', ['Python', 'SQL', 'MS Excel'], ['Data / Analytics'], 0],
  ['Arjun', 'Nair', 'Chennai', '+919900000104', 'arjun.nair@demo.careerbridge.local', ['Communication', 'Customer Service', 'CRM'], ['Customer Service'], 1],
  ['Sneha', 'Patel', 'Mumbai', '+919900000105', 'sneha.patel@demo.careerbridge.local', ['Figma', 'UI Design', 'Communication'], ['Product / Design'], 2],
  ['Rahul', 'Das', 'Bengaluru', '+919900000106', 'rahul.das@demo.careerbridge.local', ['Manual Testing', 'Selenium', 'Git'], ['QA / Testing'], 1],
  ['Priya', 'Menon', 'Madurai', '+919900000107', 'priya.menon@demo.careerbridge.local', ['Sales', 'Communication', 'CRM'], ['Sales'], 0],
  ['Karan', 'Joshi', 'Delhi', '+919900000108', 'karan.joshi@demo.careerbridge.local', ['Digital Marketing', 'Content Writing'], ['Marketing'], 1],
  ['Ananya', 'Sharma', 'Pune', '+919900000109', 'ananya.sharma@demo.careerbridge.local', ['Recruitment', 'Communication', 'MS Excel'], ['Human Resources'], 2],
  ['Imran', 'Khan', 'Hyderabad', '+919900000110', 'imran.khan@demo.careerbridge.local', ['Tally', 'Excel Accounting', 'MS Excel'], ['Finance / Accounting'], 1],
];

async function main() {
  for (const [name, category] of SKILLS) {
    await p.skill.upsert({ where: { name }, update: { category }, create: { name, category } });
  }

  let employerUser = await p.user.findFirst({
    where: { email: 'employer@abc-services.local' },
    include: { employer: true },
  });
  if (!employerUser) {
    employerUser = await p.user.create({
      data: {
        email: 'employer@abc-services.local',
        phone: '+919999999001',
        passwordHash: hashPassword('Employer12345'),
        externalAuthId: 'seed_employer_abc',
        userType: 'EMPLOYER_ADMIN',
        employer: {
          create: {
            companyName: 'ABC Services',
            industry: 'Staffing & Technology',
            city: 'Chennai',
            contactName: 'Priya Sharma',
            verificationStatus: 'VERIFIED',
            verified: true,
          },
        },
      },
      include: { employer: true },
    });
  }
  const employerId = employerUser.employer.id;

  for (const [title, city, category, salaryMin, salaryMax, experience, requiredSkills] of JOBS) {
    const existing = await p.job.findFirst({ where: { employerId, title, city } });
    if (existing) continue;
    await p.job.create({
      data: {
        employerId,
        title,
        city,
        category,
        salaryMin,
        salaryMax,
        experience,
        description: `${title} opening in ${city}. Skills: ${requiredSkills.join(', ')}.`,
        requiredSkills: JSON.stringify(requiredSkills),
        preferredSkills: JSON.stringify(['Communication']),
        jobType: 'FULL_TIME',
        benefits: 'Weekly offs, PF, training',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }

  const jobs = await p.job.findMany({ where: { status: 'PUBLISHED' } });
  const candidateIds = [];

  for (const [i, row] of CANDIDATES.entries()) {
    const [firstName, lastName, city, phone, email, skills, interests, years] = row;
    let user = await p.user.findFirst({
      where: { email, userType: 'CANDIDATE' },
      include: { candidate: true },
    });
    if (!user) {
      user = await p.user.create({
        data: {
          email,
          phone,
          passwordHash: hashPassword('Candidate12345'),
          externalAuthId: `seed_candidate_${i + 1}`,
          userType: 'CANDIDATE',
          candidate: {
            create: {
              firstName,
              lastName,
              city,
              preferredLanguage: 'English',
              careerInterests: JSON.stringify(interests),
              hasExperience: years > 0 ? 'yes' : 'no',
              totalExperienceYears: years,
              profileCompletion: 70,
              onboardingCompleted: true,
              skills: { create: skills.map((name) => ({ name })) },
            },
          },
        },
        include: { candidate: true },
      });
    }
    if (user.candidate?.id) candidateIds.push(user.candidate.id);
  }

  for (const candidateId of candidateIds) {
    const candidate = await p.candidate.findUnique({
      where: { id: candidateId },
      include: { skills: true },
    });
    const skillSet = new Set(candidate.skills.map((s) => s.name.toLowerCase()));
    const interests = JSON.parse(candidate.careerInterests || '[]');
    const matched = jobs.filter((job) => {
      const required = JSON.parse(job.requiredSkills || '[]').map((s) => String(s).toLowerCase());
      return (
        required.some((s) => skillSet.has(s)) ||
        interests.some((i) => String(i).toLowerCase() === job.category.toLowerCase())
      );
    });
    for (const job of (matched.length ? matched : jobs).slice(0, 4)) {
      const existing = await p.application.findFirst({ where: { candidateId, jobId: job.id } });
      if (existing) continue;
      await p.application.create({
        data: { candidateId, jobId: job.id, status: 'APPLIED', screeningAnswersJson: '[]' },
      });
    }
  }

  console.log({
    jobs: await p.job.count(),
    candidates: await p.candidate.count(),
    applications: await p.application.count(),
    skills: await p.skill.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
