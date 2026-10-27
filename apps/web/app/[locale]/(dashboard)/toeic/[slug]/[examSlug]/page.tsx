'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileQuestion, Clock, Users, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, PageShell } from '@/components/ui/page';
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
import { toeicAttemptService, ExamMode } from '@/services/toeic-attempt.service';

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

type Mode = ExamMode;

/* ══════════════════════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════════════════════ */
export default function ToeicExamDetailPage() {
  const params    = useParams();
  const router    = useRouter();
  const searchParams = useSearchParams();
  const practicePart = Number(searchParams.get('practicePart'));
  const { t }     = useTranslation('toeic');
  const locale    = (params?.locale   as string) || 'vi';
  const groupSlug = (params?.slug     as string) || '';
  const examSlug  = (params?.examSlug as string) || '';
  const selectionKey = `${examSlug}:${practicePart}`;

  const { user } = useAppSelector((state) => state.auth);

  const [mode, setMode]               = useState<Mode>('TEST');
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);
  const [initialised, setInitialised] = useState('');

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
  const { data: partsData, isLoading: isPartsLoading, isError: isPartsError } = useQuery({
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
  const parts       = rawParts;

  React.useEffect(() => {
    if (parts.length > 0 && initialised !== selectionKey) {
      const recommended = parts.find(p => p.part === practicePart);
      setSelected(new Set((recommended ? [recommended] : parts).map((p) => p._id)));
      setMode(recommended ? 'PRACTICE' : 'TEST');
      setInitialised(selectionKey);
    }
  }, [parts, initialised, selectionKey, practicePart]);

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

  const handleStart = async () => {
    if (!exam || starting || !selectedParts.length) return;
    setStarting(true);
    setStartError(false);
    try {
      const attempt = await toeicAttemptService.create(exam._id, mode, selectedParts.map(p => p.part));
      router.push(`/${locale}/toeic/attempts/${attempt._id}`);
    } catch { setStartError(true); setStarting(false); }
  };
  const handleContinue = () => {
    if (latestAttempt) router.push(`/${locale}/toeic/attempts/${latestAttempt._id}`);
  };

  /* error */
  if (!isExamLoading && (isExamError || isPartsError || (!isLoading && !exam))) {
    return (
      <PageShell>
        <EmptyState
          icon={AlertCircle}
          title={t('exam_detail.not_found_title')}
          description={t('exam_detail.not_found_desc')}
          action={
            <Button asChild>
              <Link href={`/${locale}/toeic/${groupSlug}`}>{t('exam_detail.back_to_group')}</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  const meta = (
    <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {(exam?.totalQuestions ?? 0) > 0 && (
        <span className="flex items-center gap-1.5">
          <FileQuestion className="h-4 w-4 text-slate-400" />
          {exam!.totalQuestions} {t('exam_detail.questions')}
        </span>
      )}
      {(exam?.totalAttempts ?? 0) > 0 && (
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-slate-400" />
          {exam!.totalAttempts!.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')} {t('exam_detail.attempts')}
        </span>
      )}
      {(exam?.durationMinutes ?? 0) > 0 && (
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-slate-400" />
          {exam!.durationMinutes} {t('exam_detail.minutes')}
        </span>
      )}
    </span>
  );

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[
          { label: 'TOEIC', href: `/${locale}/toeic` },
          { label: groupName, href: `/${locale}/toeic/${groupSlug}` },
          { label: isLoading ? '...' : exam?.name || '' },
        ]}
        title={
          isLoading ? (
            <span className="inline-block h-8 w-80 max-w-full animate-pulse rounded-md bg-slate-100 align-middle" />
          ) : (
            exam?.name
          )
        }
        description={isLoading ? undefined : meta}
      />

      {isLoading ? (
        <Card>
          <LoadingState />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <ExamStructureTable parts={parts} partTimeMap={PART_TIME_MAP} />

            <div className="space-y-3">
              {exam?.description && <p className="text-sm text-slate-600">{exam.description}</p>}
              {startError && <ErrorState message={t('attempt.start_error')} />}
              {!parts.length && <p className="text-sm text-slate-500">{t('attempt.no_parts')}</p>}
              <ExamModePartsSelector
                starting={starting}
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
          </div>

          <ExamLeaderboard rawAttempts={rawAttempts} />

          <ExamComments currentUser={user} />
        </div>
      )}
    </PageShell>
  );
}
