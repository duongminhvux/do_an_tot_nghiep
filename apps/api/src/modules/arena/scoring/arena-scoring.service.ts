import { Injectable } from '@nestjs/common';

@Injectable()
export class ArenaScoringService {
  calculateScore(baseScore: number, bonus = 0) {
    return baseScore + bonus;
  }
}
