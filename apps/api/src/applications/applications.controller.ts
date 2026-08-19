import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import { ApplicationsService } from './applications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('applications')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.CANDIDATE)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.applications.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.applications.get(user.id, id);
  }

  @Post(':id/withdraw')
  withdraw(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.applications.withdraw(user.id, id);
  }
}
