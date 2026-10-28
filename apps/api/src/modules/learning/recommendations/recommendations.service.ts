import { Injectable,ServiceUnavailableException } from '@nestjs/common';
import {
buildRecommendations,
type RecommendationInput,
type RecommendationRules,
type RecommendationSource,
} from '@repo/shared-types/recommendations';
import {
InjectPgConnection,
type PgConnection,
} from '../../../postgres/connection.js';
import { serviceUrl } from '../../../postgres/ownership.js';
import { mistakeSource } from '../mistakes/mistake-source-client.js';

@Injectable()
export class RecommendationsService {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}
  private async publishedDue(userId:string) {
    const {rows}=await this.db.query(`SELECT word_id AS "wordId" FROM public.userwordreviews WHERE user_id = $1 AND next_review_at <= now() ORDER BY next_review_at,word_id LIMIT 50`,[userId]);
    if(!rows.length)return {rows:[{count:0}]};
    const titles=await mistakeSource<Record<string,string>>('content','vocabulary-titles',{wordIds:rows.map(row=>row.wordId)});
    return {rows:[{count:Object.keys(titles).length}]};
  }

  private async owner<T>(role: string, path: string): Promise<T> {
    const token = process.env.INTERNAL_SERVICE_TOKEN;
    if (!token || token.length < 24)
      throw new ServiceUnavailableException(
        'Internal read authentication not configured',
      );
    try {
      const response = await fetch(
        `${serviceUrl(role)}/api/_internal/learning-recommendations/${path}`,
        {
          headers: { 'x-internal-token': token },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) throw new Error('Source unavailable');
      const payload = await response.json();
      return payload.data ?? payload;
    } catch {
      throw new ServiceUnavailableException(
        'Recommendation source unavailable',
      );
    }
  }

  async list(userId: string, language: string) {
    // Read current rules for every request; no stale rule or cross-user cache.
    const rules = await this.owner<RecommendationRules>('media-jobs', 'rules');
    if (!rules.enabled || !rules.sources.length)
      return buildRecommendations(
        { dueCount: 0, parts: [], dictation: null },
        rules,
        language,
      );
    const [vocabulary, toeic, dictation] = await Promise.allSettled([
      rules.sources.includes('vocabulary')
        ? this.publishedDue(userId)
        : Promise.resolve({ rows: [{ count: 0 }] }),
      rules.sources.includes('toeic')
        ? this.owner<RecommendationInput['parts']>('assessment', userId)
        : Promise.resolve([]),
      rules.sources.includes('dictation')
        ? this.owner<RecommendationInput['dictation']>('content', userId)
        : Promise.resolve(null),
    ]);
    const unavailableSources: RecommendationSource[] = [];
    if (vocabulary.status === 'rejected') unavailableSources.push('vocabulary');
    if (toeic.status === 'rejected') unavailableSources.push('toeic');
    if (dictation.status === 'rejected') unavailableSources.push('dictation');
    if (unavailableSources.length === rules.sources.length)
      throw new ServiceUnavailableException(
        'Recommendation sources unavailable',
      );
    const result = buildRecommendations(
      {
        dueCount:
          vocabulary.status === 'fulfilled'
            ? Number(vocabulary.value.rows[0]?.count ?? 0)
            : 0,
        parts: toeic.status === 'fulfilled' ? toeic.value : [],
        dictation: dictation.status === 'fulfilled' ? dictation.value : null,
      },
      {
        ...rules,
        sources: rules.sources.filter(
          (source) => !unavailableSources.includes(source),
        ),
      },
      language,
    );
    return { ...result, unavailableSources };
  }
}
