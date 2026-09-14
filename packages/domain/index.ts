export enum UserRole {
  ADMIN = "ADMIN",
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
}
export enum UserStatus {
  ACTIVE = "ACTIVE",
  BLOCKED = "BLOCKED",
  INVITED = "INVITED",
}
export enum AuthClientType {
  USER_WEB = "USER_WEB",
  ADMIN_WEB = "ADMIN_WEB",
}
export enum EnglishLevel {
  BEGINNER = "BEGINNER",
  ELEMENTARY = "ELEMENTARY",
  PRE_INTERMEDIATE = "PRE_INTERMEDIATE",
  INTERMEDIATE = "INTERMEDIATE",
  UPPER_INTERMEDIATE = "UPPER_INTERMEDIATE",
  ADVANCED = "ADVANCED",
}
export enum ContentStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}
export enum CourseVisibility {
  PUBLIC = "PUBLIC",
  UNLISTED = "UNLISTED",
  PRIVATE = "PRIVATE",
}
export enum AssignmentStatus {
  ACTIVE = "ACTIVE",
  ENDED = "ENDED",
}
export enum EnrollmentStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  DROPPED = "DROPPED",
}
export enum ExerciseType {
  DICTATION = "DICTATION",
  TOEIC = "TOEIC",
}
export enum DictationMode {
  SENTENCE = "SENTENCE",
  PARAGRAPH = "PARAGRAPH",
}
export enum ToeicPart {
  PART_1 = "PART_1",
  PART_2 = "PART_2",
  PART_3 = "PART_3",
  PART_4 = "PART_4",
}
export enum Difficulty {
  BEGINNER = "BEGINNER",
  INTERMEDIATE = "INTERMEDIATE",
  ADVANCED = "ADVANCED",
}
export enum QuestionKind {
  TEXT_INPUT = "TEXT_INPUT",
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
}
export enum AttemptStatus {
  IN_PROGRESS = "IN_PROGRESS",
  SUBMITTED = "SUBMITTED",
  GRADED = "GRADED",
  ABANDONED = "ABANDONED",
  EXPIRED = "EXPIRED",
}
export enum TtsJobStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}
export enum MediaType {
  IMAGE = "IMAGE",
  AUDIO = "AUDIO",
  VIDEO = "VIDEO",
  DOCUMENT = "DOCUMENT",
}
export enum MediaStorageProvider {
  LOCAL = "LOCAL",
  S3 = "S3",
  R2 = "R2",
  OTHER = "OTHER",
}
export enum MediaStatus {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}
export enum AudioSource {
  UPLOAD = "UPLOAD",
  TTS = "TTS",
}
export enum AudioSegmentType {
  INTRO = "INTRO",
  NARRATION = "NARRATION",
  SPEAKER = "SPEAKER",
  QUESTION = "QUESTION",
  OPTION = "OPTION",
  PAUSE = "PAUSE",
}
export enum ProgressStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}
export enum LandingVersionStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
}
export enum LandingSectionType {
  HERO = "HERO",
  FEATURED_COURSES = "FEATURED_COURSES",
  FEATURES = "FEATURES",
  HOW_IT_WORKS = "HOW_IT_WORKS",
  TOEIC_PRACTICE = "TOEIC_PRACTICE",
  DICTATION_DEMO = "DICTATION_DEMO",
  STATISTICS = "STATISTICS",
  TESTIMONIALS = "TESTIMONIALS",
  FAQ = "FAQ",
  FOOTER = "FOOTER",
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  assignedCourseIds: string[];
  permissions?: Permission[];
}
export interface CourseResource {
  id: string;
  assignedTeacherIds: string[];
}
export interface LessonResource {
  id: string;
  courseId: string;
  assignedTeacherIds: string[];
}
export interface ExerciseResource {
  id: string;
  lessonId: string;
  courseId: string;
  assignedTeacherIds: string[];
}
export interface StudentResource {
  id: string;
  enrolledCourseIds: string[];
}
export interface AttemptResource {
  id: string;
  courseId: string;
  assignedTeacherIds: string[];
}
export type Permission =
  | "dashboard:view-global"
  | "dashboard:view-assigned"
  | "student:view-any"
  | "student:view-assigned"
  | "student:update"
  | "student:block"
  | "teacher:view"
  | "teacher:create"
  | "teacher:update"
  | "course:view-any"
  | "course:view-assigned"
  | "course:create"
  | "course:update-any"
  | "course:update-assigned"
  | "course:archive"
  | "lesson:create"
  | "lesson:update"
  | "exercise:create"
  | "exercise:update"
  | "exercise:publish"
  | "attempt:view-any"
  | "attempt:view-assigned"
  | "report:view-global"
  | "report:view-assigned"
  | "media:manage-any"
  | "media:manage-assigned"
  | "landing:update"
  | "site-settings:update"
  | "tts-settings:update"
  | "tts-job:retry";

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
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}
export interface AdminSessionDto {
  accessToken: string;
  audience: "listenup-admin";
  user: AdminUser;
}
export interface MetricDto {
  label: string;
  value: string;
  change: string;
  tone: "blue" | "purple" | "green" | "amber" | "cyan" | "red";
}
export interface AdminCourseDto {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  level: string;
  category?: string;
  visibility?: CourseVisibility;
  orderIndex?: number;
  thumbnailMediaId?: string;
  lessons: number;
  students: number;
  status: ContentStatus;
  assignedTeacherIds: string[];
  assignedTeachers: Array<{
    id: string;
    fullName: string;
    email?: string;
  }>;
  updatedAt: string;
  theme: string;
}
export interface AdminStudentDto {
  id: string;
  fullName: string;
  email: string;
  targetLevel: string;
  learningGoal: string;
  status: UserStatus;
  lastActive: string;
  averageScore: number;
  enrolledCourseIds: string[];
}
export interface AdminTeacherDto {
  id: string;
  fullName: string;
  email: string;
  status: UserStatus;
  assignedCourseIds: string[];
  notes: string;
}
export interface AdminAttemptDto {
  id: string;
  studentName: string;
  exerciseTitle: string;
  courseTitle: string;
  courseId: string;
  type: ExerciseType;
  score: number;
  passed: boolean;
  listenCount: number;
  attemptNumber: number;
  submittedAt: string;
}
export interface AdminExerciseDto {
  id: string;
  title: string;
  courseId: string;
  lessonId: string;
  type: ExerciseType;
  status: ContentStatus;
  ttsStatus: TtsJobStatus;
  attempts: number;
  passRate: number;
}
export interface TtsJobDto {
  id: string;
  exerciseId: string;
  exerciseTitle: string;
  provider: string;
  voice: string;
  language: string;
  speed: number;
  status: TtsJobStatus;
  createdBy: string;
  createdAt: string;
  duration?: number;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
}
export interface LandingSectionDto {
  id: string;
  type: string;
  enabled: boolean;
  orderIndex: number;
  draftContent: Record<string, string>;
  publishedContent: Record<string, string>;
  updatedAt: string;
  publishedAt?: string;
}
