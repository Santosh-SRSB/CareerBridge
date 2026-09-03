import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import {
  ErrorCode,
  PLATFORM_USER_TYPES,
  registrationPasswordError,
  DEV_OTP_EMAIL,
  DEV_OTP_MOBILE,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from './firebase.service';
import { EmailService } from './email.service';
import { Msg91Service } from './msg91.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtPayload } from './jwt.strategy';
import { hashPassword, verifyPassword } from './password.util';

const OTP_TTL_SECONDS = 300;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly firebase: FirebaseService,
    private readonly email: EmailService,
    private readonly msg91: Msg91Service,
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
    if (!dto.accountType || (dto.accountType !== 'CANDIDATE' && dto.accountType !== 'EMPLOYER')) {
      throw new HttpException(
        {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Choose Candidate or Employer before continuing.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const accountType = dto.accountType;
    const userTypes = userTypesForAccount(accountType);

    if (email) {
      const platformHit = await this.prisma.user.findFirst({
        where: { email, userType: { in: [...PLATFORM_USER_TYPES] } },
      });
      if (platformHit) {
        throw new HttpException(
          {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Platform staff must use email and password on the Admin sign-in form.',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    if (dto.purpose === 'LOGIN') {
      const existing =
        channel === 'EMAIL'
          ? await this.prisma.user.findFirst({
              where: { email: email || '', userType: { in: userTypes } },
            })
          : await this.prisma.user.findFirst({
              where: { phone, userType: { in: userTypes } },
            });
      if (!existing) {
        throw new HttpException(
          {
            code: ErrorCode.ACCOUNT_NOT_FOUND,
            message:
              channel === 'EMAIL'
                ? accountType === 'EMPLOYER'
                  ? 'No employer account found for this email. Register as an employer first.'
                  : 'No account found for this email. Create your free Career Passport.'
                : accountType === 'EMPLOYER'
                  ? 'No employer account found for this number. Register as an employer first.'
                  : 'No account found for this number. Create your free Career Passport.',
          },
          HttpStatus.NOT_FOUND,
        );
      }
      phone = existing.phone;
    }

    if (dto.purpose === 'REGISTER') {
      if (phone) {
        const phoneTaken = await this.prisma.user.findFirst({
          where: { phone, userType: { in: userTypes } },
        });
        if (phoneTaken) {
          throw new HttpException(
            {
              code: ErrorCode.ACCOUNT_EXISTS,
              message:
                accountType === 'EMPLOYER'
                  ? 'An employer account already exists with this mobile number. Please sign in.'
                  : 'A candidate account already exists with this mobile number. Please sign in.',
            },
            HttpStatus.CONFLICT,
          );
        }
      }
      if (email) {
        const emailTaken = await this.prisma.user.findFirst({
          where: { email, userType: { in: userTypes } },
        });
        if (emailTaken) {
          throw new HttpException(
            {
              code: ErrorCode.ACCOUNT_EXISTS,
              message:
                accountType === 'EMPLOYER'
                  ? 'An employer account already exists with this email. Please sign in.'
                  : 'A candidate account already exists with this email. Please sign in.',
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

    if (channel === 'MOBILE' && !this.isDevOtp() && !this.msg91.isConfigured() && !this.firebase.isConfigured()) {
      throw new HttpException(
        {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Mobile OTP is not configured. Set MSG91_AUTH_KEY in apps/api/.env.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const passwordError =
      dto.purpose === 'REGISTER' && dto.accountType === 'EMPLOYER' && dto.password
        ? registrationPasswordError(dto.password)
        : null;
    if (passwordError) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: passwordError },
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash =
      dto.purpose === 'REGISTER' && (dto.accountType === 'EMPLOYER' || Boolean(dto.password))
        ? await this.resolvePasswordHash(phone, dto.password, dto.accountType === 'EMPLOYER')
        : null;

    const usesMsg91Mobile =
      channel === 'MOBILE' && !this.isDevOtp() && this.msg91.isConfigured();

    const otpCode = this.isDevOtp()
      ? channel === 'MOBILE'
        ? DEV_OTP_MOBILE
        : DEV_OTP_EMAIL
      : channel === 'EMAIL'
        ? String(Math.floor(100000 + Math.random() * 900000))
        : null;
    const otpHash =
      otpCode ? hashToken(otpCode) : usesMsg91Mobile ? 'MSG91' : null;

    const request = await this.prisma.otpRequest.create({
      data: {
        phone,
        email: email || null,
        channel,
        purpose: dto.purpose,
        otpHash,
        payloadJson: JSON.stringify(
          dto.purpose === 'REGISTER'
            ? {
                email,
                fullName: dto.fullName?.trim(),
                location: dto.location?.trim(),
                city: dto.city?.trim() || dto.location?.trim(),
                state: dto.state?.trim(),
                preferredLanguage: dto.preferredLanguage,
                passwordHash,
                accountType,
                companyName: dto.companyName?.trim(),
                industry: dto.industry?.trim(),
              }
            : { accountType },
        ),
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    });

    if (channel === 'EMAIL' && otpCode && !this.isDevOtp()) {
      await this.email.sendOtp(email || '', otpCode);
    }

    let msg91RequestId: string | null = null;
    if (usesMsg91Mobile) {
      msg91RequestId = await this.msg91.sendOtp(phone);
      if (msg91RequestId) {
        let basePayload: Record<string, unknown> = {};
        try {
          basePayload = JSON.parse(request.payloadJson || '{}') as Record<string, unknown>;
        } catch {
          basePayload = {};
        }
        await this.prisma.otpRequest.update({
          where: { id: request.id },
          data: {
            payloadJson: JSON.stringify({
              ...basePayload,
              msg91RequestId,
              msg91: true,
            }),
          },
        });
      }
    }

    return {
      requestId: request.id,
      expiresIn: OTP_TTL_SECONDS,
      ...(this.isDevOtp()
        ? { devOtp: channel === 'MOBILE' ? DEV_OTP_MOBILE : DEV_OTP_EMAIL }
        : {}),
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
    request: {
      phone: string;
      email: string | null;
      channel: string;
      otpHash: string | null;
      payloadJson?: string | null;
    },
  ) {
    const allowServerOtp =
      this.isDevOtp() ||
      request.channel === 'EMAIL' ||
      (request.channel === 'MOBILE' && this.msg91.isConfigured());

    const usesMsg91 =
      request.channel === 'MOBILE' &&
      this.msg91.isConfigured() &&
      !this.isDevOtp() &&
      request.otpHash === 'MSG91';

    if (usesMsg91 && dto.otp) {
      await this.msg91.verifyOtp(request.phone, dto.otp);
      const kind = parseRegistration(request.payloadJson)?.accountType;
      const role = kind === 'EMPLOYER' ? 'EMPLOYER' : 'CANDIDATE';
      return {
        firebaseUid: `msg91_${role}_${request.phone}`,
        phone: request.phone,
      };
    }

    if (allowServerOtp && dto.otp && request.otpHash && request.otpHash !== 'MSG91' && hashToken(dto.otp) === request.otpHash) {
      const kind = parseRegistration(request.payloadJson)?.accountType;
      const role = kind === 'EMPLOYER' ? 'EMPLOYER' : 'CANDIDATE';
      return {
        firebaseUid:
          request.channel === 'EMAIL'
            ? `email_${role}_${request.email}`
            : `otp_${role}_${request.phone}`,
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
      const kind = parseRegistration(request.payloadJson)?.accountType;
      const role = kind === 'EMPLOYER' ? 'EMPLOYER' : 'CANDIDATE';
      return { firebaseUid: `${decoded.uid}_${role}`, phone };
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
    const userTypes = userTypesForAccount(isEmployer ? 'EMPLOYER' : 'CANDIDATE');
    const names = splitName(registration?.fullName);
    const cityName = registration?.city?.trim() || registration?.location?.trim() || null;
    const stateName = registration?.state?.trim() || null;
    const email = registration?.email?.trim().toLowerCase() || null;
    const profileCompletion =
      (names.firstName ? 20 : 0) +
      (cityName ? 20 : 0) +
      (registration?.preferredLanguage ? 10 : 0) +
      (email ? 10 : 0);

    // Unique is per account type — same phone may exist on candidate and employer.
    const phoneMatch = phone
      ? await this.prisma.user.findFirst({
          where: { phone, userType: { in: userTypes } },
          include: { candidate: true, employer: true },
        })
      : null;
    const emailMatch = email
      ? await this.prisma.user.findFirst({
          where: { email, userType: { in: userTypes } },
          include: { candidate: true, employer: true },
        })
      : null;
    let user = emailMatch || phoneMatch;

    if (purpose === 'LOGIN' && !user) {
      throw new HttpException(
        {
          code: ErrorCode.ACCOUNT_NOT_FOUND,
          message: isEmployer
            ? 'No employer account found for this number. Register as an employer first.'
            : 'No account found for this number. Create your free Career Passport.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (purpose === 'REGISTER' && user) {
      const hitEmail = Boolean(emailMatch);
      throw new HttpException(
        {
          code: ErrorCode.ACCOUNT_EXISTS,
          message: isEmployer
            ? hitEmail
              ? 'An employer account already exists with this email. Please sign in.'
              : 'An employer account already exists with this mobile. Please sign in.'
            : hitEmail
              ? 'A candidate account already exists with this email. Please sign in.'
              : 'A candidate account already exists with this mobile. Please sign in.',
        },
        HttpStatus.CONFLICT,
      );
    }

    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: {
            phone,
            email,
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
                      city: registration?.city || registration?.location || null,
                    },
                  },
                }
              : {
                  candidate: {
                    create: {
                      firstName: names.firstName,
                      lastName: names.lastName,
                      state: stateName,
                      city: cityName,
                      preferredLanguage: registration?.preferredLanguage || null,
                      profileCompletion,
                      onboardingCompleted: false,
                    },
                  },
                }),
          },
          include: { candidate: true, employer: true },
        });
      } catch (err) {
        if (isPrismaUniqueViolation(err)) {
          const targets =
            err && typeof err === 'object' && 'meta' in err
              ? (err as { meta?: { target?: string[] } }).meta?.target || []
              : [];
          const hitEmail = targets.some((t) => String(t).toLowerCase().includes('email'));
          throw new HttpException(
            {
              code: ErrorCode.ACCOUNT_EXISTS,
              message: isEmployer
                ? hitEmail
                  ? 'An employer account already exists with this email. Please sign in.'
                  : 'An employer account already exists with this mobile. Please sign in.'
                : hitEmail
                  ? 'A candidate account already exists with this email. Please sign in.'
                  : 'A candidate account already exists with this mobile. Please sign in.',
            },
            HttpStatus.CONFLICT,
          );
        }
        throw err;
      }
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
    accountType: 'CANDIDATE' | 'EMPLOYER' | 'SUPER_ADMIN' | 'ADMIN',
  ) {
    if (!['CANDIDATE', 'EMPLOYER', 'SUPER_ADMIN', 'ADMIN'].includes(accountType)) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Choose Candidate, Employer, Super Admin, or Admin before signing in.',
      });
    }

    const value = identifier.trim();
    const email = value.includes('@') ? value.toLowerCase() : null;
    const phone = email ? null : normalizeLoginPhone(value);
    const invalid = {
      code: ErrorCode.UNAUTHORIZED,
      message: 'Incorrect email, mobile number, or password.',
    };

    if (accountType === 'SUPER_ADMIN' || accountType === 'ADMIN') {
      if (!email) {
        throw new UnauthorizedException({
          code: ErrorCode.UNAUTHORIZED,
          message: 'Use email and password for this sign-in.',
        });
      }
      const staffTypes =
        accountType === 'SUPER_ADMIN'
          ? (['SUPER_ADMIN'] as const)
          : (['PLATFORM_ADMIN', 'PLATFORM_OPERATOR'] as const);

      const user = await this.prisma.user.findFirst({
        where: { email, userType: { in: [...staffTypes] } },
        include: { candidate: true, employer: true },
      });

      if (!user || user.status !== 'ACTIVE' || !user.passwordHash) {
        throw new UnauthorizedException(invalid);
      }
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        throw new UnauthorizedException(invalid);
      }
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        include: { candidate: true, employer: true },
      });
      return this.issueSession(updated);
    }

    const userTypes = userTypesForAccount(accountType);
    const user = await this.prisma.user.findFirst({
      where: {
        ...(email ? { email } : { phone: phone || value }),
        userType: { in: userTypes },
      },
      include: { candidate: true, employer: true },
    });

    if (!user || user.status !== 'ACTIVE' || !user.passwordHash) {
      throw new UnauthorizedException(invalid);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException(invalid);
    }

    if (accountType === 'EMPLOYER') {
      if (user.userType !== 'EMPLOYER_ADMIN' && user.userType !== 'EMPLOYER_RECRUITER') {
        throw new UnauthorizedException({
          code: ErrorCode.UNAUTHORIZED,
          message: 'This is not an employer account. Use Candidate sign-in.',
        });
      }
    } else if (user.userType !== 'CANDIDATE') {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'This is not a candidate account. Use Employer sign-in.',
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
    const employerTypes = userTypesForAccount('EMPLOYER');
    const taken = await this.prisma.user.findFirst({
      where: {
        userType: { in: employerTypes },
        OR: [{ email }, { phone }],
      },
    });
    if (taken) {
      throw new HttpException(
        {
          code: ErrorCode.ACCOUNT_EXISTS,
          message: 'An employer account already exists with this email or mobile. Please sign in.',
        },
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

  private async resolvePasswordHash(phone: string, password?: string, required = false) {
    if (password) {
      return hashPassword(password);
    }
    const previous = await this.prisma.otpRequest.findFirst({
      where: { phone, purpose: 'REGISTER', verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const previousHash = parseRegistration(previous?.payloadJson)?.passwordHash;
    if (!previousHash && required) {
      throw new HttpException(
        { code: ErrorCode.VALIDATION_ERROR, message: 'Password must be at least 8 characters.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return previousHash || null;
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
          user.userType === 'CANDIDATE'
            ? user.candidate?.onboardingCompleted ?? false
            : user.userType === 'EMPLOYER_ADMIN' || user.userType === 'EMPLOYER_RECRUITER'
              ? user.employer?.verificationStatus === 'PENDING' ||
                user.employer?.verificationStatus === 'VERIFIED' ||
                user.employer?.verified === true
              : true,
        ...(user.userType === 'EMPLOYER_ADMIN' || user.userType === 'EMPLOYER_RECRUITER'
          ? {
              employerVerificationStatus:
                user.employer?.verificationStatus ||
                (user.employer?.verified ? 'VERIFIED' : 'UNVERIFIED'),
            }
          : {}),
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
    employer?: {
      contactName: string | null;
      verificationStatus?: string | null;
      verified?: boolean;
    } | null;
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
    const isEmployer =
      user.userType === 'EMPLOYER_ADMIN' || user.userType === 'EMPLOYER_RECRUITER';
    const employerStatus =
      user.employer?.verificationStatus ||
      (user.employer?.verified ? 'VERIFIED' : 'UNVERIFIED');
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
        onboardingCompleted: isCandidate
          ? user.candidate?.onboardingCompleted ?? false
          : !isEmployer || employerStatus === 'PENDING' || employerStatus === 'VERIFIED',
        ...(isEmployer ? { employerVerificationStatus: employerStatus } : {}),
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
      city?: string;
      state?: string;
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

function isPrismaUniqueViolation(err: unknown) {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
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

function userTypesForAccount(kind: 'CANDIDATE' | 'EMPLOYER'): Array<'CANDIDATE' | 'EMPLOYER_ADMIN' | 'EMPLOYER_RECRUITER'> {
  return kind === 'EMPLOYER' ? ['EMPLOYER_ADMIN', 'EMPLOYER_RECRUITER'] : ['CANDIDATE'];
}
