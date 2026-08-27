import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserType } from '../prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { VerifyGstDto } from './dto/verify-gst.dto';
import { GstService } from './gst.service';

@ApiTags('gst')
@ApiBearerAuth()
@Controller('gst')
@UseGuards(RolesGuard)
export class GstController {
  constructor(private readonly gst: GstService) {}

  /** Internal configuration health — no secrets. Employer/admin only. */
  @Get('health')
  @Roles(UserType.EMPLOYER_ADMIN, UserType.EMPLOYER_RECRUITER, UserType.PLATFORM_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  health() {
    return this.gst.health();
  }

  /**
   * Returns GST verify business payload. Because the payload includes `success`,
   * the global interceptor passes it through as the HTTP body (plus requestId).
   */
  @Post('verify')
  @Roles(UserType.EMPLOYER_ADMIN, UserType.EMPLOYER_RECRUITER, UserType.PLATFORM_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  verify(@Body() dto: VerifyGstDto, @CurrentUser() user: { id: string }) {
    return this.gst.verify(dto.gstin, user.id);
  }
}
