import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsUUID,
} from 'class-validator';
import { timingSafeEqual } from 'node:crypto';
import type { MistakeDetail, MistakeSource } from '@repo/shared-types/mistakes';
import { InjectPgConnection, type PgConnection } from '../postgres/compat.js';
import { serviceRole } from '../postgres/ownership.js';
import { Public } from '../modules/auth/decorators/public.decorator.js';

export class MistakeResolveDto {
  @IsUUID() userId: string;
  @IsIn(['TOEIC', 'DICTATION', 'VOCABULARY']) sourceType: MistakeSource;
  @IsUUID() sourceItemId: string;
  @IsUUID() sourceRefId: string;
}
export class VocabularyTitlesDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  wordIds: string[];
}
function authorize(token: string, roles: string[]) {
  const expected = Buffer.from(process.env.INTERNAL_SERVICE_TOKEN ?? '');
  const actual = Buffer.from(token ?? '');
  if (
    !roles.includes(serviceRole() ?? '') ||
    expected.length < 24 ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  )
    throw new ForbiddenException();
}
@Controller('_internal/mistakes')
export class MistakeSourceController {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}

  @Public()
  @Post('vocabulary-titles')
  async titles(
    @Headers('x-internal-token') token: string,
    @Body() input: VocabularyTitlesDto,
  ) {
    authorize(token, ['content']);
    const { rows } = await this.db.query(
      "SELECT id, word FROM public.words WHERE id = ANY($1::uuid[]) AND publication_status='PUBLISHED' AND is_active IS NOT FALSE AND is_deleted IS NOT TRUE",
      [input.wordIds],
    );
    return Object.fromEntries(rows.map((row) => [row.id, row.word]));
  }

  @Public()
  @Post('resolve')
  async resolve(
    @Headers('x-internal-token') token: string,
    @Body() input: MistakeResolveDto,
  ): Promise<MistakeDetail & { word?: Record<string, unknown> }> {
    authorize(
      token,
      input.sourceType === 'TOEIC' ? ['assessment'] : ['content'],
    );
    if (input.sourceType === 'TOEIC') {
      const { rows } = await this.db.query(
        `SELECT a.question_snapshot, a.answers, e.slug, g.slug AS group_slug,
        EXISTS(SELECT 1 FROM public.questions q WHERE q.id=$3 AND q.exam_id=e.id AND q.is_active IS NOT FALSE) AS live_question,
        e.publication_status, e.is_active, e.is_deleted, g.is_active AS group_active, g.is_deleted AS group_deleted
        FROM public.attempts a LEFT JOIN public.exams e ON e.id=a.exam_id
        LEFT JOIN public.examgroups g ON g.id=e.group_id
        WHERE a.id=$1 AND a.user_id=$2 AND a.status IN ('FINISHED','COMPLETED')`,
        [input.sourceRefId, input.userId, input.sourceItemId],
      );
      const row = rows[0];
      const q = row?.question_snapshot?.find(
        (item: { _id: string }) => item._id === input.sourceItemId,
      );
      if (!q || !row.slug || row.is_deleted) return { available: false };
      return {
        available: true,
        title: q.content || `TOEIC Part ${q.part}`,
        correctAnswer: q.correctAnswer,
        selectedAnswer: row.answers?.[input.sourceItemId],
        explanation: q.explanation || q.transcript || '',
        reviewUrl: `/toeic/attempts/${input.sourceRefId}/result#result-question-${input.sourceItemId}`,
        actionUrl:
          row.live_question &&
          row.publication_status === 'PUBLISHED' && row.is_active &&
          row.group_active &&
          !row.group_deleted &&
          row.group_slug
            ? `/toeic/${row.group_slug}/${row.slug}?practicePart=${q.part}`
            : undefined,
      };
    }
    if (input.sourceType === 'DICTATION') {
      const { rows } = await this.db.query(
        `SELECT s.text,s."order",l.slug FROM public.dictationsegments s
        JOIN public.dictationlessons l ON l.id=s.lesson_id
        JOIN public.dictationprogresses p ON p.lesson_id=l.id AND p.user_id=$1 AND p.completed IS TRUE
        WHERE s.id=$2 AND l.id=$3 AND l.status='PUBLISHED' AND l.publication_status='PUBLISHED' AND l.is_deleted IS NOT TRUE`,
        [input.userId, input.sourceItemId, input.sourceRefId],
      );
      const row = rows[0];
      return row
        ? {
            available: true,
            title: row.text,
            explanation: row.text,
            actionUrl: `/dictation/${row.slug}?segment=${row.order}`,
          }
        : { available: false };
    }
    const { rows } = await this.db.query(
      `SELECT id,word,parts,ipa,audio,image,level,slug FROM public.words
      WHERE id=$1 AND publication_status='PUBLISHED' AND is_active IS NOT FALSE AND is_deleted IS NOT TRUE`,
      [input.sourceItemId],
    );
    const row = rows[0];
    if (!row) return { available: false };
    const meanings = (row.parts ?? []).flatMap(
      (part: {
        meanings?: { definition?: string; translation?: string[] }[];
      }) => part.meanings ?? [],
    );
    return {
      available: true,
      title: row.word,
      explanation: meanings
        .map((meaning: { definition?: string; translation?: string[] }) =>
          [...(meaning.translation ?? []), meaning.definition]
            .filter(Boolean)
            .join(' · '),
        )
        .join('\n'),
      word: {
        _id: row.id,
        word: row.word,
        parts: row.parts,
        ipa: row.ipa,
        audio: row.audio,
        image: row.image,
        level: row.level,
        slug: row.slug,
      },
    };
  }
}
