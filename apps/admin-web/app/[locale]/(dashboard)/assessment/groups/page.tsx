'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '@/hooks/use-debounce';
import { useQuery } from '@tanstack/react-query';
import { examGroupService } from '@/services/assessment.service';
import { ExamGroupItem } from '@/types';
import { CreateExamGroupDialog } from '@/components/assessment/create-exam-group-dialog';
import { EditExamGroupDialog } from '@/components/assessment/edit-exam-group-dialog';
import { DeleteExamGroupDialog } from '@/components/assessment/delete-exam-group-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Layers,
  Plus,
  Search,
  ChevronRight,
  ChevronLeft,
  Edit2,
  Trash2,
  FileText,
  Loader2,
  CheckCircle2,
  FolderKanban,
  RotateCcw,
} from 'lucide-react';

export default function ExamGroupsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('assessment');

  const initialQ = searchParams?.get('q') || searchParams?.get('search') || '';
  const initialPage = Number(searchParams?.get('page')) || 1;
  const initialLimit = Number(searchParams?.get('limit')) || 10;

  const [searchTerm, setSearchTerm] = useState(initialQ);
  const [filterActive, setFilterActive] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState<number>(initialLimit);

  // Debounced search term for 'q' param
  const debouncedQ = useDebounce(searchTerm, 400);

  // Reset page when debounced search term changes
  const prevDebouncedQ = useRef(debouncedQ);
  useEffect(() => {
    if (prevDebouncedQ.current !== debouncedQ) {
      prevDebouncedQ.current = debouncedQ;
      setCurrentPage(1);
    }
  }, [debouncedQ]);

  // Sync q and page into URL query string
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (debouncedQ.trim()) {
      url.searchParams.set('q', debouncedQ.trim());
    } else {
      url.searchParams.delete('q');
    }
    if (currentPage > 1) {
      url.searchParams.set('page', String(currentPage));
    } else {
      url.searchParams.delete('page');
    }
    if (pageSize !== 10) {
      url.searchParams.set('limit', String(pageSize));
    } else {
      url.searchParams.delete('limit');
    }
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [debouncedQ, currentPage, pageSize]);

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ExamGroupItem | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<ExamGroupItem | null>(null);

  // Query Exam Groups with pagination and debounced q param
  const { data: groupsResponse, isLoading, isFetching } = useQuery({
    queryKey: ['admin-exam-groups', debouncedQ, filterActive, currentPage, pageSize],
    queryFn: async () => {
      const res = await examGroupService.getAll({
        q: debouncedQ.trim() || undefined,
        search: debouncedQ.trim() || undefined,
        isActive: filterActive === 'ALL' ? undefined : filterActive === 'ACTIVE',
        page: currentPage,
        limit: pageSize,
      });
      return res?.data;
    },
  });

  // Summary query for the top 3 cards so metric totals don't jump when searching
  const { data: summaryResponse } = useQuery({
    queryKey: ['admin-exam-groups-summary'],
    queryFn: async () => {
      const res = await examGroupService.getAll({ limit: 1000 });
      return res?.data;
    },
  });

  const summaryList: ExamGroupItem[] = summaryResponse?.data || [];
  const totalGroups = summaryResponse?.total ?? summaryList.length;
  const totalExamsCombined = summaryList.reduce((acc, g) => acc + (g.examCount || 0), 0);
  const totalActiveGroups = summaryList.filter((g) => g.isActive).length;

  const groups: ExamGroupItem[] = groupsResponse?.data || [];
  const totalFiltered = groupsResponse?.total ?? groups.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  // Smart pagination pages window
  const paginationPages = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t('examGroups.title')}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('examGroups.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition-all hover:shadow cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>{t('examGroups.addGroupBtn')}</span>
        </button>
      </div>

      {/* Mini Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">
              {t('examGroups.totalGroups')}
            </p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{totalGroups}</p>
          </div>
        </div>

        <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">
              {t('examGroups.totalGroupedExams')}
            </p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{totalExamsCombined}</p>
          </div>
        </div>

        <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">
              {t('examGroups.activeGroups')}
            </p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {totalActiveGroups}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white rounded border border-slate-200/90 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('examGroups.searchPlaceholder')}
            className="w-full h-9 pl-9 pr-8 rounded border border-slate-200 bg-slate-50/50 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {isFetching && (
            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 text-blue-500 animate-spin" />
          )}
        </div>

        <div className="w-full sm:w-48">
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="h-9 rounded border border-slate-200 bg-white text-xs text-slate-700">
              <SelectValue placeholder={t('examGroups.allStatus')} />
            </SelectTrigger>
            <SelectContent className="bg-white border border-slate-200 rounded text-xs shadow-md">
              <SelectItem value="ALL">{t('examGroups.allStatus')}</SelectItem>
              <SelectItem value="ACTIVE">{t('examGroups.active')}</SelectItem>
              <SelectItem value="INACTIVE">{t('examGroups.inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Groups List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded border border-slate-200/90 p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-xs">
              {t('examGroups.loading')}
            </p>
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded border border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {searchTerm
                  ? t('examGroups.noGroupsFound')
                  : t('examGroups.noGroupsYet')}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {t('examGroups.noGroupsDesc')}
              </p>
            </div>
            {!searchTerm && (
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('examGroups.createFirstGroup')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded border border-slate-200/90 divide-y divide-slate-100 shadow-2xs overflow-hidden">
            {groups.map((group) => {
              const count = group.examCount || 0;
              return (
                <div
                  key={group._id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-all cursor-pointer group"
                  onClick={() => router.push(`/${locale}/assessment/groups/${group._id}`)}
                >
                  {/* Left: Group Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {group.name}
                        </h2>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            group.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {group.isActive ? t('examGroups.active') : t('examGroups.inactive')}
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          {group.description}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-1">
                        Slug: <span className="font-mono text-slate-600">{group.slug}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Exams count badge & Actions */}
                  <div
                    className="flex items-center justify-between sm:justify-end gap-3 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Exam count badge */}
                    <div className="px-3 py-1.5 rounded bg-slate-100/80 group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-700 border border-slate-200 group-hover:border-blue-200 text-xs font-bold transition-colors flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{t('examGroups.examsCount', { count })}</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        title={t('examGroups.editGroup')}
                        onClick={() => setEditGroup(group)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        title={t('examGroups.deleteGroup')}
                        onClick={() => setDeleteGroup(group)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => router.push(`/${locale}/assessment/groups/${group._id}`)}
                        className="p-2 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {groups.length > 0 && (
          <div className="py-3 px-4 border-t border-slate-200/90 bg-white rounded-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              {t('pagination.showing')}{' '}
              <span className="font-semibold text-slate-700">
                {(currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, totalFiltered)}
              </span>{' '}
              {t('pagination.of')}{' '}
              <span className="font-semibold text-slate-700">{totalFiltered}</span> {t('examGroups.title').toLowerCase()}
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              {/* Prev */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
              </button>

              {/* Page numbers with ellipsis */}
              {paginationPages.map((page, idx) =>
                typeof page === 'number' ? (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold">
                    ...
                  </span>
                )
              )}

              {/* Next */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              </button>

              {/* Page Size Select */}
              <div className="w-28 ml-1">
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs rounded border border-slate-200 bg-white">
                    <SelectValue placeholder="10 / trang" />
                  </SelectTrigger>
                  <SelectContent className="text-xs rounded border border-slate-200 bg-white">
                    <SelectItem value="5">5 / {t('pagination.page')}</SelectItem>
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

      {/* Dialogs */}
      <CreateExamGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EditExamGroupDialog
        open={!!editGroup}
        onOpenChange={(open) => !open && setEditGroup(null)}
        group={editGroup}
      />

      <DeleteExamGroupDialog
        open={!!deleteGroup}
        onOpenChange={(open) => !open && setDeleteGroup(null)}
        group={deleteGroup}
      />
    </div>
  );
}
