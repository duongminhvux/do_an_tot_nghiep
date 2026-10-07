'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Home,
  ChevronRight,
  Headphones,
  BookOpen,
  Layers,
  FileText,
  BarChart2,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  Package,
  Award,
  Target,
  FileQuestion,
  AlertCircle,
} from 'lucide-react';
import {
  toeicService,
  ToeicExamSummary,
  ToeicAttemptSummary,
} from '@/services/toeic.service';

function unwrapArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  if (Array.isArray(value?.data)) return value.data as T[];
  return [];
}

function unwrapOne<T>(value: any): T | null {
  if (!value) return null;
  if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) {
    return value.data as T;
  }
  return value as T;
}

// Icon map for preset slugs
const PRESET_ICON_MAP: Record<string, { icon: any; color: string; bg: string }> = {
  'basic-listening': { icon: Headphones, color: 'text-blue-600', bg: 'bg-blue-50' },
  'basic-reading': { icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'practice-tests': { icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' },
  'by-level': { icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
  'by-topic': { icon: Target, color: 'text-rose-600', bg: 'bg-rose-50' },
  advanced: { icon: Sparkles, color: 'text-red-600', bg: 'bg-red-50' },
};

const DEFAULT_ICON = { icon: Headphones, color: 'text-blue-600', bg: 'bg-blue-50' };

export default function ToeicGroupDetailPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const slug = (params?.slug as string) || '';
  const { t } = useTranslation('toeic');



  // 1. Fetch group detail by slug or id
  const { data: groupData, isLoading: isGroupLoading, isError: isGroupError } = useQuery({
    queryKey: ['toeic-group-detail', slug],
    queryFn: () => toeicService.getGroupBySlugOrId(slug),
    enabled: !!slug,
  });

  // 2. Fetch exams belonging to this group
  const { data: groupExamsData, isLoading: isGroupExamsLoading } = useQuery({
    queryKey: ['toeic-group-exams', slug],
    queryFn: () => toeicService.getGroupExams(slug),
    enabled: !!slug,
  });

  // 3. Fetch user attempts for progress status
  const { data: attemptsData } = useQuery({
    queryKey: ['toeic-user-attempts'],
    queryFn: () => toeicService.getAttempts({ limit: 200 }),
    staleTime: 15_000,
  });

  const group = unwrapOne<any>(groupData);
  const rawExams = unwrapArray<ToeicExamSummary>(groupExamsData);
  const rawAttempts = unwrapArray<ToeicAttemptSummary>(attemptsData);

  const groupName = group?.name || slug;
  const groupDescription =
    group?.description ||
    'Các đề luyện thi TOEIC từ cơ bản đến nâng cao, giúp bạn làm quen với cấu trúc bài thi và cải thiện kỹ năng từng bước.';
  const groupExamCount = group?.examCount ?? rawExams.length;

  const iconConfig = PRESET_ICON_MAP[slug] ?? DEFAULT_ICON;
  const GroupIcon = iconConfig.icon;

  // Build attempts map: examId -> latest attempt
  const attemptsMap = useMemo(() => {
    const map = new Map<string, ToeicAttemptSummary>();
    rawAttempts.forEach((att) => {
      const examId =
        typeof att.examId === 'object' && att.examId
          ? (att.examId as any)._id
          : (att.examId as string);
      if (examId && !map.has(examId)) {
        map.set(examId, att);
      }
    });
    return map;
  }, [rawAttempts]);

  // Total completed attempts in this group
  const totalAttempts = useMemo(() => {
    return rawExams.reduce((acc, exam) => {
      const att = attemptsMap.get(exam._id);
      return acc + (att ? 1 : 0);
    }, 0);
  }, [rawExams, attemptsMap]);

  // Sorted exams (newest first by default)
  const sortedExams = useMemo(() => {
    return [...rawExams].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
  }, [rawExams]);

  const isLoading = isGroupLoading || isGroupExamsLoading;

  // Error: group not found
  if (!isGroupLoading && (isGroupError || (!isLoading && !group && rawExams.length === 0))) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Không tìm thấy nhóm đề</h2>
          <p className="text-xs text-slate-500">Nhóm đề thi này không tồn tại hoặc đã bị xóa.</p>
          <Link
            href={`/${locale}/toeic`}
            className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
          >
            ← Quay lại TOEIC
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto space-y-6">
        {/* ===================== 1. BREADCRUMBS ===================== */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Link
            href={`/${locale}`}
            className="hover:text-slate-700 transition flex items-center gap-1"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <Link href={`/${locale}/toeic`} className="hover:text-slate-700 transition">
            {t('group_detail.breadcrumb_toeic')}
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span className="text-slate-700 font-semibold truncate max-w-[200px] sm:max-w-md">
            {isLoading ? '...' : groupName}
          </span>
        </div>

        {/* ===================== 2. HERO HEADER CARD ===================== */}
        <div className="rounded border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center gap-6">
          {/* Left Icon */}
          <div
            className={`h-28 w-28 sm:h-32 sm:w-32 rounded ${iconConfig.bg} border border-slate-100 flex items-center justify-center relative overflow-hidden shrink-0`}
          >
            <div className="absolute -top-3 -left-3 h-16 w-16 rounded-full bg-white/40 pointer-events-none" />
            <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/30 pointer-events-none" />
            <div className="relative z-10 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded bg-white shadow-xs border border-slate-100/60">
              <GroupIcon className={`h-9 w-9 sm:h-11 sm:w-11 ${iconConfig.color}`} />
            </div>
          </div>

          {/* Right Info */}
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${iconConfig.bg} ${iconConfig.color}`}
                >
                  <GroupIcon className="h-4 w-4" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {isLoading ? (
                    <span className="inline-block h-8 w-48 rounded bg-slate-100 animate-pulse" />
                  ) : (
                    groupName
                  )}
                </h1>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-3xl">
                {isLoading ? (
                  <span className="inline-block h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
                ) : (
                  groupDescription
                )}
              </p>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6 sm:gap-10 pt-1 border-t border-slate-100">
              {/* Stat: Số đề */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-50 text-blue-600 shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                    {isLoading ? (
                      <span className="inline-block h-5 w-10 rounded bg-slate-100 animate-pulse" />
                    ) : (
                      `${groupExamCount} ${t('group_detail.total_exams_label')}`
                    )}
                  </p>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {t('group_detail.in_group')}
                  </span>
                </div>
              </div>

              {/* Stat: Lượt đã làm */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-50 text-blue-600 shrink-0">
                  <BarChart2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                    {isLoading ? (
                      <span className="inline-block h-5 w-10 rounded bg-slate-100 animate-pulse" />
                    ) : (
                      totalAttempts
                    )}
                  </p>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {t('group_detail.attempts_label')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================== DANH SÁCH ĐỀ THI ===================== */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded border border-slate-200 bg-white p-12 text-slate-500 shadow-xs">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
              <p className="mt-3 text-xs font-medium text-slate-600">
                {t('modals.group_exams.loading')}
              </p>
            </div>
          ) : sortedExams.length === 0 ? (
            <div className="rounded border border-slate-200 bg-white p-12 text-center shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-800">
                {t('modals.group_exams.empty_title')}
              </h3>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                {t('modals.group_exams.empty_desc')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortedExams.map((exam, index) => {
                const attempt = attemptsMap.get(exam._id);
                const isCompleted = attempt?.status === 'COMPLETED';
                const isInProgress = attempt?.status === 'IN_PROGRESS';
                const isNew = index === 0;

                const totalQ = exam.totalQuestions || 0;
                const correctQ = attempt?.totalCorrect || 0;
                const answeredQ = attempt?.totalQuestions || 0;
                const score = attempt?.score ?? null;

                const examSlug = exam.slug || exam._id;
                const href = `/${locale}/toeic/${slug}/${examSlug}`;

                // Circular progress ring
                const R = 18;
                const circ = 2 * Math.PI * R;
                const progressVal = isCompleted
                  ? totalQ > 0 ? (correctQ / totalQ) * 100 : 100
                  : isInProgress
                  ? totalQ > 0 ? (answeredQ / totalQ) * 100 : 0
                  : 0;
                const dash = (progressVal / 100) * circ;
                const ringColor = isCompleted
                  ? '#10b981'
                  : isInProgress
                  ? '#3b82f6'
                  : '#e2e8f0';

                return (
                  <Link
                    key={exam._id}
                    href={href}
                    className="group flex flex-col gap-3 rounded border border-slate-200/90 bg-white p-4 shadow-xs hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    {/* Top: Icon + Title + Progress Ring */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded ${iconConfig.bg} ${iconConfig.color} shrink-0`}
                      >
                        <GroupIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1.5">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors leading-tight">
                              {exam.name}
                            </h3>
                            {isNew && (
                              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 mr-1">
                                {t('group_detail.new_badge')}
                              </span>
                            )}
                            {exam.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{exam.description}</p>
                            )}
                          </div>

                          {/* Circular Progress Ring */}
                          <div className="relative shrink-0 flex items-center justify-center" style={{ width: 44, height: 44 }}>
                            <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                              {/* Track */}
                              <circle
                                cx="22" cy="22" r={R}
                                fill="none"
                                stroke="#f1f5f9"
                                strokeWidth="3.5"
                              />
                              {/* Progress */}
                              <circle
                                cx="22" cy="22" r={R}
                                fill="none"
                                stroke={ringColor}
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeDasharray={`${dash} ${circ}`}
                                style={{ transition: 'stroke-dasharray 0.4s ease' }}
                              />
                            </svg>
                            {/* Center label */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              {isCompleted ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              ) : isInProgress ? (
                                <span className="text-[9px] font-bold text-blue-600 leading-none">
                                  {Math.round(progressVal)}%
                                </span>
                              ) : (
                                <span className="text-[9px] font-medium text-slate-400 leading-none">0%</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Meta + Status label */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      {/* Meta chips */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                        {totalQ > 0 && (
                          <span className="flex items-center gap-1">
                            <FileQuestion className="h-3 w-3" />
                            {totalQ} câu
                          </span>
                        )}
                        {exam.durationMinutes && exam.durationMinutes > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {exam.durationMinutes} phút
                          </span>
                        )}
                      </div>

                      {/* Status text */}
                      {isCompleted ? (
                        <span className="text-[10px] font-bold text-emerald-600">
                          {score !== null ? `${score} điểm` : 'Hoàn thành'}
                        </span>
                      ) : isInProgress ? (
                        <span className="text-[10px] font-bold text-blue-600">
                          {answeredQ}/{totalQ} câu
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">
                          {t('group_detail.status_not_started')}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
