import { describe, expect, it } from "vitest";
import { bestScore, canConsumeListen, canStartAttempt, courseProgress, normalizeText, scoreDictation } from "./scoring";
describe("listening domain rules", () => {
  it("normalizes case, whitespace, and punctuation", () => expect(normalizeText("  Hello,   WORLD! ")).toBe("hello world"));
  it("scores exact dictation as 100", () => expect(scoreDictation("I am ready.", "I am ready").score).toBe(100));
  it("returns understandable word feedback", () => { const result = scoreDictation("I ready", "I am ready"); expect(result.score).toBe(33); expect(result.feedbackSegments.some((s) => s.type === "REPLACED")).toBe(true); });
  it("calculates progress", () => expect(courseProgress(3, 4)).toBe(75));
  it("applies attempt and listening limits", () => { expect(canStartAttempt(2, 3)).toBe(true); expect(canStartAttempt(3, 3)).toBe(false); expect(canConsumeListen(2, 3)).toBe(true); expect(canConsumeListen(3, 3)).toBe(false); });
  it("selects the highest score", () => expect(bestScore([62, 91, 75])).toBe(91));
});
