'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { changeLanguage } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-8 w-20 rounded-lg bg-slate-100 animate-pulse" />;
  }

  const currentLocale = (params?.locale as string) || (pathname?.startsWith('/en') ? 'en' : 'vi');

  const switchLocale = (newLocale: 'vi' | 'en') => {
    if (newLocale === currentLocale) return;

    changeLanguage(newLocale);
    if (typeof window !== 'undefined') {
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    }

    // Replace locale in current path
    if (pathname) {
      const segments = pathname.split('/');
      if (segments[1] === 'vi' || segments[1] === 'en') {
        segments[1] = newLocale;
        router.push(segments.join('/'));
      } else {
        router.push(`/${newLocale}${pathname}`);
      }
    } else {
      router.push(`/${newLocale}`);
    }
  };

  return (
    <div className="inline-flex items-center gap-1 p-0.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold">
      <button
        type="button"
        onClick={() => switchLocale('vi')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
          currentLocale === 'vi'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-800'
        }`}
        aria-label="Chuyển sang Tiếng Việt"
      >
        <span>🇻🇳</span>
        <span>VI</span>
      </button>

      <button
        type="button"
        onClick={() => switchLocale('en')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
          currentLocale === 'en'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-slate-500 hover:text-slate-800'
        }`}
        aria-label="Switch to English"
      >
        <span>🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  );
}
