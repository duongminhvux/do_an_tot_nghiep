// ==========================
// VOCABULARY GROUPS
// ==========================
export interface VocabularyGroupItem {
  _id: string;
  name: string;
  slug: string;
  order?: number;
  isActive?: boolean;
  collectionsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface QueryVocabularyGroupDto {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateVocabularyGroupDto {
  name: string;
  slug?: string;
  order?: number;
  isActive?: boolean;
}

export interface UpdateVocabularyGroupDto {
  name?: string;
  slug?: string;
  order?: number;
  isActive?: boolean;
}

// ==========================
// COLLECTIONS
// ==========================
export interface CollectionItem {
  _id: string;
  groupId?: string | { _id: string; name: string; slug: string; order?: number; isActive?: boolean } | any;
  name: string;
  slug?: string;
  description?: string;
  thumbnail?: string;
  coverUrl?: string;
  order?: number;
  isActive?: boolean;
  lessonsCount?: number;
  wordsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface QueryCollectionDto {
  search?: string;
  groupId?: string;
  page?: number;
  limit?: number;
}

export interface CreateCollectionDto {
  name: string;
  groupId?: string;
  description?: string;
  thumbnail?: string;
}

export interface UpdateCollectionDto {
  name?: string;
  groupId?: string;
  description?: string;
  thumbnail?: string;
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
  collectionId?: string;
  order?: number;
  isActive?: boolean;
  isDeleted?: boolean;
  wordsCount?: number;
  sectionsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLessonDto {
  title: string;
  description?: string;
  collectionId?: string;
  order?: number;
}

export interface UpdateLessonDto {
  title?: string;
  description?: string;
  collectionId?: string;
  order?: number;
}

// ==========================
// SECTIONS
// ==========================
export interface SectionItem {
  _id: string;
  lessonId: string;
  name: string;
  slug?: string;
  order?: number;
  wordsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ==========================
export interface WordIpa {
  us?: string;
  uk?: string;
}

export interface WordAudio {
  us?: string;
  uk?: string;
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
  slug?: string;
  level?: string;
  ipa?: WordIpa;
  audio?: WordAudio;
  image?: string;
  variations?: string[];
  relatedWords?: string[];
  parts?: WordPartDetail[];
  phonetic?: string;
  meaning?: string;
  partOfSpeech?: string;
  example?: string;
  audioUrl?: string;
  imageUrl?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LessonWordItem {
  _id: string;
  lessonId: string;
  wordId: WordDetail | any;
  sectionId?: any;
  order?: number;
  customNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

// WORDS
// ==========================
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
}

export interface CreateWordDto {
  word: string;
  phonetic?: string;
  meaning: string;
  partOfSpeech?: string;
  example?: string;
  audioUrl?: string;
  imageUrl?: string;
}

export interface UpdateWordDto {
  word?: string;
  phonetic?: string;
  meaning?: string;
  partOfSpeech?: string;
  example?: string;
  audioUrl?: string;
  imageUrl?: string;
}

