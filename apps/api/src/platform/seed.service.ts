import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, hashPlatformPassword } from '../auth/password.util';

const SKILLS = [
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
];

const SRSB_ADMIN_EMAIL = (process.env.SRSB_ADMIN_EMAIL || 'srsbhr25@gmail.com').trim().toLowerCase();
const SRSB_ADMIN_PASSWORD = process.env.SRSB_ADMIN_PASSWORD || 'srsb@suresh25';
const SRSB_ADMIN_PHONE = process.env.SRSB_ADMIN_PHONE || '+919999999025';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.skills();
    await this.admin();
    await this.srsbPortalAdmin();
    // Demo ABC Services jobs are disabled — marketplace uses real employer posts only.
    if (process.env.SEED_DEMO_JOBS === 'true') {
      await this.demoEmployerAndJobs();
    }
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

  private async admin() {
    const email = 'admin@careerbridge.local';
    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing) return;
    await this.prisma.user.create({
      data: {
        email,
        phone: '+919999999000',
        passwordHash: await hashPassword('Admin@12345'),
        externalAuthId: 'seed_admin',
        userType: 'PLATFORM_ADMIN',
      },
    });
  }

  /** Dedicated `admins` row for http://localhost:3000/srsbaadmin */
  private async srsbPortalAdmin() {
    const email = SRSB_ADMIN_EMAIL;
    const passwordHash = await hashPlatformPassword(SRSB_ADMIN_PASSWORD);

    let user = await this.prisma.user.findFirst({
      where: { email, userType: 'PLATFORM_ADMIN' },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          phone: SRSB_ADMIN_PHONE,
          passwordHash,
          externalAuthId: `admin_portal_${email}`,
          userType: 'PLATFORM_ADMIN',
          status: 'ACTIVE',
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, status: 'ACTIVE' },
      });
    }

    await this.prisma.admin.upsert({
      where: { email },
      update: {
        passwordHash,
        fullName: 'SRSB Admin',
        status: 'ACTIVE',
        userId: user.id,
      },
      create: {
        email,
        passwordHash,
        fullName: 'SRSB Admin',
        status: 'ACTIVE',
        userId: user.id,
      },
    });
  }

  private async demoEmployerAndJobs() {
    if (await this.prisma.job.count()) return;
    const email = 'employer@abc-services.local';
    let user = await this.prisma.user.findFirst({ where: { email }, include: { employer: true } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          phone: '+919999999001',
          passwordHash: await hashPassword('Employer@12345'),
          externalAuthId: 'seed_employer_abc',
          userType: 'EMPLOYER_ADMIN',
          employer: {
            create: {
              companyName: 'ABC Services',
              industry: 'Customer Service',
              city: 'Chennai',
              contactName: 'Priya Sharma',
              verified: true,
            },
          },
        },
        include: { employer: true },
      });
    }
    const employerId = user.employer?.id;
    if (!employerId) return;
    const jobs = [
      {
        title: 'Customer Service Executive',
        city: 'Chennai',
        category: 'Customer Service',
        salaryMin: 18000,
        salaryMax: 24000,
        requiredSkills: ['Communication', 'Customer Service'],
        description:
          'Handle customer queries by phone and chat. Help customers with orders, complaints and basic account questions. Freshers with strong communication are welcome.',
      },
      {
        title: 'Retail Associate',
        city: 'Chennai',
        category: 'Retail',
        salaryMin: 15000,
        salaryMax: 20000,
        requiredSkills: ['Customer Service', 'Sales'],
        description:
          'Support store operations, help shoppers find products, and keep the floor organised. No previous retail experience required.',
      },
      {
        title: 'Sales Executive',
        city: 'Madurai',
        category: 'Sales',
        salaryMin: 16000,
        salaryMax: 22000,
        requiredSkills: ['Sales', 'Communication'],
        description:
          'Speak with local customers, explain product benefits, and help the team meet monthly targets. Training will be provided.',
      },
    ];
    for (const job of jobs) {
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
          experience: 'NONE',
          requiredSkills: JSON.stringify(job.requiredSkills),
          preferredSkills: JSON.stringify(['MS Excel']),
          benefits: 'Weekly offs, on-the-job training',
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
    }
  }
}
