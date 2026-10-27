'use client';
import { SiteLogo } from '@/components/site-logo';
import { useSiteSettings } from '@/providers/site-settings-provider';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import LanguageSwitcher from '@/components/language-switcher';
import { useAppSelector } from '@/redux/hooks';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = useSiteSettings();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      router.replace(`/${locale}`);
    }
  }, [isAuthenticated, isInitialized, locale, router]);

  if (!isInitialized || isAuthenticated) {
    return null;
  }

  return (
    <div className="relative min-h-dvh flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-50">
      {/* Top right language switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <LanguageSwitcher />
      </div>

      {/* Ambient soft blue gradient orbs */}
      <div className="pointer-events-none absolute -top-28 -left-24 h-[450px] w-[450px] rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[420px] w-[420px] rounded-full bg-sky-400/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-indigo-400/5 blur-3xl" />

      {/* Auth Card */}
      <div className="relative z-10 bg-white p-6 rounded-2xl w-full max-w-[400px]">
        <div className="mb-4 flex justify-center"><SiteLogo fallback={<span className="font-semibold text-slate-700">{settings.siteName}</span>} /></div>
        {children}
      </div>
    </div>
  );
}
