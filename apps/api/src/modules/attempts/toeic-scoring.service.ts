import { Injectable } from "@nestjs/common";

export interface ToeicQuestionForScoring {
  id: string;
  explanation: string | null;
  options: { id: string; isCorrect: boolean }[];
}

@Injectable()
export class ToeicScoringService {
  score(
    questions: ToeicQuestionForScoring[],
    submitted: Record<string, string>,
  ) {
    const answers = questions.map((question) => {
      const correctOptionId =
        question.options.find((option) => option.isCorrect)?.id ?? "";
      const selectedOptionId = submitted[question.id] ?? "";
      return {
        questionId: question.id,
        selectedOptionId,
        correctOptionId,
        explanation: question.explanation ?? "",
        isCorrect: selectedOptionId === correctOptionId,
      };
    });
    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    return {
      score: Math.round((correctCount / Math.max(1, questions.length)) * 100),
      correctCount,
      totalQuestions: questions.length,
      answers,
    };
  }
}
