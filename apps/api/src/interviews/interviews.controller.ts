import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { InterviewsService } from './interviews.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class StartInterviewDto {
  @IsString()
  @MinLength(2)
  jobRole: string;

  @IsString()
  @IsIn(['HR', 'CUSTOMER_SERVICE', 'SITUATIONAL'])
  interviewType: string;
}

class AnswerDto {
  @IsString()
  @MinLength(8, { message: 'Type a fuller answer so we can give useful feedback.' })
  answer: string;
}

class LiveCreateDto {
  @IsOptional()
  @IsString()
  jobRole?: string;

  @IsString()
  @IsIn(['HR', 'TECHNICAL', 'BEHAVIOURAL', 'ROLE', 'RESUME', 'MIXED', 'CUSTOMER_SERVICE', 'SITUATIONAL'])
  interviewType!: string;

  @IsOptional()
  @IsString()
  @IsIn(['Beginner', 'Intermediate', 'Advanced', 'FRESHER', 'YEAR_1', 'YEAR_2_3', 'YEAR_4_PLUS'])
  difficulty?: string;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(45)
  durationLimitMin!: number;

  @IsString()
  @IsIn(['PASSPORT', 'UPLOAD'])
  source!: 'PASSPORT' | 'UPLOAD';

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}

class LiveAnswerDto {
  @IsString()
  @MinLength(2, { message: 'Please answer the question.' })
  answer!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSec?: number;
}

class WarningDto {
  @IsString()
  type!: string;

  @IsString()
  message!: string;

  @IsString()
  @IsIn(['INFO', 'WARNING', 'HIGH'])
  severity!: 'INFO' | 'WARNING' | 'HIGH';
}

@ApiTags('interviews')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.CANDIDATE)
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.interviews.list(user.id);
  }

  @Post()
  start(@CurrentUser() user: { id: string }, @Body() dto: StartInterviewDto) {
    return this.interviews.start(user.id, dto.jobRole, dto.interviewType);
  }

  @Post('live')
  createLive(@CurrentUser() user: { id: string }, @Body() dto: LiveCreateDto) {
    return this.interviews.createLive(user.id, dto);
  }

  @Post(':id/start')
  startLive(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.interviews.startLive(user.id, id);
  }

  @Post(':id/answers')
  answerLive(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: LiveAnswerDto) {
    return this.interviews.answerLive(user.id, id, dto.answer, dto.durationSec);
  }

  @Post(':id/warnings')
  warn(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: WarningDto) {
    return this.interviews.addWarning(user.id, id, dto);
  }

  @Post(':id/end')
  end(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.interviews.endLive(user.id, id);
  }

  @Get(':id/download-report')
  pdf(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.interviews.downloadReport(user.id, id);
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.interviews.get(user.id, id);
  }

  @Post(':id/respond')
  respond(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: AnswerDto) {
    return this.interviews.respond(user.id, id, dto.answer);
  }
}
