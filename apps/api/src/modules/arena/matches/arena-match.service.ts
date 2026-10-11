import { Injectable } from '@nestjs/common';

@Injectable()
export class ArenaMatchService {
  createMatch(matchId: string, playerIds: string[] = []) {
    return { matchId, playerIds };
  }
}
