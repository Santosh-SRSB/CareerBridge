import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  JOB_CATEGORIES,
  JOB_EDUCATION_LEVELS,
  JOB_EXPERIENCE_RANGES,
  JOB_TYPES,
  SCREENING_QUESTION_TYPES,
  WORK_MODES,
} from '@careerbridge/shared';
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

class SaveEmployerKycDto {
  @IsString()
  @MinLength(2)
  gstNumber: string;

  @IsString()
  @MinLength(2)
  cin: string;

  @IsString()
  @MinLength(2)
  website: string;

  @IsString()
  @MinLength(2)
  panNumber: string;
}

class SubmitEmployerVerificationDto {
  @IsString()
  @MinLength(2)
  companyName: string;

  @IsString()
  @MinLength(3)
  workEmail: string;

  @IsString()
  @MinLength(2)
  designation: string;
}

class ScreeningQuestionDto {
  @IsString()
  @MinLength(1)
  id: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  prompt: string;

  @IsString()
  @IsIn([...SCREENING_QUESTION_TYPES])
  type: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;
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
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  hiringManager?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  openings?: number;

  @IsOptional()
  @IsString()
  @IsIn([...WORK_MODES])
  workMode?: string;

  @IsOptional()
  @IsString()
  @IsIn([...JOB_EDUCATION_LEVELS])
  educationMin?: string;

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
  @IsIn([...JOB_EXPERIENCE_RANGES, 'NONE'])
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreeningQuestionDto)
  screeningQuestions?: ScreeningQuestionDto[];

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
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

  @Patch('me/kyc')
  saveKyc(@CurrentUser() user: { id: string }, @Body() dto: SaveEmployerKycDto) {
    return this.employers.saveKyc(user.id, dto);
  }

  @Post('me/verification')
  submitVerification(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitEmployerVerificationDto,
  ) {
    return this.employers.submitVerification(user.id, dto);
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
