import {
ConflictException,
ForbiddenException,
Injectable,
NotFoundException,
} from '@nestjs/common';
import {
publicationVisibility,
validatePublication,
type PublicationIssue,
type PublicationKind,
} from '@repo/shared-types/publication';
import {
InjectPgConnection,
type PgConnection,
} from '../../postgres/connection.js';
import { serviceRole } from '../../postgres/ownership.js';
import type { SnapshotQuestion } from '../assessment/attempts/attempt.types.js';
import { publicQuestion } from '../assessment/attempts/attempts.service.js';

const definitions = {
  exams: { owner: 'assessment', table: 'exams' },
  words: { owner: 'content', table: 'words' },
  lessons: { owner: 'content', table: 'lessons' },
  dictation: { owner: 'content', table: 'dictationlessons' },
};
const camel = (row: Record<string, any>): Record<string, any> =>
  Object.fromEntries(
    Object.entries({ ...row.payload, ...row })
      .filter(([key]) => key !== 'payload')
      .map(([key, value]) => [
        key.replace(/_([a-z])/g, (_all, letter: string) =>
          letter.toUpperCase(),
        ),
        value,
      ]),
  );
@Injectable()
export class PublicationService {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}
  private definition(kind: PublicationKind) {
    const definition = definitions[kind];
    if (!definition || definition.owner !== serviceRole())
      throw new ForbiddenException('Publication owner mismatch');
    return definition;
  }
  private async document(
    client: Pick<PgConnection, 'query'>,
    kind: PublicationKind,
    id: string,
    lock = false,
    expand = true,
  ): Promise<Record<string, any>> {
    const { table } = this.definition(kind);
    const { rows } = await client.query(
      `SELECT * FROM public.${table} WHERE id=$1 AND is_deleted IS NOT TRUE ${lock ? 'FOR UPDATE' : ''}`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Content not found');
    const document = camel(rows[0]);
    if (!expand) return document;
    if (kind === 'exams') {
      const questions = await client.query(
        'SELECT * FROM public.questions WHERE exam_id=$1 ORDER BY part,"order",id',
        [id],
      );
      const groups = await client.query(
        'SELECT * FROM public.passagegroups WHERE exam_id=$1 ORDER BY "order",id',
        [id],
      );
      const passages = await client.query(
        'SELECT p.* FROM public.passages p JOIN public.passagegroups g ON g.id=p.passage_group_id WHERE g.exam_id=$1 ORDER BY p."order",p.id',
        [id],
      );
      document.questions = questions.rows.map(camel);
      document.groups = groups.rows.map((g) => ({
        ...camel(g),
        passages: passages.rows
          .filter((p) => p.passage_group_id === g.id)
          .map(camel),
      }));
    } else if (kind === 'dictation') {
      document.segments = (
        await client.query(
          'SELECT * FROM public.dictationsegments WHERE lesson_id=$1 ORDER BY "order",id',
          [id],
        )
      ).rows.map(camel);
    } else if (kind === 'words') {
      document.linkedLessons = (
        await client.query(
          `SELECT COUNT(*)::int AS count FROM public.lessonwords lw JOIN public.lessons l ON l.id=lw.lesson_id WHERE lw.word_id=$1 AND l.is_active IS NOT FALSE AND l.is_deleted IS NOT TRUE`,
          [id],
        )
      ).rows[0].count;
    } else {
      document.collectionAvailable =
        (
          await client.query(
            'SELECT 1 FROM public.collections WHERE id=$1 AND is_active IS NOT FALSE AND is_deleted IS NOT TRUE',
            [document.collectionId],
          )
        ).rowCount !== 0;
      document.words = (
        await client.query(
          `SELECT w.id,w.word,w.publication_status AS "publicationStatus",(w.is_active IS NOT FALSE AND w.is_deleted IS NOT TRUE) AS available FROM public.lessonwords lw LEFT JOIN public.words w ON w.id=lw.word_id WHERE lw.lesson_id=$1 ORDER BY lw.id`,
          [id],
        )
      ).rows;
    }
    return document;
  }
  /** Live, read-only validation of the saved content. Never changes state. */
  private liveIssues(kind: PublicationKind, doc: Record<string, any>, language = 'vi') {
    try {
      return validatePublication(kind, doc, language);
    } catch {
      return [
        {
          code: 'MALFORMED',
          path: '',
          severity: 'error' as const,
          message:
            language === 'en'
              ? 'Malformed content; review it in the editor.'
              : 'Dữ liệu không đúng cấu trúc; cần kiểm tra trong trình biên tập.',
        },
      ];
    }
  }
  async info(kind: PublicationKind, id: string, language = 'vi') {
    const doc = await this.document(this.db, kind, id);
    const audit = (
      await this.db.query(
        `SELECT action,actor_id AS "actorId",revision,created_at AS "createdAt",
          (SELECT COUNT(*) FROM jsonb_array_elements(issues) i WHERE i->>'severity'='error')::int AS "issueCount"
          FROM public.content_publication_audit WHERE resource_type=$1 AND resource_id=$2 ORDER BY created_at DESC,id DESC LIMIT 20`,
        [kind, id],
      )
    ).rows;
    const currentIssues = this.liveIssues(kind, doc, language);
    return {
      id,
      publicationStatus: doc.publicationStatus,
      publicationRevision: doc.publicationRevision,
      publicationValidation: doc.publicationValidation,
      publishedBy: doc.publishedBy,
      publishedAt: doc.publishedAt,
      isActive: doc.isActive,
      visibility: publicationVisibility(doc, currentIssues),
      currentIssues,
      audit,
    };
  }
  /**
   * Admin list badges. Uses the stored validation when it belongs to the
   * current revision; otherwise validates the saved content in memory
   * (read-only). Bounded by the caller's page size.
   */
  async visibilityOf(kind: PublicationKind, rows: Record<string, any>[]) {
    const result = new Map<string, ReturnType<typeof publicationVisibility>>();
    for (const row of rows) {
      const id = String(row._id ?? row.id);
      const quick = publicationVisibility(row);
      const stored = row.publicationValidation;
      if (
        quick === 'VISIBLE' ||
        (stored && stored.revision === row.publicationRevision)
      ) {
        result.set(id, quick);
        continue;
      }
      try {
        const doc = await this.document(this.db, kind, id);
        result.set(id, publicationVisibility(doc, this.liveIssues(kind, doc)));
      } catch {
        result.set(id, quick);
      }
    }
    return result;
  }
  /** Read-only owner-side input shared by publication and the quality scanner. */
  qualityDocument(kind: PublicationKind, id: string) {
    return this.document(this.db, kind, id);
  }
  private async transition(
    kind: PublicationKind,
    id: string,
    actorId: string,
    action: 'VALIDATE' | 'PUBLISH' | 'UNPUBLISH',
    language = 'vi',
  ) {
    const { table } = this.definition(kind);
    if (!actorId)
      throw new ForbiddenException('Authenticated administrator required');
    const client = await this.db.pool.connect();
    let rejected: PublicationIssue[] | null = null;
    try {
      await client.query('BEGIN');
      const doc = await this.document(client, kind, id, true);
      const issues: PublicationIssue[] = validatePublication(kind, doc, language);
      const invalid = issues.some((issue) => issue.severity === 'error');
      const validation = {
        revision: doc.publicationRevision,
        checkedAt: new Date().toISOString(),
        issues,
      };
      // One-step "Show": PUBLISH validates the locked, saved content itself.
      // A failed attempt is recorded as VALIDATE (with its issues) and rejected.
      rejected = action === 'PUBLISH' && invalid ? issues : null;
      const recorded = rejected ? 'VALIDATE' : action;
      // VALIDATE never hides visible content; IN_REVIEW now means "valid, hidden".
      const status =
        recorded === 'PUBLISH'
          ? 'PUBLISHED'
          : recorded === 'VALIDATE' && doc.publicationStatus === 'PUBLISHED'
            ? 'PUBLISHED'
            : invalid
              ? 'DRAFT'
              : 'IN_REVIEW';
      await client.query(
        "SELECT set_config('vocalearn.publication_transition','1',true)",
      );
      await client.query(
        `UPDATE public.${table} SET publication_status=$2,publication_validation=$3::jsonb,
        published_by=CASE WHEN $4 THEN $5::uuid ELSE published_by END,
        published_at=CASE WHEN $4 THEN now() ELSE published_at END
        ${kind === 'dictation' ? ",status=CASE WHEN $2='PUBLISHED' THEN 'PUBLISHED' WHEN status='PUBLISHED' THEN 'READY' ELSE status END" : ''}
        ${kind === 'exams' ? ',is_active=CASE WHEN $4 THEN true ELSE is_active END' : ''}
        WHERE id=$1`,
        [
          id,
          status,
          JSON.stringify(validation),
          recorded === 'PUBLISH',
          actorId,
        ],
      );
      await client.query(
        `INSERT INTO public.content_publication_audit(resource_type,resource_id,action,actor_id,revision,issues) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          kind,
          id,
          recorded,
          actorId,
          doc.publicationRevision,
          JSON.stringify(issues),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    if (rejected)
      throw new ConflictException({
        message: 'Content validation failed',
        code: 'CONTENT_INCOMPLETE',
        issues: rejected,
      });
    return this.info(kind, id, language);
  }
  validate(
    kind: PublicationKind,
    id: string,
    actorId: string,
    language?: string,
  ) {
    return this.transition(kind, id, actorId, 'VALIDATE', language);
  }
  publish(
    kind: PublicationKind,
    id: string,
    actorId: string,
    language?: string,
  ) {
    return this.transition(kind, id, actorId, 'PUBLISH', language);
  }
  unpublish(kind: PublicationKind, id: string, actorId: string, language?: string) {
    return this.transition(kind, id, actorId, 'UNPUBLISH', language);
  }
  /**
   * Used right after an admin creates content with "show to learners" selected.
   * The content is already saved; if it is not complete it simply stays hidden
   * and the caller receives the exact issues instead of an error.
   */
  async applyRequestedVisibility(
    kind: PublicationKind,
    id: string,
    actorId: string,
    visible: boolean | undefined,
    language?: string,
  ): Promise<{ visible: boolean; issues: PublicationIssue[] }> {
    if (!visible) return { visible: false, issues: [] };
    try {
      await this.publish(kind, id, actorId, language);
      return { visible: true, issues: [] };
    } catch (error) {
      if (error instanceof ConflictException) {
        const body = error.getResponse() as { issues?: PublicationIssue[] };
        return { visible: false, issues: body.issues ?? [] };
      }
      throw error;
    }
  }
  async preview(kind: PublicationKind, id: string) {
    const doc = await this.document(this.db, kind, id);
    if (kind === 'exams')
      return {
        kind,
        title: doc.name,
        questions: doc.questions
          .filter((q: any) => q.isActive !== false)
          .map((q: any) =>
            publicQuestion(
              {
                ...q,
                _id: q.id,
                options: (Array.isArray(q.options)?q.options:[]).filter(Boolean).map((option:any)=>({key:String(option.key??''),text:typeof option.text==='string'?option.text:''})),
                passages: (
                  doc.groups.find((g: any) => g.id === q.passageGroupId)
                    ?.passages ?? []
                ).map((p: any) => ({ ...p, _id: p.id })),
              } as SnapshotQuestion,
              false,
            ),
          ),
      };
    if (kind === 'dictation')
      return {
        kind,
        title: doc.title,
        fullAudioUrl: doc.fullAudioUrl,
        segments: doc.segments.map((s: any) => ({
          id: s.id,
          text: s.text,
          startMs: s.startMs,
          endMs: s.endMs,
        })),
      };
    if (kind === 'words')
      return {
        kind,
        title: doc.word,
        parts: doc.parts,
        audio: doc.audio,
        ipa: doc.ipa,
      };
    return {
      kind,
      title: doc.title,
      words: doc.words.map((w: any) => ({
        id: w.id,
        word: w.word,
        available: w.available && w.publicationStatus === 'PUBLISHED',
      })),
    };
  }
}
