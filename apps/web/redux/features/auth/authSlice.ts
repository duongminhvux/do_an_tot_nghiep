import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserProfile } from '@/types';

export interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        user: UserProfile;
        accessToken: string;
      }>
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
      state.isLoading = false;
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', action.payload.accessToken);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
        localStorage.removeItem('refreshToken');
        document.cookie = `accessToken=${action.payload.accessToken}; path=/; max-age=604800; SameSite=Lax`;
      }
    },
    updateAccessToken: (
      state,
      action: PayloadAction<string>
    ) => {
      const newAccess = action.payload;
      state.accessToken = newAccess;
      state.isAuthenticated = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', newAccess);
        localStorage.removeItem('refreshToken');
        document.cookie = `accessToken=${newAccess}; path=/; max-age=604800; SameSite=Lax`;
      }
    },
    setUser: (state, action: PayloadAction<UserProfile>) => {
      state.user = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(action.payload));
      }
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.isInitialized = true;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    initializeAuth: (state) => {
      state.isInitialized = true;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refreshToken');
        const token = localStorage.getItem('accessToken');
        const userStr = localStorage.getItem('user');
        if (userStr && token) {
          try {
            state.user = JSON.parse(userStr);
            state.accessToken = token;
            state.isAuthenticated = true;
            document.cookie = `accessToken=${token}; path=/; max-age=604800; SameSite=Lax`;
          } catch {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
            state.isAuthenticated = false;
          }
        } else {
          state.isAuthenticated = false;
        }
      }
    },
  },
});

export const {
  setCredentials,
  updateAccessToken,
  setUser,
  logout,
  setLoading,
  initializeAuth,
} = authSlice.actions;

export default authSlice.reducer;
