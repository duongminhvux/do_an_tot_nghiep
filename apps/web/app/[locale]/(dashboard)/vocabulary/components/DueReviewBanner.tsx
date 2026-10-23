'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { RotateCcw, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { surface, tones } from '@/components/ui/page';
import { cn } from '@/lib/utils';

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
    <div
      className={cn(
        surface,
        'border-amber-200 bg-amber-50/60 p-5 animate-in fade-in slide-in-from-top-2 duration-300',
      )}
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        {/* Left: Icon + Content */}
        <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tones.amber)}>
            <RotateCcw className="h-5 w-5" />
          </span>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {t('review.banner_title')}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                <Clock className="h-3 w-3" />
                {dueCount}
              </span>
            </div>

            <p className="text-sm text-slate-600">
              {t('review.banner_desc', { count: dueCount })}
              {previewWords.length > 0 && (
                <span className="ml-1 hidden font-medium text-slate-500 sm:inline">
                  ({t('review.preview_label')} <strong className="font-semibold text-slate-800">{previewWords.join(', ')}</strong>...)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: CTA Button */}
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/${locale}/vocabulary/review`}>
              <span>{t('review.btn_review_now')}</span>
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DueReviewBanner;
