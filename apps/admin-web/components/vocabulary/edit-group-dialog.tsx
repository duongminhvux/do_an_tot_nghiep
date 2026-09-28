'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { vocabularyGroupService } from '@/services/vocabulary.service';
import { VocabularyGroupItem, UpdateVocabularyGroupDto } from '@/types/vocabulary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Pencil,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: VocabularyGroupItem | null;
  onSuccessUpdated?: () => void;
}

export function EditGroupDialog({
  open,
  onOpenChange,
  group,
  onSuccessUpdated,
}: EditGroupDialogProps) {
  const { t } = useTranslation('vocabulary');
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [order, setOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setOrder(group.order || 1);
      setIsActive(group.isActive !== undefined ? group.isActive : true);
      setErrorMessage(null);
    }
  }, [group, open]);

  const updateMutation = useMutation({
    mutationFn: async (dto: UpdateVocabularyGroupDto) => {
      if (!group?._id) return null;
      const res = await vocabularyGroupService.update(group._id, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-groups'] });
      onOpenChange(false);
      onSuccessUpdated?.();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi cập nhật nhóm';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(t('group_name_required', 'Vui lòng nhập tên nhóm từ vựng.'));
      return;
    }

    updateMutation.mutate({
      name: trimmedName,
      order: Number(order) || 1,
      isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white border border-slate-200 rounded-[6px] shadow-none">
        <DialogHeader className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[6px] bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                {t('group_edit_title', 'Chỉnh sửa nhóm từ vựng')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {group?.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {errorMessage && (
            <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <span>{t('group_name_label', 'Tên nhóm')}</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[6px] border border-slate-200 focus:outline-none focus:border-blue-500 transition-colors text-slate-900 bg-white"
            />
          </div>

          {/* Order & Status */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {t('group_order_label', 'Thứ tự')}
              </label>
              <input
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 text-sm rounded-[6px] border border-slate-200 focus:outline-none focus:border-blue-500 transition-colors text-slate-900 bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {t('group_status_label', 'Trạng thái')}
              </label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-[6px] border border-slate-200 bg-slate-50">
                <input
                  type="checkbox"
                  id="edit-group-is-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded-[4px] text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
                />
                <label htmlFor="edit-group-is-active" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
                  {isActive ? t('active', 'Đang hoạt động') : t('inactive', 'Ngừng hoạt động')}
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
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
