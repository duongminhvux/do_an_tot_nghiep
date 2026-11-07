'use client';
import { PublicationBar } from '@/components/publication/publication-controls';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
import { audioService, AudioJobStatus } from '@/services/audio.service';
import { ExamItem, QuestionItem, PassageItem } from '@/types';
import { EditExamDialog } from '@/components/assessment/edit-exam-dialog';
import { EditQuestionDialog } from '@/components/assessment/edit-question-dialog';
import { DeleteQuestionDialog } from '@/components/assessment/delete-question-dialog';
import { EditPassageDialog } from '@/components/assessment/edit-passage-dialog';
import { DeletePassageDialog } from '@/components/assessment/delete-passage-dialog';
import {
  QuestionDetailDialog,
  PassageGroupDetail,
} from '@/components/assessment/question-detail-dialog';
import { ImportQuestionsDialog } from '@/components/assessment/import-questions-dialog';
import { ExamBanner } from '@/components/assessment/exam-banner';
import { ExamQuestionsTab } from '@/components/assessment/exam-questions-tab';
import { ExamOverviewTab } from '@/components/assessment/exam-overview-tab';
import { ExamLeaderboardTab, ExamCommentsTab } from '@/components/assessment/exam-community-tabs';
import { ExamAttemptsTab } from '@/components/assessment/exam-attempts-tab';
import { ExamChecksTab } from '@/components/assessment/exam-checks-tab';
import { checkExam } from '@repo/shared-types/exam-checks';
import { ExamStructureDialog } from '@/components/assessment/exam-structure-dialog';
import {
  FileText,
  ListChecks,
  Users,
  Trophy,
  MessageSquare,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Info,
  Volume2,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ExamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const editQuestionOrder = Number(searchParams.get('editQuestion'));
  const openedQuestionLink = useRef('');
  const locale = (params?.locale as string) || 'vi';
  const examId = params?.id as string;
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'checks' | 'attempts' | 'leaderboard' | 'comments'>('questions');
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);
  const [audioExpanded, setAudioExpanded] = useState(false);
  const [selectedQuestionForDetail, setSelectedQuestionForDetail] = useState<QuestionItem | null>(null);
  const [selectedPassageGroupForDetail, setSelectedPassageGroupForDetail] = useState<PassageGroupDetail | null>(null);
  const [selectedPassageGroupForEdit, setSelectedPassageGroupForEdit] = useState<PassageGroupDetail | null>(null);
  const [selectedPassageGroupForDelete, setSelectedPassageGroupForDelete] = useState<PassageGroupDetail | null>(null);
  const [selectedQuestionForEdit, setSelectedQuestionForEdit] = useState<QuestionItem | null>(null);
  const [selectedQuestionForDelete, setSelectedQuestionForDelete] = useState<QuestionItem | null>(null);

  // Filters for questions
  const [selectedPartPill, setSelectedPartPill] = useState<number | 'ALL'>('ALL');
  const [questionSearch, setQuestionSearch] = useState('');
  const [filterPart, setFilterPart] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPassage, setFilterPassage] = useState<string>('ALL');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [audioJobId, setAudioJobId] = useState<string | null>(null);
  const [audioJob, setAudioJob] = useState<AudioJobStatus | null>(null);
  const [audioJobError, setAudioJobError] = useState<string | null>(null);
  const [isStartingAudioJob, setIsStartingAudioJob] = useState(false);

  // 1. Query Real Exam details from PostgreSQL via API
  const {
    data: examResponse,
    isLoading: isExamLoading,
    isError: isExamError,
  } = useQuery({
    queryKey: ['admin-exam', examId],
    queryFn: async () => {
      const res = await examService.getById(examId);
      return res?.data;
    },
    enabled: !!examId,
  });

  const exam: ExamItem = useMemo(() => {
    const raw = (examResponse as any)?.data || examResponse;
    if (raw && (raw._id || raw.name)) return raw;
    return {
      _id: examId,
      name: '',
      slug: '',
      type: 'TOEIC',
      mode: 'PRACTICE',
      section: 'LISTENING',
      isActive: true,
      durationMinutes: 45,
      totalQuestions: 100,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [examResponse, examId]);

  // 2. Query Real Questions of this exam from PostgreSQL
  const { data: questionsResponse } = useQuery({
    queryKey: ['admin-exam-questions', examId],
    queryFn: async () => {
      const res = await examService.getQuestions(examId);
      return res?.data;
    },
    enabled: !!examId,
  });

  const questionsList: QuestionItem[] = useMemo(() => {
    const raw = (questionsResponse as any)?.data || questionsResponse;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    return [];
  }, [questionsResponse]);

  useEffect(() => {
    const key = `${examId}:${editQuestionOrder}`;
    if (!Number.isInteger(editQuestionOrder) || editQuestionOrder < 1 || openedQuestionLink.current === key) return;
    const target = questionsList.find(q => q.order === editQuestionOrder);
    if (!target) return;
    openedQuestionLink.current = key;
    setActiveTab('questions');
    setSelectedPartPill(target.part);
    setSelectedQuestionForEdit(target);
  }, [examId, editQuestionOrder, questionsList]);

  // 3. Query Real Passages of this exam from PostgreSQL
  const { data: passagesResponse } = useQuery({
    queryKey: ['admin-exam-passages', examId],
    queryFn: async () => {
      const res = await examService.getPassages(examId);
      return res?.data;
    },
    enabled: !!examId,
  });

  const passagesList: PassageItem[] = useMemo(() => {
    const raw = (passagesResponse as any)?.data || passagesResponse;
    if (Array.isArray(raw)) return raw;
    return [];
  }, [passagesResponse]);

  // Live exam checks: same rules as publishing and the quality scan.
  const examIssues = useMemo(
    () =>
      checkExam(
        {
          exam: { type: exam.type, totalQuestions: exam.totalQuestions },
          // The admin API populates passageGroupId with the group object.
          questions: questionsList.map((q) => {
            const group = q.passageGroupId as unknown as string | { _id?: string; id?: string } | undefined;
            return {
              ...q,
              id: q._id,
              passageGroupId: typeof group === 'object' && group ? (group._id ?? group.id) : group,
            };
          }),
          groups: passagesList.map((g) => ({
            ...g,
            id: g._id,
            passages: (g.passages ?? []).map((p) => ({ ...p, id: p._id })),
          })),
        },
        locale === 'en' ? 'en' : 'vi',
      ),
    [exam.type, exam.totalQuestions, questionsList, passagesList, locale],
  );
  const examErrorCount = examIssues.filter((issue) => issue.severity === 'error').length;

  // 4. Mutation to delete a question
  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      return examService.deleteQuestion(questionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
      setSelectedQuestionForDelete(null);
    },
  });

  // 4b. Mutation to delete a passage group and all its linked questions
  const deletePassageGroupMutation = useMutation({
    mutationFn: async (group: PassageGroupDetail) => {
      const pid = group.passage?._id;
      if (pid) {
        await examService.deletePassage(pid);
      }
      await Promise.all(
        group.questions.map((q) =>
          examService.deleteQuestion(q._id).catch(() => null)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-passages', examId] });
      setSelectedPassageGroupForDelete(null);
    },
  });

  // Dynamic Part counts from real questions
  const partCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 7; i++) counts[i] = 0;
    questionsList.forEach((q) => {
      const partNum = q.part;
      if (typeof partNum === 'number' && partNum >= 1 && partNum <= 7) {
        counts[partNum] = (counts[partNum] ?? 0) + 1;
      }
    });
    return counts;
  }, [questionsList]);

  // Allowed Parts (TOEIC Full Test has all 7 parts: 1-7)
  const allowedParts = [1, 2, 3, 4, 5, 6, 7];

  // Unique passages for filter
  const uniquePassages = useMemo(() => {
    const map = new Map<string, string>();
    questionsList.forEach((q) => {
      if (q.passageTitle) map.set(q.passageTitle, q.passageTitle);
    });
    return Array.from(map.values());
  }, [questionsList]);

  // Filtered Questions list
  const filteredQuestions = useMemo(() => {
    return questionsList.filter((q) => {
      if (selectedPartPill !== 'ALL' && q.part !== selectedPartPill) return false;
      if (filterPart !== 'ALL' && String(q.part) !== filterPart) return false;
      if (filterStatus !== 'ALL') {
        const isQActive = q.isActive || (q.isActive !== false && (q as any).isActive !== false);
        if (filterStatus === 'ACTIVE' && !isQActive) return false;
        if (filterStatus === 'INACTIVE' && isQActive) return false;
      }
      if (filterPassage !== 'ALL') {
        if (filterPassage === 'NONE' && (q.passageId || q.passageTitle)) return false;
        if (filterPassage !== 'NONE' && q.passageTitle !== filterPassage && q.passageId !== filterPassage) return false;
      }
      if (questionSearch.trim()) {
        const query = questionSearch.toLowerCase().trim();
        return q.content?.toLowerCase().includes(query) || q.passageTitle?.toLowerCase().includes(query);
      }
      return true;
    });
  }, [questionsList, selectedPartPill, filterPart, filterStatus, filterPassage, questionSearch]);

  const totalFilteredQuestions = filteredQuestions.length;
  const totalPages = Math.ceil(totalFilteredQuestions / pageSize) || 1;
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuestions.slice(start, start + pageSize);
  }, [filteredQuestions, currentPage, pageSize]);

  const handleResetFilters = () => {
    setSelectedPartPill('ALL');
    setQuestionSearch('');
    setFilterPart('ALL');
    setFilterStatus('ALL');
    setFilterPassage('ALL');
    setCurrentPage(1);
  };

  const getPartColor = (partNum: number) => {
    switch (partNum) {
      case 1: return 'bg-amber-100 text-amber-700 font-bold';
      case 2: return 'bg-rose-100 text-rose-700 font-bold';
      case 3: return 'bg-blue-100 text-blue-700 font-bold';
      case 4: return 'bg-purple-100 text-purple-700 font-bold';
      case 5: return 'bg-emerald-100 text-emerald-700 font-bold';
      case 6: return 'bg-teal-100 text-teal-700 font-bold';
      case 7: return 'bg-indigo-100 text-indigo-700 font-bold';
      default: return 'bg-slate-100 text-slate-700 font-bold';
    }
  };

  const getPartSubtitle = (q: QuestionItem) => {
    if (q.part === 1) return `[${t('detailPage.tagImage')}]`;
    if (q.part === 2) return `[${t('detailPage.tagSingleAudio')}]`;
    if (q.part === 3) return `${q.passageTitle || 'Dialogue'} - Câu ${(q.order % 3) || 3}`;
    if (q.part === 4) return `${q.passageTitle || 'Talk'} - Câu ${(q.order % 3) || 3}`;
    return `Part ${q.part}`;
  };

  const listeningAudioStats = useMemo(() => {
    const singleQuestions = questionsList.filter((q) => [1, 2].includes(Number(q.part)));
    const passageChildren = passagesList
      .filter((group) => [3, 4].includes(Number(group.part)))
      .flatMap((group) => group.passages?.length ? group.passages : [group]);
    const total = singleQuestions.length + passageChildren.length;
    const ready = [
      ...singleQuestions.map((q) => q.audioMeta?.status === 'READY' || Boolean(q.audioUrl)),
      ...passageChildren.map((p) => p.audioMeta?.status === 'READY' || Boolean(p.audioUrl)),
    ].filter(Boolean).length;
    const stale = [
      ...singleQuestions.map((q) => q.audioMeta?.status === 'STALE'),
      ...passageChildren.map((p) => p.audioMeta?.status === 'STALE'),
    ].filter(Boolean).length;
    return { total, ready, stale, missing: Math.max(0, total - ready) };
  }, [questionsList, passagesList]);

  const audioHealthy = listeningAudioStats.total > 0 && listeningAudioStats.missing === 0 && listeningAudioStats.stale === 0;
  const audioWarning = listeningAudioStats.missing > 0 || listeningAudioStats.stale > 0;

  const startListeningAudioJob = async () => {
    if (!examId || isStartingAudioJob) return;
    setAudioJobError(null);
    setIsStartingAudioJob(true);
    try {
      const response = await audioService.generateToeicExam(examId, [1, 2, 3, 4]);
      const payload = (response as any)?.data?.data ?? (response as any)?.data ?? response;
      const jobId = payload?.jobId;
      if (!jobId) throw new Error('Không nhận được jobId từ server.');
      setAudioJobId(jobId);
      setAudioJob({ id: jobId, name: 'toeic-exam-bulk', state: 'waiting' });
    } catch (err: any) {
      setAudioJobError(err?.response?.data?.message || err?.message || 'Không thể bắt đầu generate audio.');
    } finally {
      setIsStartingAudioJob(false);
    }
  };

  useEffect(() => {
    if (!audioJobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const response = await audioService.getJob(audioJobId);
        const next = ((response as any)?.data?.data ?? (response as any)?.data ?? response) as AudioJobStatus;
        if (cancelled) return;
        setAudioJob(next);
        if (next.state === 'completed') {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] }),
            queryClient.invalidateQueries({ queryKey: ['admin-exam-passages', examId] }),
          ]);
          return;
        }
        if (next.state === 'failed') {
          setAudioJobError(next.failedReason || 'Audio job thất bại.');
          return;
        }
        timer = setTimeout(poll, 1000);
      } catch (err: any) {
        if (!cancelled) setAudioJobError(err?.message || 'Không đọc được trạng thái audio job.');
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [audioJobId, examId, queryClient]);

  // Loading state
  if (isExamLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm text-slate-500">{t('detailPage.loadingExam')}</span>
      </div>
    );
  }

  // Not found state
  if (!exam || isExamError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">{t('detailPage.examNotFoundTitle')}</h2>
        <p className="max-w-sm text-center text-xs text-slate-500">{t('detailPage.examNotFoundDesc')}</p>
        <Link
          href={`/${locale}/assessment`}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detailPage.backToExams')}
        </Link>
      </div>
    );
  }

  const isAudioJobRunning = audioJob?.state === 'waiting' || audioJob?.state === 'active';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/50">
      {/* ── UNIFIED COMPACT HERO HEADER (Tất cả thông tin cốt lõi gói trong 1 header phẳng) ── */}
      <header className="bg-white">
        <div className="px-4 py-3 sm:px-6">
          {/* 1. Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link href={`/${locale}/assessment`} className="hover:text-blue-600 transition-colors">
              {t('detailPage.breadcrumbToeic')}
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <Link href={`/${locale}/assessment`} className="hover:text-blue-600 transition-colors">
              {t('detailPage.breadcrumbExams')}
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span className="max-w-xs truncate font-semibold text-slate-800 sm:max-w-md">{exam.name}</span>
          </div>

          {/* 2. Main Exam Information & Action Buttons */}
          <div className="mt-3">
            <ExamBanner
              exam={exam}
              locale={locale}
              examId={examId}
              questionsCount={questionsList.length}
              passagesCount={passagesList.length}
              onEditClick={() => setEditOpen(true)}
              onImportClick={() => setImportOpen(true)}
              onViewStructureClick={() => setStructureOpen(true)}
            />
          </div>

          {/* 3. Publication Workflow Bar - Compact Inline Strip */}
          <div className="mt-3">
            <PublicationBar kind="exams" id={examId} version={examResponse} compact={true} onShowIssues={() => setActiveTab('checks')} />
          </div>

        </div>
      </header>

      {/* Tabs: sticky under the app header. Group 1 = authoring, group 2 = learners. */}
      <div className="sticky top-16 z-20 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:px-6">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Exam tabs">
          {([
            [
              { key: 'questions', icon: FileText, label: t('tabs.questions'), badge: questionsList.length, alert: false },
              { key: 'checks', icon: ListChecks, label: locale === 'en' ? 'Checks' : 'Kiểm tra lỗi', badge: examErrorCount || undefined, alert: examErrorCount > 0 },
              { key: 'overview', icon: Info, label: locale === 'en' ? 'Exam info' : 'Thông tin đề', badge: undefined, alert: false },
            ],
            [
              { key: 'attempts', icon: Users, label: locale === 'en' ? 'Attempts' : 'Lượt thi', badge: exam.totalAttempts ?? 0, alert: false },
              { key: 'leaderboard', icon: Trophy, label: locale === 'en' ? 'Ranking' : 'Xếp hạng', badge: undefined, alert: false },
              { key: 'comments', icon: MessageSquare, label: locale === 'en' ? 'Comments' : 'Bình luận', badge: undefined, alert: false },
            ],
          ] as const).map((group, index) => (
            <div key={index} className={cn('flex shrink-0 gap-1', index > 0 && 'ml-2 border-l border-slate-200 pl-3')}>
              {group.map(({ key, icon: Icon, label, badge, alert }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={activeTab === key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'relative flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-semibold outline-none transition-colors focus-visible:bg-slate-50',
                    activeTab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                  {badge !== undefined && (
                    <span className={cn(
                      'rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                      alert ? 'bg-red-100 text-red-700' : activeTab === key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600',
                    )}>
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* ── MAIN TAB CONTENT (Không gian làm việc chính tập trung, gọn gàng) ── */}
      <main className="flex-1 px-4 py-4 sm:px-6 sm:py-5">
        {activeTab === 'questions' && (
          <ExamQuestionsTab
            questionsList={questionsList}
            filteredQuestions={filteredQuestions}
            allowedParts={allowedParts}
            partCounts={partCounts}
            selectedPartPill={selectedPartPill}
            setSelectedPartPill={setSelectedPartPill}
            questionSearch={questionSearch}
            setQuestionSearch={setQuestionSearch}
            filterPart={filterPart}
            setFilterPart={setFilterPart}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterPassage={filterPassage}
            setFilterPassage={setFilterPassage}
            uniquePassages={uniquePassages}
            handleResetFilters={handleResetFilters}
            paginatedQuestions={paginatedQuestions}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            totalPages={totalPages}
            totalFilteredQuestions={totalFilteredQuestions}
            locale={locale}
            examId={examId}
            getPartColor={getPartColor}
            getPartSubtitle={getPartSubtitle}
            passagesList={passagesList}
            onViewPassageGroup={(group) => setSelectedPassageGroupForDetail(group)}
            onEditPassageGroup={(group) => setSelectedPassageGroupForEdit(group)}
            onDeletePassageGroup={(group) => setSelectedPassageGroupForDelete(group)}
            onViewQuestion={(q) => setSelectedQuestionForDetail(q)}
            onEditQuestion={(q) => setSelectedQuestionForEdit(q)}
            onDeleteQuestion={(q) => setSelectedQuestionForDelete(q)}
          />
        )}

        {activeTab === 'checks' && (
          <ExamChecksTab
            issues={examIssues}
            questionsList={questionsList}
            totalQuestions={exam.totalQuestions}
            isFullToeic={(exam.type ?? 'TOEIC') === 'TOEIC' && exam.totalQuestions === 200}
            locale={locale}
            onEditQuestion={(q) => setSelectedQuestionForEdit(q)}
            toolbar={
          <div className={cn(
            'overflow-hidden rounded-xl border bg-white transition-colors text-xs',
            audioHealthy ? 'border-emerald-200/80' : audioWarning ? 'border-amber-200/80' : 'border-slate-200'
          )}>
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <button
                type="button"
                onClick={() => setAudioExpanded(v => !v)}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer text-left hover:opacity-80 transition-opacity"
              >
                <div className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                  audioHealthy ? 'bg-emerald-100/70 text-emerald-700' : audioWarning ? 'bg-amber-100/70 text-amber-700' : 'bg-blue-100/70 text-blue-700'
                )}>
                  <Volume2 className="h-3.5 w-3.5" />
                </div>
                <span className="font-semibold text-slate-800">{locale === 'en' ? 'Listening audio (Part 1–4)' : 'Audio phần Nghe (Part 1–4)'}</span>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{listeningAudioStats.total} câu</span>
                  <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">{listeningAudioStats.ready} ready</span>
                  {listeningAudioStats.stale > 0 && (
                    <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">{listeningAudioStats.stale} stale</span>
                  )}
                  {listeningAudioStats.missing > 0 && (
                    <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200">{listeningAudioStats.missing} thiếu</span>
                  )}
                </div>
                <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform ml-1', audioExpanded && 'rotate-180')} />
              </button>

              <button
                type="button"
                onClick={() => void startListeningAudioJob()}
                disabled={isStartingAudioJob || isAudioJobRunning}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
              >
                {isStartingAudioJob || isAudioJobRunning
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : listeningAudioStats.ready > 0 ? <RefreshCw className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                {locale === 'en' ? 'Generate audio' : 'Tạo audio'}
              </button>
            </div>

            {audioExpanded && (
              <div className="border-t border-slate-200/60 bg-white px-3 py-2.5 space-y-2">
                <p className="text-[11px] text-slate-500">
                  Kokoro TTS tạo âm thanh trực tiếp vào bộ nhớ storage; BullMQ/Redis phân luồng xử lý tự động theo từng phần.
                </p>
                {audioJob && (
                  <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700">
                        {audioJob.state === 'completed' ? 'Hoàn tất' : audioJob.state === 'failed' ? 'Thất bại' : 'Đang xử lý audio...'}
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        {(audioJob.progress as any)?.processed || 0} / {(audioJob.progress as any)?.total || 0}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${(audioJob.progress as any)?.total ? Math.min(100, (((audioJob.progress as any)?.processed || 0) / (audioJob.progress as any).total) * 100) : 0}%` }}
                      />
                    </div>
                    {audioJob.state === 'completed' && (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Audio đã được đồng bộ hoàn tất.
                      </div>
                    )}
                  </div>
                )}
                {audioJobError && <p className="text-[11px] font-medium text-red-600">{audioJobError}</p>}
              </div>
            )}
          </div>
            }
            onOpenPart={(part) => {
              setActiveTab('questions');
              setSelectedPartPill(part);
            }}
          />
        )}

        {activeTab === 'overview' && (
          <ExamOverviewTab exam={exam} questionsCount={questionsList.length} />
        )}

        {activeTab === 'attempts' && <ExamAttemptsTab />}
        {activeTab === 'leaderboard' && <ExamLeaderboardTab key={examId} />}
        {activeTab === 'comments' && <ExamCommentsTab key={examId} />}
      </main>

      {/* ── DIALOGS ── */}
      <EditExamDialog open={editOpen} onOpenChange={setEditOpen} exam={exam} />
      <ExamStructureDialog open={structureOpen} onOpenChange={setStructureOpen} exam={exam} />
      <QuestionDetailDialog
        open={!!selectedQuestionForDetail || !!selectedPassageGroupForDetail}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedQuestionForDetail(null);
            setSelectedPassageGroupForDetail(null);
          }
        }}
        question={selectedQuestionForDetail}
        passageGroup={selectedPassageGroupForDetail}
        passagesList={passagesList}
        questionsList={questionsList}
        getPartColor={getPartColor}
        getPartSubtitle={getPartSubtitle}
      />
      <EditQuestionDialog
        open={!!selectedQuestionForEdit}
        onOpenChange={(open) => { if (!open) setSelectedQuestionForEdit(null); }}
        question={selectedQuestionForEdit}
        passagesList={passagesList}
        examId={examId}
      />
      <DeleteQuestionDialog
        open={!!selectedQuestionForDelete}
        onOpenChange={(open) => { if (!open) setSelectedQuestionForDelete(null); }}
        question={selectedQuestionForDelete}
        onConfirm={() => {
          if (selectedQuestionForDelete?._id) {
            deleteQuestionMutation.mutate(selectedQuestionForDelete._id);
          }
        }}
        isDeleting={deleteQuestionMutation.isPending}
      />
      <EditPassageDialog
        open={!!selectedPassageGroupForEdit}
        onOpenChange={(open) => { if (!open) setSelectedPassageGroupForEdit(null); }}
        passageGroup={selectedPassageGroupForEdit}
        examId={examId}
      />
      <DeletePassageDialog
        open={!!selectedPassageGroupForDelete}
        onOpenChange={(open) => { if (!open) setSelectedPassageGroupForDelete(null); }}
        passageGroup={selectedPassageGroupForDelete}
        onConfirm={() => {
          if (selectedPassageGroupForDelete) {
            deletePassageGroupMutation.mutate(selectedPassageGroupForDelete);
          }
        }}
        isDeleting={deletePassageGroupMutation.isPending}
      />
      <ImportQuestionsDialog open={importOpen} onOpenChange={setImportOpen} exam={exam} />
    </div>
  );
}
