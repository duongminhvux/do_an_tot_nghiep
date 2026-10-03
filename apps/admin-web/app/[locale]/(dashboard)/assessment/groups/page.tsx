'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
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
  Edit2,
  Trash2,
  FileText,
  Loader2,
  CheckCircle2,
  FolderKanban,
} from 'lucide-react';

export default function ExamGroupsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('assessment');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('ALL');

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ExamGroupItem | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<ExamGroupItem | null>(null);

  // Query Exam Groups
  const { data: groupsResponse, isLoading } = useQuery({
    queryKey: ['admin-exam-groups', searchTerm, filterActive],
    queryFn: async () => {
      const res = await examGroupService.getAll({
        search: searchTerm.trim() || undefined,
        isActive: filterActive === 'ALL' ? undefined : filterActive === 'ACTIVE',
        limit: 50,
      });
      return res?.data;
    },
  });

  const groups: ExamGroupItem[] = groupsResponse?.data || [];
  const totalGroups = groupsResponse?.total ?? groups.length;
  const totalExamsCombined = groups.reduce((acc, g) => acc + (g.examCount || 0), 0);

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
              {groups.filter((g) => g.isActive).length}
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
            className="w-full h-9 pl-9 pr-3.5 rounded border border-slate-200 bg-slate-50/50 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
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
