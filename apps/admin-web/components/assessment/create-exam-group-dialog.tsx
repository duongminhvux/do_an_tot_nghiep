'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { examGroupService } from '@/services/assessment.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Layers, AlertTriangle } from 'lucide-react';

interface CreateExamGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccessCreated?: (id: string) => void;
}

export function CreateExamGroupDialog({
  open,
  onOpenChange,
  onSuccessCreated,
}: CreateExamGroupDialogProps) {
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await examGroupService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        order: Number(order) || 1,
        isActive,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-groups'] });
      setName('');
      setDescription('');
      setOrder(1);
      setIsActive(true);
      setErrorMessage(null);
      onOpenChange(false);
      if (onSuccessCreated && data?._id) {
        onSuccessCreated(data._id);
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || t('examGroups.createDialog.createError');
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage(t('examGroups.createDialog.nameRequired'));
      return;
    }
    createMutation.mutate();
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
                {t('examGroups.createDialog.title')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {t('examGroups.createDialog.description')}
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
              {t('examGroups.createDialog.nameLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('examGroups.createDialog.namePlaceholder')}
              className="w-full h-9 px-3 rounded border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Mô tả */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              {t('examGroups.createDialog.descLabel')}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('examGroups.createDialog.descPlaceholder')}
              className="w-full p-2.5 rounded border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Thứ tự & Trạng thái */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                {t('examGroups.createDialog.orderLabel')}
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
                {t('examGroups.createDialog.statusLabel')}
              </label>
              <div className="h-9 flex items-center">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>{t('examGroups.createDialog.activeCheckbox')}</span>
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
              {t('examGroups.createDialog.cancelBtn')}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {createMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              <span>{t('examGroups.createDialog.submitBtn')}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
