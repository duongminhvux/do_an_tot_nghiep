'use client';

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
import { ExamAttemptsTab } from '@/components/assessment/exam-attempts-tab';
import { ExamStructureDialog } from '@/components/assessment/exam-structure-dialog';
import {
  FileText,
  Users,
  Search,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Info,
  Volume2,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

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

  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'attempts'>('questions');
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);
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
      // Part Pill Filter
      if (selectedPartPill !== 'ALL' && q.part !== selectedPartPill) {
        return false;
      }

      // Part Dropdown Filter
      if (filterPart !== 'ALL' && String(q.part) !== filterPart) {
        return false;
      }

      // Status Dropdown Filter
      if (filterStatus !== 'ALL') {
        const isQActive = q.isActive || (q.isActive !== false && (q as any).isActive !== false);
        if (filterStatus === 'ACTIVE' && !isQActive) return false;
        if (filterStatus === 'INACTIVE' && isQActive) return false;
      }

      // Passage Dropdown Filter
      if (filterPassage !== 'ALL') {
        if (filterPassage === 'NONE' && (q.passageId || q.passageTitle)) return false;
        if (filterPassage !== 'NONE' && q.passageTitle !== filterPassage && q.passageId !== filterPassage) {
          return false;
        }
      }

      // Search Query
      if (questionSearch.trim()) {
        const query = questionSearch.toLowerCase().trim();
        const matchContent = q.content?.toLowerCase().includes(query);
        const matchPassage = q.passageTitle?.toLowerCase().includes(query);
        return matchContent || matchPassage;
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

  // Reset all filters
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
      case 1:
        return 'bg-amber-100 text-amber-700 font-bold';
      case 2:
        return 'bg-rose-100 text-rose-700 font-bold';
      case 3:
        return 'bg-blue-100 text-blue-700 font-bold';
      case 4:
        return 'bg-purple-100 text-purple-700 font-bold';
      case 5:
        return 'bg-emerald-100 text-emerald-700 font-bold';
      case 6:
        return 'bg-teal-100 text-teal-700 font-bold';
      case 7:
        return 'bg-indigo-100 text-indigo-700 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 font-bold';
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
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-sm font-medium text-slate-500">{t('detailPage.loadingExam')}</span>
      </div>
    );
  }

  // Not found in DB state
  if (!exam || isExamError) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">{t('detailPage.examNotFoundTitle')}</h2>
        <p className="text-xs text-slate-500 max-w-sm text-center">
          {t('detailPage.examNotFoundDesc')}
        </p>
        <Link
          href={`/${locale}/assessment`}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('detailPage.backToExams')}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6 w-full">
      {/* 1. Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href={`/${locale}/assessment`} className="hover:text-blue-600 transition-colors">
            {t('detailPage.breadcrumbToeic')}
          </Link>
          <span>&rsaquo;</span>
          <Link href={`/${locale}/assessment`} className="hover:text-blue-600 transition-colors">
            {t('detailPage.breadcrumbExams')}
          </Link>
          <span>&rsaquo;</span>
          <span className="font-semibold text-slate-900 truncate max-w-xs sm:max-w-md">
            {exam.name}
          </span>
        </div>

        {/* Top right quick search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={t('filters.searchPlaceholder')}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 2. Exam Banner Card */}
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


      {/* Listening audio pipeline */}
      <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Volume2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Listening TTS · Part 1–4</h3>
                <p className="text-[11px] text-slate-500">Kokoro tạo audio vào local storage; Redis xử lý batch tuần tự.</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">Tổng: {listeningAudioStats.total}</span>
              <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Ready: {listeningAudioStats.ready}</span>
              <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">Stale: {listeningAudioStats.stale}</span>
              <span className="rounded bg-slate-50 px-2 py-1 text-slate-600">Thiếu: {listeningAudioStats.missing}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void startListeningAudioJob()}
            disabled={isStartingAudioJob || audioJob?.state === 'waiting' || audioJob?.state === 'active'}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isStartingAudioJob || audioJob?.state === 'waiting' || audioJob?.state === 'active'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : listeningAudioStats.ready > 0 ? <RefreshCw className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            Generate Part 1–4
          </button>
        </div>

        {audioJob && (
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-slate-700">
                {audioJob.state === 'completed' ? 'Hoàn tất' : audioJob.state === 'failed' ? 'Thất bại' : 'Đang xử lý audio'}
              </span>
              <span className="text-slate-500">
                {(audioJob.progress as any)?.processed || 0}/{(audioJob.progress as any)?.total || 0}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${(audioJob.progress as any)?.total ? Math.min(100, (((audioJob.progress as any)?.processed || 0) / (audioJob.progress as any).total) * 100) : 0}%` }}
              />
            </div>
            {audioJob.state === 'completed' && (
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Audio đã được cập nhật từ PostgreSQL/object storage.
              </div>
            )}
          </div>
        )}
        {audioJobError && <div className="mt-2 text-[11px] font-medium text-red-600">{audioJobError}</div>}
      </div>

      {/* 4. Tab Navigation Header */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-px text-xs font-semibold overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`pb-3 px-3 transition-colors relative cursor-pointer flex items-center gap-2 ${
            activeTab === 'questions'
              ? 'text-blue-600 font-bold border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>{t('tabs.questions')}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600">
            {questionsList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 transition-colors relative cursor-pointer flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'text-blue-600 font-bold border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Info className="h-4 w-4" />
          <span>{t('tabs.overview')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attempts')}
          className={`pb-3 px-3 transition-colors relative cursor-pointer flex items-center gap-2 ${
            activeTab === 'attempts'
              ? 'text-blue-600 font-bold border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>{t('tabs.attempts')}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600">
            {exam.totalAttempts ?? 0}
          </span>
        </button>
      </div>

      {/* 5. Main Content Area */}
      <div className="w-full space-y-5">
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

        {activeTab === 'overview' && (
          <ExamOverviewTab exam={exam} questionsCount={questionsList.length} />
        )}

        {activeTab === 'attempts' && (
          <ExamAttemptsTab />
        )}
      </div>

      {/* Edit Exam Dialog */}
      <EditExamDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        exam={exam}
      />

      {/* Exam Structure Dialog Modal */}
      <ExamStructureDialog
        open={structureOpen}
        onOpenChange={setStructureOpen}
        exam={exam}
      />

      {/* Question / Passage Detail Dialog */}
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

      {/* Edit Question Dialog */}
      <EditQuestionDialog
        open={!!selectedQuestionForEdit}
        onOpenChange={(open) => {
          if (!open) setSelectedQuestionForEdit(null);
        }}
        question={selectedQuestionForEdit}
        passagesList={passagesList}
        examId={examId}
      />

      {/* Delete Question Confirmation Dialog */}
      <DeleteQuestionDialog
        open={!!selectedQuestionForDelete}
        onOpenChange={(open) => {
          if (!open) setSelectedQuestionForDelete(null);
        }}
        question={selectedQuestionForDelete}
        onConfirm={() => {
          if (selectedQuestionForDelete?._id) {
            deleteQuestionMutation.mutate(selectedQuestionForDelete._id);
          }
        }}
        isDeleting={deleteQuestionMutation.isPending}
      />

      {/* Edit Passage Dialog */}
      <EditPassageDialog
        open={!!selectedPassageGroupForEdit}
        onOpenChange={(open) => {
          if (!open) setSelectedPassageGroupForEdit(null);
        }}
        passageGroup={selectedPassageGroupForEdit}
        examId={examId}
      />

      {/* Delete Passage Dialog */}
      <DeletePassageDialog
        open={!!selectedPassageGroupForDelete}
        onOpenChange={(open) => {
          if (!open) setSelectedPassageGroupForDelete(null);
        }}
        passageGroup={selectedPassageGroupForDelete}
        onConfirm={() => {
          if (selectedPassageGroupForDelete) {
            deletePassageGroupMutation.mutate(selectedPassageGroupForDelete);
          }
        }}
        isDeleting={deletePassageGroupMutation.isPending}
      />

      {/* Import Questions Dialog */}
      <ImportQuestionsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        exam={exam}
      />
    </div>
  );
}
