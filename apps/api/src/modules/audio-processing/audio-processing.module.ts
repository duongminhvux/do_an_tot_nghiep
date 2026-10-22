import { Module } from '@nestjs/common';
import { Schema } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { TtsModule } from '../tts/tts.module.js';
import { Word, WordSchema } from '../vocabulary/words/word.schema.js';
import { Question, QuestionSchema } from '../assessment/questions/schemas/question.schema.js';
import { Passage, PassageSchema } from '../assessment/questions/schemas/passage.schema.js';
import { PassageGroup, PassageGroupSchema } from '../assessment/questions/schemas/passage-group.schema.js';
import { AudioProcessingService } from './audio-processing.service.js';
import { AudioQueueService } from './audio-queue.service.js';
import { AdminAudioController } from './admin-audio.controller.js';
import { AdminInfrastructureController } from './admin-infrastructure.controller.js';

/** Writes generated audio to the owning service before updating local read projections.
 * The hook is installed only on media-jobs models, not on Content/Assessment.
 */
function ownedAudioSchema(source: Schema, resource: 'words'|'questions'|'passages'): Schema {
  const schema = source.clone();
  for (const operation of ['findOneAndUpdate','updateOne'] as const) {
    schema.pre(operation, async function(this: any) {
      const update = this.getUpdate() as any;
      if (!update?.$set || Object.keys(update.$set).length===0) return;
      const filter = this.getFilter();
      const token = process.env.INTERNAL_SERVICE_TOKEN || '';
      if (token.length < 24) throw new Error('INTERNAL_SERVICE_TOKEN not configured');
      const base = resource==='words' ? process.env.CONTENT_INTERNAL_URL : process.env.ASSESSMENT_INTERNAL_URL;
      const namespace = resource==='words' ? 'content' : 'assessment';
      if (!base || !filter?._id) throw new Error('Cannot propagate media audio update without owner URL / _id');
      const response = await fetch(`${base}/api/_internal/${namespace}/audio/${resource}/${String(filter._id)}`, {
        method:'POST',headers:{'content-type':'application/json','x-internal-token':token},
        body:JSON.stringify({$set:update.$set}),signal:AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Authoritative ${resource} write rejected: ${response.status}`);
    });
  }
  return schema;
}

@Module({
  imports: [
    TtsModule,
    MongooseModule.forFeature([
      { name: Word.name, schema: ownedAudioSchema(WordSchema, 'words') },
      { name: Question.name, schema: ownedAudioSchema(QuestionSchema, 'questions') },
      { name: Passage.name, schema: ownedAudioSchema(PassageSchema, 'passages') },
      { name: PassageGroup.name, schema: PassageGroupSchema },
    ]),
  ],
  controllers: [AdminAudioController, AdminInfrastructureController],
  providers: [AudioProcessingService, AudioQueueService],
  exports: [AudioProcessingService, AudioQueueService],
})
export class AudioProcessingModule {}
