'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { examGroupService } from '@/services/assessment.service';
import { ExamGroupItem } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteExamGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ExamGroupItem | null;
  onSuccessDeleted?: () => void;
}

export function DeleteExamGroupDialog({
  open,
  onOpenChange,
  group,
  onSuccessDeleted,
}: DeleteExamGroupDialogProps) {
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!group?._id) return;
      return examGroupService.delete(group._id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
      onOpenChange(false);
      if (onSuccessDeleted) {
        onSuccessDeleted();
      }
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6 rounded shadow-xl border border-slate-200">
        <DialogHeader className="space-y-2 pb-2">
          <div className="w-10 h-10 rounded bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle className="text-base font-bold text-slate-900">
            {t('examGroups.deleteDialog.title')}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 leading-relaxed">
            {t('examGroups.deleteDialog.description', { name: group?.name })}
          </DialogDescription>
        </DialogHeader>

        {deleteMutation.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {t('examGroups.deleteDialog.deleteError')}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            {t('examGroups.deleteDialog.cancelBtn')}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            {deleteMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            <span>{t('examGroups.deleteDialog.confirmBtn')}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
