'use client';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { vocabularyGroupService } from '@/services/vocabulary.service';
import { VocabularyGroupItem } from '@/types/vocabulary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: VocabularyGroupItem | null;
  onSuccessDeleted?: () => void;
}

export function DeleteGroupDialog({
  open,
  onOpenChange,
  group,
  onSuccessDeleted,
}: DeleteGroupDialogProps) {
  const { t } = useTranslation('vocabulary');
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!group?._id) return;
      const res = await vocabularyGroupService.delete(group._id);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-groups'] });
      onOpenChange(false);
      onSuccessDeleted?.();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden bg-white border border-slate-200 rounded-[6px] shadow-none">
        <DialogHeader className="p-4 bg-rose-50 border-b border-rose-200">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[6px] bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                {t('group_delete_title', 'Xóa nhóm từ vựng')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {t('group_delete_confirm', 'Hành động này có thể khôi phục lại sau.')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-3.5">
          <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1.5">
            <p className="text-xs font-semibold text-slate-800">
              {group?.name}
            </p>
            {group?.description && (
              <p className="text-xs text-slate-500">
                {group.description}
              </p>
            )}
            {group?.collectionsCount ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium pt-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {t('group_delete_warning', {
                    count: group.collectionsCount,
                    defaultValue: `Nhóm này đang chứa ${group.collectionsCount} bộ sưu tập.`,
                  })}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer"
            >
              {t('cancel', 'Hủy')}
            </button>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-[6px] transition-colors disabled:opacity-50 cursor-pointer shadow-none"
            >
              {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('group_option_delete', 'Xóa nhóm')}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
