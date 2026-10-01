'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
import { ExamItem, ExamMode, ExamSection, ExamType, UpdateExamDto } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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
  const [type, setType] = useState<ExamType>('TOEIC');
  const [section, setSection] = useState<ExamSection>('LISTENING');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [totalQuestions, setTotalQuestions] = useState<number>(100);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (exam) {
      setName(exam.name || '');
      setType(exam.type || 'TOEIC');
      setSection(exam.section || (exam.mode === 'FULL_TEST' ? 'FULL_TEST' : 'LISTENING'));
      setDurationMinutes(exam.durationMinutes || 0);
      setTotalQuestions(exam.totalQuestions || (exam.section === 'FULL_TEST' ? 200 : 100));
      setDescription(exam.description || '');
      setIsActive(exam.isActive !== undefined ? exam.isActive : true);
      setErrorMessage(null);
    }
  }, [exam]);

  const updateMutation = useMutation({
    mutationFn: async (dto: UpdateExamDto) => {
      if (!exam?._id) return;
      const res = await examService.update(exam._id, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
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

    const mode: ExamMode = section === 'FULL_TEST' ? 'FULL_TEST' : 'PRACTICE';

    updateMutation.mutate({
      name: trimmedName,
      type,
      mode,
      section,
      durationMinutes: Number(durationMinutes) || 0,
      totalQuestions: Number(totalQuestions) || 0,
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

          {/* Phân loại đề thi (Pills) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              {t('editDialog.classificationLabel')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSection('LISTENING')}
                className={`py-1.5 px-3 text-xs font-semibold rounded border transition-all text-center cursor-pointer ${
                  section === 'LISTENING'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t('editDialog.listening')}
              </button>
              <button
                type="button"
                onClick={() => setSection('READING')}
                className={`py-1.5 px-3 text-xs font-semibold rounded border transition-all text-center cursor-pointer ${
                  section === 'READING'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t('editDialog.reading')}
              </button>
              <button
                type="button"
                onClick={() => setSection('FULL_TEST')}
                className={`py-1.5 px-3 text-xs font-semibold rounded border transition-all text-center cursor-pointer ${
                  section === 'FULL_TEST'
                    ? 'bg-purple-50 border-purple-500 text-purple-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t('editDialog.fullTest')}
              </button>
            </div>
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
