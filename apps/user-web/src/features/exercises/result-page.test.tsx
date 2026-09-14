import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToeicResult } from "./result-page";

const base = {
  attemptId: "attempt-id",
  score: 50,
  passed: false,
  threshold: 80,
  correctCount: 1,
  totalQuestions: 2,
  partBreakdown: [{ part: "PART 1", correct: 1, total: 2 }],
  strengths: ["Detail recognition"],
  improvements: ["Review distractors"],
  answerReviewEnabled: false,
  answers: [
    {
      questionId: "q1",
      selectedOptionId: "selected",
      correctOptionId: "",
      explanation: "",
      isCorrect: true,
    },
    {
      questionId: "q2",
      selectedOptionId: "selected",
      correctOptionId: "",
      explanation: "",
      isCorrect: false,
    },
  ],
};

describe("TOEIC result rendering", () => {
  it("shows selected, correct, explanation, and transcript when enabled", () => {
    render(
      <ToeicResult
        result={{
          ...base,
          answerReviewEnabled: true,
          answers: [
            {
              questionId: "q1",
              selectedOptionId: "option-b",
              selectedOptionLabel: "B",
              selectedOptionText: "Selected response",
              correctOptionId: "option-c",
              correctOptionLabel: "C",
              correctOptionText: "Correct response",
              explanation: "Authoritative explanation",
              isCorrect: false,
            },
          ],
          transcripts: [
            {
              groupId: "group-1",
              label: "Conversation 1",
              text: "Woman: Hello",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Your answer")).toBeInTheDocument();
    expect(screen.getByText("B. Selected response")).toBeInTheDocument();
    expect(screen.getByText("C. Correct response")).toBeInTheDocument();
    expect(screen.getByText("Authoritative explanation")).toBeInTheDocument();
    expect(screen.getByText("Listening Transcript")).toBeInTheDocument();
    expect(screen.getByText("Woman: Hello")).toBeInTheDocument();
  });

  it("shows an honest disabled state without fake answer labels", () => {
    render(<ToeicResult result={base} />);
    expect(
      screen.getByText("Answer review is disabled for this exercise."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Your answer")).not.toBeInTheDocument();
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
  });
});
