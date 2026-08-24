import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
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

  @IsOptional()
  @IsBoolean()
  includePhoto?: boolean;
}

class UploadResumeDto {
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  targetJobTitle?: string;

  @IsOptional()
  @IsString()
  rawText?: string;

  @IsObject()
  content!: Record<string, unknown>;
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

class StartOptimizationDto {
  @IsString()
  planId!: string;
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

  @Post('upload')
  upload(@CurrentUser() user: { id: string }, @Body() dto: UploadResumeDto) {
    return this.resumes.upload(user.id, dto);
  }

  @Post(':id/enhance')
  enhance(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.enhance(user.id, id);
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

  @Get(':id/analysis')
  analysis(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.analyze(user.id, id);
  }

  @Get(':id/issues')
  issues(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.issues(user.id, id);
  }

  @Get(':id/optimization-options')
  options(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.optimizationOptions(user.id, id);
  }

  @Post(':id/optimizations')
  startOpt(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: StartOptimizationDto) {
    return this.resumes.startOptimization(user.id, id, dto.planId);
  }

  @Get(':id/optimizations/:optId')
  getOpt(@CurrentUser() user: { id: string }, @Param('id') id: string, @Param('optId') optId: string) {
    return this.resumes.getOptimization(user.id, id, optId);
  }

  @Get(':id/versions')
  versions(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.versions(user.id, id);
  }

  @Get(':id/changes')
  changes(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.changes(user.id, id);
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
