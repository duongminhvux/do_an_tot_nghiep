'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
import { ExamItem } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface DeleteExamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamItem | null;
}

export function DeleteExamDialog({
  open,
  onOpenChange,
  exam,
}: DeleteExamDialogProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!exam?._id) return;
      const res = await examService.delete(exam._id);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi xóa đề thi';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden bg-white border border-slate-200 rounded shadow-lg">
        <DialogHeader className="p-4 bg-red-50/70 border-b border-red-100">
          <DialogTitle className="text-sm font-bold text-slate-900">
            Xác nhận xóa đề thi
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            Hành động này sẽ ẩn đề thi khỏi danh sách
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {errorMessage}
            </div>
          )}

          <p className="text-xs text-slate-600">
            Bạn có chắc chắn muốn xóa đề thi{' '}
            <span className="font-semibold text-slate-900">
              &quot;{exam?.name}&quot;
            </span>
            ? Dữ liệu câu hỏi liên quan sẽ không hiển thị cho học viên nữa.
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={deleteMutation.isPending}
              className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="px-4 py-1.5 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
