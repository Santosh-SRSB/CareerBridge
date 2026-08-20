import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EDUCATION_LEVELS, EXPERIENCE_OPTIONS, MAX_RECORD_YEAR, PERSON_NAME_PATTERN } from '@careerbridge/shared';

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
  @MaxLength(80, { message: 'Name is too long.' })
  @Matches(PERSON_NAME_PATTERN, { message: 'Enter a valid name using letters only.' })
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
  @IsIn([...EDUCATION_LEVELS])
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
  photoUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileLinksDto)
  links?: ProfileLinksDto;
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
  @Max(MAX_RECORD_YEAR)
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
  @Max(MAX_RECORD_YEAR)
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
