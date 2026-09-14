import { Injectable } from "@nestjs/common";

export interface DictationScoringOptions {
  ignoreCapitalization: boolean;
  ignorePunctuation: boolean;
  ignoreExtraSpaces: boolean;
  allowMinorTypo: boolean;
}

export interface FeedbackSegment {
  value: string;
  type: "CORRECT" | "MISSING" | "EXTRA" | "REPLACED";
}

export interface DictationScore {
  score: number;
  correctWords: number;
  totalWords: number;
  feedbackSegments: FeedbackSegment[];
  normalizedExpected: string;
  normalizedStudent: string;
  missingWords: string[];
  extraWords: string[];
  replacedWords: string[];
}

type Cell = { cost: number; operation: FeedbackSegment["type"] | null };

@Injectable()
export class DictationScoringService {
  score(
    studentAnswer: string,
    correctAnswer: string,
    options: DictationScoringOptions,
  ): DictationScore {
    const expected = this.words(correctAnswer, options);
    const actual = this.words(studentAnswer, options);
    const matrix: Cell[][] = Array.from({ length: expected.length + 1 }, () =>
      Array.from({ length: actual.length + 1 }, () => ({ cost: 0, operation: null })),
    );

    for (let row = 1; row <= expected.length; row++) {
      matrix[row][0] = { cost: row, operation: "MISSING" };
    }
    for (let col = 1; col <= actual.length; col++) {
      matrix[0][col] = { cost: col, operation: "EXTRA" };
    }

    for (let row = 1; row <= expected.length; row++) {
      for (let col = 1; col <= actual.length; col++) {
        const equivalent = this.equivalent(expected[row - 1], actual[col - 1], options);
        const candidates: Cell[] = [
          {
            cost: matrix[row - 1][col - 1].cost + (equivalent ? 0 : 1),
            operation: equivalent ? "CORRECT" : "REPLACED",
          },
          { cost: matrix[row - 1][col].cost + 1, operation: "MISSING" },
          { cost: matrix[row][col - 1].cost + 1, operation: "EXTRA" },
        ];
        matrix[row][col] = candidates.reduce((best, candidate) =>
          candidate.cost < best.cost ? candidate : best,
        );
      }
    }

    const segments: FeedbackSegment[] = [];
    let row = expected.length;
    let col = actual.length;
    let correctWords = 0;
    while (row > 0 || col > 0) {
      const operation = matrix[row][col].operation;
      if (operation === "CORRECT" || operation === "REPLACED") {
        segments.unshift({
          value:
            operation === "REPLACED"
              ? `${actual[col - 1]} → ${expected[row - 1]}`
              : actual[col - 1],
          type: operation,
        });
        if (operation === "CORRECT") correctWords++;
        row--;
        col--;
      } else if (operation === "MISSING") {
        segments.unshift({ value: expected[row - 1], type: "MISSING" });
        row--;
      } else {
        segments.unshift({ value: actual[col - 1], type: "EXTRA" });
        col--;
      }
    }

    const distance = matrix[expected.length][actual.length].cost;
    const denominator = Math.max(expected.length, actual.length);
    return {
      score: denominator === 0 ? 100 : Math.max(0, Math.round((1 - distance / denominator) * 100)),
      correctWords,
      totalWords: expected.length,
      feedbackSegments: segments,
      normalizedExpected: expected.join(" "),
      normalizedStudent: actual.join(" "),
      missingWords: segments.filter((segment) => segment.type === "MISSING").map((segment) => segment.value),
      extraWords: segments.filter((segment) => segment.type === "EXTRA").map((segment) => segment.value),
      replacedWords: segments.filter((segment) => segment.type === "REPLACED").map((segment) => segment.value),
    };
  }

  private words(value: string, options: DictationScoringOptions): string[] {
    let normalized = value.normalize("NFKC");
    if (options.ignoreCapitalization) normalized = normalized.toLocaleLowerCase("en-US");
    if (options.ignorePunctuation) normalized = normalized.replace(/[^\p{L}\p{N}'-]+/gu, " ");
    if (options.ignoreExtraSpaces) normalized = normalized.replace(/\s+/g, " ").trim();
    return normalized.trim() ? normalized.trim().split(/\s+/u) : [];
  }

  private equivalent(
    expected: string,
    actual: string,
    options: DictationScoringOptions,
  ): boolean {
    if (expected === actual) return true;
    if (!options.allowMinorTypo) return false;
    const limit = Math.max(expected.length, actual.length) <= 5 ? 1 : 2;
    return this.boundedDistance(expected, actual, limit) <= limit;
  }

  private boundedDistance(left: string, right: string, limit: number): number {
    if (Math.abs(left.length - right.length) > limit) return limit + 1;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row++) {
      const current = [row];
      let rowMinimum = row;
      for (let col = 1; col <= right.length; col++) {
        current[col] = Math.min(
          current[col - 1] + 1,
          previous[col] + 1,
          previous[col - 1] + (left[row - 1] === right[col - 1] ? 0 : 1),
        );
        rowMinimum = Math.min(rowMinimum, current[col]);
      }
      if (rowMinimum > limit) return limit + 1;
      previous = current;
    }
    return previous[right.length];
  }
}
