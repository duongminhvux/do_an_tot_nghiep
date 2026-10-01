'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { QuestionItem } from '@/types';
import {
  FileText,
  Volume2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCcw,
  Eye,
  Trash2,
  Plus,
  Pencil,
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
  paginatedQuestions,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalPages,
  totalFilteredQuestions,
  locale,
  examId,
  getPartColor,
  getPartSubtitle,
  onViewQuestion,
  onEditQuestion,
  onDeleteQuestion,
}: ExamQuestionsTabProps) {
  const { t } = useTranslation('assessment');

  return (
    <>
      {/* Part Filter Pills Row */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => {
              setSelectedPartPill('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 ${
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
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Part {partNum}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
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
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
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
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200 bg-white">
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
                <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200 bg-white">
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
                  <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200 bg-white">
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
                className="h-8 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                title={t('detailPage.filterReset')}
              >
                <RotateCcw className="h-3 w-3" />
                <span className="text-[11px]">{t('detailPage.filterReset')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Real Questions Table */}
        {questionsList.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">
                {t('detailPage.emptyQuestionsTitle')}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {t('detailPage.emptyQuestionsDesc')}
              </p>
            </div>
            <Link
              href={`/${locale}/assessment/${examId}/questions/create`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer mt-2"
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
                  <th className="py-2.5 px-3">{t('detailPage.tableContent')}</th>
                  <th className="py-2.5 px-3 w-28 text-center">{t('detailPage.tablePassage')}</th>
                  <th className="py-2.5 px-3 w-24 text-center">{t('detailPage.tableCorrectAnswer')}</th>
                  <th className="py-2.5 px-3 w-16 text-center">
                    <span className="inline-flex items-center gap-0.5">
                      {t('detailPage.tableOrder')}
                    </span>
                  </th>
                  <th className="py-2.5 px-3 w-32 text-center whitespace-nowrap">{t('detailPage.tableStatus')}</th>
                  <th className="py-2.5 px-3 w-24 text-center">{t('detailPage.tableActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedQuestions.map((q, idx) => (
                  <tr key={q._id} className="hover:bg-slate-50/70 transition-colors">
                    {/* # index */}
                    <td className="py-3 px-3 text-center text-slate-500 font-medium">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>

                    {/* Part badge */}
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block w-6 h-6 leading-6 rounded-md text-xs text-center ${getPartColor(q.part)}`}>
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
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : q.section === 'READING' || (q.part && q.part >= 5) ? (
                          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
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
                    <td className="py-3 px-3 text-center">
                      {q.passageTitle ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
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
                      {q.status === 'ACTIVE' || (q.status !== 'INACTIVE' && (q as any).isActive !== false) ? (
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
                              className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded border border-slate-200 text-xs">
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
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination */}
        {filteredQuestions.length > 0 && (
          <div className="py-3 px-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              {t('pagination.showing')} {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalFilteredQuestions)} {t('pagination.of')} {totalFilteredQuestions} {t('table.questions').toLowerCase()}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  type="button"
                  onClick={() => setCurrentPage(pg)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold cursor-pointer ${
                    currentPage === pg
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pg}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              </button>

              <div className="w-28 ml-1">
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-7 text-xs rounded-lg border-slate-200 bg-white">
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
