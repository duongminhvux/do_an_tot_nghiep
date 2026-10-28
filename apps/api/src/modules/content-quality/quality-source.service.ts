import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicationKind } from '@repo/shared-types/publication';
import {
  InjectPgConnection,
  type PgConnection,
} from '../../postgres/connection.js';
import { serviceRole } from '../../postgres/ownership.js';
import { PublicationService } from '../publication/publication.service.js';
import {
  QUALITY_TABLES,
  qualityItem,
  type QualityItem,
} from './quality-rules.js';

@Injectable()
export class QualitySourceService {
  constructor(
    @InjectPgConnection() private readonly db: PgConnection,
    private readonly publication: PublicationService,
  ) {}
  async batch(
    kind: PublicationKind,
    cursor: string | null,
    before: string,
  ): Promise<{ items: QualityItem[]; cursor: string | null; done: boolean }> {
    if ((kind === 'exams' ? 'assessment' : 'content') !== serviceRole())
      throw new ForbiddenException();
    const table = QUALITY_TABLES[kind];
    if (!table) throw new ForbiddenException();
    const ids = await this.db.query(
      `SELECT id FROM public.${table} WHERE is_deleted IS NOT TRUE AND created_at <= $2::timestamptz AND ($1::uuid IS NULL OR id>$1::uuid) ORDER BY id LIMIT 10`,
      [cursor, before],
    );
    const items: QualityItem[] = [];
    for (const { id } of ids.rows) {
      try {
        const doc = await this.publication.qualityDocument(kind, id);
        const item = qualityItem(kind, doc);
        if (
          kind === 'words' &&
          typeof doc.word === 'string' &&
          doc.word.trim()
        ) {
          const duplicate = await this.db.query(
            `SELECT id FROM public.words WHERE lower(btrim(word))=lower(btrim($1::text)) AND id<>$2 AND is_deleted IS NOT TRUE LIMIT 1`,
            [doc.word, id],
          );
          if (duplicate.rows.length)
            item.issues.push({
              category: 'DUPLICATE',
              code: 'EXACT_WORD',
              path: 'word',
              severity: 'warning',
              messageVi:
                'Có từ khác trùng cách viết (bỏ khoảng trắng và hoa/thường); cần đối chiếu nghĩa.',
              messageEn:
                'Another word has the same spelling ignoring case and surrounding spaces; compare meanings.',
            });
        }
        items.push(item);
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    return {
      items,
      cursor: ids.rows.at(-1)?.id ?? cursor,
      done: ids.rows.length < 10,
    };
  }
}
