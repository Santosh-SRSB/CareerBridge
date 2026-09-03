import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';

@SkipThrottle()
@Controller()
export class HealthController {
  @Public()
  @Get()
  root() {
    return {
      status: 'ok',
      service: 'CareerBridge API',
      version: '1.0',
      docs: '/api/docs',
    };
  }

  @Public()
  @Get('health')
  check() {
    return { status: 'ok' };
  }
}

