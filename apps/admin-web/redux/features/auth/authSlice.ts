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
      action: PayloadAction<{ user: UserProfile; accessToken: string }>
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
      state.isLoading = false;
      if (typeof window !== 'undefined') {
        localStorage.setItem('adminAccessToken', action.payload.accessToken);
        localStorage.setItem('adminUser', JSON.stringify(action.payload.user));
        document.cookie = `adminAccessToken=${action.payload.accessToken}; path=/; max-age=604800; SameSite=Lax`;
      }
    },
    updateAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('adminAccessToken', action.payload);
        document.cookie = `adminAccessToken=${action.payload}; path=/; max-age=604800; SameSite=Lax`;
      }
    },
    setUser: (state, action: PayloadAction<UserProfile>) => {
      state.user = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('adminUser', JSON.stringify(action.payload));
      }
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.isInitialized = true;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('adminAccessToken');
        localStorage.removeItem('adminUser');
        document.cookie = 'adminAccessToken=; path=/; max-age=0; SameSite=Lax';
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    initializeAuth: (state) => {
      state.isInitialized = true;
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('adminAccessToken');
        const userStr = localStorage.getItem('adminUser');
        if (token && userStr) {
          try {
            state.accessToken = token;
            state.user = JSON.parse(userStr);
            state.isAuthenticated = true;
            document.cookie = `adminAccessToken=${token}; path=/; max-age=604800; SameSite=Lax`;
          } catch {
            localStorage.removeItem('adminAccessToken');
            localStorage.removeItem('adminUser');
            document.cookie = 'adminAccessToken=; path=/; max-age=0; SameSite=Lax';
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
