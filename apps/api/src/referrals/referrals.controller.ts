import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserType } from '../prisma/client';
import { ReferralsService } from './referrals.service';

class PayoutDto {
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  upiId: string;
}

class ReviewReferralDto {
  @IsIn(['APPROVE', 'REJECT', 'HOLD'])
  action: 'APPROVE' | 'REJECT' | 'HOLD';

  @IsOptional()
  @IsString()
  @MaxLength(400)
  reason?: string;
}

class ReviewPayoutDto {
  @IsIn(['PAID', 'REJECT'])
  action: 'PAID' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(150)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  adminNote?: string;
}

@ApiTags('referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Public()
  @Get('validate/:code')
  validate(@Param('code') code: string) {
    return this.referrals.validatePublicCode(code);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.referrals.getCandidateDashboard(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Post('me/payout')
  payout(@CurrentUser() user: { id: string }, @Body() dto: PayoutDto) {
    return this.referrals.submitPayoutRequest(user.id, dto.upiId);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN)
@Controller('admin/referrals')
export class AdminReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('payoutStatus') payoutStatus?: string,
    @Query('q') q?: string,
  ) {
    return this.referrals.adminList({ status, payoutStatus, q });
  }

  @Post('payouts/:id/review')
  reviewPayout(
    @Param('id') id: string,
    @Body() dto: ReviewPayoutDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.referrals.adminReviewPayout(id, dto.action, user.id, {
      paymentReference: dto.paymentReference,
      adminNote: dto.adminNote,
    });
  }

  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewReferralDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.referrals.adminReviewReferral(id, dto.action, user.id, dto.reason);
  }
}
