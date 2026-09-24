import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EXPERIENCE_OPTIONS, MAX_RECORD_YEAR } from '@careerbridge/shared';

export class ProfileLinksDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  linkedin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  github?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  portfolio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;
}

export class UpdateCandidateDto {
  @ApiPropertyOptional({ example: 'Rahul Kumar' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Enter your full name.' })
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'Tamil Nadu' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: 'Madurai' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Enter your current city.' })
  city?: string;

  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Select where you would like to work.' })
  preferredWorkCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  about?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openToRelocating?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  highestEducation?: string;

  @ApiPropertyOptional({ description: 'Education completion date YYYY-MM or YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  educationEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stillInCollege?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  careerInterests?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(EXPERIENCE_OPTIONS.map((item) => item.value))
  hasExperience?: string;

  @ApiPropertyOptional({
    example: 'Immediate',
    description: 'Join availability / notice period from onboarding',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  noticePeriod?: string;

  @ApiPropertyOptional({ enum: ['fresher', 'experienced'] })
  @IsOptional()
  @IsIn(['fresher', 'experienced'])
  experienceLevel?: 'fresher' | 'experienced';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  totalExperienceYears?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  totalExperienceMonths?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileLinksDto)
  links?: ProfileLinksDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dashboardReached?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsappNumber?: string | null;
}

export class PreferencesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  careerInterests?: string[];

  @IsOptional()
  @IsBoolean()
  openToRelocating?: boolean;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;
}

export class EducationDto {
  @IsString()
  @MinLength(2)
  qualification: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  yearCompleted?: number;
}

export class UpdateEducationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  qualification?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  yearCompleted?: number;
}

export class SkillDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;
}

export class ExperienceDto {
  @IsString()
  @MinLength(2)
  company: string;

  @IsString()
  @MinLength(2)
  jobTitle: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isInternship?: boolean;

  @IsOptional()
  @IsBoolean()
  stillInCompany?: boolean;
}

export class UpdateExperienceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  company?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  jobTitle?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isInternship?: boolean;

  @IsOptional()
  @IsBoolean()
  stillInCompany?: boolean;
}

export class PassportEducationDto {
  @IsString()
  @MinLength(2)
  qualification: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @IsOptional()
  @IsString()
  yearCompleted?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class PassportExperienceDto {
  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  stillInCompany?: boolean;

  @IsOptional()
  @IsBoolean()
  isInternship?: boolean;
}

export class SavePassportDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  about?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  careerInterests?: string[];

  @IsOptional()
  @IsBoolean()
  stillInCollege?: boolean;

  @IsOptional()
  @IsString()
  educationStart?: string;

  @IsOptional()
  @IsString()
  educationEnd?: string;

  @IsOptional()
  @IsIn(['fresher', 'experienced'])
  experienceLevel?: 'fresher' | 'experienced';

  @IsOptional()
  @IsString()
  totalExperienceYears?: string;

  @IsOptional()
  @IsString()
  totalExperienceMonths?: string;

  @IsOptional()
  @IsString()
  gapReason?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  gapMonths?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassportEducationDto)
  education?: PassportEducationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassportExperienceDto)
  experience?: PassportExperienceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectDto)
  projects?: ProjectDto[];
}

export class CertificationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  issuer?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  @Max(MAX_RECORD_YEAR)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  credentialId?: string;

  /** ADDITIVE optional certificate URL — validated only when provided. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  url?: string;
}

export class ProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  @Max(MAX_RECORD_YEAR)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  url?: string;
}

export class AnalyzeCareerGapEducationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  qualification!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  startDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  endDate?: string;

  @IsOptional()
  yearCompleted?: number | string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class AnalyzeCareerGapExperienceDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  startDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  stillInCompany?: boolean;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

/** Compute career gap after highest education (school→college gaps ignored). */
export class AnalyzeCareerGapDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnalyzeCareerGapEducationDto)
  education?: AnalyzeCareerGapEducationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnalyzeCareerGapExperienceDto)
  experience?: AnalyzeCareerGapExperienceDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  gapReason?: string;

  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}

export class ExplainCareerGapDto {
  @IsString()
  @IsIn([
    'JOB_SEARCH',
    'HIGHER_EDUCATION',
    'CERTIFICATION_TRAINING',
    'FREELANCING',
    'BUSINESS',
    'RELOCATION',
    'PERSONAL_FAMILY',
    'HEALTH_BREAK',
    'OTHER',
  ])
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonDetails?: string;
}
