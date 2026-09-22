import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import type { TestimonialAudience, TestimonialSource } from '@careerbridge/shared';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserType } from '../prisma/client';
import { TestimonialsService } from './testimonials.service';

class SubmitTestimonialDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(20)
  @MaxLength(600)
  quote: string;

  @IsOptional()
  @IsString()
  source?: TestimonialSource;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  headline?: string;
}

class DismissPromptDto {
  @IsString()
  source: TestimonialSource;
}

class ReviewDto {
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(400)
  rejectReason?: string;
}

@ApiTags('testimonials')
@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Public()
  @Get()
  listPublic(@Query('audience') audience?: TestimonialAudience) {
    const cleaned =
      audience === 'CANDIDATE' || audience === 'EMPLOYER' ? audience : undefined;
    return this.testimonials.listPublic(cleaned);
  }

  @ApiBearerAuth()
  @Get('me/prompt')
  getPrompt(@CurrentUser() user: { id: string }) {
    return this.testimonials.getActivePrompt(user.id);
  }

  @ApiBearerAuth()
  @Post('me/prompt/dismiss')
  dismiss(@CurrentUser() user: { id: string }, @Body() dto: DismissPromptDto) {
    return this.testimonials.dismissPrompt(user.id, dto.source);
  }

  @ApiBearerAuth()
  @Post()
  submit(@CurrentUser() user: { id: string }, @Body() dto: SubmitTestimonialDto) {
    return this.testimonials.submit(user.id, dto);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
@Controller('admin/testimonials')
export class AdminTestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.testimonials.adminList(status);
  }

  @Post(':id/review')
  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN)
  review(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ReviewDto,
  ) {
    return this.testimonials.adminReview(user.id, id, dto.action, dto.rejectReason);
  }
}
