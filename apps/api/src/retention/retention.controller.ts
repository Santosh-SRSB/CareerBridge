import { Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { assertTaskSecret, isTaskSecretRequired } from '../common/tasks/assert-task-secret';
import { RetentionService } from './retention.service';

@Controller('retention')
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  /** Cloud Scheduler / ops worker entry. Protected by shared secret. */
  @Public()
  @Post('tasks/run')
  @HttpCode(200)
  async runTask(@Headers('x-retention-task-secret') secret: string | undefined) {
    assertTaskSecret(process.env.RETENTION_TASK_SECRET, secret, {
      requireConfigured: isTaskSecretRequired(),
      invalidMessage: 'Invalid task secret.',
    });
    return this.retention.runAll();
  }
}
