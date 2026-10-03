'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExamItem } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AlertCircle, Clock, BookOpen, Headphones, Info, Sparkles } from 'lucide-react';

interface ExamStructureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamItem | null;
}

export function ExamStructureDialog({
  open,
  onOpenChange,
  exam,
}: ExamStructureDialogProps) {
  const { t } = useTranslation('assessment');

  if (!exam) return null;

  const isReading = false;
  const isListening = false;
  const isFullTest = true;

  const dialogTitle = t('detailPage.sideStructureTitleFull', 'Cấu trúc đề thi TOEIC Full Test');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white sm:rounded-2xl border border-slate-200/80 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/60 shadow-xs">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight">
                {dialogTitle}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 flex items-center gap-2 flex-wrap pt-0.5">
                <span className="font-semibold text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded">
                  {exam.type || 'TOEIC'}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {exam.durationMinutes || 120} {t('table.minutes', 'phút')}
                </span>
                <span>•</span>
                <span className="text-slate-600 font-medium">
                  {exam.totalQuestions || 200} {t('filters.allQuestions', 'câu hỏi')}
                </span>
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Full Test Section Summary */}
          {isFullTest && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100/80 flex items-start gap-3">
                <Headphones className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-blue-900">
                    {t('detailPage.structure.listeningSection', 'Listening Section (100 câu)')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t('detailPage.structure.listeningSectionMeta', 'Photographs, Q&R, Conversations, Talks • 45 phút')}
                  </div>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-100/80 flex items-start gap-3">
                <BookOpen className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-teal-900">
                    {t('detailPage.structure.readingSection', 'Reading Section (100 câu)')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t('detailPage.structure.readingSectionMeta', 'Incomplete Sentences, Text Completion, Comprehension • 75 phút')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Parts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Part 1 (Listening) */}
            {!isReading && (
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-blue-200 hover:bg-blue-50/20 transition-all space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {t('detailPage.structure.part1Title', 'Part 1: Photographs')}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                    Part 1
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-400">
                  {t('detailPage.structure.part1Meta', '6 câu hỏi • ~3 phút')}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t('detailPage.structure.part1Desc', 'Nghe 4 câu miêu tả ngắn về một bức tranh và chọn câu miêu tả chính xác nhất.')}
                </p>
              </div>
            )}

            {/* Part 2 (Listening) */}
            {!isReading && (
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-emerald-200 hover:bg-emerald-50/20 transition-all space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {t('detailPage.structure.part2Title', 'Part 2: Question - Response')}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                    Part 2
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-400">
                  {t('detailPage.structure.part2Meta', '25 câu hỏi • ~9 phút')}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t('detailPage.structure.part2Desc', 'Nghe một câu hỏi hoặc phát biểu và chọn câu trả lời phù hợp nhất trong 3 lựa chọn (A, B, C).')}
                </p>
              </div>
            )}

            {/* Part 3 (Listening) */}
            {!isReading && (
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {t('detailPage.structure.part3Title', 'Part 3: Conversations')}
                  </span>
                  <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                    Part 3
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-400">
                  {t('detailPage.structure.part3Meta', '39 câu hỏi (13 đoạn) • ~17 phút')}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t('detailPage.structure.part3Desc', 'Nghe các đoạn hội thoại giữa 2 hoặc 3 người. Mỗi đoạn có 3 câu hỏi trắc nghiệm liên quan.')}
                </p>
              </div>
            )}

            {/* Part 4 (Listening) */}
            {!isReading && (
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-amber-200 hover:bg-amber-50/20 transition-all space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {t('detailPage.structure.part4Title', 'Part 4: Short Talks')}
                  </span>
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md">
                    Part 4
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-400">
                  {t('detailPage.structure.part4Meta', '30 câu hỏi (10 bài nói) • ~16 phút')}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t('detailPage.structure.part4Desc', 'Nghe các bài phát biểu, thông báo ngắn từ một người nói. Mỗi bài có 3 câu hỏi trắc nghiệm.')}
                </p>
              </div>
            )}

            {/* Part 5 (Reading) */}
            {!isListening && (
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-purple-200 hover:bg-purple-50/20 transition-all space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {t('detailPage.structure.part5Title', 'Part 5: Incomplete Sentences')}
                  </span>
                  <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
                    Part 5
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-400">
                  {t('detailPage.structure.part5Meta', '30 câu hỏi • ~15 phút')}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t('detailPage.structure.part5Desc', 'Chọn từ hoặc cụm từ phù hợp nhất trong 4 phương án để điền vào chỗ trống trong câu.')}
                </p>
              </div>
            )}

            {/* Part 6 (Reading) */}
            {!isListening && (
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-teal-200 hover:bg-teal-50/20 transition-all space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {t('detailPage.structure.part6Title', 'Part 6: Text Completion')}
                  </span>
                  <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md">
                    Part 6
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-400">
                  {t('detailPage.structure.part6Meta', '16 câu hỏi (4 đoạn) • ~10 phút')}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t('detailPage.structure.part6Desc', 'Điền từ, cụm từ hoặc cả câu vào các vị trí trống trong 4 văn bản ngắn (email, thông báo, bài viết).')}
                </p>
              </div>
            )}

            {/* Part 7 (Reading) */}
            {!isListening && (
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-rose-200 hover:bg-rose-50/20 transition-all space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {t('detailPage.structure.part7Title', 'Part 7: Reading Comprehension')}
                  </span>
                  <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md">
                    Part 7
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-400">
                  {t('detailPage.structure.part7Meta', '54 câu hỏi • ~50 phút')}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t('detailPage.structure.part7Desc', 'Đọc hiểu đoạn đơn (Single Passages) và đoạn kép / ba (Multi Passages) và trả lời các câu hỏi liên quan.')}
                </p>
              </div>
            )}
          </div>

          {/* Blue Callout: Về đoạn hội thoại / bài đọc */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/60 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-blue-900 font-bold">
              <Info className="h-4 w-4 text-blue-600 shrink-0" />
              <span>{t('detailPage.sideCalloutTitle', 'Về đoạn hội thoại / bài đọc')}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed pl-6">
              {t(
                'detailPage.sideCalloutDesc',
                'Part 3 và Part 4 sử dụng chung một file audio cho mỗi đoạn hội thoại / bài nói. Mỗi đoạn bao gồm 3 câu hỏi liên tiếp, các câu hỏi sẽ được nhóm theo cùng một đoạn hội thoại / bài đọc.',
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs"
          >
            {t('modal.cancel', 'Đóng')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
