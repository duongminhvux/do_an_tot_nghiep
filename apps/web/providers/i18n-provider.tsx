'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import '@/lib/i18n';
import i18n from '@/lib/i18n';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const locale = (params?.locale as string) || '';

  useEffect(() => {
    const targetLang = locale === 'en' || locale === 'vi' ? locale : 'vi';

    if (i18n.language !== targetLang) {
      i18n.changeLanguage(targetLang);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('i18nextLng', targetLang);
      document.cookie = `NEXT_LOCALE=${targetLang}; path=/; max-age=31536000`;
      document.documentElement.lang = targetLang;
    }
  }, [locale]);

  return <>{children}</>;
}
