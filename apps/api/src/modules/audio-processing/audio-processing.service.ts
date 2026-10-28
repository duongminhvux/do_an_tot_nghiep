import { assessmentRows } from '../assessment/assessment-reader.js';
import { contentRows } from '../vocabulary/content-reader.js';
/// <reference types="multer" />
import { BadRequestException,Injectable,NotFoundException,ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash,randomUUID } from 'node:crypto';
import { updateAudio } from '../../common/media/audio-sql.js';
import { AudioGenerationStatus,AudioSourceType,GeneratedAudioMetadata } from '../../common/media/generated-audio.row.js';
import { MediaStorageService } from '../../common/media/media-storage.service.js';
import { InjectPgConnection,type PgConnection } from '../../postgres/connection.js';
import { serviceRole,serviceUrl } from '../../postgres/ownership.js';
import { QuestionRow } from '../assessment/questions/rows/question.row.js';
import { TtsService } from '../tts/tts.service.js';

export type VocabularyAccent = 'us' | 'uk';

interface SequenceSegmentInput {
  text: string;
  speaker?: string;
  voiceId: string;
  language: 'en-US' | 'en-GB';
  speed: number;
  pauseAfterMs: number;
}

@Injectable()
export class AudioProcessingService {
  constructor(
    private readonly ttsService: TtsService,
    private readonly mediaStorage: MediaStorageService,
    private readonly configService: ConfigService,
    @InjectPgConnection() private readonly connection: PgConnection,
  ) {}

  voices() {
    return this.ttsService.voices();
  }

  /** Media workers submit narrow audio commands; only the owner writes business rows. */
  private async writeAudio(resource:'words'|'questions'|'passages',id:unknown,update:{fields:Record<string,unknown>}) {
    const owner=resource==='words'?'content':'assessment';
    if(serviceRole()===owner)return updateAudio(this.connection,resource,String(id),update.fields);
    const token=this.configService.get<string>('INTERNAL_SERVICE_TOKEN');
    if(!token||token.length<24)throw new ServiceUnavailableException('Audio owner authentication not configured');
    const response=await fetch(`${serviceUrl(owner)}/api/_internal/${owner}/audio/${resource}/${String(id)}`,{
      method:'POST',headers:{'content-type':'application/json','x-internal-token':token},
      body:JSON.stringify(update),signal:AbortSignal.timeout(10000),
    });
    if(response.status===404)throw new NotFoundException('Audio owner record missing');
    if(!response.ok)throw new ServiceUnavailableException(`Audio owner ${owner} rejected update (${response.status})`);
    return (resource==='words'?await contentRows(this.connection,'words',{ids:[String(id)],limit:1}):await assessmentRows(this.connection,resource,{ids:[String(id)],limit:1}))[0]??null;
  }

  private envNumber(key: string, fallback: number): number {
    const parsed = Number(this.configService.get<string>(key));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private audioMeta(
    storageKey: string,
    language: 'en-US' | 'en-GB',
    voiceIds: string[],
    speed: number,
    scriptHash: string,
    result: Awaited<ReturnType<TtsService['synthesizeSequence']>>,
    segments: SequenceSegmentInput[],
  ): GeneratedAudioMetadata {
    const timings = result.segmentTimingsMs || [];
    return {
      source: AudioSourceType.TTS,
      status: AudioGenerationStatus.READY,
      storageKey,
      provider: result.provider || 'kokoro',
      device: result.device || '',
      language,
      voiceIds,
      speed,
      durationMs: Number(result.durationMs || 0),
      scriptHash,
      generatedAt: new Date(),
      error: '',
      segments: segments.map((segment, index) => ({
        text: segment.text,
        speaker: segment.speaker || '',
        voiceId: segment.voiceId,
        startMs: timings[index]?.startMs || 0,
        endMs: timings[index]?.endMs || 0 })) };
  }

  private singleAudioMeta(
    storageKey: string,
    language: 'en-US' | 'en-GB',
    voiceId: string,
    speed: number,
    scriptHash: string,
    result: Awaited<ReturnType<TtsService['synthesize']>>,
  ): GeneratedAudioMetadata {
    return {
      source: AudioSourceType.TTS,
      status: AudioGenerationStatus.READY,
      storageKey,
      provider: result.provider || 'kokoro',
      device: result.device || '',
      language,
      voiceIds: [voiceId],
      speed,
      durationMs: Number(result.durationMs || 0),
      scriptHash,
      generatedAt: new Date(),
      error: '',
      segments: [{
        text: '',
        speaker: '',
        voiceId,
        startMs: 0,
        endMs: Number(result.durationMs || 0) }] };
  }


  private uploadedMeta(storageKey: string, scriptHash: string): GeneratedAudioMetadata {
    return {
      source: AudioSourceType.UPLOAD,
      status: AudioGenerationStatus.READY,
      storageKey,
      provider: 'upload',
      device: '',
      voiceIds: [],
      speed: 1,
      durationMs: 0,
      scriptHash,
      generatedAt: new Date(),
      error: '',
      segments: [] };
  }

  private extensionFromFile(file: Express.Multer.File, fallback = 'audio'): string {
    const extension = file.originalname?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
    return extension || fallback;
  }

  private async cleanupReplacedLocalAudio(
    previousUrl: string | undefined,
    previousStorageKey: string | undefined,
    nextStorageKey: string,
  ) {
    const oldKey = previousStorageKey || this.mediaStorage.storageKeyFromPublicUrl(previousUrl);
    if (oldKey && oldKey !== nextStorageKey) {
      await this.mediaStorage.delete(oldKey).catch(() => undefined);
    }
  }

  async uploadVocabularyAudio(wordId: string, accent: VocabularyAccent, file: Express.Multer.File) {
    const word = await contentRows(this.connection,'words',{ids:[String(wordId)],limit:1}).then(records=>records[0]??null);
    if (!word) throw new NotFoundException('Vocabulary word not found.');
    if (!file?.buffer?.length) throw new BadRequestException('Audio file is required.');
    const ext = this.extensionFromFile(file);
    const storageKey = `vocab/${word._id.toString()}/${accent}-${randomUUID()}.${ext}`;
    const stored = await this.mediaStorage.saveBuffer(storageKey, file.buffer);
    const meta = this.uploadedMeta(storageKey, this.hash({ word: word.word, accent }));
    const updated = await this.writeAudio('words',word._id, {
      fields: { [`audio.${accent}`]: stored.url, [`audioMeta.${accent}`]: meta } });
    await this.cleanupReplacedLocalAudio(word.audio?.[accent], word.audioMeta?.[accent]?.storageKey, storageKey);
    return updated;
  }

  async uploadToeicQuestionAudio(questionId: string, file: Express.Multer.File) {
    const question = await assessmentRows(this.connection,'questions',{ids:[String(questionId)],limit:1}).then(records=>records[0]??null);
    if (!question) throw new NotFoundException('TOEIC question not found.');
    if (![1, 2].includes(Number(question.part))) throw new BadRequestException('Question audio upload is only supported for Part 1 and Part 2.');
    if (!file?.buffer?.length) throw new BadRequestException('Audio file is required.');
    const ext = this.extensionFromFile(file);
    const storageKey = `toeic/questions/${question._id.toString()}/audio-${randomUUID()}.${ext}`;
    const stored = await this.mediaStorage.saveBuffer(storageKey, file.buffer);
    const meta = this.uploadedMeta(storageKey, this.hash({ part: question.part, content: question.content, options: question.options }));
    const updated = await this.writeAudio('questions',question._id, { fields: { audioUrl: stored.url, audioMeta: meta } });
    await this.cleanupReplacedLocalAudio(question.audioUrl, question.audioMeta?.storageKey, storageKey);
    return updated;
  }

  async uploadToeicPassageAudio(passageId: string, file: Express.Multer.File) {
    const passage = await assessmentRows(this.connection,'passages',{ids:[String(passageId)],limit:1}).then(records=>records[0]??null);
    if (!passage) throw new NotFoundException('TOEIC passage not found.');
    const group = await assessmentRows(this.connection,'passagegroups',{ids:[String(passage.passageGroupId)],limit:1}).then(records=>records[0]??null);
    if (!group || ![3, 4].includes(Number(group.part))) throw new BadRequestException('Passage audio upload is only supported for Part 3 and Part 4.');
    if (!file?.buffer?.length) throw new BadRequestException('Audio file is required.');
    const ext = this.extensionFromFile(file);
    const storageKey = `toeic/passages/${passage._id.toString()}/audio-${randomUUID()}.${ext}`;
    const stored = await this.mediaStorage.saveBuffer(storageKey, file.buffer);
    const meta = this.uploadedMeta(storageKey, this.hash({ part: group.part, content: passage.content || '' }));
    const updated = await this.writeAudio('passages',passage._id, { fields: { audioUrl: stored.url, audioMeta: meta } });
    await this.cleanupReplacedLocalAudio(passage.audioUrl, passage.audioMeta?.storageKey, storageKey);
    return updated;
  }

  async generateVocabularyAudio(wordId: string, accent: VocabularyAccent, voiceOverride?: string) {
    const word = await contentRows(this.connection,'words',{ids:[String(wordId)],limit:1}).then(records=>records[0]??null);
    if (!word) throw new NotFoundException('Vocabulary word not found.');

    const isUk = accent === 'uk';
    const language: 'en-US' | 'en-GB' = isUk ? 'en-GB' : 'en-US';
    const voiceId = voiceOverride || this.configService.get<string>(isUk ? 'VOCAB_TTS_UK_VOICE' : 'VOCAB_TTS_US_VOICE') || (isUk ? 'bf_emma' : 'af_heart');
    const speed = this.envNumber('VOCAB_TTS_SPEED', 1);
    const script = word.word.trim();
    if (!script) throw new BadRequestException('Word text is empty.');
    const scriptHash = this.hash({ script, language, voiceId, speed });
    const metadataPath = `audioMeta.${accent}`;

    await this.writeAudio('words',word._id, {
      fields: {
        [`${metadataPath}.source`]: AudioSourceType.TTS,
        [`${metadataPath}.status`]: AudioGenerationStatus.PROCESSING,
        [`${metadataPath}.error`]: '' } });

    try {
      const result = await this.ttsService.synthesize({ text: script, language, voiceId, speed });
      const storageKey = `vocab/${word._id.toString()}/${accent}-${randomUUID()}.wav`;
      const stored = await this.mediaStorage.saveBuffer(storageKey, result.audio);
      const meta = this.singleAudioMeta(storageKey, language, voiceId, speed, scriptHash, result);
      meta.segments = [{ text: script, speaker: '', voiceId, startMs: 0, endMs: Number(result.durationMs || 0) }];

      const updated = await this.writeAudio('words',word._id, {
        fields: {
          [`audio.${accent}`]: stored.url,
          [metadataPath]: meta } });
      await this.cleanupReplacedLocalAudio(word.audio?.[accent], word.audioMeta?.[accent]?.storageKey, storageKey);
      return updated;
    } catch (error) {
      await this.writeAudio('words',word._id, {
        fields: {
          [`${metadataPath}.status`]: AudioGenerationStatus.FAILED,
          [`${metadataPath}.error`]: error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  }

  private part12Sequence(question: QuestionRow, primaryVoice?: string, secondaryVoice?: string): SequenceSegmentInput[] {
    const part = Number(question.part);
    const speed = this.envNumber('TOEIC_TTS_SPEED', 1);
    const pause = Math.max(0, this.envNumber('TOEIC_TTS_OPTION_PAUSE_MS', 650));
    const primary = primaryVoice || this.configService.get<string>(part === 2 ? 'TOEIC_P2_PROMPT_VOICE' : 'TOEIC_P1_VOICE') || (part === 2 ? 'am_adam' : 'af_heart');
    const secondary = secondaryVoice || this.configService.get<string>('TOEIC_P2_RESPONSE_VOICE') || 'af_heart';
    const content = question.content?.trim() || '';
    const labels = [...content.matchAll(/(?:^|\n)[ \t]*\(?([A-D])\)[ \t]*/g)];
    const scriptOptions = labels.map((label, i) => ({
      key: label[1],
      text: content.slice(label.index! + label[0].length, labels[i + 1]?.index ?? content.length).trim() }));
    if (labels.length) {
      const expected = part === 2 ? 'ABC' : 'ABCD';
      if (scriptOptions.map(o => o.key).join('') !== expected || scriptOptions.some(o => !o.text)) {
        throw new BadRequestException(`Part ${part} script must contain ${expected.split('').join('/')} statements.`);
      }
    }

    if (part === 1) {
      const options = labels.length ? scriptOptions : (question.options || []).filter((item) => item.text?.trim());
      if (!options.length) throw new BadRequestException('Part 1 question has no statements to synthesize.');
      return options.map((option, index) => ({
        text: option.text.trim(),
        speaker: 'Narrator',
        voiceId: primary,
        language: 'en-US',
        speed,
        pauseAfterMs: index === options.length - 1 ? 0 : pause }));
    }

    if (part === 2) {
      if (!question.content?.trim()) throw new BadRequestException('Part 2 question text is empty.');
      const responses = labels.length ? scriptOptions : (question.options || []).filter((item) => item.text?.trim());
      const prompt = labels.length ? content.slice(0, labels[0]!.index).trim() : content;
      if (!prompt) throw new BadRequestException('Part 2 question text is empty.');
      return [
        { text: prompt, speaker: 'Prompt', voiceId: primary, language: 'en-US', speed, pauseAfterMs: pause },
        ...responses.map((option, index) => ({
          text: option.text.trim(),
          speaker: 'Response',
          voiceId: secondary,
          language: 'en-US' as const,
          speed,
          pauseAfterMs: index === responses.length - 1 ? 0 : pause })),
      ];
    }

    throw new BadRequestException('Question TTS is only supported for TOEIC Part 1 and Part 2.');
  }

  async generateToeicQuestionAudio(questionId: string, primaryVoice?: string, secondaryVoice?: string) {
    const question = await assessmentRows(this.connection,'questions',{ids:[String(questionId)],limit:1}).then(records=>records[0]??null);
    if (!question) throw new NotFoundException('TOEIC question not found.');
    if (![1, 2].includes(Number(question.part))) {
      throw new BadRequestException('Question-level TTS only supports TOEIC Part 1 and Part 2.');
    }

    const sequence = this.part12Sequence(question, primaryVoice, secondaryVoice);
    const scriptHash = this.hash({ part: question.part, sequence });
    await this.writeAudio('questions',question._id, {
      fields: { 'audioMeta.source': AudioSourceType.TTS, 'audioMeta.status': AudioGenerationStatus.PROCESSING, 'audioMeta.error': '' } });

    try {
      const result = await this.ttsService.synthesizeSequence({
        segments: sequence,
        defaultVoiceId: sequence[0]!.voiceId,
        defaultLanguage: 'en-US',
        defaultSpeed: sequence[0]!.speed });
      const storageKey = `toeic/questions/${question._id.toString()}/audio-${randomUUID()}.wav`;
      const stored = await this.mediaStorage.saveBuffer(storageKey, result.audio);
      const meta = this.audioMeta(storageKey, 'en-US', [...new Set(sequence.map((item) => item.voiceId))], sequence[0]!.speed, scriptHash, result, sequence);
      const updated = await this.writeAudio('questions',question._id, { fields: { audioUrl: stored.url, audioMeta: meta } });
      await this.cleanupReplacedLocalAudio(question.audioUrl, question.audioMeta?.storageKey, storageKey);
      return updated;
    } catch (error) {
      await this.writeAudio('questions',question._id, { fields: { 'audioMeta.status': AudioGenerationStatus.FAILED, 'audioMeta.error': error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  }

  private splitSentences(text: string): string[] {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    return Array.from(segmenter.segment(cleaned), ({ segment }) => segment.trim()).filter(Boolean);
  }

  private conversationSequence(content: string, primaryVoice?: string, secondaryVoice?: string): SequenceSegmentInput[] {
    const speed = this.envNumber('TOEIC_TTS_SPEED', 1);
    const pause = Math.max(0, this.envNumber('TOEIC_TTS_TURN_PAUSE_MS', 350));
    const voices = [
      primaryVoice || this.configService.get<string>('TOEIC_P3_SPEAKER_A_VOICE') || 'am_adam',
      secondaryVoice || this.configService.get<string>('TOEIC_P3_SPEAKER_B_VOICE') || 'af_heart',
      this.configService.get<string>('TOEIC_P3_SPEAKER_C_VOICE') || 'bm_george',
    ];
    const speakerIndex = new Map<string, number>();
    const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const sequence: SequenceSegmentInput[] = [];

    for (const line of lines) {
      const match = line.match(/^([A-Za-z][A-Za-z0-9 _-]{0,20}):\s*(.+)$/);
      const speaker = match?.[1]?.trim() || '';
      const text = (match?.[2] || line).trim();
      if (!text) continue;
      const key = speaker || `speaker-${sequence.length % 2}`;
      if (!speakerIndex.has(key)) speakerIndex.set(key, speakerIndex.size % voices.length);
      const voiceId = voices[speakerIndex.get(key)!] || voices[0]!;
      sequence.push({ text, speaker: speaker || `Speaker ${speakerIndex.get(key)! + 1}`, voiceId, language: voiceId.startsWith('b') ? 'en-GB' : 'en-US', speed, pauseAfterMs: pause });
    }

    if (sequence.length === 1 && !lines[0]?.match(/^([A-Za-z][A-Za-z0-9 _-]{0,20}):/)) {
      const sentences = this.splitSentences(content);
      return sentences.map((text, index) => ({ text, speaker: `Speaker ${(index % 2) + 1}`, voiceId: voices[index % 2]!, language: voices[index % 2]!.startsWith('b') ? 'en-GB' : 'en-US', speed, pauseAfterMs: index === sentences.length - 1 ? 0 : pause }));
    }

    if (sequence.length) sequence[sequence.length - 1]!.pauseAfterMs = 0;
    return sequence;
  }

  private talkSequence(content: string, voiceOverride?: string): SequenceSegmentInput[] {
    const speed = this.envNumber('TOEIC_TTS_SPEED', 1);
    const pause = Math.max(0, this.envNumber('TOEIC_TTS_SENTENCE_PAUSE_MS', 260));
    const voiceId = voiceOverride || this.configService.get<string>('TOEIC_P4_VOICE') || 'bf_emma';
    const language: 'en-US' | 'en-GB' = voiceId.startsWith('b') ? 'en-GB' : 'en-US';
    const sentences = this.splitSentences(content);
    return sentences.map((text, index) => ({ text, speaker: 'Narrator', voiceId, language, speed, pauseAfterMs: index === sentences.length - 1 ? 0 : pause }));
  }

  async generateToeicPassageAudio(passageId: string, primaryVoice?: string, secondaryVoice?: string) {
    const passage = await assessmentRows(this.connection,'passages',{ids:[String(passageId)],limit:1}).then(records=>records[0]??null);
    if (!passage) throw new NotFoundException('TOEIC passage not found.');
    const group = await assessmentRows(this.connection,'passagegroups',{ids:[String(passage.passageGroupId)],limit:1}).then(records=>records[0]??null);
    if (!group) throw new NotFoundException('Passage group not found.');
    if (![3, 4].includes(Number(group.part))) throw new BadRequestException('Passage TTS only supports TOEIC Part 3 and Part 4.');
    if (!passage.content?.trim()) throw new BadRequestException('Transcript is empty.');

    const sequence = Number(group.part) === 3
      ? this.conversationSequence(passage.content, primaryVoice, secondaryVoice)
      : this.talkSequence(passage.content, primaryVoice);
    if (!sequence.length) throw new BadRequestException('No speakable transcript segments were found.');

    const scriptHash = this.hash({ part: group.part, sequence });
    await this.writeAudio('passages',passage._id, {
      fields: { 'audioMeta.source': AudioSourceType.TTS, 'audioMeta.status': AudioGenerationStatus.PROCESSING, 'audioMeta.error': '' } });

    try {
      const result = await this.ttsService.synthesizeSequence({
        segments: sequence,
        defaultVoiceId: sequence[0]!.voiceId,
        defaultLanguage: sequence[0]!.language,
        defaultSpeed: sequence[0]!.speed });
      const storageKey = `toeic/passages/${passage._id.toString()}/audio-${randomUUID()}.wav`;
      const stored = await this.mediaStorage.saveBuffer(storageKey, result.audio);
      const voices = [...new Set(sequence.map((item) => item.voiceId))];
      const meta = this.audioMeta(storageKey, sequence[0]!.language, voices, sequence[0]!.speed, scriptHash, result, sequence);
      const updated = await this.writeAudio('passages',passage._id, { fields: { audioUrl: stored.url, audioMeta: meta } });
      await this.cleanupReplacedLocalAudio(passage.audioUrl, passage.audioMeta?.storageKey, storageKey);
      return updated;
    } catch (error) {
      await this.writeAudio('passages',passage._id, { fields: { 'audioMeta.status': AudioGenerationStatus.FAILED, 'audioMeta.error': error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  }

  async generateVocabularyBatch(ids: string[], accent: 'us' | 'uk' | 'both', onProgress?: (progress: any) => Promise<void> | void) {
    const accents: VocabularyAccent[] = accent === 'both' ? ['us', 'uk'] : [accent];
    const total = ids.length * accents.length;
    let processed = 0;
    let succeeded = 0;
    const failures: Array<{ id: string; accent: string; error: string }> = [];
    for (const id of ids) {
      for (const itemAccent of accents) {
        try {
          await this.generateVocabularyAudio(id, itemAccent);
          succeeded += 1;
        } catch (error) {
          failures.push({ id, accent: itemAccent, error: error instanceof Error ? error.message : String(error) });
        }
        processed += 1;
        await onProgress?.({ processed, total, succeeded, failed: failures.length, currentId: id, accent: itemAccent });
      }
    }
    return { total, processed, succeeded, failed: failures.length, failures };
  }

  async generateToeicExamBatch(examId: string, parts: number[] = [1, 2, 3, 4], onProgress?: (progress: any) => Promise<void> | void) {
    const normalizedParts = [...new Set(parts.map(Number).filter((part) => [1, 2, 3, 4].includes(part)))];
    const questions = normalizedParts.some((p) => [1, 2].includes(p))
      ? await assessmentRows(this.connection,'questions',{examIds:[examId],parts:normalizedParts.filter(p=>[1,2].includes(p)),orderBy:'order',limit:2000})
      : [];
    const groups = normalizedParts.some((p) => [3, 4].includes(p))
      ? await assessmentRows(this.connection,'passagegroups',{examIds:[examId],parts:normalizedParts.filter(p=>[3,4].includes(p)),limit:2000})
      : [];
    const passages = groups.length
      ? await assessmentRows(this.connection,'passages',{passageGroupIds:groups.map(g=>g._id),orderBy:'order',limit:2000})
      : [];
    // Batch generation intentionally preserves existing ready/manual audio.
    // It only fills missing audio or regenerates TTS items that were marked stale/failed.
    const shouldGenerate = (item: any) => {
      const source = item?.audioMeta?.source;
      const status = item?.audioMeta?.status;
      if (source === AudioSourceType.UPLOAD && item?.audioUrl) return false;
      if (status === AudioGenerationStatus.READY && item?.audioUrl) return false;
      if (!status && item?.audioUrl) return false; // legacy/manual URL without metadata
      return true;
    };
    const tasks = [
      ...questions.filter(shouldGenerate).map((q) => ({ type: 'question' as const, id: q._id.toString() })),
      ...passages.filter(shouldGenerate).map((p) => ({ type: 'passage' as const, id: p._id.toString() })),
    ];
    let processed = 0;
    let succeeded = 0;
    const failures: Array<{ type: string; id: string; error: string }> = [];
    for (const task of tasks) {
      try {
        if (task.type === 'question') await this.generateToeicQuestionAudio(task.id);
        else await this.generateToeicPassageAudio(task.id);
        succeeded += 1;
      } catch (error) {
        failures.push({ ...task, error: error instanceof Error ? error.message : String(error) });
      }
      processed += 1;
      await onProgress?.({ processed, total: tasks.length, succeeded, failed: failures.length, current: task });
    }
    return { total: tasks.length, processed, succeeded, failed: failures.length, failures };
  }
}
