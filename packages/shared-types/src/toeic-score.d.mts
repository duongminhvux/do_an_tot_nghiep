export interface ToeicSectionCount {
  correct: number;
  total: number;
}
export interface ToeicEstimatedScore {
  total: number;
  max: number;
  listening: number | null;
  reading: number | null;
}
export type ToeicScoreBand = "excellent" | "good" | "fair" | "average" | "low";

export declare const TOEIC_SECTION_MAX: 495;
export declare const TOEIC_TOTAL_MAX: 990;
export declare const TOEIC_SCORE_BANDS: readonly { band: ToeicScoreBand; min: number }[];

/**
 * Converts the number of correct answers (0 – 100) to a section score
 * (5 – 495). No scaling: fewer questions can only earn fewer points.
 */
export declare function toeicSectionScore(
  section: "LISTENING" | "READING",
  correct: number,
): number;

/** Estimated TOEIC score; null when neither section has questions. */
export declare function estimateToeicScore(
  listeningResult?: ToeicSectionCount | null,
  readingResult?: ToeicSectionCount | null,
): ToeicEstimatedScore | null;

export declare function toeicScoreBand(total: number): ToeicScoreBand;
