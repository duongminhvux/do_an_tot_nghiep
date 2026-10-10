'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Home,
  ChevronRight,
  ChevronLeft,
  FileQuestion,
  Clock,
  Users,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAppSelector } from '@/redux/hooks';
import {
  toeicService,
  ToeicExamSummary,
  ToeicExamPart,
  ToeicAttemptSummary,
} from '@/services/toeic.service';
import { ExamStructureTable } from './components/exam-structure-table';
import { ExamModePartsSelector } from './components/exam-mode-parts-selector';
import { ExamLeaderboard } from './components/exam-leaderboard';
import { ExamComments } from './components/exam-comments';

function unwrapOne<T>(value: any): T | null {
  if (!value) return null;
  if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data))
    return value.data as T;
  return value as T;
}
function unwrapArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  if (Array.isArray(value?.data)) return value.data as T[];
  return [];
}

const PART_TIME_MAP: Record<number, number> = {
  1: 3,
  2: 10,
  3: 18,
  4: 15,
  5: 20,
  6: 12,
  7: 42,
};

const DEFAULT_PARTS: ToeicExamPart[] = [
  { _id: 'p1', section: 'LISTENING', part: 1, type: 'Photos',               totalQuestions: 6  },
  { _id: 'p2', section: 'LISTENING', part: 2, type: 'Question-Response',    totalQuestions: 25 },
  { _id: 'p3', section: 'LISTENING', part: 3, type: 'Conversations',        totalQuestions: 39 },
  { _id: 'p4', section: 'LISTENING', part: 4, type: 'Talks',                totalQuestions: 30 },
  { _id: 'p5', section: 'READING',   part: 5, type: 'Incomplete Sentences', totalQuestions: 30 },
  { _id: 'p6', section: 'READING',   part: 6, type: 'Text Completion',      totalQuestions: 16 },
  { _id: 'p7', section: 'READING',   part: 7, type: 'Reading Comprehension',totalQuestions: 54 },
];

type Mode = 'exam' | 'practice';

/* ══════════════════════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════════════════════ */
export default function ToeicExamDetailPage() {
  const params    = useParams();
  const router    = useRouter();
  const { t }     = useTranslation('toeic');
  const locale    = (params?.locale   as string) || 'vi';
  const groupSlug = (params?.slug     as string) || '';
  const examSlug  = (params?.examSlug as string) || '';

  const { user } = useAppSelector((state) => state.auth);

  const [mode, setMode]               = useState<Mode>('exam');
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [initialised, setInitialised] = useState(false);

  const { data: groupData } = useQuery({
    queryKey: ['toeic-group-detail', groupSlug],
    queryFn:  () => toeicService.getGroupBySlugOrId(groupSlug),
    enabled:  !!groupSlug,
  });
  const { data: examData, isLoading: isExamLoading, isError: isExamError } = useQuery({
    queryKey: ['toeic-exam-detail', examSlug],
    queryFn:  () => toeicService.getExamById(examSlug),
    enabled:  !!examSlug,
  });
  const { data: partsData, isLoading: isPartsLoading } = useQuery({
    queryKey: ['toeic-exam-parts', examSlug],
    queryFn:  () => toeicService.getExamParts(examSlug),
    enabled:  !!examSlug,
  });
  const { data: attemptsData } = useQuery({
    queryKey: ['toeic-exam-attempts', examSlug],
    queryFn:  () => toeicService.getAttempts({ examId: examSlug, limit: 10 }),
    staleTime: 10_000,
  });

  const group       = unwrapOne<any>(groupData);
  const exam        = unwrapOne<ToeicExamSummary>(examData);
  const rawParts    = unwrapArray<ToeicExamPart>(partsData);
  const rawAttempts = unwrapArray<ToeicAttemptSummary>(attemptsData);
  const parts       = rawParts.length > 0 ? rawParts : DEFAULT_PARTS;

  React.useEffect(() => {
    if (parts.length > 0 && !initialised) {
      setSelected(new Set(parts.map((p) => p._id)));
      setInitialised(true);
    }
  }, [parts, initialised]);

  const groupName         = group?.name || groupSlug;
  const listeningParts    = parts.filter((p) => p.section === 'LISTENING');
  const readingParts      = parts.filter((p) => p.section === 'READING');
  const selectedParts     = parts.filter((p) => selected.has(p._id));
  const selectedQuestions = selectedParts.reduce((s, p) => s + p.totalQuestions, 0);
  const selectedMinutes   = selectedParts.reduce((s, p) => s + (PART_TIME_MAP[p.part] ?? 0), 0);
  const selectedCount     = selectedParts.length;
  const latestAttempt     = rawAttempts.find((a) => a.status === 'IN_PROGRESS');
  const isInProgress      = !!latestAttempt;
  const isLoading         = isExamLoading || isPartsLoading;

  const togglePart = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectAll   = () => setSelected(new Set(parts.map((p) => p._id)));
  const deselectAll = () => setSelected(new Set());

  const handleStart = () => {
    const partIds = Array.from(selected).join(',');
    router.push(`/${locale}/toeic/take/${exam?._id}?${new URLSearchParams({ mode, parts: partIds })}`);
  };
  const handleContinue = () =>
    router.push(`/${locale}/toeic/take/${exam?._id}?attemptId=${latestAttempt?._id}`);

  /* error */
  if (!isExamLoading && (isExamError || (!isLoading && !exam))) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-base font-bold text-slate-800">{t('exam_detail.not_found_title')}</h2>
          <p className="text-xs text-slate-500">{t('exam_detail.not_found_desc')}</p>
          <Link
            href={`/${locale}/toeic/${groupSlug}`}
            className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
          >
            {t('exam_detail.back_to_group')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="px-4 py-6 sm:px-8 lg:px-12 space-y-6">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
          <Link href={`/${locale}`} className="hover:text-slate-600 transition">
            <Home className="h-3.5 w-3.5" />
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <Link href={`/${locale}/toeic`} className="hover:text-slate-600 transition">TOEIC</Link>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span>{t('exam_detail.breadcrumb_exams')}</span>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <Link href={`/${locale}/toeic/${groupSlug}`} className="hover:text-slate-600 transition truncate max-w-[140px] sm:max-w-xs">
            {groupName}
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span className="text-slate-700 font-medium truncate max-w-[200px] sm:max-w-sm">
            {isLoading ? '...' : exam?.name}
          </span>
        </nav>

        {/* ── Title + meta ── */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            {isLoading
              ? <div className="h-9 w-80 rounded bg-slate-100 animate-pulse" />
              : <h1 className="text-2xl sm:text-[28px] font-extrabold text-slate-900 leading-tight">{exam?.name}</h1>
            }
            <div className="mt-1.5 flex flex-wrap items-center gap-5 text-sm text-slate-500">
              {(exam?.totalQuestions ?? 0) > 0 && (
                <span className="flex items-center gap-1.5">
                  <FileQuestion className="h-4 w-4 text-slate-400" />
                  {exam!.totalQuestions} {t('exam_detail.questions')}
                </span>
              )}
              {(exam?.totalAttempts ?? 0) > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-slate-400" />
                  {exam!.totalAttempts!.toLocaleString('vi-VN')} {t('exam_detail.attempts')}
                </span>
              )}
              {(exam?.durationMinutes ?? 0) > 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-slate-400" />
                  {exam!.durationMinutes} {t('exam_detail.minutes')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── 2-col body: Cấu trúc đề & Chế độ làm bài ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <ExamStructureTable parts={parts} partTimeMap={PART_TIME_MAP} />

              <ExamModePartsSelector
                mode={mode}
                setMode={setMode}
                selected={selected}
                togglePart={togglePart}
                selectAll={selectAll}
                deselectAll={deselectAll}
                listeningParts={listeningParts}
                readingParts={readingParts}
                selectedCount={selectedCount}
                selectedQuestions={selectedQuestions}
                selectedMinutes={selectedMinutes}
                isInProgress={isInProgress}
                onStart={handleStart}
                onContinue={handleContinue}
              />
            </div>

            {/* ── BẢNG THÀNH TÍCH ── */}
            <ExamLeaderboard rawAttempts={rawAttempts} />

            {/* ── KHU VỰC BÌNH LUẬN ── */}
            <ExamComments currentUser={user} />
          </div>
        )}
      </div>
    </div>
  );
}
