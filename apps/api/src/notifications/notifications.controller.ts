import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { UserType } from '../prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotificationsService } from './notifications.service';

class DeviceTokenDto {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.CANDIDATE, UserType.EMPLOYER_ADMIN, UserType.EMPLOYER_RECRUITER)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.notifications.listForUser(user.id);
  }

  @Post('device-token')
  registerToken(@CurrentUser() user: { id: string }, @Body() dto: DeviceTokenDto) {
    return this.notifications.registerDeviceToken(user.id, dto.token, dto.platform || 'WEB');
  }

  @Delete('device-token')
  unregisterToken(@CurrentUser() user: { id: string }, @Body() dto: DeviceTokenDto) {
    return this.notifications.unregisterDeviceToken(user.id, dto.token);
  }

  @Post('read-all')
  markAll(@CurrentUser() user: { id: string }) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  markOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }
}
