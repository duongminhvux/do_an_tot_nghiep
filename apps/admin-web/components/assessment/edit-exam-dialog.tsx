'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { examService, examGroupService } from '@/services/assessment.service';
import { ExamGroupItem, ExamItem, ExamType, UpdateExamDto } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EditExamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamItem | null;
}

export function EditExamDialog({
  open,
  onOpenChange,
  exam,
}: EditExamDialogProps) {
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [type, setType] = useState<ExamType>('TOEIC');
  const [durationMinutes, setDurationMinutes] = useState<number>(120);
  const [totalQuestions, setTotalQuestions] = useState<number>(200);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Query groups for selection
  const { data: groupsResponse } = useQuery({
    queryKey: ['admin-exam-groups-select'],
    queryFn: async () => {
      const res = await examGroupService.getAll({ limit: 100, isActive: true });
      return res?.data;
    },
    enabled: open,
  });
  const groups: ExamGroupItem[] = groupsResponse?.data || [];

  useEffect(() => {
    if (exam) {
      setName(exam.name || '');
      setGroupId((exam.groupId as any) || (exam.group?._id as any) || '');
      setType(exam.type || 'TOEIC');
      setDurationMinutes(exam.durationMinutes || 120);
      setTotalQuestions(exam.totalQuestions || 200);
      setDescription(exam.description || '');
      setIsActive(exam.isActive ?? true);
      setErrorMessage(null);
    }
  }, [exam, open]);

  const updateMutation = useMutation({
    mutationFn: async (dto: UpdateExamDto) => {
      if (!exam?._id) return;
      const res = await examService.update(exam._id, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-group-exams'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-unassigned'] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || t('editDialog.errorUpdate');
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(t('editDialog.nameRequired'));
      return;
    }

    updateMutation.mutate({
      name: trimmedName,
      groupId: groupId ? groupId : null,
      type,
      durationMinutes: Number(durationMinutes) || 120,
      totalQuestions: Number(totalQuestions) || 200,
      description: description.trim(),
      isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white border border-slate-200 rounded shadow-lg">
        <DialogHeader className="p-4 bg-slate-50 border-b border-slate-200">
          <DialogTitle className="text-sm font-bold text-slate-900">
            {t('editDialog.title')}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            {t('editDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {errorMessage}
            </div>
          )}

          {/* Tiêu đề */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              {t('editDialog.nameLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full h-8 px-3 rounded border border-slate-300 text-xs focus:outline-none focus:border-blue-500 text-slate-900"
            />
          </div>

          {/* Nhóm đề thi */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              {t('examGroups.groupSelectLabel')}
            </label>
            <Select
              value={groupId || 'none'}
              onValueChange={(val) => setGroupId(val === 'none' ? '' : val)}
            >
              <SelectTrigger className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs focus:outline-none focus:border-blue-500 text-slate-900 bg-white">
                <SelectValue placeholder={t('examGroups.groupSelectPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="rounded border border-slate-200 bg-white">
                <SelectItem value="none" className="text-xs">
                  {t('examGroups.groupSelectPlaceholder')}
                </SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g._id} value={g._id} className="text-xs">
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row: Thời gian & Tổng số câu */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                {t('editDialog.durationLabel')}
              </label>
              <input
                type="number"
                min={1}
                max={300}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full h-8 px-3 rounded border border-slate-300 text-xs focus:outline-none focus:border-blue-500 text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                {t('editDialog.questionsLabel')}
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(Number(e.target.value))}
                className="w-full h-8 px-3 rounded border border-slate-300 text-xs focus:outline-none focus:border-blue-500 text-slate-900"
              />
            </div>
          </div>

          {/* Mô tả */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              {t('editDialog.descriptionLabel')}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:border-blue-500 text-slate-900 resize-none"
            />
          </div>

          {/* Trạng thái hoạt động */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-xs font-semibold text-slate-800">{t('editDialog.statusLabel')}</p>
              <p className="text-[11px] text-slate-500">{t('editDialog.statusHint')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
              className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
            >
              {t('editDialog.cancel')}
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {updateMutation.isPending ? t('editDialog.saving') : t('editDialog.saveChanges')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
