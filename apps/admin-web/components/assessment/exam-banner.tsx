'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ExamItem } from '@/types';
import {
  FileText,
  Clock,
  Pencil,
  Plus,
  AlertCircle,
  Layers,
  HelpCircle,
  BookOpen,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  onViewStructureClick,
}: ExamBannerProps) {
  const { t } = useTranslation('assessment');

  const groupName = exam.group?.name || (exam as any).groupId?.name;
  const groupId = exam.group?._id || (exam as any).groupId?._id || exam.groupId;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Left: Identity & Core Metadata */}
      <div className="flex items-start gap-3.5 min-w-0">
        {/* Compact Icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
          <FileText className="h-6 w-6" />
        </div>

        <div className="min-w-0 space-y-1.5">
          {/* Title & Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
              {exam.name || t('detailPage.defaultExamName', 'Đề thi')}
            </h1>

            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200/60 uppercase">
              {exam.type || 'TOEIC'}
            </span>

            <span className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200/60 uppercase">
              Full Test
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${
                exam.isActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  exam.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              <span>{exam.isActive ? t('status.active') : t('status.inactive')}</span>
            </span>
          </div>

          {/* Description & Subline */}
          {exam.description && (
            <p className="text-xs text-slate-500 line-clamp-1 max-w-2xl">
              {exam.description}
            </p>
          )}

          {/* Metrics & Tags in single neat row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
              <span>{questionsCount} câu hỏi</span>
            </span>

            <span className="text-slate-300">•</span>

            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <BookOpen className="h-3.5 w-3.5 text-slate-400" />
              <span>{passagesCount} bài đọc/hội thoại</span>
            </span>

            <span className="text-slate-300">•</span>

            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>{exam.durationMinutes || 120} {t('table.minutes')}</span>
            </span>

            {groupName && groupId && (
              <>
                <span className="text-slate-300">•</span>
                <Link
                  href={`/${locale}/assessment/groups/${groupId}`}
                  className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <Layers className="h-3 w-3" />
                  <span>{groupName}</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {onViewStructureClick && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onViewStructureClick}
            className="h-9 gap-1.5 text-xs text-slate-700 hover:text-blue-600"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{t('detailPage.viewExamStructure', 'Cấu trúc đề')}</span>
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEditClick}
          className="h-9 gap-1.5 text-xs text-slate-700 hover:text-blue-600"
        >
          <Pencil className="h-3.5 w-3.5" />
          <span>{t('detailPage.editExam', 'Chỉnh sửa')}</span>
        </Button>

        <Link
          href={`/${locale}/assessment/${examId}/settings`}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-xs font-medium"
          title={t('timing.title', 'Cài đặt thời gian')}
        >
          <Settings className="h-3.5 w-3.5" />
        </Link>

        <Link
          href={`/${locale}/assessment/${examId}/questions/create`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t('detailPage.addQuestion', 'Thêm câu hỏi')}</span>
        </Link>
      </div>
    </div>
  );
}
