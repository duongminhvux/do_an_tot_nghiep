import type { Model } from 'mongoose';
import type { Attempt } from './schemas/attempt.schema.js';
import { COMPLETED_STATUSES } from './attempt-results.js';

export async function withAttemptCounts<T extends { _id: unknown }>(
  model: Model<Attempt> | undefined,
  exams: T[],
) {
  if (!model || !exams.length)
    return exams.map((exam) => ({
      ...exam,
      totalAttempts: 0,
      completedAttempts: 0,
    }));
  const counts = await model
    .aggregate<{
      _id: unknown;
      totalAttempts: number;
      completedAttempts: number;
    }>([
      { $match: { examId: { $in: exams.map((exam) => exam._id) } } },
      {
        $group: {
          _id: '$examId',
          totalAttempts: { $sum: 1 },
          completedAttempts: {
            $sum: { $cond: [{ $in: ['$status', COMPLETED_STATUSES] }, 1, 0] },
          },
        },
      },
    ])
    .exec();
  const byExam = new Map(counts.map((row) => [String(row._id), row]));
  return exams.map((exam) => ({
    ...exam,
    totalAttempts: byExam.get(String(exam._id))?.totalAttempts ?? 0,
    completedAttempts: byExam.get(String(exam._id))?.completedAttempts ?? 0,
  }));
}
