'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { QuestionItem } from '@/types';
import { Volume2, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface QuestionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: QuestionItem | null;
  getPartColor: (part: number) => string;
  getPartSubtitle: (q: QuestionItem) => string;
}

export function QuestionDetailDialog({
  open,
  onOpenChange,
  question,
  getPartColor,
  getPartSubtitle,
}: QuestionDetailDialogProps) {
  const { t } = useTranslation('assessment');

  if (!question) return null;

  const isActive =
    question.status === 'ACTIVE' ||
    (question.status !== 'INACTIVE' && (question as any).isActive !== false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded border border-slate-200 p-4.5 bg-white shadow-lg">
        <div className="space-y-3.5">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${getPartColor(
                  question.part
                )}`}
              >
                Part {question.part}
              </span>
              <span className="text-xs font-medium text-slate-500">
                • {question.section}
              </span>
              <span className="ml-auto">
                {isActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    <span>{t('status.active')}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    <span>{t('status.inactive')}</span>
                  </span>
                )}
              </span>
            </div>
            <DialogTitle className="text-sm font-bold text-slate-900">
              {t('detailPage.questionDetailTitle', { order: question.order })}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {getPartSubtitle(question)}
            </DialogDescription>
          </DialogHeader>

          {/* Linked Passage if exists */}
          {question.passageTitle && (
            <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded space-y-1">
              <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                {t('detailPage.passageAttached')}
              </div>
              <div className="text-xs font-semibold text-blue-900">
                {question.passageTitle}
              </div>
            </div>
          )}

          {/* Image visual if exists */}
          {question.imageUrl && (
            <div className="border rounded border-slate-200 p-2 bg-slate-50/50 flex justify-center">
              <img
                src={question.imageUrl}
                alt="Question visual"
                className="max-h-52 rounded object-contain"
              />
            </div>
          )}

          {/* Audio if exists */}
          {question.audioUrl && (
            <div className="p-2.5 border rounded border-slate-200 bg-slate-50 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Volume2 className="h-3.5 w-3.5 text-blue-600" />
                <span>Audio</span>
              </div>
              <audio controls src={question.audioUrl} className="w-full h-8" />
            </div>
          )}

          {/* Question Content */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {t('detailPage.questionContentTitle')}
            </div>
            <div className="p-2.5 bg-slate-50 border rounded border-slate-200 text-xs font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
              {question.content || '—'}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {t('detailPage.questionOptionsTitle')}
            </div>
            <div className="space-y-1.5">
              {question.options?.map((opt) => {
                const isCorrect = opt.key === question.correctAnswer;
                return (
                  <div
                    key={opt.key}
                    className={`p-2 border rounded flex items-center justify-between text-xs transition-colors ${
                      isCorrect
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                          isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span>{opt.text}</span>
                    </div>
                    {isCorrect && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{t('detailPage.correctAnswerBadge')}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {t('detailPage.explanationTitle')}
            </div>
            <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded text-xs text-slate-700 leading-relaxed">
              {question.explanation ? (
                question.explanation
              ) : (
                <span className="text-slate-400 italic">
                  {t('detailPage.noExplanation')}
                </span>
              )}
            </div>
          </div>

          {/* Close button */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3.5 py-1.5 border rounded border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              {t('detailPage.closeBtn')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
