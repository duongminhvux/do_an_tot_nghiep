import type { SnapshotQuestion } from './attempt.types.js';

// Expressions are evaluated by MongoDB against the answers at the exact moment
// submission wins the IN_PROGRESS update, including a concurrent last answer.
export function buildAttemptResultPipeline(
  questions: SnapshotQuestion[],
  selectedParts: number[],
) {
  const sum = (values: unknown[]) => ({ $sum: values });
  const percent = (correct: unknown, total: number) =>
    total
      ? { $round: [{ $multiply: [{ $divide: [correct, total] }, 100] }, 2] }
      : 0;
  const resultFor = (items: SnapshotQuestion[]) => {
    const answered = sum(
      items.map((q) => ({
        $cond: [
          {
            $in: [
              { $ifNull: [`$answers.${q._id}`, null] },
              q.options.map((o) => o.key),
            ],
          },
          1,
          0,
        ],
      })),
    );
    const correct = sum(
      items.map((q) => ({
        $cond: [
          {
            $and: [
              {
                $in: [
                  { $ifNull: [`$answers.${q._id}`, null] },
                  q.options.map((o) => o.key),
                ],
              },
              { $eq: [`$answers.${q._id}`, q.correctAnswer] },
            ],
          },
          1,
          0,
        ],
      })),
    );
    return {
      total: items.length,
      answered,
      correct,
      incorrect: { $subtract: [answered, correct] },
      unanswered: { $subtract: [items.length, answered] },
      accuracy: percent(correct, items.length),
    };
  };
  return [
    {
      $set: {
        status: 'FINISHED',
        submittedAt: '$$NOW',
        completedAt: '$$NOW',
        resultVersion: 1,
        totalQuestions: questions.length,
        partResults: selectedParts.map((part) => ({
          part,
          ...resultFor(questions.filter((q) => q.part === part)),
        })),
        listeningResult: resultFor(questions.filter((q) => q.part <= 4)),
        readingResult: resultFor(questions.filter((q) => q.part >= 5)),
        durationSpent: {
          $max: [
            0,
            {
              $floor: {
                $divide: [
                  {
                    $subtract: ['$$NOW', { $ifNull: ['$startedAt', '$$NOW'] }],
                  },
                  1000,
                ],
              },
            },
          ],
        },
        score: '$$REMOVE',
        listeningScore: '$$REMOVE',
        readingScore: '$$REMOVE',
      },
    },
    {
      $set: {
        answeredQuestions: { $sum: '$partResults.answered' },
        correctAnswers: { $sum: '$partResults.correct' },
        incorrectAnswers: { $sum: '$partResults.incorrect' },
        unansweredQuestions: { $sum: '$partResults.unanswered' },
        listeningCorrect: '$listeningResult.correct',
        readingCorrect: '$readingResult.correct',
      },
    },
    {
      $set: {
        totalCorrect: '$correctAnswers',
        accuracy: percent('$correctAnswers', questions.length),
      },
    },
  ];
}

export const COMPLETED_STATUSES = ['FINISHED', 'COMPLETED'];
