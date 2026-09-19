// ==========================
// COLLECTIONS
// ==========================
export interface CollectionItem {
  _id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QueryCollectionDto {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateCollectionDto {
  name: string;
  description?: string;
  thumbnail?: string;
}

export interface UpdateCollectionDto {
  name?: string;
  description?: string;
  thumbnail?: string;
}

// ==========================
// LESSONS
// ==========================
export interface LessonItem {
  _id: string;
  title: string;
  description?: string;
  collectionId?: string;
  order?: number;
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
