import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode, PLATFORM_USER_TYPES, platformPasswordError, UserType } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashPlatformPassword } from '../auth/password.util';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [candidates, activeCandidates, employers, openJobs, applications, interviews, admins, states, cities] =
      await Promise.all([
        this.prisma.candidate.count(),
        this.prisma.candidate.count({ where: { onboardingCompleted: true } }),
        this.prisma.employer.count(),
        this.prisma.job.count({ where: { status: 'PUBLISHED' } }),
        this.prisma.application.count(),
        this.prisma.interview.count(),
        this.prisma.user.count({
          where: { userType: { in: ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR'] } },
        }),
        this.prisma.state.count(),
        this.prisma.city.count(),
      ]);
    return {
      candidates,
      activeCandidates,
      employers,
      openJobs,
      applications,
      interviews,
      admins,
      states,
      cities,
    };
  }

  async candidates() {
    return this.prisma.candidate.findMany({
      include: { user: { select: { phone: true, email: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async employers() {
    return this.prisma.employer.findMany({
      include: { user: { select: { phone: true, email: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async verifyEmployer(id: string) {
    const employer = await this.prisma.employer.findUnique({ where: { id } });
    if (!employer) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Employer was not found' });
    }
    return this.prisma.employer.update({ where: { id }, data: { verified: true } });
  }

  async jobs() {
    return this.prisma.job.findMany({
      include: { employer: { select: { companyName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async applications() {
    return this.prisma.application.findMany({
      include: {
        job: { select: { title: true } },
        candidate: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async skills(query?: string) {
    return this.prisma.skill.findMany({
      where: query ? { name: { contains: query, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async addSkill(name: string, category: string) {
    return this.prisma.skill.upsert({
      where: { name: name.trim() },
      update: { category },
      create: { name: name.trim(), category },
    });
  }

  async listAdmins() {
    const rows = await this.prisma.user.findMany({
      where: {
        userType: { in: ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR', 'SUPER_ADMIN'] },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        userType: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    }));
  }

  async createAdmin(
    actor: { id: string; role: string },
    dto: { email: string; fullName: string; password: string },
  ) {
    if (actor.role !== UserType.SUPER_ADMIN) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Only Super Admin can register Admin accounts.',
      });
    }

    const passwordError = platformPasswordError(dto.password);
    if (passwordError) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: passwordError },
        HttpStatus.BAD_REQUEST,
      );
    }

    const email = dto.email.trim().toLowerCase();
    const taken = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email, userType: { in: [...PLATFORM_USER_TYPES] } },
          { email, userType: { in: ['CANDIDATE', 'EMPLOYER_ADMIN', 'EMPLOYER_RECRUITER'] } },
        ],
      },
    });
    if (taken) {
      throw new HttpException(
        {
          code: ErrorCode.ACCOUNT_EXISTS,
          message: 'This email is already registered. Use a different email for Admin.',
        },
        HttpStatus.CONFLICT,
      );
    }

    const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        phone: `+910000${suffix.slice(0, 6)}`,
        passwordHash: await hashPlatformPassword(dto.password),
        externalAuthId: `admin_${randomUUID()}`,
        userType: 'PLATFORM_ADMIN',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        phone: true,
        userType: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      status: user.status,
      fullName: dto.fullName.trim(),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: null,
      message: 'Admin created. They can sign in from the Admin tab on Sign In.',
    };
  }

  async suspendAdmin(actor: { id: string; role: string }, adminId: string) {
    if (actor.role !== UserType.SUPER_ADMIN) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Only Super Admin can suspend Admin accounts.',
      });
    }
    if (actor.id === adminId) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'You cannot suspend your own Super Admin account.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const target = await this.prisma.user.findFirst({
      where: { id: adminId, userType: { in: ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR'] } },
    });
    if (!target) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Admin account was not found.',
      });
    }
    return this.prisma.user.update({
      where: { id: adminId },
      data: { status: 'SUSPENDED' },
      select: { id: true, email: true, status: true, userType: true },
    });
  }

  async listStatesAdmin() {
    return this.prisma.state.findMany({
      include: { _count: { select: { cities: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createState(name: string, code?: string) {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'Enter a valid state name.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.prisma.state.create({
        data: {
          name: trimmed,
          code: code?.trim().toUpperCase() || null,
        },
      });
    } catch {
      throw new HttpException(
        { code: ErrorCode.ACCOUNT_EXISTS, message: 'This state already exists.' },
        HttpStatus.CONFLICT,
      );
    }
  }

  async updateState(id: string, data: { name?: string; code?: string; active?: boolean }) {
    const existing = await this.prisma.state.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'State not found.' });
    }
    return this.prisma.state.update({
      where: { id },
      data: {
        name: data.name?.trim() || undefined,
        code: data.code === undefined ? undefined : data.code.trim().toUpperCase() || null,
        active: data.active,
      },
    });
  }

  async deleteState(id: string) {
    const existing = await this.prisma.state.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'State not found.' });
    }
    await this.prisma.state.delete({ where: { id } });
    return { ok: true };
  }

  async listCitiesAdmin(stateId?: string) {
    return this.prisma.city.findMany({
      where: stateId ? { stateId } : undefined,
      include: { state: { select: { id: true, name: true, code: true } } },
      orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async createCity(stateId: string, name: string) {
    const state = await this.prisma.state.findUnique({ where: { id: stateId } });
    if (!state) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'State not found.' });
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'Enter a valid city name.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.prisma.city.create({
        data: { stateId, name: trimmed },
        include: { state: { select: { id: true, name: true } } },
      });
    } catch {
      throw new HttpException(
        { code: ErrorCode.ACCOUNT_EXISTS, message: 'This city already exists in the selected state.' },
        HttpStatus.CONFLICT,
      );
    }
  }

  async updateCity(id: string, data: { name?: string; active?: boolean; stateId?: string }) {
    const existing = await this.prisma.city.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'City not found.' });
    }
    if (data.stateId) {
      const state = await this.prisma.state.findUnique({ where: { id: data.stateId } });
      if (!state) {
        throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'State not found.' });
      }
    }
    return this.prisma.city.update({
      where: { id },
      data: {
        name: data.name?.trim() || undefined,
        active: data.active,
        stateId: data.stateId,
      },
      include: { state: { select: { id: true, name: true } } },
    });
  }

  async deleteCity(id: string) {
    const existing = await this.prisma.city.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'City not found.' });
    }
    await this.prisma.city.delete({ where: { id } });
    return { ok: true };
  }
}
