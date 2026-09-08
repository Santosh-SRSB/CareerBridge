import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { ApplicationsService } from './applications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateApplicationDto {
  jobId!: string;
  resumeId?: string;
}

@ApiTags('applications')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.CANDIDATE)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateApplicationDto) {
    return this.applications.apply(user.id, dto.jobId, dto.resumeId);
  }

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.applications.list(user.id);
  }

  @Get('scheduled-interviews')
  listScheduled(@CurrentUser() user: { id: string }) {
    return this.applications.listScheduledInterviews(user.id);
  }

  @Get('scheduled-interviews/:id')
  getScheduled(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.applications.getScheduledInterview(user.id, id);
  }

  @Post('scheduled-interviews/:id/confirm')
  confirmScheduled(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.applications.confirmScheduledInterview(user.id, id);
  }

  @Post('scheduled-interviews/:id/reschedule')
  rescheduleScheduled(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.applications.requestRescheduleInterview(user.id, id);
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.applications.get(user.id, id);
  }

  @Post(':id/withdraw')
  withdraw(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.applications.withdraw(user.id, id);
  }

  @Post(':id/status')
  updateStatus(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: { status?: string; action?: string }) {
    return this.applications.withdraw(user.id, id);
  }
}
