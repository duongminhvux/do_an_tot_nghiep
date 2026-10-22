export enum ExamMode {
  TEST = 'TEST',
  PRACTICE = 'PRACTICE',
}

export interface RawSectionResult {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
}

export enum ToeicAttemptStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
  ABANDONED = 'ABANDONED',
}

export interface SnapshotQuestion {
  _id: string;
  part: number;
  content: string;
  options: { key: string; text: string }[];
  imageUrl?: string;
  audioUrl?: string;
  passageGroupId?: string;
  passages: {
    _id?: string;
    content?: string;
    imageUrl?: string;
    audioUrl?: string;
  }[];
  correctAnswer: string;
  explanation?: string;
  transcript?: string;
}
