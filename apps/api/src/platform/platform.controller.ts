import { Body, Controller, Get, HttpCode, Logger, Post } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus } from '../prisma/client';
import { EmailService } from '../auth/email.service';
import { formatClientErrorLogLine } from './client-error-sanitize';

class ClientErrorReportDto {
  @IsString()
  @Matches(/^ERR-\d{8}-[A-Z0-9]{5,8}$/)
  errorId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  digest?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  path?: string;
}

class DemoRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  companyName!: string;

  @IsEmail()
  @MaxLength(160)
  workEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

@SkipThrottle()
@Controller('platform')
export class PlatformController {
  private readonly logger = new Logger('ClientError');

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @Public()
  @Get('stats')
  async stats() {
    const [passports, openJobs, candidateCities, jobCities] = await Promise.all([
      this.prisma.candidate.count(),
      this.prisma.job.count({ where: { status: JobStatus.PUBLISHED } }),
      this.prisma.candidate.findMany({
        where: { city: { not: null } },
        select: { city: true },
        distinct: ['city'],
      }),
      this.prisma.job.findMany({
        where: { status: JobStatus.PUBLISHED },
        select: { city: true },
        distinct: ['city'],
      }),
    ]);

    const citySet = new Set<string>();
    for (const row of candidateCities) {
      const city = row.city?.trim();
      if (city) citySet.add(city.toLowerCase());
    }
    for (const row of jobCities) {
      const city = row.city?.trim();
      if (city) citySet.add(city.toLowerCase());
    }

    return {
      passports,
      jobs: openJobs,
      cities: citySet.size,
      updatedAt: new Date().toISOString(),
    };
  }

  /** Landing-page "Request for Demo" — emailed to CareerBridge support. */
  @Public()
  @SkipThrottle({ default: false })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('demo-request')
  @HttpCode(200)
  async demoRequest(@Body() body: DemoRequestDto) {
    await this.email.sendDemoRequest({
      name: body.name.trim().replace(/\s+/g, ' '),
      companyName: body.companyName.trim().replace(/\s+/g, ' '),
      workEmail: body.workEmail.trim().toLowerCase(),
      phone: body.phone?.trim(),
      message: body.message?.trim(),
    });
    return { ok: true };
  }

  /** Error-boundary incidents from the web app, logged under the id shown to the user. */
  @Public()
  @SkipThrottle({ default: false })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('client-errors')
  @HttpCode(202)
  reportClientError(@Body() body: ClientErrorReportDto) {
    // SEC-LOG-008: never log pasted Bearer/JWT/API credentials from client error reports.
    this.logger.error(
      formatClientErrorLogLine({
        errorId: body.errorId,
        path: body.path,
        digest: body.digest,
        message: body.message,
      }),
    );
    return { received: true, errorId: body.errorId };
  }
}
