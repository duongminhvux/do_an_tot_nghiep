'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { QuestionItem, PassageItem } from '@/types';
import { Volume2, CheckCircle2, FileText, BookOpen, ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export interface PassageGroupDetail {
  passage?: PassageItem;
  title: string;
  part: number;
  section: 'LISTENING' | 'READING';
  questions: QuestionItem[];
  selectedQuestionId?: string;
}

interface QuestionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: QuestionItem | null;
  passageGroup?: PassageGroupDetail | null;
  passagesList?: PassageItem[];
  questionsList?: QuestionItem[];
  getPartColor: (part: number) => string;
  getPartSubtitle: (q: QuestionItem) => string;
}

export function QuestionDetailDialog({
  open,
  onOpenChange,
  question,
  passageGroup,
  passagesList = [],
  questionsList = [],
  getPartColor,
  getPartSubtitle,
}: QuestionDetailDialogProps) {
  const { t } = useTranslation('assessment');

  // Determine if this is a passage group view or single question view
  const activePassageGroup: PassageGroupDetail | null = React.useMemo(() => {
    if (passageGroup) return passageGroup;
    if (!question) return null;

    const pid =
      typeof (question.passageGroupId || question.passageId) === 'object'
        ? ((question.passageGroupId || question.passageId) as any)?._id
        : (question.passageGroupId || question.passageId);
    const pTitle = question.passageTitle;

    // If question has no passage association at all
    if (!pid && !pTitle) return null;

    // Find passage object
    const matchedPassage =
      passagesList.find((p) => {
        if (pid && String(p._id) === String(pid)) return true;
        if (
          pTitle &&
          p.title?.trim().toLowerCase() === pTitle.trim().toLowerCase()
        )
          return true;
        return false;
      }) ||
      (typeof (question.passageGroupId || question.passageId) === 'object'
        ? ((question.passageGroupId || question.passageId) as unknown as PassageItem)
        : undefined);

    // Find all sibling questions
    const siblings = questionsList.filter((q) => {
      const qPid =
        typeof (q.passageGroupId || q.passageId) === 'object'
          ? ((q.passageGroupId || q.passageId) as any)?._id
          : (q.passageGroupId || q.passageId);
      if (pid && qPid && String(qPid) === String(pid)) return true;
      if (
        pTitle &&
        q.passageTitle &&
        q.passageTitle.trim().toLowerCase() === pTitle.trim().toLowerCase()
      )
        return true;
      return false;
    });

    const isGroup = siblings.length > 1 || !!matchedPassage;
    if (!isGroup) return null;

    const groupQuestions =
      siblings.length > 0 ? siblings.sort((a, b) => a.order - b.order) : [question];

    return {
      passage: matchedPassage,
      title:
        matchedPassage?.title ||
        question.passageTitle ||
        `Passage (Part ${question.part})`,
      part: question.part,
      section: question.section,
      questions: groupQuestions,
      selectedQuestionId: question._id,
    };
  }, [passageGroup, question, passagesList, questionsList]);

  if (!open) return null;
  if (!activePassageGroup && !question) return null;

  // Case 1: Passage Group View (Passage prompt + questions & answers list)
  if (activePassageGroup) {
    const { title, part, section, passage, questions } = activePassageGroup;
    const sortedOrders = questions
      .map((q) => q.order)
      .filter(Boolean)
      .sort((a, b) => a - b);
    const orderRangeStr =
      sortedOrders.length > 0
        ? `Câu ${sortedOrders[0]} - ${sortedOrders[sortedOrders.length - 1]}`
        : `${questions.length} câu hỏi`;

    const audioUrl = passage?.audioUrl || passage?.passages?.find((cp) => cp.audioUrl)?.audioUrl || questions.find((q) => q.audioUrl)?.audioUrl;
    const imageUrl =
      (passage as any)?.imageUrl ||
      passage?.passages?.find((cp) => cp.imageUrl)?.imageUrl ||
      questions.find((q) => q.imageUrl)?.imageUrl;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded border border-slate-200 p-5 bg-white shadow-xl">
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${getPartColor(
                    part
                  )}`}
                >
                  Part {part}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  • {section}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {orderRangeStr} ({questions.length} câu hỏi)
                </span>
              </div>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
                <span>{title}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {section === 'LISTENING'
                  ? t('detailPage.passageListeningPromptTitle')
                  : t('detailPage.passagePromptTitle')}{' '}
                — TOEIC Part {part}
              </DialogDescription>
            </DialogHeader>

            {/* 1. Phần Đề bài (Passage Prompt Card) */}
            <div className="border rounded border-blue-200/90 bg-blue-50/20 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wide">
                  {section === 'LISTENING' ? (
                    <Volume2 className="h-4 w-4 text-blue-600" />
                  ) : (
                    <>{imageUrl ? <ImageIcon className="h-4 w-4 text-blue-600" /> : <FileText className="h-4 w-4 text-blue-600" />}</>
                  )}
                  <span>
                    {section === 'LISTENING'
                      ? t('detailPage.passageListeningPromptTitle')
                      : t('detailPage.passagePromptTitle')}
                  </span>
                </div>
                <span className="text-xs font-bold text-blue-700">{title}</span>
              </div>

              {/* Audio if available */}
              {audioUrl && (
                <div className="p-2.5 border rounded border-blue-200 bg-white space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Volume2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>Audio bài nghe</span>
                  </div>
                  <audio controls src={audioUrl} className="w-full h-8" />
                </div>
              )}



              {/* Passage text content: supports multi-passage groups and single passage */}
              {passage?.passages && passage.passages.length > 0 ? (
                <div className="space-y-3">
                  {passage.passages.map((cp, idx) => (
                    <div
                      key={cp._id || idx}
                      className="p-3.5 bg-white rounded border border-slate-200 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                            {cp.imageUrl ? 'IMAGE' : cp.type || 'TEXT'}
                          </span>
                          <span>{`${cp.imageUrl ? 'Hình ảnh' : 'Văn bản'} #${idx + 1}`}</span>
                        </span>
                      </div>
                      {cp.imageUrl && (
                        <div className="border rounded border-slate-200 p-2 bg-white flex justify-center max-h-80 overflow-hidden">
                          <img
                            src={cp.imageUrl}
                            alt={`Passage image ${idx + 1}`}
                            className="max-h-72 rounded object-contain"
                          />
                        </div>
                      )}
                      {cp.content && !cp.imageUrl && (
                        cp.content.includes('<') ? (
                          <div
                            className="text-xs sm:text-sm font-sans text-slate-800 leading-relaxed select-text tiptap-content"
                            dangerouslySetInnerHTML={{ __html: cp.content }}
                          />
                        ) : (
                          <div className="text-xs sm:text-sm font-sans text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                            {cp.content}
                          </div>
                        )
                      )}
                      {cp.content && cp.imageUrl && (
                        cp.content.includes('<') ? (
                          <div
                            className="text-xs sm:text-sm font-sans text-slate-600 leading-relaxed select-text border-t border-slate-100 pt-2 tiptap-content"
                            dangerouslySetInnerHTML={{ __html: cp.content }}
                          />
                        ) : (
                          <div className="text-xs sm:text-sm font-sans text-slate-600 leading-relaxed whitespace-pre-wrap select-text border-t border-slate-100 pt-2">
                            {cp.content}
                          </div>
                        )
                      )}
                    </div>
                  ))}
                </div>
              ) : imageUrl ? (
                /* Single passage — image takes priority, show content below if exists */
                <div className="space-y-2">
                  <div className="border rounded border-slate-200 p-2 bg-white flex justify-center">
                    <img
                      src={imageUrl}
                      alt="Passage visual"
                      className="max-h-96 rounded object-contain"
                    />
                  </div>
                  {passage?.content && (
                    passage.content.includes('<') ? (
                      <div
                        className="p-3.5 bg-white border rounded border-slate-200 text-xs sm:text-sm font-sans text-slate-600 leading-relaxed select-text tiptap-content"
                        dangerouslySetInnerHTML={{ __html: passage.content }}
                      />
                    ) : (
                      <div className="p-3.5 bg-white border rounded border-slate-200 text-xs sm:text-sm font-sans text-slate-600 leading-relaxed whitespace-pre-wrap select-text">
                        {passage.content}
                      </div>
                    )
                  )}
                </div>
              ) : passage?.content ? (
                passage.content.includes('<') ? (
                  <div
                    className="p-3.5 bg-white border rounded border-slate-200 text-xs sm:text-sm font-sans text-slate-800 leading-relaxed select-text tiptap-content"
                    dangerouslySetInnerHTML={{ __html: passage.content }}
                  />
                ) : (
                  <div className="p-3.5 bg-white border rounded border-slate-200 text-xs sm:text-sm font-sans text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                    {passage.content}
                  </div>
                )
              ) : !audioUrl ? (
                <div className="p-3.5 bg-white border rounded border-slate-200 text-xs sm:text-sm font-sans text-slate-400 italic">
                  {t('detailPage.noPassagesDesc')}
                </div>
              ) : null}
            </div>

            {/* 2. Phần Danh sách câu hỏi & câu trả lời (Questions & Answers List) */}
            <div className="space-y-3 pt-1">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
                <span>
                  {t('detailPage.passageQuestionsList', {
                    count: questions.length,
                  })}
                </span>
                <span className="text-slate-400 text-[11px] lowercase">
                  {questions.length} câu hỏi
                </span>
              </div>

              <div className="space-y-3">
                {questions.map((q) => (
                  <div
                    key={q._id}
                    className="p-3.5 rounded border border-slate-200 bg-white space-y-2.5 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="px-2 py-0.5 rounded font-bold text-xs bg-blue-100 text-blue-800 shrink-0 mt-0.5">
                          Câu {q.order}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                          {q.content && q.content.includes('<') ? (
                            <span dangerouslySetInnerHTML={{ __html: q.content }} />
                          ) : (
                            q.content
                          )}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                        Đáp án: {q.correctAnswer}
                      </span>
                    </div>

                    {/* Question Image if any (chỉ hiện khi khác với ảnh đoạn văn đề bài) */}
                    {q.imageUrl && q.imageUrl !== imageUrl && (
                      <div className="flex justify-center p-2 bg-slate-50 rounded border border-slate-200">
                        <img
                          src={q.imageUrl}
                          alt={`Question ${q.order}`}
                          className="max-h-48 rounded object-contain"
                        />
                      </div>
                    )}

                    {/* 2x2 Grid of Answer Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                      {q.options?.map((opt) => {
                        const isCorrect = opt.key === q.correctAnswer;
                        return (
                          <div
                            key={opt.key}
                            className={`p-2 rounded border flex items-center justify-between transition-colors ${
                              isCorrect
                                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 font-bold shadow-2xs'
                                : 'border-slate-200 bg-slate-50/40 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {opt.key}
                              </span>
                              <span>{opt.text}</span>
                            </div>
                            {isCorrect && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>{t('detailPage.correctAnswerBadge')}</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="p-2.5 bg-amber-50/60 border rounded border-amber-200 text-xs text-slate-700 leading-relaxed">
                        <span className="font-bold text-amber-800">
                          {t('detailPage.explanationTitle')}:{' '}
                        </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer close button */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-1.5 border rounded border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {t('detailPage.closeBtn')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Case 2: Standalone Question View (e.g. Part 5 single sentence question)
  if (!question) return null;
  const isActive = question.isActive;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded border border-slate-200 p-5 bg-white shadow-lg">
        <div className="space-y-4">
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

          {/* Question Content (Đề bài) */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {t('detailPage.questionContentTitle')}
            </div>
            <div className="p-3 bg-slate-50 border rounded border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
              {question.content && question.content.includes('<') ? (
                <div dangerouslySetInnerHTML={{ __html: question.content }} />
              ) : (
                question.content || '—'
              )}
            </div>
          </div>

          {/* Options (Danh sách câu trả lời) */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {t('detailPage.questionOptionsTitle')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
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
