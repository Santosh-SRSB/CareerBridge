import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { RESUME_TEMPLATES } from '@careerbridge/shared';
import { ResumesService } from './resumes.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';

class CreateResumeDto {
  @IsOptional()
  @IsString()
  targetJobTitle?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn([...RESUME_TEMPLATES])
  template?: string;

  @IsOptional()
  @IsBoolean()
  includePhoto?: boolean;

  /** Blank ATS editor resume (no Career Passport autofill). */
  @IsOptional()
  @IsBoolean()
  blank?: boolean;

  /** Friend-editor / manual JSON payload (stored under content._manual.data). */
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  summary?: string;

  /** Create a new version linked to an existing resume (does not overwrite). */
  @IsOptional()
  @IsString()
  parentResumeId?: string;
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

  @IsOptional()
  @IsString()
  @IsIn([...RESUME_TEMPLATES])
  template?: string;

  @IsOptional()
  @IsBoolean()
  includePhoto?: boolean;

  @IsObject()
  content!: Record<string, unknown>;
}

class SavePrimaryResumeDto {
  @IsOptional()
  @IsString()
  resumeId?: string;

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

  @IsObject()
  content!: Record<string, unknown>;

  /** When true, save DB only — do not sync PDF to Google Cloud Storage. */
  @IsOptional()
  @IsBoolean()
  skipCloudSync?: boolean;
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

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}

class StartOptimizationDto {
  @IsString()
  planId!: string;
}

class CareerGuidanceDto {
  @IsOptional()
  @IsString()
  resumeId?: string;

  @IsOptional()
  @IsObject()
  resume?: Record<string, unknown>;
}

class RoleAtsDto {
  @IsOptional()
  @IsString()
  resumeId?: string;

  @IsString()
  @MinLength(2)
  targetRole!: string;

  @IsOptional()
  @IsString()
  jobDescription?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  resume?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  analysis?: Record<string, unknown>;
}

class StructureResumeTextDto {
  @IsString()
  @MinLength(20)
  rawText!: string;
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

  /** Public: structure resume text through Nest AI Gateway (Gemini only). */
  @Public()
  @Roles()
  @Post('structure-text')
  structureText(@Body() dto: StructureResumeTextDto) {
    return this.resumes.structureText(dto.rawText);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateResumeDto) {
    return this.resumes.create(user.id, {
      targetJobTitle: dto.targetJobTitle,
      title: dto.title,
      template: dto.template,
      includePhoto: dto.includePhoto,
      blank: dto.blank,
      content: dto.content,
      summary: dto.summary,
      parentResumeId: dto.parentResumeId,
    });
  }

  @Post('upload')
  upload(@CurrentUser() user: { id: string }, @Body() dto: UploadResumeDto) {
    return this.resumes.upload(user.id, dto);
  }

  @Post('upload-file')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadFile(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body() body: { targetJobTitle?: string },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Please choose a resume file to upload.',
      });
    }
    return this.resumes.uploadFile(user.id, file, body?.targetJobTitle);
  }

  /** Cloud Tasks / local worker callback */
  @Public()
  @Post('worker/process')
  processWorker(@Body() body: { resumeId: string; userId: string }) {
    return this.resumes.processWorker(body);
  }

  @Post('save-primary')
  savePrimary(@CurrentUser() user: { id: string }, @Body() dto: SavePrimaryResumeDto) {
    return this.resumes.savePrimary(user.id, dto);
  }

  @Post('ats/analyze')
  roleAnalyze(@CurrentUser() user: { id: string }, @Body() dto: RoleAtsDto) {
    return this.resumes.roleAnalyze(user.id, dto);
  }

  @Post('ats/rewrite')
  roleRewrite(@CurrentUser() user: { id: string }, @Body() dto: RoleAtsDto) {
    return this.resumes.roleRewrite(user.id, dto);
  }

  @Post('career-guidance')
  careerGuidance(@CurrentUser() user: { id: string }, @Body() dto: CareerGuidanceDto) {
    return this.resumes.careerGuidance(user.id, dto);
  }

  @Post(':id/career-guidance')
  careerGuidanceOwned(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: CareerGuidanceDto) {
    return this.resumes.careerGuidance(user.id, { ...dto, resumeId: id });
  }

  @Post(':id/ai-review')
  aiReview(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: RoleAtsDto) {
    return this.resumes.aiReview(user.id, id, dto);
  }

  @Post(':id/generate')
  generate(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.enhance(user.id, id);
  }

  @Post(':id/enhance')
  enhance(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.enhance(user.id, id);
  }

  @Post(':id/ats-rewrite')
  roleRewriteOwned(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: RoleAtsDto) {
    return this.resumes.roleRewrite(user.id, { ...dto, resumeId: id });
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.get(user.id, id);
  }

  @Put([':id', ':id/update'])
  updatePut(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateResumeDto) {
    return this.resumes.update(user.id, id, dto);
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

  @Get(':id/processing')
  processing(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumes.processingStatus(user.id, id);
  }
}
