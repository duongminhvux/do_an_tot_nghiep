export type ReviewState = {
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  intervalDays: number;
  status: string;
  lastReviewedAt?: Date;
  nextReviewAt?: Date;
};
/** Shared by live sessions, review API and deterministic demo replay. Mutates the locked state. */
export function advanceReview(
  review: ReviewState,
  rating: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY',
  now: Date,
) {
  review.reviewCount += 1;
  review.lastReviewedAt = now;

  const isAgain = rating === 'AGAIN';
  const isHard = rating === 'HARD';
  const isEasy = rating === 'EASY';

  if (isAgain) {
    review.incorrectCount += 1;
    review.intervalDays = 0;
    review.status = 'LEARNING';
    // Ôn lại sau 10 phút
    review.nextReviewAt = new Date(now.getTime() + 10 * 60 * 1000);
  } else if (isHard) {
    review.intervalDays = Math.max(
      1,
      Math.round((review.intervalDays || 1) * 1.2),
    );
    review.nextReviewAt = new Date(
      now.getTime() + review.intervalDays * 24 * 60 * 60 * 1000,
    );
  } else if (isEasy) {
    review.correctCount += 1;
    review.intervalDays =
      review.intervalDays === 0 ? 3 : Math.round(review.intervalDays * 3.5);
    if (review.reviewCount >= 2) {
      review.status = 'MASTERED';
    }
    review.nextReviewAt = new Date(
      now.getTime() + review.intervalDays * 24 * 60 * 60 * 1000,
    );
  } else {
    // 'GOOD'
    review.correctCount += 1;
    review.intervalDays =
      review.intervalDays === 0
        ? 1
        : review.intervalDays === 1
          ? 3
          : Math.round(review.intervalDays * 2.5);
    if (review.reviewCount >= 4 && review.correctCount >= 3) {
      review.status = 'MASTERED';
    }
    review.nextReviewAt = new Date(
      now.getTime() + review.intervalDays * 24 * 60 * 60 * 1000,
    );
  }
  return review;
}
