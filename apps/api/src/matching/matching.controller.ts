import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { UserType } from '../prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MatchingService } from './matching.service';

class SkillProfileDto {
  @IsArray()
  @IsString({ each: true })
  requiredSkills: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredSkills?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(40)
  experienceYearsMin?: number;

  @IsOptional()
  @IsString()
  educationMin?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  interviewReadinessMin?: number;
}

class HiringOutcomeDto {
  @IsString()
  @IsIn(['HIRED', 'OFFER_EXTENDED', 'OFFER_DECLINED', 'REJECTED', 'POSITION_FILLED'])
  outcome: 'HIRED' | 'OFFER_EXTENDED' | 'OFFER_DECLINED' | 'REJECTED' | 'POSITION_FILLED';

  @IsOptional()
  @IsString()
  @MinLength(2)
  notes?: string;
}

@ApiTags('employer-matching')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.EMPLOYER_ADMIN, UserType.EMPLOYER_RECRUITER)
@Controller('employers')
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Get('jobs/:id/skill-profile')
  getSkillProfile(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.matching.getSkillProfile(user.id, id);
  }

  @Post('jobs/:id/skill-profile/extract')
  extractSkillProfile(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.matching.extractSkillProfile(user.id, id);
  }

  @Put('jobs/:id/skill-profile')
  saveSkillProfile(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: SkillProfileDto,
  ) {
    return this.matching.saveSkillProfile(user.id, id, dto);
  }

  @Post('jobs/:id/matches/recompute')
  recomputeMatches(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.matching.recomputeMatches(user.id, id);
  }

  @Get('jobs/:id/matches')
  listMatches(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.matching.listMatches(user.id, id);
  }

  @Get('jobs/:id/posting-payment')
  getJobPostingPayment(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.matching.getJobPostingPayment(user.id, id);
  }

  @Post('applications/:id/outcome')
  recordOutcome(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: HiringOutcomeDto,
  ) {
    return this.matching.recordHiringOutcome(user.id, id, dto.outcome, dto.notes);
  }

  @Get('me/payments')
  listPayments(@CurrentUser() user: { id: string }) {
    return this.matching.listPayments(user.id);
  }

  @Post('me/payments/:id/mark-paid')
  markPaid(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.matching.markPaymentPaid(user.id, id);
  }
}
