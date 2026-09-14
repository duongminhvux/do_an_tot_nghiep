import { describe, expect, it } from "vitest";
import { DictationScoringService } from "./dictation-scoring.service";

const defaults = {
  ignoreCapitalization: true,
  ignorePunctuation: true,
  ignoreExtraSpaces: true,
  allowMinorTypo: false,
};

describe("DictationScoringService", () => {
  const service = new DictationScoringService();

  it("normalizes case, punctuation and whitespace", () => {
    expect(
      service.score("  HELLO,   world! ", "Hello world", defaults),
    ).toMatchObject({ score: 100, correctWords: 2, totalWords: 2 });
  });

  it("reports replaced words and applies word edit distance", () => {
    const result = service.score(
      "I have blue car today",
      "I have a red car",
      defaults,
    );
    expect(result.score).toBe(40);
    expect(result.replacedWords.length).toBe(3);
    expect(service.score("one", "one two", defaults).missingWords).toEqual(["two"]);
    expect(service.score("one two", "one", defaults).extraWords).toEqual(["two"]);
  });

  it("accepts bounded minor typos only when enabled", () => {
    expect(
      service.score("busines meeting", "business meeting", {
        ...defaults,
        allowMinorTypo: true,
      }).score,
    ).toBe(100);
    expect(
      service.score("busines meeting", "business meeting", defaults).score,
    ).toBe(50);
  });
});
