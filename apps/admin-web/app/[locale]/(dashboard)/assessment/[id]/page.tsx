'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
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
import { ExamStatsCards } from '@/components/assessment/exam-stats-cards';
import { ExamQuestionsTab } from '@/components/assessment/exam-questions-tab';
import { ExamOverviewTab } from '@/components/assessment/exam-overview-tab';
import { ExamPassagesTab } from '@/components/assessment/exam-passages-tab';
import { ExamAttemptsTab } from '@/components/assessment/exam-attempts-tab';
import { ExamStructureSidebar } from '@/components/assessment/exam-structure-sidebar';
import {
  FileText,
  BookOpen,
  Users,
  Search,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Info,
} from 'lucide-react';

export default function ExamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const examId = params?.id as string;
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  // Dialog & Active tab states
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'passages' | 'attempts'>('questions');
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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

  // 1. Query Real Exam details from MongoDB via API
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
      status: 'ACTIVE',
      durationMinutes: 45,
      totalQuestions: 100,
      isActive: true,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [examResponse, examId]);

  // 2. Query Real Questions of this exam from MongoDB
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

  // 3. Query Real Passages of this exam from MongoDB
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

  // Allowed Parts based on Exam Section (Listening: 1-4, Reading: 5-7, Full Test: 1-7)
  const allowedParts = useMemo(() => {
    if (exam?.section === 'READING') return [5, 6, 7];
    if (exam?.section === 'LISTENING') return [1, 2, 3, 4];
    return [1, 2, 3, 4, 5, 6, 7];
  }, [exam?.section]);

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
        const isQActive = q.status === 'ACTIVE' || (q.status !== 'INACTIVE' && (q as any).isActive !== false);
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
      />

      {/* 3. 4 Stat Cards Row */}
      <ExamStatsCards
        questionsCount={questionsList.length}
        targetQuestions={exam.totalQuestions || 100}
        passagesCount={passagesList.length}
        durationMinutes={exam.durationMinutes || 45}
      />

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
          onClick={() => setActiveTab('passages')}
          className={`pb-3 px-3 transition-colors relative cursor-pointer flex items-center gap-2 ${
            activeTab === 'passages'
              ? 'text-blue-600 font-bold border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>{t('tabs.passages')}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600">
            {passagesList.length}
          </span>
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
            0
          </span>
        </button>
      </div>

      {/* 5. Main Content Grid (Left: Tab content, Right: Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8-9 Cols */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-5">
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

          {activeTab === 'passages' && (
            <ExamPassagesTab passagesList={passagesList} />
          )}

          {activeTab === 'attempts' && (
            <ExamAttemptsTab />
          )}
        </div>

        {/* Right 3-4 Cols - Sticky Structure Sidebar */}
        <ExamStructureSidebar exam={exam} />
      </div>

      {/* Edit Exam Dialog */}
      <EditExamDialog
        open={editOpen}
        onOpenChange={setEditOpen}
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
