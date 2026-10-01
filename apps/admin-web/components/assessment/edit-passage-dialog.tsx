'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, BookOpen, CheckCircle2, HelpCircle, ImageIcon, Volume2 } from 'lucide-react';
import { PassageGroupDetail } from './question-detail-dialog';
import { AutoResizeTextarea } from './auto-resize-textarea';

interface EditableQuestion {
  _id: string;
  order: number;
  content: string;
  options: { key: 'A' | 'B' | 'C' | 'D'; text: string }[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

interface EditPassageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passageGroup: PassageGroupDetail | null;
  examId: string;
}

export function EditPassageDialog({
  open,
  onOpenChange,
  passageGroup,
  examId,
}: EditPassageDialogProps) {
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  const isListening =
    passageGroup?.section === 'LISTENING' ||
    (passageGroup?.part ? passageGroup.part <= 4 : false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (passageGroup) {
      setTitle(passageGroup.title || passageGroup.passage?.title || '');
      setContent(passageGroup.passage?.content || '');
      setAudioUrl(passageGroup.passage?.audioUrl || '');
      setImageUrl(
        passageGroup.passage?.imageUrl ||
        (passageGroup.passage as any)?.imageUrl ||
        passageGroup.questions.find((q) => q.imageUrl)?.imageUrl ||
        ''
      );
      setErrorMessage(null);

      const initialQs: EditableQuestion[] = (passageGroup.questions || []).map((q) => {
        const existingOpts = q.options || [];
        const optA = existingOpts.find((o) => o.key === 'A')?.text || '';
        const optB = existingOpts.find((o) => o.key === 'B')?.text || '';
        const optC = existingOpts.find((o) => o.key === 'C')?.text || '';
        const optD = existingOpts.find((o) => o.key === 'D')?.text || '';
        return {
          _id: q._id,
          order: q.order,
          content: q.content || '',
          options: [
            { key: 'A', text: optA },
            { key: 'B', text: optB },
            { key: 'C', text: optC },
            { key: 'D', text: optD },
          ],
          correctAnswer: q.correctAnswer || 'A',
          explanation: q.explanation || '',
        };
      });
      setQuestions(initialQs);
    }
  }, [passageGroup]);

  const handleQuestionContentChange = (index: number, newContent: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], content: newContent };
      }
      return next;
    });
  };

  const handleOptionChange = (
    qIndex: number,
    optKey: 'A' | 'B' | 'C' | 'D',
    text: string
  ) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[qIndex];
      if (q) {
        const nextOptions = q.options.map((opt) =>
          opt.key === optKey ? { ...opt, text } : opt
        );
        next[qIndex] = { ...q, options: nextOptions };
      }
      return next;
    });
  };

  const handleCorrectAnswerChange = (
    qIndex: number,
    newKey: 'A' | 'B' | 'C' | 'D'
  ) => {
    setQuestions((prev) => {
      const next = [...prev];
      if (next[qIndex]) {
        next[qIndex] = { ...next[qIndex], correctAnswer: newKey };
      }
      return next;
    });
  };

  const handleExplanationChange = (qIndex: number, explanation: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      if (next[qIndex]) {
        next[qIndex] = { ...next[qIndex], explanation };
      }
      return next;
    });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!passageGroup) return;
      const pid = passageGroup.passage?._id;
      let finalPassageId = pid;

      const passagePayload = {
        title,
        content: content.trim() || undefined,
        audioUrl: isListening ? (audioUrl.trim() || undefined) : undefined,
        imageUrl: imageUrl.trim() || undefined,
      };

      // 1. Update or create the passage document
      if (pid) {
        await examService.updatePassage(pid, passagePayload);
      } else {
        const created = await examService.createPassage({
          examId,
          ...passagePayload,
          section: passageGroup.section,
          part: passageGroup.part,
          order: questions[0]?.order || 1,
        });
        finalPassageId = (created as any)?.data?._id || (created as any)?._id;
      }

      // 2. Update all questions and their answer choices
      await Promise.all(
        questions.map((q) =>
          examService.updateQuestion(q._id, {
            content: q.content,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || undefined,
            passageId: finalPassageId || undefined,
            passageTitle: title,
            imageUrl: imageUrl.trim() || undefined,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-passages', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi cập nhật bài đọc và câu hỏi';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  if (!passageGroup) return null;

  const isSaveDisabled =
    updateMutation.isPending ||
    !title.trim() ||
    (!content.trim() && !imageUrl.trim() && !audioUrl.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded border border-slate-200 p-5 bg-white shadow-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-5"
        >
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                Part {passageGroup.part}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                • {passageGroup.section}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {questions.length} câu hỏi liên kết
              </span>
            </div>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
              <span>Chỉnh sửa bài đọc & các câu trả lời</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {isListening
                ? 'Chỉnh sửa audio bài nghe, transcript và các câu hỏi, câu trả lời.'
                : 'Chỉnh sửa hình ảnh/văn bản bài đọc và các câu hỏi, câu trả lời.'}
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700">
              {errorMessage}
            </div>
          )}

          {/* CARD 1: ĐỀ BÀI (PASSAGE) */}
          <div className="border rounded border-blue-200 bg-blue-50/20 p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-blue-100 pb-2">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                {isListening ? (
                  <Volume2 className="h-3.5 w-3.5 text-blue-600" />
                ) : (
                  <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                )}
                <span>1. Đề bài / Nội dung đoạn văn</span>
              </span>
              <span className="text-[11px] font-semibold text-blue-700">
                Part {passageGroup.part} ({passageGroup.section})
              </span>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Tiêu đề bài đọc / đoạn hội thoại <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: The Expansion of the Town Market"
                className="w-full h-8.5 px-3 rounded border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* If Listening: Audio URL */}
            {isListening ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-blue-600" />
                  <span>Audio URL (Link âm thanh MP3/WAV)</span>
                </label>
                <input
                  type="url"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="https://... / audio.mp3"
                  className="w-full h-8.5 px-3 rounded border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ) : (
              /* If Reading: Image URL (thay thế cho text bài đọc) */
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                  <span>Hình ảnh bài đọc (URL ảnh văn bản/đoạn văn thay thế cho text)</span>
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... / image.jpg / .png"
                  className="w-full h-8.5 px-3 rounded border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {imageUrl && (
                  <div className="p-2 border rounded border-slate-200 bg-white flex justify-center max-h-60 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt="Passage preview"
                      className="max-h-56 rounded object-contain"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Passage text content */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Nội dung đoạn văn dạng văn bản{' '}
                {imageUrl.trim() ? (
                  <span className="text-slate-400 font-normal">
                    (Tùy chọn khi bài đọc là dạng hình ảnh)
                  </span>
                ) : (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <AutoResizeTextarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  imageUrl.trim()
                    ? 'Có thể để trống nếu bài đọc đã dùng hình ảnh ở trên...'
                    : 'Nhập nội dung đầy đủ của bài đọc...'
                }
                className="w-full p-3 rounded border border-slate-200 bg-white text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans min-h-[120px]"
              />
            </div>
          </div>

          {/* CARD 2: DANH SÁCH CÂU HỎI & CÁC CÂU TRẢ LỜI */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>2. Danh sách câu hỏi & các câu trả lời ({questions.length} câu)</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Chọn chữ cái tương ứng để đặt đáp án đúng (tô xanh)
              </span>
            </div>

            <div className="space-y-4">
              {questions.map((q, qIdx) => (
                <div
                  key={q._id}
                  className="rounded border border-slate-200 bg-slate-50/50 p-3.5 space-y-3 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  {/* Question header & content input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded font-bold text-xs bg-blue-100 text-blue-800">
                        Câu {q.order}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Đáp án đúng: <strong>{q.correctAnswer}</strong>
                      </span>
                    </div>

                    <AutoResizeTextarea
                      required
                      value={q.content}
                      onChange={(e) =>
                        handleQuestionContentChange(qIdx, e.target.value)
                      }
                      placeholder={`Nội dung câu hỏi ${q.order}...`}
                      className="w-full p-2.5 rounded border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[44px]"
                    />
                  </div>

                  {/* 2x2 Grid of Answer Options */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-slate-600">
                      Các lựa chọn trả lời:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {q.options.map((opt) => {
                        const isCorrect = opt.key === q.correctAnswer;
                        return (
                          <div
                            key={opt.key}
                            className={`flex items-center gap-2 p-1.5 px-2 rounded border transition-colors ${
                              isCorrect
                                ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-400'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleCorrectAnswerChange(qIdx, opt.key)
                              }
                              title={`Chọn ${opt.key} làm đáp án đúng`}
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition-colors ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {opt.key}
                            </button>
                            <input
                              type="text"
                              required
                              value={opt.text}
                              onChange={(e) =>
                                handleOptionChange(qIdx, opt.key, e.target.value)
                              }
                              placeholder={`Đáp án ${opt.key}...`}
                              className="flex-1 h-7 text-xs bg-transparent focus:outline-none text-slate-800"
                            />
                            {isCorrect && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded shrink-0">
                                ✓ Đúng
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="space-y-1 pt-0.5">
                    <label className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      <HelpCircle className="h-3 w-3 text-slate-400" />
                      <span>Lời giải thích (tùy chọn):</span>
                    </label>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) =>
                        handleExplanationChange(qIdx, e.target.value)
                      }
                      placeholder={`Giải thích đáp án câu ${q.order}...`}
                      className="w-full h-7.5 px-2.5 rounded border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 sticky bottom-0 bg-white/95 backdrop-blur-xs py-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border rounded border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSaveDisabled}
              className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs transition-colors"
            >
              {updateMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              <span>
                {updateMutation.isPending
                  ? 'Đang lưu bài đọc & câu hỏi...'
                  : 'Lưu thay đổi bài đọc & câu hỏi'}
              </span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
