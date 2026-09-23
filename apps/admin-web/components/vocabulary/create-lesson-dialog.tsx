'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { lessonService } from '@/services/vocabulary.service';
import { CreateLessonDto } from '@/types/vocabulary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  BookPlus,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface CreateLessonDialogProps {
  open: boolean;
  collectionId: string;
  collectionName?: string;
  onOpenChange: (open: boolean) => void;
  defaultOrder?: number;
}

export function CreateLessonDialog({
  open,
  collectionId,
  collectionName,
  onOpenChange,
  defaultOrder = 1,
}: CreateLessonDialogProps) {
  const { t } = useTranslation('vocabulary');
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState<number>(defaultOrder > 0 ? defaultOrder : 1);
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync default order when dialog opens or defaultOrder changes
  React.useEffect(() => {
    if (open) {
      setOrder(defaultOrder > 0 ? defaultOrder : 1);
    }
  }, [open, defaultOrder]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setOrder(defaultOrder > 0 ? defaultOrder : 1);
    setIsActive(true);
    setErrorMessage(null);
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateLessonDto) => lessonService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create lesson. Please try again.';
      setErrorMessage(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Lesson title is required.');
      return;
    }
    if (!collectionId) {
      setErrorMessage('No collection selected.');
      return;
    }

    setErrorMessage(null);
    createMutation.mutate({
      collectionId,
      title: title.trim(),
      description: description.trim() || undefined,
      order: Number(order) || 0,
      isActive,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md w-full p-6 rounded-2xl border border-slate-200 shadow-2xl bg-white">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <BookPlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {t('add_lesson', { defaultValue: 'Add New Lesson' })}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {collectionName
                  ? `Add a lesson to "${collectionName}"`
                  : 'Add a new lesson to this collection.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              {t('lesson_title', { defaultValue: 'Lesson Title' })} *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unit 1: Family & Friends, Lesson 1"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              {t('description', { defaultValue: 'Description (Optional)' })}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the lesson's target topic..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 items-start">
            {/* Order */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                {t('order', { defaultValue: 'Order' })}
              </label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(Math.max(1, Number(e.target.value)))}
                min={1}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* IsActive */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                {t('status', { defaultValue: 'Status' })}
              </label>
              <div className="h-[38px] flex items-center">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    {isActive
                      ? t('active', { defaultValue: 'Active' })
                      : t('inactive', { defaultValue: 'Inactive' })}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
            >
              {t('cancel', { defaultValue: 'Cancel' })}
            </button>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              {createMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              <span>{t('create_lesson', { defaultValue: 'Create Lesson' })}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
