import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { RESUME_TEMPLATES } from '@careerbridge/shared';
import { ResumesService } from './resumes.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class CreateResumeDto {
  @IsOptional()
  @IsString()
  targetJobTitle?: string;

  @IsOptional()
  @IsString()
  @IsIn([...RESUME_TEMPLATES])
  template?: string;
}

class UpdateResumeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  targetJobTitle?: string;

  @IsOptional()
  @IsString()
  @IsIn([...RESUME_TEMPLATES])
  template?: string;

  @IsOptional()
  @IsString()
  summary?: string;
}

@ApiTags('resumes')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.CANDIDATE)
@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.resumes.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateResumeDto) {
    return this.resumes.create(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.get(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateResumeDto) {
    return this.resumes.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.remove(user.id, id);
  }

  @Post(':id/analyze')
  analyze(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.analyze(user.id, id);
  }

  @Post(':id/ai/suggestions')
  suggestions(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.analyze(user.id, id);
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.duplicate(user.id, id);
  }

  @Get(':id/download')
  download(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.download(user.id, id);
  }
}
