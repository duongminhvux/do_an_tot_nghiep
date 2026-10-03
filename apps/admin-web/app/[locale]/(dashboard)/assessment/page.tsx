'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examService, examGroupService } from '@/services/assessment.service';
import { ExamGroupItem, ExamItem, ExamStatus } from '@/types';
import { CreateExamDialog } from '@/components/assessment/create-exam-dialog';
import { EditExamDialog } from '@/components/assessment/edit-exam-dialog';
import { DeleteExamDialog } from '@/components/assessment/delete-exam-dialog';
import { ViewExamDialog } from '@/components/assessment/view-exam-dialog';
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
import {
  Plus,
  Search,
  Pencil,
  Eye,
  Copy,
  MoreHorizontal,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';

export default function AssessmentPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExamStatus>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(8);

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(null);

  // Fetch real exams from MongoDB via NestJS API
  const { data: response, isLoading } = useQuery({
    queryKey: ['admin-exams'],
    queryFn: async () => {
      const res = await examService.getAll({ limit: 100 });
      return res.data;
    },
  });

  // Query groups for filter dropdown
  const { data: groupsResponse } = useQuery({
    queryKey: ['admin-exam-groups-filter'],
    queryFn: async () => {
      const res = await examGroupService.getAll({ limit: 100 });
      return res?.data;
    },
  });
  const groups: ExamGroupItem[] = groupsResponse?.data || [];

  // Extract real array of exams from API response
  const allExams: ExamItem[] = useMemo(() => {
    const payload = response?.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray((payload as any)?.data)) return (payload as any).data;
    if (Array.isArray((response as any)?.items)) return (response as any).items;
    return [];
  }, [response]);

  // Mutations
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      examService.toggleActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (exam: ExamItem) => {
      const newName = `${exam.name} (Bản sao)`;
      return examService.create({
        name: newName,
        type: exam.type,
        description: exam.description,
        durationMinutes: exam.durationMinutes || 120,
        totalQuestions: exam.totalQuestions || 200,
        isActive: false,
        order: (exam.order || 0) + 1,
        groupId: exam.groupId || exam.group?._id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
    },
  });

  // Filtered exams computed from DB data
  const filteredExams = useMemo(() => {
    return allExams.filter((exam) => {
      // Search by name, slug, or description
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        exam.name.toLowerCase().includes(term) ||
        (exam.description && exam.description.toLowerCase().includes(term)) ||
        (exam.slug && exam.slug.toLowerCase().includes(term));

      // Filter by status
      const examStatus = exam.isActive ? 'ACTIVE' : 'INACTIVE';
      const matchesStatus = statusFilter === 'ALL' || examStatus === statusFilter;

      // Filter by group
      let matchesGroup = true;
      if (groupFilter !== 'ALL') {
        if (groupFilter === 'none') {
          matchesGroup = !exam.groupId && !exam.group;
        } else {
          matchesGroup =
            (exam.groupId as any) === groupFilter ||
            (exam.groupId as any)?._id === groupFilter ||
            exam.group?._id === groupFilter;
        }
      }

      return matchesSearch && matchesStatus && matchesGroup;
    });
  }, [allExams, searchTerm, statusFilter, groupFilter]);

  // Pagination logic
  const totalFiltered = filteredExams.length;
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  const paginatedExams = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredExams.slice(startIndex, startIndex + pageSize);
  }, [filteredExams, currentPage, pageSize]);

  // Real statistics calculated directly from database records
  const stats = useMemo(() => {
    const total = allExams.length;
    const active = allExams.filter((e) => e.isActive).length;
    const inactive = total - active;
    const groupsCount = groups.length;

    return {
      total,
      active,
      inactive,
      groupsCount,
    };
  }, [allExams, groups]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setGroupFilter('ALL');
    setCurrentPage(1);
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return { date: '—', time: '' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: '—', time: '' };

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return {
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}`,
    };
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {t('title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('subtitle')}
          </p>
        </div>

        <Link
          href={`/${locale}/assessment/create`}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>{t('createExam')}</span>
        </Link>
      </div>

      {/* 4 Stat Cards Row - Calculated strictly from DB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng số đề thi */}
        <div className="bg-white rounded border border-slate-200/80 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 font-medium">{t('stats.total')}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              TOEIC Full Test (200 câu)
            </p>
          </div>
        </div>

        {/* Card 2: Đang hoạt động */}
        <div className="bg-white rounded border border-slate-200/80 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 font-medium">{t('status.active')}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.active}</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              {t('stats.subTotal', { active: stats.active })}
            </p>
          </div>
        </div>

        {/* Card 3: Chưa kích hoạt / Bản nháp */}
        <div className="bg-white rounded border border-slate-200/80 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <XCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 font-medium">{t('status.inactive')}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.inactive}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Bản nháp / Chưa kích hoạt
            </p>
          </div>
        </div>

        {/* Card 4: Nhóm đề thi */}
        <div className="bg-white rounded border border-slate-200/80 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 font-medium">{t('examGroups.title')}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.groupsCount}</p>
            <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
              Bộ đề thi phân loại
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t('filters.searchPlaceholder')}
            className="w-full h-9 pl-9 pr-3 rounded border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Filter Dropdowns & Reset button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Nhóm đề (Exam Group) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">{t('filters.group')}</span>
            <Select
              value={groupFilter}
              onValueChange={(val) => {
                setGroupFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-36 text-xs rounded border border-slate-200 bg-white">
                <SelectValue placeholder={t('filters.allGroups')} />
              </SelectTrigger>
              <SelectContent className="text-xs rounded border border-slate-200 bg-white">
                <SelectItem value="ALL">{t('filters.allGroups')}</SelectItem>
                <SelectItem value="none">{t('filters.unassignedGroup')}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g._id} value={g._id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trạng thái (Status) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">{t('table.status')}</span>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val as 'ALL' | ExamStatus);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-32 text-xs rounded border border-slate-200 bg-white">
                <SelectValue placeholder={t('filters.allStatuses')} />
              </SelectTrigger>
              <SelectContent className="text-xs rounded border border-slate-200 bg-white">
                <SelectItem value="ALL">{t('filters.allStatuses')}</SelectItem>
                <SelectItem value="ACTIVE">{t('filters.active')}</SelectItem>
                <SelectItem value="INACTIVE">{t('filters.inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Xóa bộ lọc */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-9 px-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t('filters.reset')}</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200/90 rounded overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-24 text-center text-slate-400 text-xs font-medium flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span>{t('examGroups.loading')}</span>
          </div>
        ) : allExams.length === 0 ? (
          /* Empty DB state */
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {t('empty.noExamsTitle')}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              {t('empty.noExamsDesc')}
            </p>
            <div className="flex items-center justify-center">
              <Link
                href={`/${locale}/assessment/create`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>{t('createExam')}</span>
              </Link>
            </div>
          </div>
        ) : filteredExams.length === 0 ? (
          /* No filter match state */
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {t('empty.noMatchTitle')}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              {t('empty.noMatchDesc')}
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('filters.reset')}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500">
                  <th className="py-3 px-3.5 w-10 text-center">
                    <span className="inline-flex items-center gap-0.5"># <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
                  </th>
                  <th className="py-3 px-3.5">
                    <span className="inline-flex items-center gap-0.5">{t('table.name')} <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
                  </th>
                  <th className="py-3 px-3.5 text-center w-32">
                    <span className="inline-flex items-center gap-0.5">{t('table.totalQuestions')} <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
                  </th>
                  <th className="py-3 px-3.5 text-center w-28">
                    <span className="inline-flex items-center gap-0.5">{t('table.duration')} <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
                  </th>
                  <th className="py-3 px-3.5 text-center w-20">
                    <span className="inline-flex items-center gap-0.5">{t('table.order')} <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
                  </th>
                  <th className="py-3 px-3.5 text-center w-36">
                    <span className="inline-flex items-center gap-0.5">{t('table.status')} <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
                  </th>
                  <th className="py-3 px-3.5 text-center w-20">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedExams.map((exam, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const examStatus = exam.isActive ? 'ACTIVE' : 'INACTIVE';

                  return (
                    <tr
                      key={exam._id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* # index */}
                      <td className="py-3 px-3.5 text-center text-slate-500 font-medium">
                        {globalIdx}
                      </td>

                      {/* Tên đề with File icon */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/${locale}/assessment/${exam._id}`}
                              className="font-bold text-slate-900 text-xs sm:text-sm hover:text-blue-600 transition-colors truncate block"
                            >
                              {exam.name}
                            </Link>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {(exam.group?.name || (exam as any).groupId?.name) && (
                                <Link
                                  href={`/${locale}/assessment/groups/${(exam.group?._id || (exam as any).groupId?._id || exam.groupId)}`}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded hover:bg-indigo-100 transition-colors shrink-0"
                                >
                                  <Layers className="h-2.5 w-2.5" />
                                  <span>{exam.group?.name || (exam as any).groupId?.name}</span>
                                </Link>
                              )}
                              <span className="text-slate-400 text-[11px] truncate">
                                {exam.description || '200 câu hỏi • Part 1–7'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total Questions */}
                      <td className="py-3 px-3.5 text-center">
                        <span className="inline-block px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded bg-blue-50 text-blue-700 border border-blue-100">
                          {exam.totalQuestions || 200} câu (Part 1–7)
                        </span>
                      </td>

                      {/* Thời gian */}
                      <td className="py-3 px-3.5 text-center font-medium text-slate-700">
                        {exam.durationMinutes || 120} {t('table.minutes')}
                      </td>

                      {/* Thứ tự */}
                      <td className="py-3 px-3.5 text-center font-medium text-slate-700">
                        {exam.order !== undefined ? exam.order : globalIdx}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3 px-3.5 text-center">
                        {examStatus === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            <span>{t('status.active')}</span>
                          </span>
                        )}
                        {examStatus === 'INACTIVE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                            <span>{t('status.inactive')}</span>
                          </span>
                        )}
                      </td>

                      {/* Thao tác (ALL ACTIONS IN DROPDOWN) */}
                      <td className="py-3 px-3.5 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="h-8 w-8 mx-auto rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                              title={t('actions.options')}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded shadow-lg border border-slate-200">
                            {/* Xem chi tiết */}
                            <DropdownMenuItem asChild className="cursor-pointer text-xs flex items-center gap-2 py-2">
                              <Link href={`/${locale}/assessment/${exam._id}`}>
                                <Eye className="h-3.5 w-3.5 text-blue-600" />
                                <span>{t('actions.view')}</span>
                              </Link>
                            </DropdownMenuItem>

                            {/* Sửa đề thi */}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedExam(exam);
                                setEditOpen(true);
                              }}
                              className="cursor-pointer text-xs flex items-center gap-2 py-2"
                            >
                              <Pencil className="h-3.5 w-3.5 text-blue-600" />
                              <span>{t('actions.edit')}</span>
                            </DropdownMenuItem>

                            {/* Nhân bản */}
                            <DropdownMenuItem
                              onClick={() => duplicateMutation.mutate(exam)}
                              disabled={duplicateMutation.isPending}
                              className="cursor-pointer text-xs flex items-center gap-2 py-2"
                            >
                              <Copy className="h-3.5 w-3.5 text-slate-600" />
                              <span>{t('actions.duplicate')}</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Đổi trạng thái */}
                            <DropdownMenuItem
                              onClick={() =>
                                toggleActiveMutation.mutate({
                                  id: exam._id,
                                  isActive: !exam.isActive,
                                })
                              }
                              className="cursor-pointer text-xs flex items-center gap-2 py-2"
                            >
                              {exam.isActive ? (
                                <>
                                  <XCircle className="h-3.5 w-3.5 text-amber-500" />
                                  <span>{t('actions.deactivate')}</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>{t('actions.activate')}</span>
                                </>
                              )}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Xóa */}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedExam(exam);
                                setDeleteOpen(true);
                              }}
                              className="cursor-pointer text-xs text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-2 py-2"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>{t('actions.delete')}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredExams.length > 0 && (
          <div className="py-3 px-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              {t('pagination.showing')}{' '}
              <span className="font-semibold text-slate-700">
                {(currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, totalFiltered)}
              </span>{' '}
              {t('pagination.of')}{' '}
              <span className="font-semibold text-slate-700">{totalFiltered}</span> {t('pagination.exams')}
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              {/* Prev */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
              </button>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
              ))}

              {/* Next */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                    <SelectValue placeholder="8 / trang" />
                  </SelectTrigger>
                  <SelectContent className="text-xs rounded border border-slate-200 bg-white">
                    <SelectItem value="8">8 / {t('pagination.page')}</SelectItem>
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
      <CreateExamDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <EditExamDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        exam={selectedExam}
      />

      <DeleteExamDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        exam={selectedExam}
      />

      <ViewExamDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        exam={selectedExam}
        onEditClick={() => setEditOpen(true)}
      />
    </div>
  );
}