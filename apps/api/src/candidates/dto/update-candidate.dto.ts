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
