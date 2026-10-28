import type { MeaningTypingSettings,TypingRushSettings,WordShooterSettings } from '../game-registry.js';
export enum GameCategory {
    SOLO = 'SOLO',
    MULTIPLAYER = 'MULTIPLAYER'
}
export interface GameDefinition {
    settings: TypingRushSettings | MeaningTypingSettings | WordShooterSettings | null;
    code: string;
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    imageUrl: string;
    badge: 'NEW' | 'POPULAR' | 'FEATURED' | null;
    destination: string;
    category: GameCategory;
    order: number;
    isActive: boolean;
}
