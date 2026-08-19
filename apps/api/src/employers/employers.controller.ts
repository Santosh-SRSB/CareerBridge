import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { JOB_CATEGORIES, JOB_TYPES } from '@careerbridge/shared';
import { EmployersService } from './employers.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class UpdateEmployerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  companyName?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  contactName?: string;
}

class CreateJobDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  @MinLength(20, { message: 'Add a short job description.' })
  description: string;

  @IsString()
  @MinLength(2)
  city: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  @IsIn([...JOB_TYPES])
  jobType?: string;

  @IsString()
  @IsIn([...JOB_CATEGORIES])
  category: string;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredSkills?: string[];

  @IsOptional()
  @IsString()
  benefits?: string;
}

class ApplicationActionDto {
  @IsString()
  @IsIn(['REVIEW', 'SHORTLIST', 'INTERVIEW', 'SELECT', 'REJECT', 'HIRE'])
  action: string;
}

@ApiTags('employers')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.EMPLOYER_ADMIN, UserType.EMPLOYER_RECRUITER)
@Controller('employers')
export class EmployersController {
  constructor(private readonly employers: EmployersService) {}

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.employers.me(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateEmployerDto) {
    return this.employers.updateMe(user.id, dto);
  }

  @Get('me/dashboard')
  dashboard(@CurrentUser() user: { id: string }) {
    return this.employers.dashboard(user.id);
  }

  @Get('jobs')
  jobs(@CurrentUser() user: { id: string }) {
    return this.employers.jobs(user.id);
  }

  @Post('jobs')
  createJob(@CurrentUser() user: { id: string }, @Body() dto: CreateJobDto) {
    return this.employers.createJob(user.id, dto);
  }

  @Get('jobs/:id')
  job(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.employers.job(user.id, id);
  }

  @Patch('jobs/:id')
  updateJob(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: CreateJobDto) {
    return this.employers.updateJob(user.id, id, dto);
  }

  @Post('jobs/:id/publish')
  publish(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.employers.setStatus(user.id, id, 'PUBLISHED');
  }

  @Post('jobs/:id/pause')
  pause(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.employers.setStatus(user.id, id, 'PAUSED');
  }

  @Post('jobs/:id/close')
  close(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.employers.setStatus(user.id, id, 'CLOSED');
  }

  @Get('jobs/:id/applications')
  applications(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.employers.applications(user.id, id);
  }

  @Get('candidates/:id')
  candidate(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.employers.candidateView(user.id, id);
  }

  @Post('applications/:id/status')
  status(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ApplicationActionDto,
  ) {
    return this.employers.changeStatus(user.id, id, dto.action);
  }
}
