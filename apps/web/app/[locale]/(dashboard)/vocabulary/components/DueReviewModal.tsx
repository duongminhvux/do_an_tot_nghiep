'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Clock, X, ArrowRight } from 'lucide-react';
import { learningService } from '@/services/learning.service';
import { Button } from '@/components/ui/button';
import { Badge, tones } from '@/components/ui/page';
import { cn } from '@/lib/utils';

interface DueReviewModalProps {
  locale?: string;
  forceOpen?: boolean;
  onClose?: () => void;
}

export function DueReviewModal({
  locale = 'vi',
  forceOpen,
  onClose,
}: DueReviewModalProps) {
  const { t } = useTranslation('vocabulary');
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch check-due data
  const { data: checkRes } = useQuery({
    queryKey: ['due-reviews-check'],
    queryFn: () => learningService.checkDueReviews(),
    staleTime: 60 * 1000,
  });

  const checkData = (checkRes as any)?.data || checkRes;
  const dueCount = checkData?.dueCount ?? 0;
  const previewWords: string[] = checkData?.previewWords ?? [];

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    if (dueCount > 0) {
      // Check session storage to avoid spamming the user on every page load
      const isDismissed = sessionStorage.getItem('srs_review_modal_dismissed');
      if (!isDismissed) {
        // Open smoothly after a short delay
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [dueCount, forceOpen]);

  const handleDismiss = () => {
    setIsOpen(false);
    sessionStorage.setItem('srs_review_modal_dismissed', 'true');
    if (onClose) onClose();
  };

  const handleGoToReview = () => {
    setIsOpen(false);
    sessionStorage.setItem('srs_review_modal_dismissed', 'true');
    if (onClose) onClose();
    router.push(`/${locale}/vocabulary/review`);
  };

  if (!isOpen || dueCount <= 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Close X button */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleDismiss}
          className="absolute right-4 top-4 text-slate-400"
          title={t('review.btn_later')}
        >
          <X />
        </Button>

        {/* Badge & Icon */}
        <div className="flex flex-col items-center space-y-3 pt-1 text-center">
          <div className="relative">
            <span className={cn('flex h-14 w-14 items-center justify-center rounded-xl', tones.amber)}>
              <RotateCcw className="h-7 w-7" />
            </span>
            <span className="absolute -bottom-1.5 -right-2 rounded-full border-2 border-white bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
              +{dueCount}
            </span>
          </div>

          <div className="max-w-sm space-y-1.5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {t('review.modal_title', { count: dueCount })}
            </h2>
            <p className="text-sm text-slate-600">
              {t('review.modal_desc')}
            </p>
          </div>
        </div>

        {/* Preview Words pills if available */}
        {previewWords.length > 0 && (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>{t('review.preview_label')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {previewWords.map((word, idx) => (
                <Badge key={idx} tone="blue">
                  {word}
                </Badge>
              ))}
              {dueCount > previewWords.length && (
                <span className="text-xs font-medium text-slate-500">
                  {t('review.more_words', { count: dueCount - previewWords.length })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 2 Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Button type="button" variant="outline" onClick={handleDismiss} className="w-full">
            {t('review.btn_later')}
          </Button>
          <Button type="button" onClick={handleGoToReview} className="w-full">
            <span>{t('review.btn_review_now')}</span>
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DueReviewModal;
