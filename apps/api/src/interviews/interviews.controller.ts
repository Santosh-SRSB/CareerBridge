import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { IsIn, IsString, MinLength } from 'class-validator';
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

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.interviews.get(user.id, id);
  }

  @Post(':id/respond')
  respond(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: AnswerDto) {
    return this.interviews.respond(user.id, id, dto.answer);
  }
}
