'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { QuestionItem, PassageItem } from '@/types';
import {
  FileText,
  Volume2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  RotateCcw,
  Eye,
  Trash2,
  Plus,
  Pencil,
  BookOpen,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PassageGroupDetail } from './question-detail-dialog';

export type DisplayItem =
  | {
      type: 'passage';
      id: string;
      passage?: PassageItem;
      title: string;
      part: number;
      section: 'LISTENING' | 'READING';
      questions: QuestionItem[];
      orderMin: number;
      orderMax: number;
      isActive: boolean;
    }
  | {
      type: 'single';
      id: string;
      question: QuestionItem;
    };

interface ExamQuestionsTabProps {
  questionsList: QuestionItem[];
  filteredQuestions: QuestionItem[];
  allowedParts: number[];
  partCounts: Record<number, number>;
  selectedPartPill: number | 'ALL';
  setSelectedPartPill: (pill: number | 'ALL') => void;
  questionSearch: string;
  setQuestionSearch: (search: string) => void;
  filterPart: string;
  setFilterPart: (part: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterPassage: string;
  setFilterPassage: (passage: string) => void;
  uniquePassages: string[];
  handleResetFilters: () => void;
  paginatedQuestions: QuestionItem[];
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  totalFilteredQuestions: number;
  locale: string;
  examId: string;
  getPartColor: (part: number) => string;
  getPartSubtitle: (q: QuestionItem) => string;
  onViewQuestion: (q: QuestionItem) => void;
  onEditQuestion: (q: QuestionItem) => void;
  onDeleteQuestion: (q: QuestionItem) => void;
  passagesList?: PassageItem[];
  onViewPassageGroup?: (group: PassageGroupDetail) => void;
  onEditPassageGroup?: (group: PassageGroupDetail) => void;
  onDeletePassageGroup?: (group: PassageGroupDetail) => void;
}

export function ExamQuestionsTab({
  questionsList,
  filteredQuestions,
  allowedParts,
  partCounts,
  selectedPartPill,
  setSelectedPartPill,
  questionSearch,
  setQuestionSearch,
  filterPart,
  setFilterPart,
  filterStatus,
  setFilterStatus,
  filterPassage,
  setFilterPassage,
  uniquePassages,
  handleResetFilters,
  paginatedQuestions: _fallbackPaginatedQuestions,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalPages: _fallbackTotalPages,
  totalFilteredQuestions,
  locale,
  examId,
  getPartColor,
  getPartSubtitle,
  onViewQuestion,
  onEditQuestion,
  onDeleteQuestion,
  passagesList = [],
  onViewPassageGroup,
  onEditPassageGroup,
  onDeletePassageGroup,
}: ExamQuestionsTabProps) {
  const { t } = useTranslation('assessment');

  const [expandedPassageIds, setExpandedPassageIds] = React.useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedPassageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group questions that share a passage; keep standalone questions as single rows.
  const displayItems = React.useMemo<DisplayItem[]>(() => {
    const items: DisplayItem[] = [];
    const visitedPassageKeys = new Set<string>();

    const passageById = new Map<string, PassageItem>();
    const passageByTitle = new Map<string, PassageItem>();
    passagesList.forEach((p) => {
      if (p._id) passageById.set(String(p._id), p);
      if (p.title) passageByTitle.set(p.title.trim().toLowerCase(), p);
    });

    for (const q of filteredQuestions) {
      if (!q) continue;
      const rawPid = q.passageGroupId || q.passageId;
      const pid =
        typeof rawPid === 'object'
          ? (rawPid as any)?._id
          : rawPid;
      const pKey = pid
        ? String(pid)
        : q.passageTitle
        ? `title:${q.passageTitle.trim()}`
        : null;

      if (pKey) {
        if (visitedPassageKeys.has(pKey)) {
          continue;
        }
        visitedPassageKeys.add(pKey);

        const groupQuestions = filteredQuestions
          .filter((item) => {
            const itemRawPid = item.passageGroupId || item.passageId;
            const itemPid =
              typeof itemRawPid === 'object'
                ? (itemRawPid as any)?._id
                : itemRawPid;
            const itemPKey = itemPid
              ? String(itemPid)
              : item.passageTitle
              ? `title:${item.passageTitle.trim()}`
              : null;
            return itemPKey === pKey;
          })
          .sort((a, b) => a.order - b.order);

        const foundPassage =
          (pid ? passageById.get(String(pid)) : null) ||
          (q.passageTitle
            ? passageByTitle.get(q.passageTitle.trim().toLowerCase())
            : null) ||
          (typeof rawPid === 'object'
            ? (rawPid as PassageItem)
            : undefined);

        const title =
          foundPassage?.title ||
          q.passageTitle ||
          `Passage (Part ${q.part})`;
        const orders = groupQuestions
          .map((item) => item.order)
          .filter(Boolean)
          .sort((a, b) => a - b);
        const allActive = groupQuestions.every(
          (item) => item.isActive
        );

        items.push({
          type: 'passage',
          id: pKey,
          passage: foundPassage,
          title,
          part: q.part,
          section: q.section,
          questions: groupQuestions,
          orderMin: orders[0] ?? q.order,
          orderMax: orders[orders.length - 1] ?? q.order,
          isActive: allActive,
        });
      } else {
        items.push({
          type: 'single',
          id: q._id,
          question: q,
        });
      }
    }

    return items;
  }, [filteredQuestions, passagesList]);

  // Pagination calculation based on displayItems
  const totalDisplayItems = displayItems.length;
  const computedTotalPages = Math.ceil(totalDisplayItems / pageSize) || 1;
  const paginatedDisplayItems = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayItems.slice(start, start + pageSize);
  }, [displayItems, currentPage, pageSize]);

  return (
    <>
      {/* Part Filter Pills Row */}
      <div className="bg-white rounded border border-slate-200/80 p-3 sm:p-4 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => {
              setSelectedPartPill('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded font-semibold transition-all cursor-pointer shrink-0 ${
              selectedPartPill === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t('detailPage.all')} ({questionsList.length})
          </button>

          {allowedParts.map((partNum) => {
            const count = partCounts[partNum] ?? 0;
            const isSelected = selectedPartPill === partNum;
            return (
              <button
                key={partNum}
                type="button"
                onClick={() => {
                  setSelectedPartPill(partNum);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Part {partNum}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Questions Table Card */}
      <div className="bg-white rounded border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Filters & Search Row */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={questionSearch}
              onChange={(e) => {
                setQuestionSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t('filters.searchQuestionsPlaceholder')}
              className="w-full h-8 pl-8 pr-3 rounded border border-slate-200 bg-slate-50/50 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Part */}
            <div className="w-28">
              <Select
                value={filterPart}
                onValueChange={(val) => {
                  setFilterPart(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs rounded border-slate-200 bg-white">
                  <SelectValue placeholder={t('detailPage.filterPart')} />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="ALL">{t('detailPage.filterAll')}</SelectItem>
                  {allowedParts.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      Part {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter by Status */}
            <div className="w-32">
              <Select
                value={filterStatus}
                onValueChange={(val) => {
                  setFilterStatus(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs rounded border-slate-200 bg-white">
                  <SelectValue placeholder={t('detailPage.filterStatus')} />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="ALL">{t('detailPage.filterAll')}</SelectItem>
                  <SelectItem value="ACTIVE">{t('status.active')}</SelectItem>
                  <SelectItem value="INACTIVE">{t('status.inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter by Passage */}
            {uniquePassages.length > 0 && (
              <div className="w-36">
                <Select
                  value={filterPassage}
                  onValueChange={(val) => {
                    setFilterPassage(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs rounded border-slate-200 bg-white">
                    <SelectValue placeholder={t('detailPage.filterPassage')} />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="ALL">{t('detailPage.filterAll')}</SelectItem>
                    <SelectItem value="NONE">—</SelectItem>
                    {uniquePassages.map((title) => (
                      <SelectItem key={title} value={title}>
                        {title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Reset Filters */}
            {(selectedPartPill !== 'ALL' ||
              questionSearch ||
              filterPart !== 'ALL' ||
              filterStatus !== 'ALL' ||
              filterPassage !== 'ALL') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-8 px-2.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                title={t('detailPage.filterReset')}
              >
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">{t('detailPage.filterReset')}</span>
              </button>
            )}

            {/* Quick Add Question Button */}
            <Link
              href={`/${locale}/assessment/${examId}/questions/create`}
              className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('detailPage.addQuestion')}</span>
            </Link>
          </div>
        </div>

        {/* Questions Table */}
        {questionsList.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-2">
            <p className="font-semibold text-slate-600 text-sm">
              {t('detailPage.emptyQuestionsTitle')}
            </p>
            <p>{t('detailPage.emptyQuestionsDesc')}</p>
            <Link
              href={`/${locale}/assessment/${examId}/questions/create`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 text-white font-semibold text-xs mt-2"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('detailPage.addQuestion')}</span>
            </Link>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-1">
            <p className="font-semibold text-slate-600">
              {t('detailPage.noMatchQuestionsTitle')}
            </p>
            <p>{t('detailPage.noMatchQuestionsDesc')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold text-slate-500">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-14 text-center">Part</th>
                  <th className="py-2.5 px-3 min-w-[220px]">
                    Bài đọc / Nội dung câu hỏi
                  </th>
                  <th className="py-2.5 px-3 min-w-[180px] max-w-[260px] text-center">
                    {t('detailPage.tablePassage')}
                  </th>
                  <th className="py-2.5 px-3 w-24 text-center">
                    {t('detailPage.tableCorrectAnswer')}
                  </th>
                  <th className="py-2.5 px-3 w-16 text-center">
                    <span className="inline-flex items-center gap-0.5">
                      {t('detailPage.tableOrder')}
                    </span>
                  </th>
                  <th className="py-2.5 px-3 w-28 text-center whitespace-nowrap">
                    {t('detailPage.tableStatus')}
                  </th>
                  <th className="py-2.5 px-3 w-24 text-center">
                    {t('detailPage.tableActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedDisplayItems.map((item, idx) => {
                  // CASE A: Passage Group Row
                  if (item.type === 'passage') {
                    const isExpanded = expandedPassageIds.has(item.id);
                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-blue-50/40 bg-white transition-colors">
                          {/* Index */}
                          <td className="py-3 px-3 text-center text-slate-500 font-medium">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>

                          {/* Part badge */}
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block w-6 h-6 leading-6 rounded text-xs text-center ${getPartColor(
                                item.part
                              )}`}
                            >
                              {item.part}
                            </span>
                          </td>

                          {/* Content / Title of Passage */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                                {item.section === 'LISTENING' ? (
                                  <Volume2 className="h-5 w-5" />
                                ) : (
                                  <BookOpen className="h-5 w-5" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                                    {item.title}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 shrink-0">
                                    {item.questions.length} câu hỏi
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                                  <span>
                                    Câu {item.orderMin} - {item.orderMax}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(item.id)}
                                    className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronDown className="h-3 w-3" />
                                        <span>
                                          {t('detailPage.collapseQuestions')}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <ChevronRight className="h-3 w-3" />
                                        <span>
                                          {t('detailPage.expandQuestions', {
                                            count: item.questions.length,
                                          })}
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Passage column */}
                          <td className="py-3 px-3 text-center min-w-[180px] max-w-[260px]">
                            <span
                              title={item.title}
                              className="inline-block max-w-[240px] truncate px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 align-middle"
                            >
                              {item.title}
                            </span>
                          </td>

                          {/* Correct Answer Summary */}
                          <td className="py-3 px-3 text-center">
                            <span
                              className="text-xs font-semibold text-slate-600"
                              title={item.questions
                                .map((q) => `Câu ${q.order}: ${q.correctAnswer}`)
                                .join(', ')}
                            >
                              {item.questions
                                .map((q) => q.correctAnswer)
                                .join(', ')}
                            </span>
                          </td>

                          {/* Order Range */}
                          <td className="py-3 px-3 text-center font-bold text-slate-800">
                            {item.orderMin === item.orderMax
                              ? item.orderMin
                              : `${item.orderMin} - ${item.orderMax}`}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {item.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                <span>{t('status.active')}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                                <span>{t('status.inactive')}</span>
                              </span>
                            )}
                          </td>

                          {/* Actions: Single clean DropdownMenu */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1 text-[11px]">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="h-7 w-7 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-48 rounded border border-slate-200 text-xs"
                                >
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (onViewPassageGroup) {
                                        onViewPassageGroup({
                                          passage: item.passage,
                                          title: item.title,
                                          part: item.part,
                                          section: item.section,
                                          questions: item.questions,
                                        });
                                      } else if (item.questions[0]) {
                                        onViewQuestion(item.questions[0]);
                                      }
                                    }}
                                    className="cursor-pointer text-slate-700 flex items-center gap-2"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-blue-600" />
                                    <span>{t('detailPage.viewQuestionDetail')}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (onEditPassageGroup) {
                                        onEditPassageGroup({
                                          passage: item.passage,
                                          title: item.title,
                                          part: item.part,
                                          section: item.section,
                                          questions: item.questions,
                                        });
                                      } else if (item.questions[0]) {
                                        onEditQuestion(item.questions[0]);
                                      }
                                    }}
                                    className="cursor-pointer text-amber-700 flex items-center gap-2"
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-amber-600" />
                                    <span>Chỉnh sửa bài đọc</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (onDeletePassageGroup) {
                                        onDeletePassageGroup({
                                          passage: item.passage,
                                          title: item.title,
                                          part: item.part,
                                          section: item.section,
                                          questions: item.questions,
                                        });
                                      }
                                    }}
                                    className="cursor-pointer text-red-600 flex items-center gap-2"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Xóa bài đọc & các câu hỏi</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>

                        {/* Sub-rows when expanded */}
                        {isExpanded &&
                          item.questions.map((q) => (
                            <tr
                              key={q._id}
                              className="bg-slate-50/60 hover:bg-slate-100/70 border-l-4 border-l-blue-500 text-xs transition-colors"
                            >
                              <td className="py-2.5 px-3 text-center text-slate-400 text-xs font-mono">
                                └
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-400">
                                <span className="text-[10px] text-slate-500 font-medium">
                                  #{q.order}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 pl-6">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 text-[11px] shrink-0">
                                    Câu {q.order}:
                                  </span>
                                  <span className="text-slate-700 truncate max-w-sm sm:max-w-md">
                                    {q.content}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-400 text-[11px] italic">
                                {item.title}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                                {q.correctAnswer}
                              </td>
                              <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                                {q.order}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {q.isActive ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                    <span>{t('status.active')}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                                    <span>{t('status.inactive')}</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1 text-[11px]">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className="h-6 w-6 rounded border border-slate-200 hover:bg-white flex items-center justify-center text-slate-500 cursor-pointer"
                                      >
                                        <MoreHorizontal className="h-3 w-3" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="w-40 rounded border border-slate-200 text-xs"
                                    >
                                      <DropdownMenuItem
                                        onClick={() => onViewQuestion(q)}
                                        className="cursor-pointer text-slate-700 flex items-center gap-2"
                                      >
                                        <Eye className="h-3.5 w-3.5 text-blue-600" />
                                        <span>{t('detailPage.viewQuestionDetail')}</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => onEditQuestion(q)}
                                        className="cursor-pointer text-amber-700 flex items-center gap-2"
                                      >
                                        <Pencil className="h-3.5 w-3.5 text-amber-600" />
                                        <span>{t('detailPage.editQuestion')}</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => onDeleteQuestion(q)}
                                        className="cursor-pointer text-red-600 flex items-center gap-2"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>{t('detailPage.deleteQuestion')}</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  }

                  // CASE B: Single Question Row
                  const q = item.question;
                  return (
                    <tr
                      key={q._id}
                      className="hover:bg-slate-50/70 transition-colors bg-white"
                    >
                      {/* # index */}
                      <td className="py-3 px-3 text-center text-slate-500 font-medium">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Part badge */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block w-6 h-6 leading-6 rounded text-xs text-center ${getPartColor(
                            q.part
                          )}`}
                        >
                          {q.part}
                        </span>
                      </td>

                      {/* Question content */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          {q.imageUrl ? (
                            <img
                              src={q.imageUrl}
                              alt="Question visual"
                              className="w-10 h-10 rounded object-cover border border-slate-200 shrink-0"
                            />
                          ) : q.section === 'READING' ||
                            (q.part && q.part >= 5) ? (
                            <div className="w-10 h-10 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                              <FileText className="h-5 w-5" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              <Volume2 className="h-5 w-5" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-slate-800">
                              {getPartSubtitle(q)}
                            </div>
                            <div className="text-xs text-slate-600 truncate max-w-sm sm:max-w-md">
                              {q.content}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Passage */}
                      <td className="py-3 px-3 text-center min-w-[180px] max-w-[260px]">
                        {q.passageTitle ? (
                          <span
                            title={q.passageTitle}
                            className="inline-block max-w-[240px] truncate px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100 align-middle"
                          >
                            {q.passageTitle}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Correct Answer */}
                      <td className="py-3 px-3 text-center font-bold text-slate-900">
                        {q.correctAnswer}
                      </td>

                      {/* Order */}
                      <td className="py-3 px-3 text-center font-medium text-slate-700">
                        {q.order}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {q.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span>{t('status.active')}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span>
                            <span>{t('status.inactive')}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 text-[11px]">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="h-7 w-7 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-40 rounded border border-slate-200 text-xs"
                            >
                              <DropdownMenuItem
                                onClick={() => onViewQuestion(q)}
                                className="cursor-pointer text-slate-700 flex items-center gap-2"
                              >
                                <Eye className="h-3.5 w-3.5 text-blue-600" />
                                <span>{t('detailPage.viewQuestionDetail')}</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onEditQuestion(q)}
                                className="cursor-pointer text-amber-700 flex items-center gap-2"
                              >
                                <Pencil className="h-3.5 w-3.5 text-amber-600" />
                                <span>{t('detailPage.editQuestion')}</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onDeleteQuestion(q)}
                                className="cursor-pointer text-red-600 flex items-center gap-2"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>{t('detailPage.deleteQuestion')}</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination */}
        {totalDisplayItems > 0 && (
          <div className="py-3 px-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              {t('pagination.showing')}{' '}
              {(currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, totalDisplayItems)}{' '}
              {t('pagination.of')} {totalDisplayItems} mục (
              {totalFilteredQuestions} câu hỏi)
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
              </button>

              {Array.from({ length: computedTotalPages }, (_, i) => i + 1).map(
                (pg) => (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setCurrentPage(pg)}
                    className={`w-7 h-7 rounded text-xs font-semibold cursor-pointer ${
                      currentPage === pg
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pg}
                  </button>
                )
              )}

              <button
                type="button"
                disabled={currentPage >= computedTotalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, computedTotalPages))
                }
                className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              </button>

              <div className="w-28 ml-1">
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs rounded border-slate-200 bg-white">
                    <SelectValue placeholder={`10 / ${t('pagination.page')}`} />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="10">10 / {t('pagination.page')}</SelectItem>
                    <SelectItem value="20">20 / {t('pagination.page')}</SelectItem>
                    <SelectItem value="50">50 / {t('pagination.page')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
