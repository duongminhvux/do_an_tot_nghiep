import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { estimateToeicScore } from '@repo/shared-types/toeic-score';
import {
  InjectPgConnection,
  withPgTransaction,
  type PgConnection,
} from '../../../../postgres/connection.js';
import { isUuid } from '../../../../postgres/ids.js';
import { serviceUrl } from '../../../../postgres/ownership.js';
import {
  COMMENT_EMOJIS,
  type CreateExamCommentDto,
} from './exam-community.dto.js';

@Injectable()
export class ExamCommunityService {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}
  private async names(
    ids: (string | null)[],
  ): Promise<Record<string, string | null>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    const token = process.env.INTERNAL_SERVICE_TOKEN;
    if (!unique.length || !token || token.length < 24) return {};
    try {
      const response = await fetch(
        `${serviceUrl('identity')}/api/_internal/exam-community/profiles`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-token': token,
          },
          body: JSON.stringify({ ids: unique }),
          signal: AbortSignal.timeout(3000),
        },
      );
      if (!response.ok) return {};
      const body = await response.json();
      return body.data ?? body;
    } catch {
      return {};
    }
  }
  private async exam(idOrSlug: string, db = this.db, lock = false) {
    const { rows } = await db.query(
      `SELECT id,publication_revision FROM public.exams
      WHERE ${isUuid(idOrSlug) ? 'id=$1::uuid' : 'slug=$1'} AND type='TOEIC' AND publication_status='PUBLISHED'
        AND is_active IS NOT FALSE AND is_deleted IS NOT TRUE ${lock ? 'FOR SHARE' : ''}`,
      [idOrSlug],
    );
    if (!rows[0]) throw new NotFoundException('Exam not found');
    return rows[0];
  }
  async leaderboard(examId: string, viewer: string, page = 1) {
    const exam = await this.exam(examId);
    // Never trust a client score or rank partial/practice/legacy ungraded data.
    // Compare all current question IDs with the immutable, server-created snapshot.
    const { rows } = await this.db.query(
      `WITH questions AS (
      SELECT id,part FROM public.questions WHERE exam_id=$1 AND is_active IS NOT FALSE
    ), eligible AS (
      SELECT a.*, p.username,ROW_NUMBER() OVER(PARTITION BY a.user_id ORDER BY a.correct_answers DESC,a.duration_spent,a.completed_at,a.id) AS best
      FROM public.attempts a LEFT JOIN public.identity_profiles p ON p.id=a.user_id
      WHERE a.exam_id=$1 AND a.mode='TEST' AND a.status IN ('FINISHED','COMPLETED')
        AND a.result_version IS NOT NULL AND a.completed_at IS NOT NULL
        AND a.total_questions>0 AND a.total_questions=(SELECT count(*) FROM questions)
        AND a.correct_answers BETWEEN 0 AND a.total_questions AND a.duration_spent>=0
        AND p.is_deleted IS NOT TRUE AND p.is_banned IS NOT TRUE
        AND a.exam_publication_revision=$2::integer
        AND jsonb_typeof(a.question_snapshot)='array'
        AND jsonb_array_length(CASE WHEN jsonb_typeof(a.question_snapshot)='array' THEN a.question_snapshot ELSE '[]'::jsonb END)=a.total_questions
        AND NOT EXISTS (SELECT q.id::text FROM questions q EXCEPT
          SELECT s->>'_id' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.question_snapshot)='array' THEN a.question_snapshot ELSE '[]'::jsonb END) s)
        AND jsonb_typeof(a.selected_parts)='array'
        AND NOT EXISTS(SELECT 1 FROM questions q WHERE NOT a.selected_parts @> jsonb_build_array(q.part))
    ), ranked AS (
      SELECT ROW_NUMBER() OVER(ORDER BY correct_answers DESC,duration_spent,completed_at,id)::int AS rank,
        user_id AS "userId",username,correct_answers::int AS correct,total_questions::int AS total,
        duration_spent AS "durationSpent",completed_at AS "completedAt",listening_result,reading_result
      FROM eligible WHERE best=1
    ) SELECT (SELECT count(*)::int FROM ranked) AS total,
      COALESCE((SELECT jsonb_agg(r ORDER BY r.rank) FROM (SELECT * FROM ranked ORDER BY rank LIMIT 20 OFFSET $3) r),'[]') AS items,
      (SELECT to_jsonb(r) FROM ranked r WHERE "userId"=$4::uuid) AS mine`,
      [exam.id, String(exam.publication_revision), (page - 1) * 20, viewer],
    );
    const names = await this.names([
      ...rows[0].items.map((row: any) => row.userId),
      rows[0].mine?.userId,
    ]);
    const publicRow = (row: any) => {
      if (!row) return null;
      const { listening_result, reading_result, ...safe } = row;
      return {
        ...safe,
        username: Object.hasOwn(names, row.userId)
          ? names[row.userId]
          : row.username,
        estimatedScore:
          estimateToeicScore(listening_result, reading_result)?.total ?? null,
        isMe: row.userId === viewer,
      };
    };
    return {
      items: rows[0].items.map(publicRow),
      mine: publicRow(rows[0].mine),
      total: rows[0].total,
      page,
      pageSize: 20,
    };
  }
  async comments(examId: string, viewer: string, page = 1, rootId?: string) {
    const exam = await this.exam(examId);
    if (rootId) {
      const root = await this.db.query(
        `SELECT 1 FROM public.exam_comments WHERE id=$1 AND exam_id=$2 AND root_id IS NULL`,
        [rootId, exam.id],
      );
      if (!root.rows.length) throw new NotFoundException('Comment not found');
    }
    const where = `(($2::uuid IS NOT NULL AND c.root_id=$2::uuid) OR ($2::uuid IS NULL AND c.root_id IS NULL AND (c.deleted_at IS NULL OR EXISTS(SELECT 1 FROM public.exam_comments child WHERE child.root_id=c.id))))`;
    const result = await this.db.query(
      `SELECT c.id,c.root_id AS "rootId",c.reply_to_id AS "replyToId",
      CASE WHEN c.deleted_at IS NULL THEN c.body ELSE NULL END AS body,c.deleted_at IS NOT NULL AS deleted,c.created_at AS "createdAt",
      CASE WHEN c.deleted_at IS NULL THEN c.author_id ELSE NULL END AS "authorId",
      CASE WHEN c.deleted_at IS NULL AND p.is_deleted IS NOT TRUE THEN p.username ELSE NULL END AS username,
      CASE WHEN parent.deleted_at IS NULL THEN parent.author_id ELSE NULL END AS "replyToAuthorId",
      target.username AS "replyToName",c.author_id=$3::uuid AND c.deleted_at IS NULL AS "isMine",
      (SELECT count(*)::int FROM public.exam_comments child WHERE child.root_id=c.id) AS "replyCount",
      COALESCE((SELECT jsonb_object_agg(emoji,n) FROM (SELECT emoji,count(*)::int n FROM public.exam_comment_reactions WHERE comment_id=c.id GROUP BY emoji) counts),'{}') AS reactions,
      (SELECT emoji FROM public.exam_comment_reactions WHERE comment_id=c.id AND user_id=$3::uuid) AS "myReaction"
      FROM public.exam_comments c LEFT JOIN public.identity_profiles p ON p.id=c.author_id
      LEFT JOIN public.exam_comments parent ON parent.id=c.reply_to_id
      LEFT JOIN public.identity_profiles target ON target.id=parent.author_id AND target.is_deleted IS NOT TRUE
      WHERE c.exam_id=$1 AND ${where} ORDER BY c.created_at DESC,c.id DESC LIMIT 20 OFFSET $4`,
      [exam.id, rootId ?? null, viewer, (page - 1) * 20],
    );
    const count = await this.db.query(
      `SELECT count(*)::int AS total FROM public.exam_comments c WHERE c.exam_id=$1 AND ${where}`,
      [exam.id, rootId ?? null],
    );
    const names = await this.names(
      result.rows.flatMap((row) => [row.authorId, row.replyToAuthorId]),
    );
    return {
      items: result.rows.map(({ replyToAuthorId, ...row }) => {
        const item = {
          ...row,
          username:
            row.authorId && Object.hasOwn(names, row.authorId)
              ? names[row.authorId]
              : row.username,
          replyToName: replyToAuthorId
            ? Object.hasOwn(names, replyToAuthorId)
              ? names[replyToAuthorId]
              : row.replyToName
            : null,
        };
        return row.deleted
          ? { ...item, reactions: {}, myReaction: null }
          : item;
      }),
      total: count.rows[0].total,
      page,
      pageSize: 20,
    };
  }
  async post(examId: string, author: string, dto: CreateExamCommentDto) {
    const body = typeof dto.body === 'string' ? dto.body.trim() : '';
    if (!body || body.length > 2000)
      throw new BadRequestException('Invalid comment');
    return withPgTransaction(this.db, async (db) => {
      const exam = await this.exam(examId, db, true);
      await db.query(
        `SELECT pg_advisory_xact_lock(hashtextextended('toeic-comments:'||$1::text,0))`,
        [author],
      );
      const recent = await db.query(
        `SELECT count(*)::int n FROM public.exam_comments WHERE author_id=$1 AND created_at>now()-interval '1 minute'`,
        [author],
      );
      if (recent.rows[0].n >= 10)
        throw new HttpException(
          'Please wait before posting more comments',
          429,
        );
      let root: string | null = null;
      if (dto.replyToId) {
        const parent = (
          await db.query(
            `SELECT id,root_id FROM public.exam_comments WHERE id=$1 AND exam_id=$2 AND deleted_at IS NULL FOR SHARE`,
            [dto.replyToId, exam.id],
          )
        ).rows[0];
        if (!parent) throw new NotFoundException('Comment not found');
        root = parent.root_id ?? parent.id;
      }
      const inserted = await db.query(
        `INSERT INTO public.exam_comments(exam_id,author_id,root_id,reply_to_id,body) VALUES($1,$2,$3,$4,$5) RETURNING id,root_id AS "rootId"`,
        [exam.id, author, root, dto.replyToId ?? null, body],
      );
      return inserted.rows[0];
    });
  }
  async remove(
    examId: string,
    commentId: string,
    actor: string,
    admin = false,
  ) {
    return withPgTransaction(this.db, async (db) => {
      const exam = await this.exam(examId, db, true);
      const comment = (
        await db.query(
          `SELECT author_id FROM public.exam_comments WHERE id=$1 AND exam_id=$2 FOR UPDATE`,
          [commentId, exam.id],
        )
      ).rows[0];
      if (!comment) throw new NotFoundException('Comment not found');
      if (comment.author_id !== actor && !admin) throw new ForbiddenException();
      await db.query(
        `UPDATE public.exam_comments SET deleted_at=COALESCE(deleted_at,now()),body='[deleted]' WHERE id=$1`,
        [commentId],
      );
      await db.query(
        `DELETE FROM public.exam_comment_reactions WHERE comment_id=$1`,
        [commentId],
      );
      return { deleted: true };
    });
  }
  async react(
    examId: string,
    commentId: string,
    actor: string,
    emoji: string | null,
  ) {
    if (emoji !== null && !COMMENT_EMOJIS.includes(emoji))
      throw new BadRequestException('Unsupported reaction');
    return withPgTransaction(this.db, async (db) => {
      const exam = await this.exam(examId, db, true);
      const comment = await db.query(
        `SELECT id FROM public.exam_comments WHERE id=$1 AND exam_id=$2 AND deleted_at IS NULL FOR SHARE`,
        [commentId, exam.id],
      );
      if (!comment.rows.length)
        throw new NotFoundException('Comment not found');
      if (emoji === null)
        await db.query(
          `DELETE FROM public.exam_comment_reactions WHERE comment_id=$1 AND user_id=$2`,
          [commentId, actor],
        );
      else
        await db.query(
          `INSERT INTO public.exam_comment_reactions(comment_id,user_id,emoji) VALUES($1,$2,$3) ON CONFLICT(comment_id,user_id) DO UPDATE SET emoji=EXCLUDED.emoji`,
          [commentId, actor, emoji],
        );
      return { emoji };
    });
  }
}
