'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Loader2 } from 'lucide-react';
import { DeleteConfirmState } from './types';

interface DeleteConfirmModalProps {
  state: DeleteConfirmState | null;
  onClose: () => void;
  onConfirm: (state: DeleteConfirmState) => void;
  isPending: boolean;
  selectedCount?: number;
}

export function DeleteConfirmModal({
  state,
  onClose,
  onConfirm,
  isPending,
  selectedCount = 0,
}: DeleteConfirmModalProps) {
  const { t } = useTranslation('vocabulary');

  if (!state) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-sm w-full space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-slate-900">
              {state.type === 'bulk'
                ? t('bulk_remove_title', 'Xác nhận xóa từ đã chọn')
                : state.type === 'section'
                  ? t('delete_group_title', 'Xác nhận xóa nhóm')
                  : t('remove_word_title', 'Xóa từ khỏi bài học')}
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {state.type === 'bulk'
                ? t('bulk_remove_lesson_confirm', {
                    count: state.count || selectedCount,
                    defaultValue: `Bạn có chắc muốn xóa ${state.count || selectedCount} từ đã chọn khỏi bài học này?`,
                  })
                : state.type === 'section'
                  ? t('delete_section_confirm', {
                      name: state.sectionName,
                      defaultValue: `Xóa nhóm "${state.sectionName}"? Các từ vựng sẽ về trạng thái Chưa phân nhóm.`,
                    })
                  : t('remove_single_word_desc', {
                      word: state.wordName,
                      defaultValue: `Bạn có chắc muốn xóa từ "${state.wordName}" khỏi bài học này?`,
                    })}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            {t('cancel', 'Hủy')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(state)}
            disabled={isPending}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{t('btn_confirm_delete', 'Xác nhận xóa')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
