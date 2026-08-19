import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateSkillDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  category: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('candidates')
  candidates() {
    return this.admin.candidates();
  }

  @Get('employers')
  employers() {
    return this.admin.employers();
  }

  @Post('employers/:id/verify')
  verify(@Param('id') id: string) {
    return this.admin.verifyEmployer(id);
  }

  @Get('jobs')
  jobs() {
    return this.admin.jobs();
  }

  @Get('applications')
  applications() {
    return this.admin.applications();
  }

  @Get('skills')
  skills(@Query('query') query?: string) {
    return this.admin.skills(query);
  }

  @Post('skills')
  addSkill(@Body() dto: CreateSkillDto) {
    return this.admin.addSkill(dto.name, dto.category);
  }
}
