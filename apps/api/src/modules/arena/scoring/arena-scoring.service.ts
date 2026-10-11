import { Injectable } from '@nestjs/common';

@Injectable()
export class ArenaScoringService {
  /** Tính điểm câu hỏi từ điểm gốc, tốc độ trả lời và số lần trả lời sai. */
  calculateQuestionScore({
    timeLimitMs,
    elapsedMs,
    wrongAttempts,
  }: {
    timeLimitMs: number;
    elapsedMs: number;
    wrongAttempts: number;
  }): number {
    const BASE_SCORE = 100;

    const MAX_SPEED_BONUS = 100;

    const WRONG_ATTEMPT_PENALTY = 15;

    /*
     * Đảm bảo elapsed không bị âm
     * hoặc lớn hơn time limit.
     */
    const safeElapsedMs = Math.max(0, Math.min(elapsedMs, timeLimitMs));

    /*
     * Ví dụ:
     *
     * timeLimit = 15000
     * elapsed = 3000
     *
     * remainingRatio =
     *
     * 1 - 3000 / 15000
     * = 0.8
     */
    const remainingRatio =
      timeLimitMs > 0 ? 1 - safeElapsedMs / timeLimitMs : 0;

    /*
     * Bonus tốc độ.
     *
     * Trả lời ngay:
     * ~100 bonus
     *
     * Trả lời gần hết giờ:
     * ~0 bonus
     */
    const speedBonus = Math.round(MAX_SPEED_BONUS * remainingRatio);

    /*
     * Mỗi lần sai giảm 15 điểm bonus.
     */
    const wrongPenalty = Math.max(0, wrongAttempts) * WRONG_ATTEMPT_PENALTY;

    /*
     * Nếu đã trả lời đúng,
     * luôn được ít nhất BASE_SCORE.
     */
    const totalScore = BASE_SCORE + speedBonus - wrongPenalty;

    return Math.max(BASE_SCORE, totalScore);
  }
}
