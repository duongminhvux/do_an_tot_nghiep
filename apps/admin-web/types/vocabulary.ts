// ==========================
// COLLECTIONS
// ==========================
export interface CollectionItem {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  thumbnail?: string;
  order?: number;
  isActive?: boolean;
  isDeleted?: boolean;
  lessonsCount?: number;
  wordsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CollectionListResponse {
  data: CollectionItem[];
  total: number;
  page: number;
  limit: number;
}

export interface QueryCollectionDto {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateCollectionDto {
  name: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  thumbnail?: string;
  order?: number;
  isActive?: boolean;
}

export interface UpdateCollectionDto {
  name?: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  thumbnail?: string;
  order?: number;
  isActive?: boolean;
}

// ==========================
// LESSONS
// ==========================
export interface LessonItem {
  _id: string;
  title: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  collectionId: string;
  order?: number;
  isActive?: boolean;
  isDeleted?: boolean;
  wordsCount?: number;
  sectionsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLessonDto {
  collectionId: string;
  title: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  order?: number;
  isActive?: boolean;
}

export interface UpdateLessonDto {
  collectionId?: string;
  title?: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  order?: number;
  isActive?: boolean;
}

// ==========================
// SECTIONS
// ==========================
export interface SectionItem {
  _id: string;
  lessonId: string;
  name: string;
  slug: string;
  order?: number;
  wordsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSectionDto {
  name: string;
  slug?: string;
  order?: number;
}

export interface UpdateSectionDto {
  name?: string;
  slug?: string;
  order?: number;
}

// ==========================
// LESSON WORDS
// ==========================
export interface LessonWordItem {
  _id: string;
  lessonId: string;
  wordId: WordDetail | any;
  sectionId?: SectionItem | string | null;
  order?: number;
  customNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AddWordsToLessonDto {
  wordIds: string[];
  sectionId?: string;
}

export interface UpdateLessonWordDto {
  sectionId?: string | null;
  order?: number;
  customNote?: string;
}

// ==========================
// WORDS
// ==========================
export interface WordIpa {
  us?: string;
  uk?: string;
}

export interface WordAudio {
  us?: string;
  uk?: string;
}

export interface WordMeaningListItem {
  definition: string;
  translation?: string[];
}

export interface WordPartListItem {
  partOfSpeech: string;
  meanings: WordMeaningListItem[];
}

export interface WordListItem {
  _id: string;
  word: string;
  level: string;
  ipa?: WordIpa;
  audio?: WordAudio;
  parts: WordPartListItem[];
  isActive: boolean;
}

export interface WordListResponse {
  data: WordListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface WordExample {
  en: string;
  vi: string;
}

export interface WordMeaningDetail {
  definition: string;
  translation?: string[];
  synonyms?: string[];
  antonyms?: string[];
  examples?: WordExample[];
}

export interface WordPartDetail {
  partOfSpeech: string;
  meanings: WordMeaningDetail[];
}

export interface WordDetail {
  _id: string;
  word: string;
  level: string;
  ipa?: WordIpa;
  audio?: WordAudio;
  image?: string;
  variations?: string[];
  relatedWords?: string[];
  parts: WordPartDetail[];
  isActive: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WordItem {
  _id: string;
  word: string;
  phonetic?: string;
  meaning: string;
  partOfSpeech?: string;
  example?: string;
  audioUrl?: string;
  imageUrl?: string;
  isDeleted?: boolean;
}

export interface QueryWordDto {
  search?: string;
  page?: number;
  limit?: number;
  partOfSpeech?: string;
  level?: string;
  isActive?: boolean;
}

export interface CreateWordDto {
  word: string;
  level: string;
  ipa?: WordIpa;
  audio?: WordAudio;
  image?: string;
  variations?: string[];
  relatedWords?: string[];
  parts?: WordPartDetail[];
  isActive?: boolean;
}

export type UpdateWordDto = Partial<CreateWordDto>;
