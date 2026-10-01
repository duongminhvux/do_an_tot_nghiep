'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, AlertTriangle } from 'lucide-react';
import { PassageGroupDetail } from './question-detail-dialog';

interface DeletePassageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passageGroup: PassageGroupDetail | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeletePassageDialog({
  open,
  onOpenChange,
  passageGroup,
  onConfirm,
  isDeleting,
}: DeletePassageDialogProps) {
  const { t } = useTranslation('assessment');

  if (!passageGroup) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded border border-slate-200 p-5 bg-white shadow-xl">
        <div className="space-y-4">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Xác nhận xóa bài đọc & câu hỏi liên quan
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Hành động này sẽ xóa vĩnh viễn bài đọc và tất cả các câu hỏi thuộc bài đọc này khỏi đề thi và không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 rounded bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <span>Bài đọc:</span>
              <span className="text-blue-700">{passageGroup.title}</span>
            </div>
            <div className="text-slate-600">
              Part {passageGroup.part} • Bao gồm{' '}
              <strong className="text-red-600 font-bold">
                {passageGroup.questions.length} câu hỏi
              </strong>{' '}
              (
              {passageGroup.questions
                .map((q) => `Câu ${q.order}`)
                .slice(0, 5)
                .join(', ')}
              {passageGroup.questions.length > 5 ? '...' : ''})
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border rounded border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirm}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isDeleting ? 'Đang xóa...' : 'Xác nhận xóa tất cả'}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
