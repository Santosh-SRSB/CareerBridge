import { Body, Controller, Get, HttpCode, Logger, Post } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus } from '../prisma/client';

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

@SkipThrottle()
@Controller('platform')
export class PlatformController {
  private readonly logger = new Logger('ClientError');

  constructor(private readonly prisma: PrismaService) {}

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

  /** Error-boundary incidents from the web app, logged under the id shown to the user. */
  @Public()
  @SkipThrottle({ default: false })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('client-errors')
  @HttpCode(202)
  reportClientError(@Body() body: ClientErrorReportDto) {
    const oneLine = (value?: string) => (value || '').replace(/[\r\n]+/g, ' ').slice(0, 500);
    this.logger.error(
      `errorId=${body.errorId} path=${oneLine(body.path)} digest=${oneLine(body.digest)} message=${oneLine(body.message)}`,
    );
    return { received: true, errorId: body.errorId };
  }
}
