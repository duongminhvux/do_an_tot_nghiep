export type LandingImageKey =
  | "heroImageUrl"
  | "vocabularyImageUrl"
  | "toeicImageUrl"
  | "dictationImageUrl"
  | "gamesImageUrl"
  | "arenaImageUrl";
export type LandingPageSettings = Record<LandingImageKey, string>;
export declare const LANDING_PAGE_SETTINGS_ID: string;
export declare const LANDING_IMAGE_KEYS: readonly LandingImageKey[];
export declare const DEFAULT_LANDING_PAGE_SETTINGS: Readonly<LandingPageSettings>;
export declare const LANDING_IMAGE_URL_PATTERN: RegExp;
export declare function normalizeLandingPageSettings(input?: unknown): LandingPageSettings;
