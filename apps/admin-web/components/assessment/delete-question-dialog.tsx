'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { QuestionItem } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: QuestionItem | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteQuestionDialog({
  open,
  onOpenChange,
  question,
  onConfirm,
  isDeleting,
}: DeleteQuestionDialogProps) {
  const { t } = useTranslation('assessment');

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !isDeleting && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden bg-white border border-slate-200 rounded shadow-lg">
        <DialogHeader className="p-4 bg-red-50/70 border-b border-red-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-900">
                {t('detailPage.confirmDeleteQuestionTitle')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {t('detailPage.confirmDeleteQuestionDesc')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4">
          <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-blue-100 text-blue-700">
                Part {question.part}
              </span>
              <span className="font-semibold text-slate-800">
                {t('detailPage.confirmDeleteQuestionMsg', { order: question.order })}
              </span>
            </div>
            <p className="text-slate-600 line-clamp-2 italic">
              &quot;{question.content}&quot;
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
              className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200 disabled:opacity-50"
            >
              {t('detailPage.cancelBtn')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-1.5 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isDeleting ? t('detailPage.deleting') : t('detailPage.confirmDeleteBtn')}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
