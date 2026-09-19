export interface UserProfile {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role?: string;
}

export interface LoginDto {
  username?: string;
  email?: string;
  password?: string;
}

export interface RegisterDto {
  username: string;
  email: string;
  password?: string;
}

export interface VerifyEmailDto {
  email: string;
  code: string;
}

export interface ChangePasswordDto {
  oldPassword?: string;
  newPassword?: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  email: string;
  code: string;
  newPassword?: string;
}

export interface AuthLoginResponse {
  message: string;
  accessToken: string;
  profile: UserProfile;
}

export interface RefreshTokenResponse {
  message: string;
  accessToken: string;
}
