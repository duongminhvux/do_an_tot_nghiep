import type {PublicationInfo,PublicationStatus} from '@repo/shared-types/publication';
export type ExamType = "TOEIC" | "IELTS";
export type ExamMode = "PRACTICE" | "FULL_TEST";
export type ExamSection = "LISTENING" | "READING" | "FULL_TEST";
export type ExamStatus = "ACTIVE" | "INACTIVE";

export interface ExamGroupItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  order: number;
  isActive: boolean;
  examCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamGroupDto {
  name: string;
  slug?: string;
  description?: string;
  order?: number;
  isActive?: boolean;
}

export interface UpdateExamGroupDto extends Partial<CreateExamGroupDto> {}

export interface QueryExamGroupDto {
  search?: string;
  q?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface ExamGroupListResponse {
  data: ExamGroupItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ExamItem extends Partial<PublicationInfo> {
  _id: string;
  totalAttempts?: number;
  completedAttempts?: number;
  name: string;
  slug: string;
  type: ExamType;
  isActive: boolean;
  description?: string;
  durationMinutes: number;
  totalQuestions?: number;
  order: number;
  groupId?: string | null;
  group?: ExamGroupItem;
  createdAt: string;
  updatedAt: string;
}

export interface RawAttemptResult {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
}
export interface ExamAttemptItem {
  _id: string;
  userId: string | { _id: string; username?: string; email?: string } | null;
  examId: string | { _id: string; name: string; slug: string } | null;
  mode?: "TEST" | "PRACTICE";
  status: "IN_PROGRESS" | "FINISHED" | "COMPLETED" | "ABANDONED";
  selectedParts?: number[];
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers?: number;
  incorrectAnswers?: number;
  unansweredQuestions?: number;
  accuracy?: number;
  durationSpent?: number;
  createdAt?: string;
  submittedAt?: string;
  partResults?: (RawAttemptResult & { part: number })[];
  listeningResult?: RawAttemptResult;
  readingResult?: RawAttemptResult;
}
export interface ExamAttemptList {
  data: ExamAttemptItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateExamDto {
  name: string;
  slug?: string;
  type: ExamType;
  isActive?: boolean;
  description?: string;
  durationMinutes?: number;
  totalQuestions?: number;
  order?: number;
  groupId?: string | null;
}

export interface UpdateExamDto extends Partial<CreateExamDto> {}

export interface QueryExamDto {
  publicationStatus?:PublicationStatus;
  sortBy?: "name" | "totalQuestions" | "durationMinutes" | "order" | "isActive";
  sortOrder?: "asc" | "desc";
  search?: string;
  q?: string;
  type?: ExamType;
  isActive?: boolean;
  groupId?: string;
  page?: number;
  limit?: number;
}

export interface ExamListResponse {
  data: ExamItem[];
  total: number;
  page: number;
  limit: number;
}

export interface GeneratedAudioSegmentMeta {
  text?: string;
  speaker?: string;
  voiceId?: string;
  startMs?: number;
  endMs?: number;
}

export interface GeneratedAudioMeta {
  source?: "TTS" | "UPLOAD";
  status?: "NONE" | "PROCESSING" | "READY" | "STALE" | "FAILED";
  storageKey?: string;
  provider?: string;
  device?: string;
  language?: string;
  voiceIds?: string[];
  speed?: number;
  durationMs?: number;
  scriptHash?: string;
  generatedAt?: string;
  error?: string;
  segments?: GeneratedAudioSegmentMeta[];
}

export interface QuestionOption {
  key: "A" | "B" | "C" | "D";
  text: string;
}

export interface QuestionItem {
  _id: string;
  examId: string;
  passageGroupId?: string;
  passageId?: string;
  passageTitle?: string;
  section: "LISTENING" | "READING";
  part: number;
  content: string;
  options: QuestionOption[];
  correctAnswer: "A" | "B" | "C" | "D";
  explanation?: string;
  audioUrl?: string;
  audioMeta?: GeneratedAudioMeta;
  imageUrl?: string;
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type PassageType =
  "TEXT" | "EMAIL" | "ADVERTISEMENT" | "ARTICLE" | "NOTICE" | "CHAT";

export interface PassageGroupItem {
  _id: string;
  examId: string;
  section: "LISTENING" | "READING";
  part: number;
  title?: string;
  order: number;
  passages?: PassageItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PassageItem {
  _id: string;
  passageGroupId?: string;
  examId?: string;
  type?: PassageType;
  title?: string;
  section?: "LISTENING" | "READING";
  part?: number;
  content?: string;
  audioUrl?: string;
  audioMeta?: GeneratedAudioMeta;
  imageUrl?: string;
  order: number;
  passages?: PassageItem[];
  questionCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttemptItem {
  _id: string;
  examId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  score: number;
  totalScore: number;
  durationSeconds: number;
  completedAt: string;
}
