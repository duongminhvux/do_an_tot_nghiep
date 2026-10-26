export type RecommendationSource = "vocabulary" | "toeic" | "dictation";
export interface RecommendationRules {
  enabled: boolean;
  maxSuggestions: number;
  minSamples: number;
  minQuestions: number;
  weakAccuracy: number;
  prioritizeDue: boolean;
  sources: RecommendationSource[];
}
export interface Recommendation {
  id: string;
  source: RecommendationSource;
  type: "vocabulary" | "listening" | "reading";
  title: string;
  reason: string;
  estimatedMinutes: number;
  actionUrl: string;
  priority: number;
}
export interface RecommendationInput {
  dueCount: number;
  parts: {
    part: number;
    samples: number;
    total: number;
    correct: number;
    actionUrl: string | null;
  }[];
  dictation: {
    samples: number;
    total: number;
    correct: number;
    actionUrl: string | null;
    estimatedMinutes?: number;
  } | null;
}
export interface RecommendationResult {
  state: "disabled" | "insufficient_data" | "ready";
  items: Recommendation[];
  unavailableSources?: RecommendationSource[];
}
export const RECOMMENDATION_RULES_ID: string;
export const DEFAULT_RECOMMENDATION_RULES: Readonly<RecommendationRules>;
export function normalizeRecommendationRules(
  input?: unknown,
): RecommendationRules;
export function buildRecommendations(
  input: RecommendationInput,
  rules: RecommendationRules,
  language?: string,
): RecommendationResult;
export function recommendationScenario(
  scenario: "new" | "little" | "progress",
): RecommendationInput;
