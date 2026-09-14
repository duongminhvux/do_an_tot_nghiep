import type {
  AttemptStatus,
  ContentStatus,
  DictationMode,
  ExerciseType,
  ProgressStatus,
  ToeicPart,
  UserRole,
  UserStatus,
} from "./enums";

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  targetLevel: string;
  learningGoal: string;
}
export interface MediaFile {
  id: string;
  url: string;
  duration: number;
  mimeType: string;
}
export interface Course {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  level: string;
  status: ContentStatus;
  theme: "person" | "meeting" | "headphones";
}
export interface CourseEnrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: string;
}
export interface VocabularyItem {
  term: string;
  pronunciation: string;
  definition: string;
}
export interface ExpressionItem {
  phrase: string;
  meaning: string;
}
export interface Lesson {
  id: string;
  courseId: string;
  slug: string;
  order: number;
  title: string;
  description: string;
  duration: number;
  status: ContentStatus;
  vocabulary: VocabularyItem[];
  expressions: ExpressionItem[];
}
export interface ExerciseOption {
  id: string;
  label: string;
  text?: string;
}
export interface ExerciseQuestion {
  id: string;
  prompt?: string;
  image?: string;
  options: ExerciseOption[];
  correctOptionId?: string;
  explanation?: string;
}
export interface ExerciseGroup {
  id: string;
  listenCount?: number;
  audio?: MediaFile;
  image?: string;
  transcript?: string;
  questions: ExerciseQuestion[];
}
export interface ListeningExercise {
  id: string;
  lessonId: string;
  title: string;
  type: ExerciseType;
  status: ContentStatus;
  maxListenCount: number;
  maxAttemptCount: number;
  passThreshold: number;
  dictationMode?: DictationMode;
  toeicPart?: ToeicPart;
  correctAnswer?: string;
  groups?: ExerciseGroup[];
}
export interface ListeningAttempt {
  id: string;
  userId: string;
  exerciseId: string;
  status: AttemptStatus;
  attemptNumber: number;
  listenCount: number;
  listenCountsByGroup?: Record<string, number>;
  answers: AttemptAnswer[];
  score?: number;
  passed?: boolean;
  startedAt: string;
  submittedAt?: string;
}
export interface AttemptAnswer {
  questionId?: string;
  value: string;
}
export interface LessonProgress {
  userId: string;
  lessonId: string;
  status: ProgressStatus;
  lastOpenedAt?: string;
}
