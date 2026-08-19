import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EDUCATION_LEVELS, EXPERIENCE_OPTIONS } from '@careerbridge/shared';

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
