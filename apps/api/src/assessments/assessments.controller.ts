import { Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AssessmentsService } from './assessments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class AnswerAssessmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  selectedIndex?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasAudio?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasVoice?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30000)
  durationMs?: number;
}

@ApiTags('assessments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.CANDIDATE)
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.assessments.list(user.id);
  }

  @Get('access')
  access(@CurrentUser() user: { id: string }) {
    return this.assessments.access(user.id);
  }

  @Post()
  start(@CurrentUser() user: { id: string }) {
    return this.assessments.start(user.id);
  }

  @Post('unlock')
  unlock(@CurrentUser() user: { id: string }) {
    return this.assessments.unlock(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.assessments.get(user.id, id);
  }

  @Post(':id/respond')
  @UseInterceptors(
    FileInterceptor('recording', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  respond(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: AnswerAssessmentDto,
    @UploadedFile() recording?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    return this.assessments.respond(user.id, id, dto, recording);
  }
}
