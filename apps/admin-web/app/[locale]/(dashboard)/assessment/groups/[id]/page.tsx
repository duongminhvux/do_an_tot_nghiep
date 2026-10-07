'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examGroupService } from '@/services/assessment.service';
import { ExamGroupItem, ExamItem } from '@/types';
import { AddExamToGroupDialog } from '@/components/assessment/add-exam-to-group-dialog';
import { EditExamGroupDialog } from '@/components/assessment/edit-exam-group-dialog';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Clock,
  AlertTriangle,
  Loader2,
  Layers,
  ExternalLink,
  MinusCircle,
  FileText,
} from 'lucide-react';

export default function ExamGroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const groupId = (params?.id as string) || '';
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  const [addExamOpen, setAddExamOpen] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [examToRemove, setExamToRemove] = useState<ExamItem | null>(null);

  // 1. Query Group Details
  const {
    data: groupResponse,
    isLoading: isGroupLoading,
    isError: isGroupError,
  } = useQuery({
    queryKey: ['admin-exam-group', groupId],
    queryFn: async () => {
      const res = await examGroupService.getById(groupId);
      return res?.data;
    },
    enabled: !!groupId,
  });

  const group: ExamGroupItem | null = groupResponse || null;

  // 2. Query Exams in this group
  const {
    data: examsResponse,
    isLoading: isExamsLoading,
  } = useQuery({
    queryKey: ['admin-exam-group-exams', groupId],
    queryFn: async () => {
      const res = await examGroupService.getExams(groupId);
      return res?.data;
    },
    enabled: !!groupId,
  });

  const exams: ExamItem[] = examsResponse || [];

  // Remove exam from group mutation
  const removeMutation = useMutation({
    mutationFn: async (examId: string) => {
      return examGroupService.removeExam(groupId, examId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-group-exams', groupId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-unassigned'] });
      setExamToRemove(null);
    },
  });

  if (isGroupLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <p className="text-xs">
            {t('examGroups.detail.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (isGroupError || !group) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
        <div className="max-w-md mx-auto bg-white rounded border border-red-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {t('examGroups.detail.notFoundTitle')}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {t('examGroups.detail.notFoundDesc')}
            </p>
          </div>
          <Link
            href={`/${locale}/assessment/groups`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t('examGroups.detail.backToGroups')}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6 w-full">
      {/* Back button */}
      <div>
        <Link
          href={`/${locale}/assessment/groups`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t('examGroups.detail.backToGroups')}</span>
        </Link>
      </div>

      {/* Group Detail Header */}
      <div className="bg-white rounded border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Layers className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {group.name}
                </h1>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                    group.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {group.isActive ? t('examGroups.active') : t('examGroups.inactive')}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {t('examGroups.examsCount', { count: exams.length })}
                </span>
              </div>
              {group.description && (
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-2xl">
                  {group.description}
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-2">
                Slug: <span className="font-mono text-slate-600">{group.slug}</span>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
            <button
              onClick={() => setEditGroupOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>{t('examGroups.detail.editBtn')}</span>
            </button>

            <button
              onClick={() => setAddExamOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition-all hover:shadow cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('examGroups.detail.addExamBtn')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* List of Exams in this Group */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>{t('examGroups.detail.examsInGroup')}</span>
            <span className="text-xs font-normal text-slate-400">({exams.length})</span>
          </h2>
        </div>

        {isExamsLoading ? (
          <div className="bg-white rounded border border-slate-200/90 p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-xs">
              {t('examGroups.detail.loadingExams')}
            </p>
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-white rounded border border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {t('examGroups.detail.noExamsTitle')}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {t('examGroups.detail.noExamsDesc')}
              </p>
            </div>
            <button
              onClick={() => setAddExamOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('examGroups.detail.addExamBtn')}</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded border border-slate-200/90 divide-y divide-slate-100 shadow-2xs overflow-hidden">
            {exams.map((exam, idx) => (
              <div
                key={exam._id}
                className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-all cursor-pointer group"
                onClick={() => router.push(`/${locale}/assessment/${exam._id}`)}
              >
                {/* Left: Exam Info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded bg-slate-100 group-hover:bg-blue-50 text-slate-600 group-hover:text-blue-600 font-bold text-xs flex items-center justify-center shrink-0 transition-colors">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {exam.name}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {exam.type}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        Full Test
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{t('examGroups.detail.minutes', { count: exam.durationMinutes })}</span>
                      </span>
                      <span>•</span>
                      <span>{t('examGroups.detail.questionsCount', { count: exam.totalQuestions || 0 })}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div
                  className="flex items-center justify-between sm:justify-end gap-3 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      exam.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {exam.isActive ? t('examGroups.active') : t('examGroups.inactive')}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      title={t('examGroups.detail.removeConfirmBtn')}
                      onClick={() => setExamToRemove(exam)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                    >
                      <MinusCircle className="h-4 w-4" />
                    </button>

                    <Link
                      href={`/${locale}/assessment/${exam._id}`}
                      title={t('examGroups.detail.viewDetail')}
                      className="p-1.5 text-slate-400 group-hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Exam Dialog */}
      <AddExamToGroupDialog
        open={addExamOpen}
        onOpenChange={setAddExamOpen}
        groupId={groupId}
        groupName={group.name}
      />

      {/* Edit Group Dialog */}
      <EditExamGroupDialog
        open={editGroupOpen}
        onOpenChange={setEditGroupOpen}
        group={group}
      />

      {/* Confirmation Dialog: Remove Exam from Group */}
      {examToRemove && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-sm w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 border border-slate-200">
            <div className="w-10 h-10 rounded bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-900">
                {t('examGroups.detail.removeExamTitle')}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {t('examGroups.detail.removeExamDesc', { name: examToRemove.name })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExamToRemove(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              >
                {t('examGroups.detail.cancelBtn')}
              </button>
              <button
                type="button"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(examToRemove._id)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              >
                {removeMutation.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                <span>{t('examGroups.detail.removeConfirmBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
