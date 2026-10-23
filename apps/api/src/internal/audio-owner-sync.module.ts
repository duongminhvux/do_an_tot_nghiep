import { PgId } from '../postgres/compat.js';
import { Controller, Module, Post, Body, Param, Headers, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectPgModel, PgModelsModule } from '../postgres/compat.js';
import { type Model } from '../postgres/compat.js';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { Word, WordSchema } from '../modules/vocabulary/words/word.schema.js';
import { Question, QuestionSchema } from '../modules/assessment/questions/schemas/question.schema.js';
import { Passage, PassageSchema } from '../modules/assessment/questions/schemas/passage.schema.js';

function authorized(token?: string): void {
  const expected = process.env.INTERNAL_SERVICE_TOKEN || '';
  if (expected.length < 24 || !token || token.length !== expected.length ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    throw new ForbiddenException('Internal service credentials required');
  }
}
function audioUpdate(body: unknown, allowed: string[]) {
  const update = body as { $set?: Record<string,unknown> };
  if (!update || typeof update !== 'object' || !update.$set || typeof update.$set !== 'object') {
    throw new BadRequestException('Only $set audio updates are accepted');
  }
  const fields = Object.keys(update.$set);
  if (!fields.length || fields.some(field => !allowed.some(prefix => field === prefix || field.startsWith(prefix+'.')))) {
    throw new BadRequestException('Only audio metadata fields may be updated');
  }
  if (fields.some(field => field.includes('$') || field.split('.').some(part => part === '__proto__' || part === 'constructor'))) {
    throw new BadRequestException('Invalid update key');
  }
  return {$set:update.$set};
}
function validId(id:string) {
  if (!PgId.isValid(id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid UUID');
  return new PgId(id);
}

@Controller('_internal/content/audio')
export class ContentAudioOwnerController {
  constructor(@InjectPgModel(Word.name) private readonly words: Model<Word>) {}
  @Public()
  @Post('words/:id')
  async sync(@Headers('x-internal-token') token: string, @Param('id') id: string, @Body() input:unknown) {
    authorized(token);
    const result = await this.words.findOneAndUpdate({_id:validId(id), isDeleted:{$ne:true}},
      audioUpdate(input,['audio','audioMeta']), {returnDocument:'after'}).lean();
    if (!result) throw new NotFoundException('Word missing');
    return {ok:true,id:String(result._id)};
  }
}

@Controller('_internal/assessment/audio')
export class AssessmentAudioOwnerController {
  constructor(@InjectPgModel(Question.name) private readonly questions: Model<Question>,
              @InjectPgModel(Passage.name) private readonly passages: Model<Passage>) {}
  @Public()
  @Post('questions/:id')
  async question(@Headers('x-internal-token') token:string, @Param('id') id:string, @Body() input:unknown) {
    authorized(token);
    const result = await this.questions.updateOne({_id:validId(id)},audioUpdate(input,['audioUrl','audioMeta']));
    if (!result.matchedCount) throw new NotFoundException('Question missing');
    return {ok:true};
  }
  @Public()
  @Post('passages/:id')
  async passage(@Headers('x-internal-token') token:string, @Param('id') id:string, @Body() input:unknown) {
    authorized(token);
    const result = await this.passages.updateOne({_id:validId(id)},audioUpdate(input,['audioUrl','audioMeta']));
    if (!result.matchedCount) throw new NotFoundException('Passage missing');
    return {ok:true};
  }
}

@Module({imports:[PgModelsModule.forFeature([{name:Word.name,schema:WordSchema}])], controllers:[ContentAudioOwnerController]})
export class ContentAudioOwnerModule {}
@Module({imports:[PgModelsModule.forFeature([{name:Question.name,schema:QuestionSchema},{name:Passage.name,schema:PassageSchema}])], controllers:[AssessmentAudioOwnerController]})
export class AssessmentAudioOwnerModule {}
