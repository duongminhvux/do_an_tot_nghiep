'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { RotateCcw, ArrowRight, Clock } from 'lucide-react';

interface DueReviewBannerProps {
  dueCount: number;
  previewWords?: string[];
  locale?: string;
}

export function DueReviewBanner({
  dueCount,
  previewWords = [],
  locale = 'vi',
}: DueReviewBannerProps) {
  const { t } = useTranslation('vocabulary');

  if (dueCount <= 0) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-sky-50/80 to-indigo-50/70 p-4 sm:p-5 shadow-xs transition-all animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Subtle blue background glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-200/40 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Icon + Content */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
            <RotateCcw className="w-5 h-5 text-white" />
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                {t('review.banner_title')}
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white shadow-2xs">
                <Clock className="w-3 h-3" />
                {dueCount}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t('review.banner_desc', { count: dueCount })}
              {previewWords.length > 0 && (
                <span className="hidden sm:inline text-blue-900/80 font-medium ml-1">
                  ({t('review.preview_label')} <strong className="font-bold text-blue-950">{previewWords.join(', ')}</strong>...)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: CTA Button */}
        <div className="shrink-0 flex items-center gap-2">
          <Link
            href={`/${locale}/vocabulary/review`}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all shadow-sm shadow-blue-500/25 cursor-pointer"
          >
            <span>{t('review.btn_review_now')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default DueReviewBanner;
