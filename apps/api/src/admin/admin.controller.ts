import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateSkillDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  category: string;

  @IsOptional()
  @IsString()
  aliases?: string;
}

class UpdateSkillDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  category?: string;

  @IsOptional()
  @IsString()
  aliases?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class CreateAdminDto {
  @IsString()
  @MinLength(5)
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'])
  role?: 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_OPERATOR';
}

class StatusDto {
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

class JobStatusDto {
  @IsIn(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED'])
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED';
}

class SettingsDto {
  @IsObject()
  settings: Record<string, string>;
}

class AdminRoleDto {
  @IsIn(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR'])
  role: 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_OPERATOR';
}

class AdminPasswordDto {
  @IsString()
  @MinLength(8)
  password: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('candidates')
  candidates(@Query('query') query?: string) {
    return this.admin.candidates(query);
  }

  @Get('candidates/:id')
  candidateDetails(@Param('id') id: string) {
    return this.admin.candidateDetails(id);
  }

  @Post('candidates/:id/status')
  setCandidateStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: StatusDto,
  ) {
    return this.admin.setCandidateStatus(user.id, id, dto.status);
  }

  @Post('users/:id/status')
  setUserStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: StatusDto,
  ) {
    return this.admin.setUserStatus(user.id, id, dto.status);
  }

  @Get('employers')
  employers(@Query('query') query?: string) {
    return this.admin.employers(query);
  }

  @Get('employers/:id')
  employerDetails(@Param('id') id: string) {
    return this.admin.employerDetails(id);
  }

  @Post('employers/:id/status')
  setEmployerStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: StatusDto,
  ) {
    return this.admin.setEmployerStatus(user.id, id, dto.status);
  }

  @Post('employers/:id/verify')
  verify(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.admin.verifyEmployer(user.id, id);
  }

  @Get('jobs')
  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  jobs(@Query('query') query?: string, @Query('status') status?: string) {
    return this.admin.jobs(query, status);
  }

  @Get('jobs/:id')
  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  jobDetails(@Param('id') id: string) {
    return this.admin.jobDetails(id);
  }

  @Post('jobs/:id/status')
  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  setJobStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: JobStatusDto,
  ) {
    return this.admin.setJobStatus(user.id, id, dto.status);
  }

  @Post('jobs/:id/approve')
  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  approveJob(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.admin.setJobStatus(user.id, id, 'PUBLISHED');
  }

  @Post('jobs/:id/reject')
  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  rejectJob(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.admin.setJobStatus(user.id, id, 'CLOSED');
  }

  @Get('applications')
  applications(@Query('query') query?: string, @Query('status') status?: string) {
    return this.admin.applications(query, status);
  }

  @Get('applications/:id')
  applicationDetails(@Param('id') id: string) {
    return this.admin.applicationDetails(id);
  }

  @Get('interviews')
  interviews(@Query('query') query?: string, @Query('status') status?: string) {
    return this.admin.interviews(query, status);
  }

  @Get('interviews/:id')
  interviewDetails(@Param('id') id: string) {
    return this.admin.interviewDetails(id);
  }

  @Get('skills')
  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  skills(@Query('query') query?: string) {
    return this.admin.skills(query);
  }

  @Post('skills')
  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN)
  addSkill(@CurrentUser() user: { id: string }, @Body() dto: CreateSkillDto) {
    return this.admin.addSkill(user.id, dto.name, dto.category, dto.aliases);
  }

  @Patch('skills/:id')
  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN)
  updateSkill(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateSkillDto,
  ) {
    return this.admin.updateSkill(user.id, id, dto);
  }

  @Get('notifications')
  notifications() {
    return this.admin.notifications();
  }

  @Get('reports')
  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  reports() {
    return this.admin.reports();
  }

  @Get('ai-usage')
  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  aiUsage() {
    return this.admin.aiUsage();
  }

  @Get('admins')
  @Roles(UserType.SUPER_ADMIN)
  listAdmins() {
    return this.admin.listAdmins();
  }

  @Post('admins')
  @Roles(UserType.SUPER_ADMIN)
  createAdmin(@CurrentUser() user: { id: string }, @Body() dto: CreateAdminDto) {
    return this.admin.createAdmin(user.id, dto);
  }

  @Post('admins/:id/suspend')
  @Roles(UserType.SUPER_ADMIN)
  suspendAdmin(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.admin.setAdminStatus(user.id, id, 'SUSPENDED');
  }

  @Post('admins/:id/status')
  @Roles(UserType.SUPER_ADMIN)
  setAdminStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: StatusDto,
  ) {
    return this.admin.setAdminStatus(user.id, id, dto.status);
  }

  @Post('admins/:id/role')
  @Roles(UserType.SUPER_ADMIN)
  setAdminRole(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: AdminRoleDto,
  ) {
    return this.admin.setAdminRole(user.id, id, dto.role);
  }

  @Post('admins/:id/password')
  @Roles(UserType.SUPER_ADMIN)
  setAdminPassword(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: AdminPasswordDto,
  ) {
    return this.admin.setAdminPassword(user.id, id, dto.password);
  }

  @Get('settings')
  @Roles(UserType.SUPER_ADMIN)
  getSettings() {
    return this.admin.getSettings();
  }

  @Post('settings')
  @Roles(UserType.SUPER_ADMIN)
  updateSettings(@CurrentUser() user: { id: string }, @Body() dto: SettingsDto) {
    return this.admin.updateSettings(user.id, dto.settings);
  }

  @Get('audit')
  audit(@CurrentUser() user: { role?: string }, @Query('query') query?: string) {
    return this.admin.audit(query, user.role === 'PLATFORM_OPERATOR');
  }
}
