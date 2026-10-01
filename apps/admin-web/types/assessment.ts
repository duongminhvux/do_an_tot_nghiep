export type ExamType = 'TOEIC' | 'IELTS';
export type ExamMode = 'PRACTICE' | 'FULL_TEST';
export type ExamSection = 'LISTENING' | 'READING' | 'FULL_TEST';
export type ExamStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface ExamItem {
  _id: string;
  name: string;
  slug: string;
  type: ExamType;
  mode: ExamMode;
  section?: ExamSection;
  status?: ExamStatus;
  description?: string;
  durationMinutes: number;
  totalQuestions?: number;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamDto {
  name: string;
  slug?: string;
  type: ExamType;
  mode: ExamMode;
  section?: ExamSection;
  status?: ExamStatus;
  description?: string;
  durationMinutes?: number;
  totalQuestions?: number;
  isActive?: boolean;
  order?: number;
}

export interface UpdateExamDto extends Partial<CreateExamDto> {}

export interface QueryExamDto {
  search?: string;
  type?: ExamType;
  mode?: ExamMode;
  section?: ExamSection;
  status?: ExamStatus;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface ExamListResponse {
  data: ExamItem[];
  total: number;
  page: number;
  limit: number;
}

export interface QuestionOption {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface QuestionItem {
  _id: string;
  examId: string;
  passageId?: string;
  passageTitle?: string;
  section: 'LISTENING' | 'READING';
  part: number;
  content: string;
  options: QuestionOption[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  audioUrl?: string;
  imageUrl?: string;
  order: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export interface PassageItem {
  _id: string;
  examId: string;
  title?: string;
  section: 'LISTENING' | 'READING';
  content?: string;
  audioUrl?: string;
  order: number;
  questionCount?: number;
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
