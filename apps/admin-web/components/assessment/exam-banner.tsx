'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ExamItem } from '@/types';
import {
  BookOpen,
  FileText,
  Headphones,
  Clock,
  Pencil,
  Plus,
  Upload,
  AlertCircle,
  Layers,
} from 'lucide-react';

interface ExamBannerProps {
  exam: ExamItem;
  locale: string;
  examId: string;
  questionsCount: number;
  passagesCount: number;
  onEditClick: () => void;
  onImportClick: () => void;
  onAddPassageClick?: () => void;
  onViewStructureClick?: () => void;
}

export function ExamBanner({
  exam,
  locale,
  examId,
  questionsCount,
  passagesCount,
  onEditClick,
  onImportClick,
  onAddPassageClick,
  onViewStructureClick,
}: ExamBannerProps) {
  const { t } = useTranslation('assessment');

  return (
    <div className="bg-white rounded border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div className="flex items-center gap-4 sm:gap-5 min-w-0">
        {/* Cover image */}
        <div className="w-20 h-20 relative sm:w-24 group sm:h-24 rounded text-white flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-tr from-indigo-600 to-purple-500">
          <FileText className="h-10 w-10 sm:h-12 sm:w-12 drop-shadow-md" />
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>

          {onViewStructureClick && (
            <button
              type="button"
              onClick={onViewStructureClick}
              className="absolute -top-2 -right-2 z-10 text-slate-500 w-5 h-5 bg-white rounded-full hidden group-hover:text-blue-600 group-hover:flex items-center justify-center shrink-0 transition-all shadow-xs cursor-pointer group"
              title={t('detailPage.viewExamStructure', 'Xem cấu trúc đề thi')}
              aria-label={t('detailPage.viewExamStructure', 'Xem cấu trúc đề thi')}
            >
              <AlertCircle className="h-4 w-4 text-slate-500 group-hover:text-blue-600 group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>

        <div className="min-w-0 space-y-1">
          {/* Badges Row */}
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <span className="px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-700 uppercase">
              {exam.type || 'TOEIC'}
            </span>
            <span className="px-2 py-0.5 rounded font-bold uppercase bg-purple-100 text-purple-700">
              Full Test
            </span>
            <span className="px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-600 inline-flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-400" />
              <span>
                {exam.durationMinutes || 120} {t('table.minutes')}
              </span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${exam.isActive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${exam.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
              ></span>
              <span>{exam.isActive ? t('status.active') : t('status.inactive')}</span>
            </span>
            <span className="px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-600">
              #{exam.order || 1}
            </span>
            {(exam.group?.name || (exam as any).groupId?.name) && (
              <Link
                href={`/${locale}/assessment/groups/${(exam.group?._id || (exam as any).groupId?._id || exam.groupId)}`}
                className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded hover:bg-indigo-100 transition-colors shrink-0"
              >
                <Layers className="h-3 w-3" />
                <span>{exam.group?.name || (exam as any).groupId?.name}</span>
              </Link>
            )}
          </div>
          {/* Title Row with Circular Exclamation Info Button */}
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
              {exam.name}
            </h1>
          </div>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-slate-500 truncate">
            {exam.description || t('table.noDescription')}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 text-xs text-slate-400 pt-0.5 flex-wrap">
            <span>{t('detailPage.metaQuestions', { count: questionsCount })}</span>
            <span>•</span>
            <span>{t('detailPage.metaPassages', { count: passagesCount })}</span>
            <span>•</span>
            <span>{t('detailPage.metaDuration', { minutes: exam.durationMinutes || 45 })}</span>
          </div>
        </div>
      </div>

      {/* Banner Action Buttons */}
      <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 flex-wrap">
        <button
          type="button"
          onClick={onEditClick}
          className="flex-1 md:flex-none px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5" />
          <span>{t('detailPage.editExam')}</span>
        </button>
        {/* 
        <Link
          href={`/${locale}/assessment/${examId}/questions/import`}
          className="flex-1 md:flex-none px-3.5 py-2 border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 text-blue-700 rounded text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Upload className="h-3.5 w-3.5 text-blue-600" />
          <span>{t('detailPage.importQuestions', 'Import câu hỏi')}</span>
        </Link> */}

        <Link
          href={`/${locale}/assessment/${examId}/questions/create`}
          className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 rounded text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t('detailPage.addQuestion')}</span>
        </Link>
      </div>
    </div>
  );
}
