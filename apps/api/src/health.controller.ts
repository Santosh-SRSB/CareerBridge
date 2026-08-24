import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';

@SkipThrottle()
@Controller()
export class ApiRootController {
  @Public()
  @Get()
  root() {
    return {
      name: 'CareerBridge API',
      status: 'ok',
      health: '/api/v1/health',
      docs: '/api/docs',
    };
  }
}

@SkipThrottle()
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
