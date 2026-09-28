'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collectionService } from '@/services/vocabulary.service';
import { CollectionItem, VocabularyGroupItem } from '@/types/vocabulary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FolderSync, Loader2 } from 'lucide-react';

interface ChangeGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: CollectionItem | null;
  groups: VocabularyGroupItem[];
  onSuccess?: () => void;
}

export function ChangeGroupDialog({
  open,
  onOpenChange,
  collection,
  groups,
  onSuccess,
}: ChangeGroupDialogProps) {
  const { t } = useTranslation('vocabulary');
  const queryClient = useQueryClient();

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  useEffect(() => {
    if (collection) {
      const gId = typeof collection.groupId === 'string'
        ? collection.groupId
        : collection.groupId?._id || '';
      setSelectedGroupId(gId);
    }
  }, [collection, open]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!collection?._id) return;
      const res = await collectionService.update(collection._id, {
        groupId: selectedGroupId || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-groups'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden bg-white border border-slate-200 rounded-[6px] shadow-none">
        <DialogHeader className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[6px] bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <FolderSync className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                {t('change_group_dialog_title', 'Thay đổi nhóm')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {collection?.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              {t('change_group_select_label', 'Chọn nhóm từ vựng')}
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[6px] border border-slate-200 focus:outline-none focus:border-blue-500 transition-colors text-slate-900 bg-white"
            >
              <option value="">{t('change_group_no_group', '(Không thuộc nhóm nào)')}</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer"
            >
              {t('cancel', 'Hủy')}
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-[6px] transition-colors disabled:opacity-50 cursor-pointer shadow-none"
            >
              {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('btn_update_word', 'Lưu thay đổi')}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
