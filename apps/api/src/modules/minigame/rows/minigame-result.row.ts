import { MiniGameType } from '../minigame.types.js';
export interface MiniGameResult {
    userId: string;
    gameType: MiniGameType;
    score: number;
    createdAt: Date;
}
