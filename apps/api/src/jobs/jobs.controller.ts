import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { IsBoolean, IsNumber, IsOptional, IsString, IsInt, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { JobsService } from './jobs.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class JobQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

class NearbyJobsQueryDto {
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minDistanceKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  maxDistanceKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsString()
  workMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salaryMax?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string' && value.trim()) {
      return value
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    return undefined;
  })
  skills?: string[];

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  remoteOnly?: boolean;
}

class ApplyDto {
  @IsOptional()
  @IsString()
  resumeId?: string;
}

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Public()
  @Get()
  list(@Query() query: JobQueryDto, @CurrentUser() user?: { id: string; role: string }) {
    return this.jobs.list(query, user?.role === 'CANDIDATE' ? user.id : undefined);
  }

  /** OLX-style distance-bucketed job discovery. Registered before :id. */
  @Public()
  @Get('nearby')
  nearby(@Query() query: NearbyJobsQueryDto, @CurrentUser() user?: { id: string; role: string }) {
    return this.jobs.nearby(
      {
        latitude: query.latitude,
        longitude: query.longitude,
        minDistanceKm: query.minDistanceKm,
        maxDistanceKm: query.maxDistanceKm,
        page: query.page,
        limit: query.limit,
        q: query.q,
        type: query.type,
        category: query.category,
        experience: query.experience,
        workMode: query.workMode,
        salaryMin: query.salaryMin,
        salaryMax: query.salaryMax,
        skills: query.skills,
        remoteOnly: query.remoteOnly,
      },
      user?.role === 'CANDIDATE' ? user.id : undefined,
    );
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Get('recommended')
  recommended(@CurrentUser() user: { id: string }) {
    return this.jobs.recommended(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Get('saved')
  saved(@CurrentUser() user: { id: string }) {
    return this.jobs.listSaved(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Post(':id/save')
  save(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.jobs.saveJob(user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Post(':id/unsave')
  unsave(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.jobs.unsaveJob(user.id, id);
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user?: { id: string; role: string }) {
    return this.jobs.detail(id, user?.role === 'CANDIDATE' ? user.id : undefined);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Get(':id/match')
  match(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.jobs.matchFor(user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Post(':jobId/applications')
  apply(
    @Param('jobId') jobId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ApplyDto,
  ) {
    return this.jobs.apply(user.id, jobId, dto.resumeId);
  }
}
