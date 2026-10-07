'use client';

import React, { useState, useEffect } from 'react';
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
import { Loader2, Layers, AlertTriangle } from 'lucide-react';

interface EditExamGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ExamGroupItem | null;
}

export function EditExamGroupDialog({
  open,
  onOpenChange,
  group,
}: EditExamGroupDialogProps) {
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setDescription(group.description || '');
      setOrder(group.order ?? 1);
      setIsActive(group.isActive ?? true);
      setErrorMessage(null);
    }
  }, [group, open]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!group?._id) return;
      const res = await examGroupService.update(group._id, {
        name: name.trim(),
        description: description.trim(),
        order: Number(order) || 1,
        isActive,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-groups'] });
      if (group?._id) {
        queryClient.invalidateQueries({ queryKey: ['admin-exam-group', group._id] });
      }
      setErrorMessage(null);
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || t('examGroups.editDialog.updateError');
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage(t('examGroups.editDialog.nameRequired'));
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6 rounded shadow-xl border border-slate-200">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                {t('examGroups.editDialog.title')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {t('examGroups.editDialog.description')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-xs text-red-600">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Tên nhóm */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              {t('examGroups.editDialog.nameLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('examGroups.editDialog.namePlaceholder')}
              className="w-full h-9 px-3 rounded border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Mô tả */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              {t('examGroups.editDialog.descLabel')}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('examGroups.editDialog.descPlaceholder')}
              className="w-full p-2.5 rounded border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Thứ tự & Trạng thái */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                {t('examGroups.editDialog.orderLabel')}
              </label>
              <input
                type="number"
                min={0}
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                className="w-full h-9 px-3 rounded border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                {t('examGroups.editDialog.statusLabel')}
              </label>
              <div className="h-9 flex items-center">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>{t('examGroups.editDialog.activeCheckbox')}</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            >
              {t('examGroups.editDialog.cancelBtn')}
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {updateMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              <span>{t('examGroups.editDialog.submitBtn')}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
