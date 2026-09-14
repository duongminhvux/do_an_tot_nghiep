import { describe, expect, it } from "vitest";
import { ToeicScoringService } from "./toeic-scoring.service";

describe("ToeicScoringService", () => {
  it("scores selections from server-side correct flags", () => {
    const result = new ToeicScoringService().score(
      [
        {
          id: "q1",
          explanation: "One",
          options: [
            { id: "a", isCorrect: true },
            { id: "b", isCorrect: false },
          ],
        },
        {
          id: "q2",
          explanation: "Two",
          options: [
            { id: "c", isCorrect: false },
            { id: "d", isCorrect: true },
          ],
        },
      ],
      { q1: "a", q2: "c" },
    );
    expect(result).toMatchObject({ score: 50, correctCount: 1, totalQuestions: 2 });
  });
});
