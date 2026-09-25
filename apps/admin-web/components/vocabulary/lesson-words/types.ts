import { LessonItem, SectionItem, WordListItem } from '@/types/vocabulary';

export interface ParseWordsResult {
  words: string[];
  duplicates: string[];
  skipped: string[];
  rawCount: number;
}

export interface DeleteConfirmState {
  type: 'single' | 'bulk' | 'section';
  wordId?: string;
  wordName?: string;
  sectionId?: string;
  sectionName?: string;
  count?: number;
}

export interface EditingWordItem {
  wordId: string;
  currentSecId: string | null;
  word: string;
}

export interface ImportSummaryResult {
  totalInput: number;
  addedCount: number;
  alreadyInCount: number;
  notFoundWords: string[];
}
