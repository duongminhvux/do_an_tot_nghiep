'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examService, examGroupService } from '@/services/assessment.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface AddExamToGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
}

export function AddExamToGroupDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
}: AddExamToGroupDialogProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Query unassigned exams (exams without a group, or matching search)
  const { data: examsResponse, isLoading } = useQuery({
    queryKey: ['admin-exams-unassigned', searchTerm],
    queryFn: async () => {
      const res = await examService.getAll({
        search: searchTerm.trim() || undefined,
        groupId: 'none',
        limit: 50,
      });
      return res?.data;
    },
    enabled: open && !!groupId,
  });

  const exams = examsResponse?.data || [];

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedExamIds.length) return;
      return examGroupService.addExams(groupId, selectedExamIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
      setSelectedExamIds([]);
      setErrorMessage(null);
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || t('examGroups.addExamDialog.addError');
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const toggleSelectExam = (id: string) => {
    setSelectedExamIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedExamIds.length === exams.length) {
      setSelectedExamIds([]);
    } else {
      setSelectedExamIds(exams.map((e) => e._id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white p-6 rounded shadow-xl border border-slate-200 flex flex-col max-h-[85vh]">
        <DialogHeader className="space-y-1.5 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {t('examGroups.addExamDialog.title')}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {t('examGroups.addExamDialog.description', { name: groupName })}
                </DialogDescription>
              </div>
            </div>
            <Link
              href={`/${locale}/assessment/create?groupId=${groupId}`}
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              <span>{t('examGroups.addExamDialog.createNewExam')}</span>
            </Link>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-xs text-red-600 my-2 shrink-0">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Search bar */}
        <div className="pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('examGroups.addExamDialog.searchPlaceholder')}
              className="w-full h-9 pl-9 pr-3 rounded border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Select all & Count */}
        <div className="flex items-center justify-between py-1.5 px-1 text-xs text-slate-500 shrink-0 border-b border-slate-100">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
          >
            {selectedExamIds.length === exams.length && exams.length > 0
              ? t('examGroups.addExamDialog.deselectAll')
              : t('examGroups.addExamDialog.selectAll')}
          </button>
          <span>{t('examGroups.addExamDialog.selectedCount', { count: selectedExamIds.length })}</span>
        </div>

        {/* List of unassigned exams */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 min-h-[160px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-xs">{t('examGroups.addExamDialog.loading')}</span>
            </div>
          ) : exams.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              {searchTerm ? t('examGroups.addExamDialog.noMatch') : t('examGroups.addExamDialog.empty')}
            </div>
          ) : (
            exams.map((exam) => {
              const isSelected = selectedExamIds.includes(exam._id);
              return (
                <div
                  key={exam._id}
                  onClick={() => toggleSelectExam(exam._id)}
                  className={`flex items-center justify-between p-3 rounded border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 pointer-events-none cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {exam.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-medium text-slate-600">{exam.type}</span>
                        <span>•</span>
                        <span>{exam.durationMinutes || 120} phút</span>
                        <span>•</span>
                        <span>{exam.totalQuestions || 200} câu</span>
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            {t('examGroups.addExamDialog.cancelBtn')}
          </button>
          <button
            type="button"
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || selectedExamIds.length === 0}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            {addMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            <span>{t('examGroups.addExamDialog.submitBtn', { count: selectedExamIds.length })}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
