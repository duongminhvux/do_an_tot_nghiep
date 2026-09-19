'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { logout, setUser } from '@/redux/features/auth/authSlice';
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

    if (!isAuthenticated) {
      router.replace(`/${locale}/login`);
      return;
    }

    // Token exists, verify with backend profile API and verify ADMIN role
    const verifySession = async () => {
      try {
        const res = await authService.getProfile();
        if (res.data) {
          if (res.data.role !== 'ADMIN') {
            dispatch(logout());
            router.replace(`/${locale}/login?error=unauthorized`);
            return;
          }
          dispatch(setUser(res.data));
        }
        setIsVerifying(false);
      } catch {
        // Token expired or invalid, and refresh failed
        dispatch(logout());
        router.replace(`/${locale}/login`);
      }
    };

    verifySession();
  }, [isAuthenticated, isInitialized, router, dispatch, locale]);

  if (!isInitialized || !isAuthenticated || isVerifying) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="mt-3 text-sm font-semibold text-slate-600">
          {locale === 'en' ? 'Verifying admin session...' : 'Đang kiểm tra quyền quản trị...'}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
