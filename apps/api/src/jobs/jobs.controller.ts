import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
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

class ScreeningAnswerDto {
  @IsString()
  questionId: string;

  @IsString()
  answer: string;
}

class ApplyDto {
  @IsOptional()
  @IsString()
  resumeId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreeningAnswerDto)
  screeningAnswers?: ScreeningAnswerDto[];
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

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Get('recommended')
  recommended(@CurrentUser() user: { id: string }) {
    return this.jobs.recommended(user.id);
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
    return this.jobs.apply(user.id, jobId, dto.resumeId, dto.screeningAnswers);
  }
}
