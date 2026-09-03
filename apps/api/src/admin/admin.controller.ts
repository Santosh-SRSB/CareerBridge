import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
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
}

class CreateStateDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  code?: string;
}

class UpdateStateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class CreateCityDto {
  @IsUUID()
  stateId: string;

  @IsString()
  @MinLength(2)
  name: string;
}

class UpdateCityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsUUID()
  stateId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Get('candidates')
  candidates() {
    return this.admin.candidates();
  }

  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Get('employers')
  employers() {
    return this.admin.employers();
  }

  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Post('employers/:id/verify')
  verify(@Param('id') id: string) {
    return this.admin.verifyEmployer(id);
  }

  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Get('jobs')
  jobs() {
    return this.admin.jobs();
  }

  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Get('applications')
  applications() {
    return this.admin.applications();
  }

  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Get('skills')
  skills(@Query('query') query?: string) {
    return this.admin.skills(query);
  }

  @Roles(UserType.SUPER_ADMIN, UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Post('skills')
  addSkill(@Body() dto: CreateSkillDto) {
    return this.admin.addSkill(dto.name, dto.category);
  }

  @Roles(UserType.SUPER_ADMIN)
  @Get('admins')
  listAdmins() {
    return this.admin.listAdmins();
  }

  @Roles(UserType.SUPER_ADMIN)
  @Post('admins')
  createAdmin(
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: CreateAdminDto,
  ) {
    return this.admin.createAdmin(user, dto);
  }

  @Roles(UserType.SUPER_ADMIN)
  @Post('admins/:id/suspend')
  suspendAdmin(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') id: string,
  ) {
    return this.admin.suspendAdmin(user, id);
  }

  @Roles(UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Get('states')
  listStates() {
    return this.admin.listStatesAdmin();
  }

  @Roles(UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Post('states')
  createState(@Body() dto: CreateStateDto) {
    return this.admin.createState(dto.name, dto.code);
  }

  @Roles(UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Patch('states/:id')
  updateState(@Param('id') id: string, @Body() dto: UpdateStateDto) {
    return this.admin.updateState(id, dto);
  }

  @Roles(UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Delete('states/:id')
  deleteState(@Param('id') id: string) {
    return this.admin.deleteState(id);
  }

  @Roles(UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Get('cities')
  listCities(@Query('stateId') stateId?: string) {
    return this.admin.listCitiesAdmin(stateId);
  }

  @Roles(UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Post('cities')
  createCity(@Body() dto: CreateCityDto) {
    return this.admin.createCity(dto.stateId, dto.name);
  }

  @Roles(UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Patch('cities/:id')
  updateCity(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.admin.updateCity(id, dto);
  }

  @Roles(UserType.PLATFORM_ADMIN, UserType.PLATFORM_OPERATOR)
  @Delete('cities/:id')
  deleteCity(@Param('id') id: string) {
    return this.admin.deleteCity(id);
  }
}
