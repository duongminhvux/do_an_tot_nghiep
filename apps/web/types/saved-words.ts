export interface SavedWordWordDetail {
  _id: string;
  word: string;
  slug: string;
  level: string;
  phonetic?: string;
  ipa?: {
    us?: string;
    uk?: string;
  };
  audio?: {
    us?: string;
    uk?: string;
  };
  image?: string;
  parts?: Array<{
    partOfSpeech: string;
    meanings: Array<{
      definition?: string;
      translation: string[];
      synonyms?: string[];
      antonyms?: string[];
      examples?: Array<{
        en?: string;
        vi?: string;
      }>;
    }>;
  }>;
}

export interface SavedWordItem {
  _id: string;
  savedAt: string;
  note?: string;
  word: SavedWordWordDetail;
  reviewStatus: 'NOT_STUDIED' | 'LEARNING' | 'MASTERED';
  reviewCount: number;
  nextReviewAt?: string;
}

export interface SavedWordsPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SavedWordsQuery {
  page?: number;
  limit?: number;
  search?: string;
  level?: string;
  sortBy?: 'savedAt' | 'alpha';
  order?: 'asc' | 'desc';
}
