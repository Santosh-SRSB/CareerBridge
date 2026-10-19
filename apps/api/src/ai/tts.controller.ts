import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { UserType } from '../prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TtsService } from './tts.service';

class SynthesizeSpeechDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2200)
  text!: string;
}

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.CANDIDATE)
@Controller('ai')
export class TtsController {
  constructor(private readonly tts: TtsService) {}

  /**
   * Consistent cloud TTS for AI interview / guided mock speech.
   * Fixed female Indian-English voice (firm tone) — same on every device.
   */
  @Post('tts')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  synthesize(@Body() dto: SynthesizeSpeechDto) {
    return this.tts.synthesize(dto.text);
  }
}
