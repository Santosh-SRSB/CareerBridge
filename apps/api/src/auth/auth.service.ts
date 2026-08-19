import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { ErrorCode, registrationPasswordError } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from './firebase.service';
import { EmailService } from './email.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtPayload } from './jwt.strategy';
import { hashPassword, verifyPassword } from './password.util';

const OTP_TTL_SECONDS = 300;
const MAX_VERIFY_ATTEMPTS = 5;
const DEV_OTP = '123456';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly firebase: FirebaseService,
    private readonly email: EmailService,
  ) {}

  private isDevOtp() {
    return (
      this.config.get('AUTH_DEV_OTP') === 'true' &&
      this.config.get('NODE_ENV') !== 'production'
    );
  }

  async requestOtp(dto: RequestOtpDto) {
    const channel = dto.channel;
    let phone = dto.phone?.trim() || '';
    const email = dto.email?.trim().toLowerCase();

    if (dto.purpose === 'LOGIN') {
      const existing =
        channel === 'EMAIL'
          ? await this.prisma.user.findFirst({ where: { email: email || '' } })
          : await this.prisma.user.findUnique({ where: { phone } });
      if (!existing) {
        throw new HttpException(
          {
            code: ErrorCode.ACCOUNT_NOT_FOUND,
            message:
              channel === 'EMAIL'
                ? 'No account found for this email. Create your free Career Passport.'
                : 'No account found for this number. Create your free Career Passport.',
          },
          HttpStatus.NOT_FOUND,
        );
      }
      phone = existing.phone;
    }

    if (dto.purpose === 'REGISTER') {
      if (phone) {
        const phoneTaken = await this.prisma.user.findUnique({ where: { phone } });
        if (phoneTaken) {
          throw new HttpException(
            {
              code: ErrorCode.ACCOUNT_EXISTS,
              message: 'An account already exists. Please sign in.',
            },
            HttpStatus.CONFLICT,
          );
        }
      }
      if (email) {
        const emailTaken = await this.prisma.user.findFirst({ where: { email } });
        if (emailTaken) {
          throw new HttpException(
            {
              code: ErrorCode.ACCOUNT_EXISTS,
              message: 'An account already exists with this email. Please sign in.',
            },
            HttpStatus.CONFLICT,
          );
        }
      }
    }

    const recentWhere = channel === 'EMAIL' ? { email: email || undefined } : { phone };
    const recentCount = await this.prisma.otpRequest.count({
      where: {
        ...recentWhere,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (recentCount >= 5) {
      throw new HttpException(
        {
          code: ErrorCode.TOO_MANY_ATTEMPTS,
          message: "You've reached the maximum number of attempts. Please try again later.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (channel === 'MOBILE' && !this.isDevOtp() && !this.firebase.isConfigured()) {
      throw new HttpException(
        {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Firebase Admin is not configured. Set FIREBASE_* in apps/api/.env.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const passwordError =
      dto.purpose === 'REGISTER' && dto.password ? registrationPasswordError(dto.password) : null;
    if (passwordError) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: passwordError },
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash =
      dto.purpose === 'REGISTER' ? await this.resolvePasswordHash(phone, dto.password) : null;

    const useServerOtp = this.isDevOtp() || channel === 'EMAIL';
    const otpCode = useServerOtp
      ? this.isDevOtp()
        ? DEV_OTP
        : String(Math.floor(100000 + Math.random() * 900000))
      : null;
    const otpHash = otpCode ? hashToken(otpCode) : null;

    const request = await this.prisma.otpRequest.create({
      data: {
        phone,
        email: email || null,
        channel,
        purpose: dto.purpose,
        otpHash,
        payloadJson:
          dto.purpose === 'REGISTER'
            ? JSON.stringify({
                email,
                fullName: dto.fullName?.trim(),
                location: dto.location?.trim(),
                preferredLanguage: dto.preferredLanguage,
                passwordHash,
                accountType: dto.accountType || 'CANDIDATE',
                companyName: dto.companyName?.trim(),
                industry: dto.industry?.trim(),
              })
            : null,
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    });

    if (channel === 'EMAIL' && otpCode && !this.isDevOtp()) {
      await this.email.sendOtp(email || '', otpCode);
    }

    return {
      requestId: request.id,
      expiresIn: OTP_TTL_SECONDS,
      ...(this.isDevOtp() ? { devOtp: DEV_OTP } : {}),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const request = await this.prisma.otpRequest.findUnique({
      where: { id: dto.requestId },
    });

    if (!request) {
      throw new HttpException(
        { code: ErrorCode.INVALID_OTP, message: 'Incorrect OTP. Please check the code and try again.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (request.verifiedAt) {
      throw new HttpException(
        { code: ErrorCode.INVALID_OTP, message: 'This code has already been used. Please request a new OTP.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (request.expiresAt.getTime() < Date.now()) {
      throw new HttpException(
        { code: ErrorCode.OTP_EXPIRED, message: 'This OTP has expired.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (request.attemptCount >= MAX_VERIFY_ATTEMPTS) {
      throw new HttpException(
        {
          code: ErrorCode.TOO_MANY_ATTEMPTS,
          message: "You've reached the maximum number of attempts. Please request a new OTP.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.otpRequest.update({
      where: { id: request.id },
      data: { attemptCount: { increment: 1 } },
    });

    const { firebaseUid, phone } = await this.resolveIdentity(dto, request);

    if (request.phone && phone !== request.phone) {
      throw new HttpException(
        { code: ErrorCode.INVALID_OTP, message: 'Incorrect OTP. Please check the code and try again.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const session = await this.upsertUserAndIssue(
      phone,
      firebaseUid,
      request.purpose,
      request.payloadJson,
    );

    await this.prisma.otpRequest.update({
      where: { id: request.id },
      data: { verifiedAt: new Date() },
    });

    return session;
  }

  private async resolveIdentity(
    dto: VerifyOtpDto,
    request: { phone: string; email: string | null; channel: string; otpHash: string | null },
  ) {
    const allowServerOtp = request.channel === 'EMAIL' || this.isDevOtp();
    if (allowServerOtp && dto.otp && request.otpHash && hashToken(dto.otp) === request.otpHash) {
      return {
        firebaseUid:
          request.channel === 'EMAIL' ? `email_${request.email}` : `otp_${request.phone}`,
        phone: request.phone,
      };
    }

    if (request.channel === 'MOBILE' && dto.idToken) {
      const decoded = await this.firebase.verifyIdToken(dto.idToken);
      const phone = decoded.phone_number;
      if (!phone) {
        throw new UnauthorizedException({
          code: ErrorCode.UNAUTHORIZED,
          message: 'We could not verify your number right now. Please try again.',
        });
      }
      return { firebaseUid: decoded.uid, phone };
    }

    throw new HttpException(
      { code: ErrorCode.INVALID_OTP, message: 'Incorrect OTP. Please check the code and try again.' },
      HttpStatus.BAD_REQUEST,
    );
  }

  private async upsertUserAndIssue(
    phone: string,
    externalAuthId: string,
    purpose: 'LOGIN' | 'REGISTER',
    payloadJson?: string | null,
  ) {
    const registration = parseRegistration(payloadJson);
    const isEmployer = registration?.accountType === 'EMPLOYER';
    const names = splitName(registration?.fullName);
    const profileCompletion =
      (names.firstName ? 20 : 0) +
      (registration?.location ? 20 : 0) +
      (registration?.preferredLanguage ? 10 : 0) +
      (registration?.email ? 10 : 0);

    let user = await this.prisma.user.findUnique({
      where: { phone },
      include: { candidate: true, employer: true },
    });

    if (purpose === 'LOGIN' && !user) {
      throw new HttpException(
        {
          code: ErrorCode.ACCOUNT_NOT_FOUND,
          message: 'No account found for this number. Create your free Career Passport.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (purpose === 'REGISTER' && user) {
      throw new HttpException(
        { code: ErrorCode.ACCOUNT_EXISTS, message: 'An account already exists. Please sign in.' },
        HttpStatus.CONFLICT,
      );
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          email: registration?.email || null,
          passwordHash: registration?.passwordHash || null,
          externalAuthId,
          userType: isEmployer ? 'EMPLOYER_ADMIN' : 'CANDIDATE',
          lastLoginAt: isEmployer ? null : new Date(),
          ...(isEmployer
            ? {
                employer: {
                  create: {
                    companyName: registration?.companyName || registration?.fullName || 'Company',
                    contactName: registration?.fullName || null,
                    industry: registration?.industry || null,
                    city: registration?.location || null,
                  },
                },
              }
            : {
                candidate: {
                  create: {
                    firstName: names.firstName,
                    lastName: names.lastName,
                    city: registration?.location || null,
                    preferredLanguage: registration?.preferredLanguage || null,
                    profileCompletion,
                  },
                },
              }),
        },
        include: { candidate: true, employer: true },
      });
      if (isEmployer) {
        return { registered: true, signInRequired: true as const };
      }
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          externalAuthId: user.externalAuthId.startsWith('dev_') ? externalAuthId : user.externalAuthId,
        },
        include: { candidate: true, employer: true },
      });
    }

    return this.issueSession(user);
  }

  async loginWithPassword(
    identifier: string,
    password: string,
    accountType?: 'CANDIDATE' | 'EMPLOYER',
  ) {
    const value = identifier.trim();
    const email = value.includes('@') ? value.toLowerCase() : null;
    const phone = email ? null : normalizeLoginPhone(value);

    const user = await this.prisma.user.findFirst({
      where: email ? { email } : { phone: phone || value },
      include: { candidate: true, employer: true },
    });

    if (!user || user.status !== 'ACTIVE' || !user.passwordHash) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Incorrect mobile number, email, or password.',
      });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Incorrect mobile number, email, or password.',
      });
    }

    if (accountType === 'EMPLOYER' && user.userType !== 'EMPLOYER_ADMIN' && user.userType !== 'EMPLOYER_RECRUITER') {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'This is not an employer account. Sign in as a candidate.',
      });
    }
    if (
      accountType === 'CANDIDATE' &&
      (user.userType === 'EMPLOYER_ADMIN' || user.userType === 'EMPLOYER_RECRUITER')
    ) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'This is an employer account. Sign in as an employer.',
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: { candidate: true, employer: true },
    });
    return this.issueSession(updated);
  }

  async registerEmployer(dto: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    industry: string;
    city: string;
    password: string;
  }) {
    const passwordError = registrationPasswordError(dto.password);
    if (passwordError) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: passwordError },
        HttpStatus.BAD_REQUEST,
      );
    }
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();
    const taken = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (taken) {
      throw new HttpException(
        { code: ErrorCode.ACCOUNT_EXISTS, message: 'An account already exists. Please sign in.' },
        HttpStatus.CONFLICT,
      );
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        passwordHash: await hashPassword(dto.password),
        externalAuthId: `employer_${randomUUID()}`,
        userType: 'EMPLOYER_ADMIN',
        lastLoginAt: new Date(),
        employer: {
          create: {
            companyName: dto.companyName.trim(),
            contactName: dto.contactName.trim(),
            industry: dto.industry.trim(),
            city: dto.city.trim(),
          },
        },
      },
      include: { candidate: true, employer: true },
    });
    return this.issueSession(user);
  }

  private async resolvePasswordHash(phone: string, password?: string) {
    if (password) {
      return hashPassword(password);
    }
    const previous = await this.prisma.otpRequest.findFirst({
      where: { phone, purpose: 'REGISTER', verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const previousHash = parseRegistration(previous?.payloadJson)?.passwordHash;
    if (!previousHash) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'Password must be at least 8 characters.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return previousHash;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { candidate: true, employer: true },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Please sign in again.',
      });
    }
    return {
      id: user.id,
      type: user.userType,
      phone: user.phone,
        firstName: user.candidate?.firstName ?? user.employer?.contactName ?? null,
        profileCompleted: user.candidate?.profileCompletion ?? 0,
        onboardingCompleted:
          user.userType === 'CANDIDATE' ? user.candidate?.onboardingCompleted ?? false : true,
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        revokedAt: null,
        OR: [{ tokenHash }, ...(payload?.jti ? [{ jti: payload.jti }] : [])],
      },
      include: { user: { include: { candidate: true, employer: true } } },
    });
    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Please sign in again.',
      });
    }
    if (payload && stored.userId !== payload.sub) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Please sign in again.',
      });
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueSession(stored.user);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          OR: [
            { tokenHash: hashToken(refreshToken) },
            ...(payload?.jti ? [{ jti: payload.jti }] : []),
          ],
        },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { loggedOut: true };
  }

  private async issueSession(user: {
    id: string;
    userType: string;
    phone: string;
    candidate?: { onboardingCompleted: boolean; firstName: string | null } | null;
    employer?: { contactName: string | null } | null;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.userType,
      phone: user.phone,
    };
    const accessExpires = this.config.get('JWT_ACCESS_EXPIRES') || '15m';
    const refreshExpires = this.config.get('JWT_REFRESH_EXPIRES') || '7d';
    const jti = randomUUID();
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET') || 'dev-access-secret',
      expiresIn: accessExpires,
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, typ: 'refresh', jti },
      {
        secret: this.config.get('JWT_REFRESH_SECRET') || 'dev-refresh-secret',
        expiresIn: refreshExpires,
      },
    );
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + durationMs(refreshExpires)),
      },
    });
    const isCandidate = user.userType === 'CANDIDATE';
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: Math.floor(durationMs(accessExpires) / 1000),
      user: {
        id: user.id,
        role: user.userType,
        phone: user.phone,
        firstName: user.candidate?.firstName ?? user.employer?.contactName ?? null,
        onboardingCompleted: isCandidate ? user.candidate?.onboardingCompleted ?? false : true,
      },
    };
  }

  private async verifyRefreshToken(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; typ?: string; jti?: string }>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET') || 'dev-refresh-secret',
      });
      if (payload.typ && payload.typ !== 'refresh') {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }
}

function durationMs(value: string) {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    return 15 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return amount * 1000;
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function splitName(fullName?: string) {
  const names = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  return {
    firstName: names[0] || null,
    lastName: names.slice(1).join(' ') || null,
  };
}

function parseRegistration(payloadJson?: string | null) {
  if (!payloadJson) return null;
  try {
    return JSON.parse(payloadJson) as {
      email?: string;
      fullName?: string;
      location?: string;
      preferredLanguage?: string;
      passwordHash?: string;
      accountType?: 'CANDIDATE' | 'EMPLOYER';
      companyName?: string;
      industry?: string;
    };
  } catch {
    return null;
  }
}

function normalizeLoginPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (value.startsWith('+')) {
    return value;
  }
  return `+${digits}`;
}
