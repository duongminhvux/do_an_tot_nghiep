import { Injectable } from '@nestjs/common';

@Injectable()
export class ArenaRatingService {
  private readonly K_FACTOR = 32;

  /** Tính xác suất thắng kỳ vọng của người chơi theo công thức Elo. */
  calculateExpected(rating: number, opponentRating: number) {
    return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
  }

  /** Tính rating mới của một người sau khi biết kết quả trận. */
  calculateNewRating(
    rating: number,
    opponentRating: number,
    result: 0 | 0.5 | 1,
    kFactor = this.K_FACTOR,
  ) {
    const expected = this.calculateExpected(rating, opponentRating);

    const change = Math.round(kFactor * (result - expected));

    return {
      ratingBefore: rating,

      ratingAfter: Math.max(0, rating + change),

      ratingChange: change,
    };
  }

  /** Tính rating mới cho cả hai người chơi trong cùng một trận. */
  calculateMatch(
    playerARating: number,
    playerBRating: number,
    winner: 'A' | 'B' | 'DRAW',
    kFactor = this.K_FACTOR,
  ) {
    const resultA = winner === 'A' ? 1 : winner === 'B' ? 0 : 0.5;

    const resultB = winner === 'B' ? 1 : winner === 'A' ? 0 : 0.5;

    return {
      playerA: this.calculateNewRating(
        playerARating,
        playerBRating,
        resultA,
        kFactor,
      ),

      playerB: this.calculateNewRating(
        playerBRating,
        playerARating,
        resultB,
        kFactor,
      ),
    };
  }
}
