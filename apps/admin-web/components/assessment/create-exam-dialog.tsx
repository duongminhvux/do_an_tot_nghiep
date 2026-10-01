'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
import { CreateExamDto, ExamMode, ExamSection, ExamType } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface CreateExamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccessCreated?: (id: string) => void;
}

export function CreateExamDialog({
  open,
  onOpenChange,
  onSuccessCreated,
}: CreateExamDialogProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [type, setType] = useState<ExamType>('TOEIC');
  const [section, setSection] = useState<ExamSection>('LISTENING');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [totalQuestions, setTotalQuestions] = useState<number>(100);
  const [description, setDescription] = useState('Bộ đề luyện nghe TOEIC Part 1-4');
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSectionChange = (sec: ExamSection) => {
    setSection(sec);
    if (sec === 'LISTENING') {
      setDurationMinutes(45);
      setTotalQuestions(100);
      if (!description || description.includes('TOEIC')) {
        setDescription('Bộ đề luyện nghe TOEIC Part 1-4');
      }
    } else if (sec === 'READING') {
      setDurationMinutes(75);
      setTotalQuestions(100);
      if (!description || description.includes('TOEIC')) {
        setDescription('Bộ đề luyện đọc TOEIC Part 5-7');
      }
    } else if (sec === 'FULL_TEST') {
      setDurationMinutes(120);
      setTotalQuestions(200);
      if (!description || description.includes('TOEIC')) {
        setDescription('Đề thi thử TOEIC đầy đủ 200 câu');
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (dto: CreateExamDto) => {
      const res = await examService.create(dto);
      return res.data;
    },
    onSuccess: (newExam) => {
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
      resetForm();
      onOpenChange(false);
      if (newExam?._id) {
        onSuccessCreated?.(newExam._id);
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi tạo đề thi';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const resetForm = () => {
    setName('');
    setType('TOEIC');
    setSection('LISTENING');
    setDurationMinutes(45);
    setTotalQuestions(100);
    setDescription('Bộ đề luyện nghe TOEIC Part 1-4');
    setIsActive(true);
    setErrorMessage(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Vui lòng nhập tên đề thi.');
      return;
    }

    const mode: ExamMode = section === 'FULL_TEST' ? 'FULL_TEST' : 'PRACTICE';

    createMutation.mutate({
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white border border-slate-200 rounded shadow-lg">
        <DialogHeader className="p-4 bg-slate-50 border-b border-slate-200">
          <DialogTitle className="text-sm font-bold text-slate-900">
            Tạo đề thi mới
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            Nhập thông tin đề thi và cấu hình thời gian làm bài
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
              Tiêu đề đề thi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: TOEIC Listening Practice 01"
              required
              className="w-full h-8 px-3 rounded border border-slate-300 text-xs focus:outline-none focus:border-blue-500 text-slate-900"
            />
          </div>

          {/* Phân loại đề thi (Pills) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Phân loại đề thi <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSectionChange('LISTENING')}
                className={`py-1.5 px-3 text-xs font-semibold rounded border transition-all text-center cursor-pointer ${
                  section === 'LISTENING'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Listening
              </button>
              <button
                type="button"
                onClick={() => handleSectionChange('READING')}
                className={`py-1.5 px-3 text-xs font-semibold rounded border transition-all text-center cursor-pointer ${
                  section === 'READING'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Reading
              </button>
              <button
                type="button"
                onClick={() => handleSectionChange('FULL_TEST')}
                className={`py-1.5 px-3 text-xs font-semibold rounded border transition-all text-center cursor-pointer ${
                  section === 'FULL_TEST'
                    ? 'bg-purple-50 border-purple-500 text-purple-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Full Test
              </button>
            </div>
          </div>

          {/* Row: Thời gian & Tổng số câu */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Thời gian (phút)
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
                Tổng số câu
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
              Mô tả ngắn
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
              <p className="text-xs font-semibold text-slate-800">Trạng thái kích hoạt</p>
              <p className="text-[11px] text-slate-500">Cho phép học viên nhìn thấy và làm bài thi này</p>
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
              onClick={() => handleOpenChange(false)}
              disabled={createMutation.isPending}
              className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo đề thi'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
