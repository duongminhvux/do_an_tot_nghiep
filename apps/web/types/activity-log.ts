export type ActivityAction =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_REGISTER'
  | 'SESSION_START'
  | 'SESSION_END'
  | 'HEARTBEAT'
  | 'PAGE_VIEW'
  | 'VOCABULARY_LEARN'
  | 'VOCABULARY_TEST'
  | 'VOCABULARY_SAVE'
  | 'DICTATION_START'
  | 'DICTATION_SUBMIT'
  | 'TOEIC_START'
  | 'TOEIC_SUBMIT'
  | 'CUSTOM'
  | string;

export type ActivityCategory =
  | 'AUTH'
  | 'SESSION'
  | 'VOCABULARY'
  | 'DICTATION'
  | 'ASSESSMENT'
  | 'GENERAL'
  | string;

export type ActivityStatus = 'SUCCESS' | 'FAILED' | 'INFO' | 'WARNING';

export interface CreateActivityLogPayload {
  action: ActivityAction;
  category?: ActivityCategory;
  description: string;
  metadata?: Record<string, any>;
  userId?: string;
  userEmail?: string;
  userName?: string;
  role?: string;
  status?: ActivityStatus;
  durationMs?: number;
}
