'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Clock, X, ArrowRight } from 'lucide-react';
import { learningService } from '@/services/learning.service';

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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Glow ambient circle in background */}
        <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-blue-200/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-sky-200/30 blur-3xl pointer-events-none" />

        {/* Close X button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title={t('review.btn_later')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Badge & Icon */}
        <div className="flex flex-col items-center text-center space-y-3 pt-1">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
              <RotateCcw className="w-8 h-8 text-white" />
            </div>
            <span className="absolute -bottom-1.5 -right-2 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white border-2 border-white shadow-xs">
              +{dueCount}
            </span>
          </div>

          <div className="space-y-1.5 max-w-sm">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {t('review.modal_title', { count: dueCount })}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t('review.modal_desc')}
            </p>
          </div>
        </div>

        {/* Preview Words pills if available */}
        {previewWords.length > 0 && (
          <div className="bg-blue-50/70 rounded-2xl border border-blue-100 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-900 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('review.preview_label')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {previewWords.map((word, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-xs font-bold text-blue-900 shadow-2xs"
                >
                  {word}
                </span>
              ))}
              {dueCount > previewWords.length && (
                <span className="text-xs font-semibold text-blue-700">
                  +{dueCount - previewWords.length} từ khác
                </span>
              )}
            </div>
          </div>
        )}

        {/* 2 Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Secondary: Để sau */}
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer text-center"
          >
            {t('review.btn_later')}
          </button>

          {/* Primary: Ôn tập ngay */}
          <button
            type="button"
            onClick={handleGoToReview}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 active:scale-98 transition-all cursor-pointer text-center"
          >
            <span>{t('review.btn_review_now')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DueReviewModal;
