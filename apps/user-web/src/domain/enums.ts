export enum UserRole { ADMIN = "ADMIN", TEACHER = "TEACHER", STUDENT = "STUDENT" }
export enum UserStatus { ACTIVE = "ACTIVE", BLOCKED = "BLOCKED", INVITED = "INVITED" }
export enum ContentStatus { DRAFT = "DRAFT", PUBLISHED = "PUBLISHED", ARCHIVED = "ARCHIVED" }
export enum ExerciseType { DICTATION = "DICTATION", TOEIC = "TOEIC" }
export enum DictationMode { SENTENCE = "SENTENCE", PARAGRAPH = "PARAGRAPH" }
export enum ToeicPart { PART_1 = "PART_1", PART_2 = "PART_2", PART_3 = "PART_3", PART_4 = "PART_4" }
export enum AttemptStatus { IN_PROGRESS = "IN_PROGRESS", SUBMITTED = "SUBMITTED", GRADED = "GRADED", ABANDONED = "ABANDONED", EXPIRED = "EXPIRED" }
export enum ProgressStatus { NOT_STARTED = "NOT_STARTED", IN_PROGRESS = "IN_PROGRESS", COMPLETED = "COMPLETED" }
export type LessonState = "COMPLETED" | "CURRENT" | "NOT_STARTED" | "LOCKED";
export type FeedbackType = "CORRECT" | "MISSING" | "EXTRA" | "REPLACED";
