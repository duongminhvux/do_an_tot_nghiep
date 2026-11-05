export interface UserProfile {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role?: string;
  permissions?: string[];
  roleCodes?: string[];
  isSuperAdmin?: boolean;
  status?: "PENDING_ACTIVATION" | "ACTIVE" | "SUSPENDED" | "DISABLED";
  authVersion?: number;
}

export interface LoginDto {
  username?: string;
  email?: string;
  password?: string;
}

export interface AuthLoginResponse {
  message: string;
  accessToken: string;
  refreshToken?: string;
  profile: UserProfile;
}

export interface RefreshTokenResponse {
  message: string;
  accessToken: string;
  refreshToken?: string;
}
