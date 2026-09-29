import apiClient from '@/lib/axios';
import {
  ApiResponse,
  RecordActionPayload,
  RecordActionResult,
  LessonProgressDetail,
  CollectionProgressDetail,
  ReviewStats,
  DashboardStudyStats,
  CheckDueReviewResult,
  UserWordReviewItem,
} from './types';

export const learningService = {
  /**
   * Tạo session học mới
   */
  createSession: async (data: {
    lessonId: string;
    type?: 'LESSON' | 'REVIEW';
    startedAt?: string;
  }) => {
    const res = await apiClient.post<ApiResponse<any>>(
      '/learning/sessions',
      data,
    );
    return res.data;
  },

  /**
   * Ghi nhận tương tác / đánh giá từ vựng (Lazy session creation + SRS + Progress)
   */
  recordAction: async (data: RecordActionPayload) => {
    const res = await apiClient.post<ApiResponse<RecordActionResult>>(
      '/learning/sessions/record-action',
      data,
    );
    return res.data;
  },

  /**
   * Đánh dấu hoàn thành session
   */
  completeSession: async (sessionId: string, endedAt?: string) => {
    const res = await apiClient.patch<ApiResponse<any>>(
      `/learning/sessions/${sessionId}/complete`,
      { endedAt },
    );
    return res.data;
  },

  /**
   * Lấy tiến độ của một bài học
   */
  getLessonProgress: async (lessonId: string) => {
    const res = await apiClient.get<ApiResponse<LessonProgressDetail>>(
      `/learning/progress/lesson/${lessonId}`,
    );
    return res.data;
  },

  /**
   * Lấy chi tiết tiến độ các section trong một bài học
   */
  getLessonSections: async (lessonId: string) => {
    const res = await apiClient.get<ApiResponse<any[]>>(
      `/learning/progress/lesson/${lessonId}/sections`,
    );
    return res.data;
  },

  /**
   * Lấy danh sách từ vựng cần học:
   * Mặc định lọc bỏ các từ ĐÃ HỌC QUA (đã có UserLessonWord) do các từ này đã có trong UserWordReview để ôn tập riêng.
   */
  getStudyWords: async (
    lessonId: string,
    excludeLearned: boolean = true,
    sectionId?: string,
    excludeMastered: boolean = false,
  ) => {
    const res = await apiClient.get<ApiResponse<any>>(
      `/learning/progress/lesson/${lessonId}/study-words`,
      {
        params: {
          excludeLearned: excludeLearned ? 'true' : 'false',
          sectionId: sectionId && sectionId !== 'all' ? sectionId : undefined,
          excludeMastered: excludeMastered ? 'true' : undefined,
        },
      },
    );
    return res.data;
  },

  /**
   * Lấy tiến độ của toàn bộ collection
   */
  getCollectionProgress: async (collectionId: string) => {
    const res = await apiClient.get<ApiResponse<CollectionProgressDetail>>(
      `/learning/progress/collection/${collectionId}`,
    );
    return res.data;
  },

  /**
   * Kiểm tra xem user có từ nào cần ôn tập hôm nay không (cho popup & banner)
   */
  checkDueReviews: async () => {
    const res = await apiClient.get<ApiResponse<CheckDueReviewResult>>(
      '/learning/reviews/check-due',
    );
    return res.data;
  },

  /**
   * Lấy danh sách từ đến hạn ôn tập
   */
  getDueReviews: async (limit: number = 30) => {
    const res = await apiClient.get<ApiResponse<UserWordReviewItem[]>>(
      '/learning/reviews/due',
      {
        params: { limit },
      },
    );
    return res.data;
  },

  /**
   * Đánh giá 1 từ trong phiên ôn tập độc lập (SRS)
   */
  recordReview: async (
    wordId: string,
    rating: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY',
  ) => {
    const res = await apiClient.post<ApiResponse<any>>(
      '/learning/reviews/record',
      { wordId, rating },
    );
    return res.data;
  },

  /**
   * Lấy thống kê ôn tập SRS
   */
  getReviewStats: async () => {
    const res = await apiClient.get<ApiResponse<ReviewStats>>(
      '/learning/reviews/stats',
    );
    return res.data;
  },

  /**
   * Lấy thống kê tiến độ học tập cho Dashboard ("Học hôm nay", "Thành tích", streak)
   */
  getDashboardStats: async (timezoneOffset?: number) => {
    const offset =
      timezoneOffset !== undefined
        ? timezoneOffset
        : new Date().getTimezoneOffset();
    const res = await apiClient.get<ApiResponse<DashboardStudyStats>>(
      '/learning/progress/dashboard-stats',
      {
        params: { timezoneOffset: offset },
      },
    );
    return res.data;
  },
};

