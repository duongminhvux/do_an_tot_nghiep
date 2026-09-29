export type StudyModeType = 'FLASHCARD' | 'MULTIPLE_CHOICE' | 'TYPING';
export type SrsRatingType = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

export interface RecordActionPayload {
  sessionId?: string;
  lessonId?: string;
  wordId: string;
  lessonWordId?: string;
  sessionStartedAt?: string;
  mode: StudyModeType;
  rating?: SrsRatingType;
  isCorrect?: boolean;
  answeredAt?: string;
}

export interface RecordActionResult {
  sessionId: string;
  sessionWordId: string;
  completedWords: number;
  totalWords: number;
  progress: number;
  lessonStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  wordReview: {
    status: 'LEARNING' | 'MASTERED';
    intervalDays: number;
    nextReviewAt?: string;
  };
}

export interface SectionProgressStat {
  sectionId?: string;
  name?: string;
  order?: number;
  totalWords: number;
  learnedCount: number;
  masteredCount: number;
  needReviewCount: number;
  unlearnedCount: number;
  progressPercent: number;
  isCompleted?: boolean;
  masteredWordIds: string[];
  needReviewWordIds: string[];
  unlearnedWordIds: string[];
}

export interface SectionProgressDetail extends SectionProgressStat {
  _id: string;
  name: string;
  slug?: string;
  order?: number;
}

export interface LessonProgressDetail {
  lessonId: string;
  progress: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt?: string;
  lastStudiedAt?: string;
  completedAt?: string;
  totalWords: number;
  learnedCount: number;
  masteredCount: number;
  needReviewCount: number;
  unlearnedCount: number;
  learnedWordIds: string[];
  masteredWordIds: string[];
  needReviewWordIds: string[];
  unlearnedWordIds: string[];
  sections?: SectionProgressDetail[];
  sectionStats?: Record<string, SectionProgressStat>;
}

export interface CollectionLessonProgress {
  lessonId: string;
  title: string;
  slug: string;
  progress: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  lastStudiedAt?: string;
}

export interface CollectionProgressDetail {
  collectionId: string;
  overallProgress: number;
  completedLessonsCount: number;
  totalLessonsCount: number;
  lessons: CollectionLessonProgress[];
}

export interface ReviewStats {
  totalWords: number;
  learningWords: number;
  masteredWords: number;
  dueToday: number;
}

export interface DashboardStudyStats {
  dailyGoal: number;
  todayLearnedCount: number;
  streak: number;
  totalLearnedWords: number;
  totalMasteredWords: number;
  hasStudiedToday: boolean;
  continueLesson?: {
    lessonId: string;
    lessonTitle: string;
    lessonSlug: string;
    collectionSlug?: string;
    progress: number;
  } | null;
}

export interface CheckDueReviewResult {
  hasDueWords: boolean;
  dueCount: number;
  dueToday: number;
  totalLearning: number;
  previewWords?: string[];
}

export interface UserWordReviewItem {
  _id: string;
  userId: string;
  wordId: any;
  status: 'LEARNING' | 'MASTERED';
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  intervalDays: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
}

