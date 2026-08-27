import { Body, Controller, Get, Param, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { Allow, IsBoolean, IsEmail, IsIn, IsISO8601, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { HumanMocksService } from './human-mocks.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class ScheduleDto {
  @IsString()
  @MinLength(2)
  candidateName: string;

  @IsEmail()
  candidateEmail: string;

  @IsISO8601()
  scheduledAt: string;

  @IsString()
  @IsIn(['TECHNICAL', 'NON_TECHNICAL'])
  interviewTrack: 'TECHNICAL' | 'NON_TECHNICAL';
}

class JoinDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsString()
  @IsIn(['candidate', 'interviewer'])
  role: 'candidate' | 'interviewer';
}

class SignalDto extends JoinDto {
  @IsString()
  @IsIn(['offer', 'answer', 'ice'])
  kind: 'offer' | 'answer' | 'ice';

  @Allow()
  payload: unknown;
}

class CompleteDto {
  @IsInt()
  @Min(0)
  durationMs: number;

  @IsBoolean()
  hadVideo: boolean;

  @IsBoolean()
  hadVoice: boolean;

  @IsBoolean()
  interviewerJoined: boolean;

  @IsOptional()
  @IsString()
  transcript?: string;
}

@ApiTags('human-mocks')
@Controller('human-mocks')
export class HumanMocksController {
  constructor(private readonly mocks: HumanMocksService) {}

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.mocks.list(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Post()
  schedule(@CurrentUser() user: { id: string }, @Body() dto: ScheduleDto) {
    return this.mocks.schedule(user.id, dto);
  }

  @Public()
  @Get(':id')
  get(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @CurrentUser() user?: { id: string },
  ) {
    if (token) return this.mocks.getByToken(id, token);
    if (!user?.id) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Please sign in again.' });
    }
    return this.mocks.getForCandidate(user.id, id);
  }

  @Public()
  @Post(':id/join')
  join(@Param('id') id: string, @Body() dto: JoinDto, @CurrentUser() user?: { id: string }) {
    return this.mocks.join(id, { ...dto, userId: user?.id });
  }

  @Public()
  @SkipThrottle()
  @Post(':id/signal')
  signal(@Param('id') id: string, @Body() dto: SignalDto, @CurrentUser() user?: { id: string }) {
    return this.mocks.signal(id, { ...dto, userId: user?.id });
  }

  @Public()
  @SkipThrottle()
  @Get(':id/signal')
  peek(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Query('role') role: 'candidate' | 'interviewer',
    @CurrentUser() user?: { id: string },
  ) {
    return this.mocks.peek(id, { token, role: role || 'candidate', userId: user?.id });
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserType.CANDIDATE)
  @Post(':id/complete')
  complete(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: CompleteDto) {
    return this.mocks.complete(user.id, id, dto);
  }
}
