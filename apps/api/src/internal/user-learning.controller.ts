import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { readUserLearning } from '../modules/users/user-learning-reader.js';
import {
  InjectPgConnection,
  type PgConnection,
} from '../postgres/connection.js';
import { authorizeInternal } from './authorize.js';
import {
  readUserExercises,
  readUserExerciseDetail,
} from '../modules/users/user-exercises-reader.js';
import { UserExercisesReadDto } from '../modules/users/dto/user-exercises.dto.js';
@Controller('_internal/user-learning')
export class UserLearningController {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}
  @Public()
  @Post(':owner/exercises')
  exercises(
    @Headers('x-internal-token') token: string,
    @Param('owner') owner: string,
    @Body() input: UserExercisesReadDto,
  ) {
    authorizeInternal(token, [owner]);
    return readUserExercises(this.db, owner, input);
  }
  @Public()
  @Post(':owner/exercises/detail')
  async exerciseDetail(
    @Headers('x-internal-token') token: string,
    @Param('owner') owner: string,
    @Body() input: UserExercisesReadDto,
  ) {
    authorizeInternal(token, [owner]);
    try {
      return await readUserExerciseDetail(this.db, owner, input);
    } catch (error) {
      if (error instanceof NotFoundException) return { notFound: true };
      throw error;
    }
  }
  @Public()
  @Post(':owner')
  read(
    @Headers('x-internal-token') token: string,
    @Param('owner') owner: string,
    @Body() input: { userId: string },
  ) {
    authorizeInternal(token, [owner]);
    return readUserLearning(this.db, owner, input?.userId);
  }
}
