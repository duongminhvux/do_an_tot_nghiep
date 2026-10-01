'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, BookOpen, Clock, Users } from 'lucide-react';

interface ExamStatsCardsProps {
  questionsCount: number;
  targetQuestions: number;
  passagesCount: number;
  durationMinutes: number;
}

export function ExamStatsCards({
  questionsCount,
  targetQuestions,
  passagesCount,
  durationMinutes,
}: ExamStatsCardsProps) {
  const { t } = useTranslation('assessment');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Tổng số câu hỏi */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium">
            {t('detailPage.cardQuestionsTitle')}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">
            {questionsCount}
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            {t('detailPage.targetQuestions', { target: targetQuestions })}
          </p>
        </div>
      </div>

      {/* Card 2: Tổng số đoạn hội thoại/bài đọc */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium">
            {t('detailPage.cardPassagesTitle')}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">
            {passagesCount}
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            {t('detailPage.passagesDesc')}
          </p>
        </div>
      </div>

      {/* Card 3: Thời gian làm bài */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Clock className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium">
            {t('detailPage.cardDurationTitle')}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">
            {durationMinutes}{' '}
            <span className="text-sm font-semibold text-slate-500">
              {t('table.minutes')}
            </span>
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            {t('detailPage.standardExam')}
          </p>
        </div>
      </div>

      {/* Card 4: Tổng lượt thi */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium">
            {t('detailPage.cardAttemptsTitle')}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">0</p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            {t('detailPage.noAttempts')}
          </p>
        </div>
      </div>
    </div>
  );
}
