'use client';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import LanguageSwitcher from '@/components/language-switcher';
import { useAppSelector } from '@/redux/hooks';

export default function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminAccessToken') : null;
    if (isAuthenticated || token) {
      router.replace(`/${locale}`);
    }
  }, [isAuthenticated, locale, router]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('adminAccessToken') : null;
  if (isAuthenticated || token) {
    return null;
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-50 text-slate-900">
      {/* Top right language switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <LanguageSwitcher />
      </div>

      {/* Subtle soft blue gradient orbs */}
      <div className="pointer-events-none absolute -top-28 -left-24 h-[450px] w-[450px] rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[420px] w-[420px] rounded-full bg-sky-400/10 blur-3xl" />

      {/* Auth Card */}
      <div className="relative z-10 bg-white border border-slate-200 p-8 rounded-2xl w-full max-w-[420px] shadow-lg shadow-slate-200/60">
        {children}
      </div>
    </div>
  );
}
