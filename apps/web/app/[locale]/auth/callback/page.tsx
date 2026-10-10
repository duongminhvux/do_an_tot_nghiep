'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useAppDispatch } from '@/redux/hooks';
import { setCredentials } from '@/redux/features/auth/authSlice';
import { authService } from '@/services';
import { Loader2, AlertCircle } from 'lucide-react';

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const dispatch = useAppDispatch();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError(locale === 'en' ? 'Authentication token missing.' : 'Không tìm thấy mã xác thực.');
      setTimeout(() => {
        router.replace(`/${locale}/login`);
      }, 2000);
      return;
    }

    const processGoogleLogin = async () => {
      try {
        // Decode token for immediate fallback user info
        const decoded = parseJwt(token);
        const fallbackUser = {
          _id: decoded?._id || '',
          username: decoded?.username || decoded?.email?.split('@')[0] || 'User',
          email: decoded?.email || '',
          role: decoded?.role || 'USER',
        };

        // Save immediately
        localStorage.setItem('accessToken', token);
        document.cookie = `accessToken=${token}; path=/; max-age=604800; SameSite=Lax`;
        dispatch(setCredentials({ user: fallbackUser, accessToken: token }));

        // Fetch full profile from API if possible
        try {
          const profileRes = await authService.getProfile();
          if (profileRes.data) {
            dispatch(setCredentials({ user: profileRes.data, accessToken: token }));
          }
        } catch {
          // If getProfile fails, fallbackUser is already set
        }

        // Redirect to homepage
        router.replace(`/${locale}`);
      } catch (err: any) {
        setError(locale === 'en' ? 'Google login failed.' : 'Đăng nhập Google thất bại.');
        setTimeout(() => {
          router.replace(`/${locale}/login`);
        }, 2000);
      }
    };

    processGoogleLogin();
  }, [searchParams, router, locale, dispatch]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50">
        <div className="flex items-center gap-3 p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl max-w-md w-full shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50">
      <div className="flex flex-col items-center space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-sm font-semibold text-slate-700">
          {locale === 'en' ? 'Processing Google login...' : 'Đang xử lý đăng nhập Google...'}
        </p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
