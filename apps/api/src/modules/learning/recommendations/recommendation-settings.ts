import {
normalizeRecommendationRules,
RECOMMENDATION_RULES_ID,
} from '@repo/shared-types/recommendations';
import type { PgConnection } from '../../../postgres/connection.js';

/** Settings remain owned by Media, alongside the existing website settings. */
export async function readRecommendationRules(db: PgConnection) {
  const { rows } = await db.query(
    'SELECT payload FROM public.system_settings WHERE id = $1',
    [RECOMMENDATION_RULES_ID],
  );
  return normalizeRecommendationRules(rows[0]?.payload?.settings);
}
