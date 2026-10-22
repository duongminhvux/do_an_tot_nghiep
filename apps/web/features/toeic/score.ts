// The conversion table lives in @repo/shared-types so the API (statistics)
// and the web app (history, result) always agree.
export {
  estimateToeicScore,
  toeicSectionScore,
  TOEIC_SECTION_MAX,
  TOEIC_TOTAL_MAX,
} from '@repo/shared-types/toeic-score';
export type { ToeicEstimatedScore } from '@repo/shared-types/toeic-score';
