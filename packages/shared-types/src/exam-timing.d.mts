export interface ExamTimingSettings {
  testDurationMinutes: number;
  /** Zero means unlimited practice. */
  practiceDurationMinutes: number;
}
export declare function examTimeLimitSeconds(
  mode: "TEST" | "PRACTICE",
  parts: { part: number; totalQuestions?: number }[],
  selectedParts: number[],
  exam?: { durationMinutes?: number; timingSettings?: ExamTimingSettings },
): number | undefined;
