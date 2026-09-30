export type UserRole = 'User' | 'Admin' | 'Moderator';
export type UserStatus = 'active' | 'banned';

export interface UserCourseProgress {
  id: string;
  title: string;
  completedItems: number;
  totalItems: number;
  type: 'lessons' | 'words';
  percentage: number;
  color: string;
  iconBg: string;
}

export interface UserRecentActivity {
  id: string;
  title: string;
  time: string;
  iconType: 'lesson' | 'word' | 'auth' | 'profile';
}

export interface UserPersonalDetail {
  fullName: string;
  email: string;
  phone?: string;
  authProvider: 'local' | 'google';
  isVerified: boolean;
  createdAt: string;
  bio?: string;
}

export interface UserLearningStats {
  totalWordsLearned: number;
  accuracyRate: number;
  testScoresAvg: number;
  studyTimeMinutes: number;
  dailyGoalStreak: number;
}

export interface UserItem {
  id: string; // e.g. "U001"
  _id?: string; // mongo id
  name: string;
  email: string;
  avatarUrl?: string;
  role?: UserRole;
  status: UserStatus;
  createdAt: string;
  registrationAgo?: string;
  lastActive: string;
  lastActiveDetails?: string;
  phone?: string;
  notes?: string;
  wordsLearned: number;
  completedCoursesCount?: number;
  inProgressCoursesCount?: number;
  totalEnrolledCount?: number;
  streakDays: number;
  courses: UserCourseProgress[];
  recentActivities: UserRecentActivity[];
  personalDetail?: UserPersonalDetail;
  learningStats?: UserLearningStats;
}

export interface UserStatsSummary {
  totalUsers: number;
  activeUsers: number;
  newUsers7d: number;
  bannedUsers: number;
  growthTotal: number;
  growthActive: number;
  growthNew: number;
  growthBanned: number;
}

export interface QueryUserDto {
  search?: string;
  role?: string;
  status?: string;
  dateRange?: string;
  page?: number;
  limit?: number;
}

export interface UserListResponse {
  items: UserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: UserStatsSummary;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
  phone?: string;
  avatarUrl?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  phone?: string;
  avatarUrl?: string;
}

export interface UpdateProfileDto {
  username?: string;
  avatarUrl?: string;
  bio?: string;
}
