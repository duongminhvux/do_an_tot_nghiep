import {
Body,
Controller,
ForbiddenException,
Headers,
Module,
NotFoundException,
Param,
Post,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { parseAudioFields,updateAudio } from '../common/media/audio-sql.js';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import {
InjectPgConnection,
type PgConnection,
} from '../postgres/connection.js';

function authorized(token?: string): void {
  const expected = process.env.INTERNAL_SERVICE_TOKEN || '';
  if (
    expected.length < 24 ||
    !token ||
    Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
    throw new ForbiddenException('Internal service credentials required');
}
@Controller('_internal/content/audio')
export class ContentAudioOwnerController {
  constructor(
    @InjectPgConnection() private readonly connection: PgConnection,
  ) {}
  @Public()
  @Post('words/:id')
  async sync(
    @Headers('x-internal-token') token: string,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    authorized(token);
    const result = await updateAudio(
      this.connection,
      'words',
      id,
      parseAudioFields(input),
    );
    if (!result) throw new NotFoundException('Word missing');
    return { ok: true, id: result._id };
  }
}
@Controller('_internal/assessment/audio')
export class AssessmentAudioOwnerController {
  constructor(
    @InjectPgConnection() private readonly connection: PgConnection,
  ) {}
  @Public()
  @Post('questions/:id')
  async question(
    @Headers('x-internal-token') token: string,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    authorized(token);
    if (
      !(await updateAudio(
        this.connection,
        'questions',
        id,
        parseAudioFields(input),
      ))
    )
      throw new NotFoundException('Question missing');
    return { ok: true };
  }
  @Public()
  @Post('passages/:id')
  async passage(
    @Headers('x-internal-token') token: string,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    authorized(token);
    if (
      !(await updateAudio(
        this.connection,
        'passages',
        id,
        parseAudioFields(input),
      ))
    )
      throw new NotFoundException('Passage missing');
    return { ok: true };
  }
}
@Module({ controllers: [ContentAudioOwnerController] })
export class ContentAudioOwnerModule {}
@Module({ controllers: [AssessmentAudioOwnerController] })
export class AssessmentAudioOwnerModule {}
