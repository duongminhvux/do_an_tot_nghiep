'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Sparkles,
  Search,
} from 'lucide-react';

export default function VocabularyPage() {
  const { t } = useTranslation('common');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 w-full max-w-7xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 sm:p-10 text-white shadow-md">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('nav.vocabulary', 'Từ vựng')}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {t('featured_collections', 'Bộ từ vựng học tiếng Anh')}
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
            {t('featured_collections_desc', 'Các bộ sưu tập từ vựng phong phú được biên soạn theo lộ trình chuẩn quốc tế với phiên âm IPA và audio giọng bản xứ.')}
          </p>
        </div>

        {/* Decorative backdrop shapes */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-20 bottom-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Content Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs">
          <BookOpen className="w-7 h-7" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h3 className="text-base font-bold text-slate-900">
            {t('featured_collections', 'Danh mục Từ vựng')}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {t('no_collections_desc', 'Dữ liệu sẽ hiển thị tự động khi API backend có nội dung bài học.')}
          </p>
        </div>
      </div>
    </div>
  );
}
