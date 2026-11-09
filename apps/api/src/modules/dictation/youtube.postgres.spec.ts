import { describe, it, expect } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {plainToInstance} from 'class-transformer';
import {UpdateDictationDto} from './dto/update-dictation.dto.js';
import { randomUUID } from 'node:crypto';
import { databaseSuite } from '../../../test/native-database.js';
import { DictationService } from './dictation.service.js';
import { gradeDictation, youtubeVideoId } from './youtube.js';
import { DomainOutboxService } from '../../common/events/domain-outbox.service.js';
import { PublicationService } from '../publication/publication.service.js';
const suite = databaseSuite('content');
const service = () =>
  new DictationService(
    suite.db,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    new ConfigService(),
    undefined,
    new DomainOutboxService(suite.db),
    new PublicationService(suite.db),
  );
const body = () =>
  ({
    title: 'YouTube listening',
    level: 'B1',
    youtubeUrl: 'https://youtu.be/2Yk1M6URsCU',
    segments: [
      { order: 0, text: 'Good morning.', startMs: 1000, endMs: 3000 },
      { order: 1, text: 'Please take a seat.', startMs: 3500, endMs: 6000 },
    ],
  }) as any;
describe('YouTube dictation', () => {
  it('accepts only real YouTube video URLs', () => {
    for (const url of [
      'https://youtu.be/2Yk1M6URsCU',
      'https://youtube.com/watch?v=2Yk1M6URsCU&t=2',
      'https://www.youtube.com/shorts/2Yk1M6URsCU',
    ])
      expect(youtubeVideoId(url)).toBe('2Yk1M6URsCU');
    for (const url of [
      'http://localhost/video',
      'https://youtube.com.evil.test/watch?v=2Yk1M6URsCU',
      'javascript:alert(1)',
      'https://youtube.com/watch?v=bad',
    ])
      expect(() => youtubeVideoId(url)).toThrow();
  });
  it('grades words with case/punctuation normalization and penalties for additions', () => {
    expect(gradeDictation('Good morning!', 'GOOD morning.').score).toBe(100);
    expect(
      gradeDictation('Please take a seat.', 'Please take seat').score,
    ).toBe(75);
    expect(gradeDictation('Good morning', 'Good morning extra').isCorrect).toBe(
      false,
    );
    expect(gradeDictation('Good morning', '').score).toBe(0);
  });
  it('saves an atomic draft, permits caption edits and checks published answers on the server', async () => {
    const svc = service(),
      lesson = await svc.createYoutube(body());
    expect(lesson.audioSource).toBe('YOUTUBE');
    expect(lesson.publicationStatus).toBe('DRAFT');
    expect(lesson.segments).toHaveLength(2);
    expect(lesson.fullAudioUrl).toBe('');
    const metadata=await svc.update(String(lesson._id),plainToInstance(UpdateDictationDto,{title:'Updated YouTube lesson'}));
    expect(metadata.audioSource).toBe('YOUTUBE');expect(metadata.sourceText).toBe(lesson.sourceText);
    const publication = new PublicationService(suite.db),
      actor = randomUUID();
    const validation = await publication.validate(
      'dictation',
      String(lesson._id),
      actor,
    );
    expect(
      validation.publicationValidation.issues.filter(
        (i: any) => i.severity === 'error',
      ),
    ).toEqual([]);
    await publication.publish('dictation', String(lesson._id), actor);
    const result = await svc.recordAnswer(
      randomUUID(),
      String(lesson._id),
      0,
      'good morning',
    );
    expect(result.grading.score).toBe(100);
    await expect(
      svc.recordAttempt(randomUUID(), String(lesson._id), 0, true),
    ).rejects.toThrow();
    const wrong = await svc.recordAnswer(
      randomUUID(),
      String(lesson._id),
      1,
      'Please seat',
    );
    expect(wrong.grading.score).toBe(50);
    const edited = await svc.updateSegments(
      String(lesson._id),
      body().segments,
    );
    expect(edited.segments).toHaveLength(2);
  });
  it('rejects empty/overlapping captions without creating a lesson', async () => {
    const request = body();
    request.segments[1].startMs = 2000;
    await expect(service().createYoutube(request)).rejects.toThrow();
    expect(await suite.records('dictationlessons').select()).toHaveLength(0);
  });
  it('records a word hint without revealing the sentence or crediting an unassisted first try',async()=>{
    const svc=service(),lesson=await svc.createYoutube(body()),user=randomUUID();
    const publication=new PublicationService(suite.db),actor=randomUUID();
    await publication.validate('dictation',String(lesson._id),actor);
    await publication.publish('dictation',String(lesson._id),actor);
    const hint=await svc.recordHint(user,String(lesson._id),0);
    expect(hint.revealedSegments||[]).toEqual([]);
    expect(hint.completedSegments||[]).toEqual([]);
    const result=await svc.recordAnswer(user,String(lesson._id),0,'good morning');
    expect(result.grading.score).toBe(100);
    expect(result.segmentProgress[0].firstTryCorrect).toBe(false);
    expect((result.segmentProgress[0] as any).hinted).toBe(true);
    await expect(svc.recordHint(user,String(lesson._id),99)).rejects.toThrow();
  });
});
