import type {
  ExerciseType,
  FeedbackType,
  LessonState,
  ToeicPart,
} from "./enums";
import type {
  ExerciseGroup,
  ExpressionItem,
  User,
  VocabularyItem,
} from "./entities";

export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface ApiSuccess<T> {
  data: T;
  meta?: ApiMeta;
}
export interface ApiFailure {
  error: { code: string; message: string; details?: Record<string, unknown> };
}
export interface SessionDto {
  accessToken: string;
  user: User;
}
export interface CourseCardDto {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  level: string;
  thumbnailUrl?: string;
  theme: "person" | "meeting" | "headphones";
  lessonCount: number;
  learnerCount: number;
  progress: number;
  status: "IN_PROGRESS" | "NOT_STARTED" | "COMPLETED";
}
export interface LessonListItemDto {
  id: string;
  slug: string;
  order: number;
  title: string;
  duration: number;
  state: LessonState;
  exerciseCount: number;
}
export interface CourseDetailDto extends CourseCardDto {
  lessons: LessonListItemDto[];
  completedLessons: number;
}
export interface ExerciseLinkDto {
  id: string;
  title: string;
  type: ExerciseType | "QUIZ" | "SHADOWING";
  available: boolean;
}
export interface LessonResourceDto {
  id: string;
  type: "IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT" | "LINK";
  title: string;
  url?: string;
  duration?: number;
  mimeType?: string;
}
export interface LessonDetailDto {
  id: string;
  slug: string;
  courseSlug: string;
  courseTitle: string;
  title: string;
  description: string;
  duration: number;
  vocabulary: VocabularyItem[];
  expressions: ExpressionItem[];
  resources: LessonResourceDto[];
  lessons: LessonListItemDto[];
  exercises: ExerciseLinkDto[];
}
export interface DashboardDto {
  userName: string;
  stats: { label: string; value: string; change: string; icon: string }[];
  continueLearning: {
    courseSlug: string;
    lessonSlug: string;
    courseTitle: string;
    lessonTitle: string;
    category: string;
    duration: number;
    progress: number;
    theme: CourseCardDto["theme"];
  };
  weeklyProgress: { day: string; value: number }[];
  courses: CourseCardDto[];
  recentActivity: HistoryItemDto[];
  recommended: CourseCardDto[];
  weeklyGoal: number;
  streakDays: number;
  streak: boolean[];
  achievements: { title: string; description: string; tone: "gold" | "blue" }[];
}
export interface FeedbackSegmentDto {
  value: string;
  type: FeedbackType;
}
export interface DictationResultDto {
  attemptId: string;
  score: number;
  passed: boolean;
  threshold: number;
  accuracy: { correctWords: number; totalWords: number };
  studentAnswer: string;
  correctAnswer: string;
  feedbackSegments: FeedbackSegmentDto[];
  feedbackMessage: string;
}
export interface ToeicResultDto {
  attemptId: string;
  score: number;
  passed: boolean;
  threshold: number;
  correctCount: number;
  totalQuestions: number;
  partBreakdown: { part: string; correct: number; total: number }[];
  strengths: string[];
  improvements: string[];
  answerReviewEnabled: boolean;
  transcripts?: { groupId: string; label: string; text: string }[];
  answers: {
    questionId: string;
    selectedOptionId: string;
    selectedOptionText?: string;
    selectedOptionLabel?: string;
    correctOptionId?: string;
    correctOptionLabel?: string;
    correctOptionText?: string;
    explanation?: string;
    isCorrect: boolean;
  }[];
}
export interface ExerciseDto {
  id: string;
  lessonId: string;
  courseSlug: string;
  lessonSlug: string;
  title: string;
  type: ExerciseType;
  progressLabel: string;
  maxListenCount: number;
  maxAttemptCount: number;
  passThreshold: number;
  audio?: import("./entities").MediaFile;
  attempt: {
    id: string;
    attemptNumber: number;
    listenCount: number;
    status: string;
    answers: { questionId?: string; value: string }[];
  };
  correctAnswer?: string;
  groups?: ExerciseGroup[];
  toeicPart?: ToeicPart;
}
export interface HistoryItemDto {
  id: string;
  attemptId: string;
  exerciseId: string;
  exerciseTitle: string;
  courseTitle: string;
  type: ExerciseType;
  score: number;
  passed: boolean;
  attemptNumber: number;
  submittedAt: string;
}
export interface UserSettingsDto {
  emailNotifications: boolean;
  learningReminder: boolean;
  playbackSpeed: number;
  reducedMotion: boolean;
}
