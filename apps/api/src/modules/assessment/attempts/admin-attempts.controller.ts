import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator.js';
import { Get,Param,Query } from '@nestjs/common';
import { AdminController } from '../../auth/decorators/admin-controller.decorator.js';
import { AttemptsService } from './attempts.service.js';
import { AdminQueryAttemptDto } from './dto/query-attempt.dto.js';

@AdminController('attempts')
export class AdminAttemptsController {
  constructor(private readonly attempts: AttemptsService) {}
  @RequirePermissions('toeic.attempts.read')
  @Get() list(@Query() query: AdminQueryAttemptDto) {
    return this.attempts.adminList(query);
  }
  @RequirePermissions('toeic.attempts.read')
  @Get('stats') stats(@Query() query: AdminQueryAttemptDto) {
    return this.attempts.stats(undefined, query);
  }
  @RequirePermissions('toeic.attempts.read')
  @Get(':id') detail(@Param('id') id: string) {
    return this.attempts.adminFindOne(id);
  }
}

@AdminController('exams')
export class AdminExamAttemptsController {
  constructor(private readonly attempts: AttemptsService) {}
  @RequirePermissions('toeic.attempts.read')
  @Get(':id/attempts') list(
    @Param('id') id: string,
    @Query() query: AdminQueryAttemptDto,
  ) {
    return this.attempts.adminList({ ...query, examId: id });
  }
  @RequirePermissions('toeic.attempts.read')
  @Get(':id/attempts/stats') stats(
    @Param('id') id: string,
    @Query() query: AdminQueryAttemptDto,
  ) {
    return this.attempts.stats(undefined, { ...query, examId: id });
  }
}
