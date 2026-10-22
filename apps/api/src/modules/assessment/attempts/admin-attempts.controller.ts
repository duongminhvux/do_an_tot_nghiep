import { Get, Param, Query } from '@nestjs/common';
import { AdminController } from '../../auth/decorators/admin-controller.decorator.js';
import { AttemptsService } from './attempts.service.js';
import { AdminQueryAttemptDto } from './dto/query-attempt.dto.js';

@AdminController('attempts')
export class AdminAttemptsController {
  constructor(private readonly attempts: AttemptsService) {}
  @Get() list(@Query() query: AdminQueryAttemptDto) {
    return this.attempts.adminList(query);
  }
  @Get('stats') stats(@Query() query: AdminQueryAttemptDto) {
    return this.attempts.stats(undefined, query);
  }
  @Get(':id') detail(@Param('id') id: string) {
    return this.attempts.adminFindOne(id);
  }
}

@AdminController('exams')
export class AdminExamAttemptsController {
  constructor(private readonly attempts: AttemptsService) {}
  @Get(':id/attempts') list(
    @Param('id') id: string,
    @Query() query: AdminQueryAttemptDto,
  ) {
    return this.attempts.adminList({ ...query, examId: id });
  }
  @Get(':id/attempts/stats') stats(
    @Param('id') id: string,
    @Query() query: AdminQueryAttemptDto,
  ) {
    return this.attempts.stats(undefined, { ...query, examId: id });
  }
}
