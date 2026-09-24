import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus } from '../prisma/client';

@SkipThrottle()
@Controller('platform')
export class PlatformController {
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
}
