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

export interface ActivityLogItem {
  _id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  role?: string;
  action: ActivityAction;
  category: ActivityCategory;
  description?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: ActivityStatus;
  durationMs?: number;
  createdAt: string;
  updatedAt?: string;
  actionLabel?: string;
  categoryLabel?: string;
  statusLabel?: string;
}

export interface ActivityLogsResponse {
  items: ActivityLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface QueryActivityLogsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  action?: string;
  userId?: string;
  userEmail?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  lang?: string;
}

export interface ActivityLogFilterOption {
  value: string;
  label: string;
  category?: string;
}

export interface ActivityLogFilterResponse {
  categories: ActivityLogFilterOption[];
  actions: ActivityLogFilterOption[];
}
