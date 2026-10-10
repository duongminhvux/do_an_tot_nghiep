'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { logout, setUser, updateAccessToken } from '@/redux/features/auth/authSlice';
import { authService } from '@/services';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    if (!isInitialized) return;

    const verifySession = async () => {
      try {
        // If not marked authenticated in store, attempt silent refresh first
        if (!isAuthenticated) {
          try {
            const refreshRes = await authService.refreshToken();
            const newAccess =
              refreshRes?.data?.accessToken || (refreshRes as any)?.accessToken;

            if (newAccess) {
              dispatch(updateAccessToken(newAccess));
            } else {
              throw new Error('No access token returned');
            }
          } catch {
            dispatch(logout());
            router.replace(`/${locale}/login`);
            return;
          }
        }

        // Fetch profile to verify session and get latest user data
        const res = await authService.getProfile();
        if (res?.data) {
          dispatch(setUser(res.data));
        }
        setIsVerifying(false);
      } catch {
        // Token expired or invalid, and auto-refresh failed
        dispatch(logout());
        router.replace(`/${locale}/login`);
      }
    };

    verifySession();
  }, [isAuthenticated, isInitialized, router, dispatch, locale]);

  if (!isInitialized || isVerifying) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="mt-3 text-sm font-semibold text-slate-600">
          {locale === 'en' ? 'Verifying session...' : 'Đang kiểm tra thông tin đăng nhập...'}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
