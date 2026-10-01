'use client';

import React from 'react';
import { ExamItem } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ViewExamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamItem | null;
  onEditClick?: () => void;
}

export function ViewExamDialog({
  open,
  onOpenChange,
  exam,
  onEditClick,
}: ViewExamDialogProps) {
  if (!exam) return null;

  const section = exam.section || (exam.mode === 'FULL_TEST' ? 'FULL_TEST' : 'LISTENING');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white border border-slate-200 rounded shadow-lg">
        <DialogHeader className="p-4 bg-slate-50 border-b border-slate-200">
          <DialogTitle className="text-sm font-bold text-slate-900">
            Chi tiết đề thi
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            Mã định danh: {exam._id}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-3.5">
          {/* Header Title & Badges */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {section === 'LISTENING' && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                  LISTENING
                </span>
              )}
              {section === 'READING' && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  READING
                </span>
              )}
              {section === 'FULL_TEST' && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
                  FULL_TEST
                </span>
              )}
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {exam.type}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">{exam.name}</h3>
            {exam.description && (
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {exam.description}
              </p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-50 rounded border border-slate-200">
            <div>
              <p className="text-[11px] text-slate-500">Thời gian làm bài</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {exam.durationMinutes ? `${exam.durationMinutes} phút` : 'Không giới hạn'}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-slate-500">Tổng số câu hỏi</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {exam.totalQuestions || (section === 'FULL_TEST' ? 200 : 100)} câu
              </p>
            </div>

            <div>
              <p className="text-[11px] text-slate-500">Ngày tạo</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {exam.createdAt
                  ? new Date(exam.createdAt).toLocaleDateString('vi-VN')
                  : 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-slate-500">Trạng thái</p>
              <p
                className={`text-xs font-bold mt-0.5 ${
                  exam.isActive ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {exam.isActive ? 'Đang hoạt động' : 'Tạm ẩn'}
              </p>
            </div>
          </div>

          {/* Slug */}
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Slug:</span>
            <code className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
              {exam.slug || 'N/A'}
            </code>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
            >
              Đóng
            </button>
            {onEditClick && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onEditClick();
                }}
                className="px-4 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Chỉnh sửa đề thi
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
