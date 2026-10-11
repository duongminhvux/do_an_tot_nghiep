"use client";

import { useEffect } from "react";
import { isAccessTokenValid } from "@/lib/access-token";
import { refreshAccessToken } from "@/lib/axios";
import { store } from "@/redux/store";
import {
  initializeAuth,
  logout,
  setUser,
  updateAccessToken,
} from "@/redux/features/auth/authSlice";
import { authService } from "@/services/auth.service";

let restorePromise: Promise<void> | null = null;

export function restoreSession(): Promise<void> {
  if (store.getState().auth.isInitialized) return Promise.resolve();
  if (!restorePromise) {
    restorePromise = (async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (isAccessTokenValid(token)) {
          store.dispatch(updateAccessToken(token));
        } else {
          await refreshAccessToken();
        }

        const profile = await authService.getProfile();
        if (!profile.data) throw new Error("Missing user profile");
        store.dispatch(setUser(profile.data));
      } catch {
        store.dispatch(logout());
      } finally {
        store.dispatch(initializeAuth());
        restorePromise = null;
      }
    })();
  }
  return restorePromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void restoreSession();
  }, []);

  return children;
}
