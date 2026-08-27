import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** App-level rate limit guard (extends Nest ThrottlerGuard). */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {}
