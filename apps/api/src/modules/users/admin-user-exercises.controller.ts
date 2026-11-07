import {
  BadRequestException,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { UsersService } from './users.service.js';
import {
  EXERCISE_OWNERS,
  type ExerciseModule,
  UserExercisesQueryDto,
} from './dto/user-exercises.dto.js';
import { ownerRequest } from '../../postgres/owner-client.js';
import { isUuid } from '../../postgres/ids.js';
@AdminController('users')
export class AdminUserExercisesController {
  constructor(private readonly users: UsersService) {}
  private async read(
    userId: string,
    module: ExerciseModule,
    q: UserExercisesQueryDto,
    recordId?: string,
  ) {
    if (!isUuid(userId) || (recordId && !isUuid(recordId)))
      throw new BadRequestException('Invalid learner or exercise ID');
    if (q.from && q.to && Date.parse(q.from) >= Date.parse(q.to))
      throw new BadRequestException('Invalid exercise date range');
    const user = await this.users.findById(userId);
    if (!user || user.isDeleted)
      throw new NotFoundException('Learner not found');
    const owner = EXERCISE_OWNERS[module];
    const result = await ownerRequest<Record<string, unknown>>(
      owner,
      `user-learning/${owner}/exercises${recordId ? '/detail' : ''}`,
      { ...q, userId, module, ...(recordId ? { recordId } : {}) },
    );
    if (result.notFound === true)
      throw new NotFoundException('Exercise not found for this learner');
    return result;
  }
  @RequirePermissions('users.read', 'toeic.attempts.read')
  @Get(':id/exercises/toeic')
  @Header('Cache-Control', 'private, no-store')
  toeic(@Param('id') id: string, @Query() q: UserExercisesQueryDto) {
    return this.read(id, 'toeic', q);
  }
  @RequirePermissions('users.read', 'toeic.attempts.read')
  @Get(':id/exercises/toeic/:recordId')
  @Header('Cache-Control', 'private, no-store')
  toeicDetail(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Query() q: UserExercisesQueryDto,
  ) {
    return this.read(id, 'toeic', q, recordId);
  }
  @RequirePermissions('users.read', 'vocabulary.read')
  @Get(':id/exercises/vocabulary')
  @Header('Cache-Control', 'private, no-store')
  vocabulary(@Param('id') id: string, @Query() q: UserExercisesQueryDto) {
    return this.read(id, 'vocabulary', q);
  }
  @RequirePermissions('users.read', 'vocabulary.read')
  @Get(':id/exercises/vocabulary/:recordId')
  @Header('Cache-Control', 'private, no-store')
  vocabularyDetail(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Query() q: UserExercisesQueryDto,
  ) {
    return this.read(id, 'vocabulary', q, recordId);
  }
  @RequirePermissions('users.read', 'dictation.read')
  @Get(':id/exercises/dictation')
  @Header('Cache-Control', 'private, no-store')
  dictation(@Param('id') id: string, @Query() q: UserExercisesQueryDto) {
    return this.read(id, 'dictation', q);
  }
  @RequirePermissions('users.read', 'dictation.read')
  @Get(':id/exercises/dictation/:recordId')
  @Header('Cache-Control', 'private, no-store')
  dictationDetail(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Query() q: UserExercisesQueryDto,
  ) {
    return this.read(id, 'dictation', q, recordId);
  }
  @RequirePermissions('users.read', 'arena.read')
  @Get(':id/exercises/arena')
  @Header('Cache-Control', 'private, no-store')
  arena(@Param('id') id: string, @Query() q: UserExercisesQueryDto) {
    return this.read(id, 'arena', q);
  }
  @RequirePermissions('users.read', 'arena.read')
  @Get(':id/exercises/arena/:recordId')
  @Header('Cache-Control', 'private, no-store')
  arenaDetail(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Query() q: UserExercisesQueryDto,
  ) {
    return this.read(id, 'arena', q, recordId);
  }
  @RequirePermissions('users.read', 'games.results.read')
  @Get(':id/exercises/minigame')
  @Header('Cache-Control', 'private, no-store')
  minigame(@Param('id') id: string, @Query() q: UserExercisesQueryDto) {
    return this.read(id, 'minigame', q);
  }
  @RequirePermissions('users.read', 'games.results.read')
  @Get(':id/exercises/minigame/:recordId')
  @Header('Cache-Control', 'private, no-store')
  minigameDetail(
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Query() q: UserExercisesQueryDto,
  ) {
    return this.read(id, 'minigame', q, recordId);
  }
}
