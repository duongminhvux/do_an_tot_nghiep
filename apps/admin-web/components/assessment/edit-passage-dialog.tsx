'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
import { useDraftUploads } from '@/hooks/use-draft-uploads';
import { ImageUploadField } from './image-upload-field';
import { PassageItem } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, BookOpen, CheckCircle2, HelpCircle, Volume2 } from 'lucide-react';
import { PassageGroupDetail } from './question-detail-dialog';
import { AutoResizeTextarea } from './auto-resize-textarea';
import { TiptapEditor } from './tiptap-editor';

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
  const [editablePassages, setEditablePassages] = useState<(PassageItem & { inputMode?: 'TEXT' | 'IMAGE' })[]>([]);
  const [uploadingPassages, setUploadingPassages] = useState<Record<string, boolean>>({});
  const isUploading = Object.values(uploadingPassages).some(Boolean);
  const draftUploads = useDraftUploads(editablePassages.map((p) => p.imageUrl), open);
  const updatePassage = (index: number, fields: Partial<PassageItem> & { inputMode?: 'TEXT' | 'IMAGE' }) => {
    setEditablePassages((prev) => prev.map((p, i) => i === index ? { ...p, ...fields } : p));
  };
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => {
      document.getElementById('edit-passage-error-alert')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  useEffect(() => {
    if (passageGroup) {
      setTitle(passageGroup.title || passageGroup.passage?.title || '');
      const passage = passageGroup.passage;
      const children = passage?.passages;
      setEditablePassages(children?.length ? children.map((p) => ({
        ...p,
        inputMode: p.content?.trim() ? 'TEXT' as const : (p.imageUrl ? 'IMAGE' as const : 'TEXT' as const),
      })) : [{
        inputMode: passage?.content?.trim() ? 'TEXT' : (passage?.imageUrl || passageGroup.questions.some((q) => q.imageUrl) ? 'IMAGE' : 'TEXT'),
        _id: '', type: passage?.type || 'TEXT', order: 1,
        content: passage?.content || '', audioUrl: passage?.audioUrl || '',
        imageUrl: passage?.imageUrl || passageGroup.questions.find((q) => q.imageUrl)?.imageUrl || '',
      }]);
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
  }, [passageGroup, open]);

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

      if (isUploading) throw new Error(t('editPassageDialog.uploadWaitingError'));
      draftUploads.startSaving();
      try {
        let groupId = passageGroup.passage?._id;
        if (groupId) {
          await examService.updatePassageGroup(groupId, { title: title.trim() });
          for (let index = 0; index < editablePassages.length; index++) {
            const p = editablePassages[index]!;
            const payload = {
              type: p.type || 'TEXT', content: p.content?.trim() || '',
              audioUrl: p.audioUrl?.trim() || '', imageUrl: p.imageUrl?.trim() || '',
            };
            await examService.updatePassage(p._id || groupId, payload);
            // Preserve this image even if a subsequent question update fails.
            draftUploads.commit([payload.imageUrl]);
          }
        } else {
          const created = await examService.createPassageGroup({
            examId, section: passageGroup.section, part: passageGroup.part,
            title: title.trim(), order: 1,
            passages: editablePassages.map((p, index) => ({
              type: p.type || 'TEXT', content: p.content?.trim() || '',
              audioUrl: p.audioUrl?.trim() || '', imageUrl: p.imageUrl?.trim() || '', order: index + 1,
            })),
          });
          groupId = (created as any)?.data?._id || (created as any)?._id;
          draftUploads.commit(editablePassages.map((p) => p.imageUrl));
        }
        if (!groupId) throw new Error(t('editPassageDialog.missingGroupIdError'));
        const originalImageUrls = new Set([
          passageGroup.passage?.imageUrl,
          ...(passageGroup.passage?.passages || []).map((p) => p.imageUrl),
          ...(!passageGroup.passage?.passages?.length
            ? passageGroup.questions.map((q) => q.imageUrl) : []),
        ].filter(Boolean));
        await Promise.all(questions.map((q) => {
          const original = passageGroup.questions.find((item) => item._id === q._id);
          return examService.updateQuestion(q._id, {
            content: q.content.trim(), options: q.options, correctAnswer: q.correctAnswer,
            explanation: q.explanation.trim(), passageGroupId: groupId,
            ...(original?.imageUrl && originalImageUrls.has(original.imageUrl) ? { imageUrl: '' } : {}),
          });
        }));
      } finally {
        draftUploads.finishSaving();
        queryClient.invalidateQueries({ queryKey: ['admin-exam-passages', examId] });
        queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-passages', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || t('editPassageDialog.updateError');
      showError(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  if (!passageGroup) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded border border-slate-200 p-5 bg-white shadow-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (updateMutation.isPending || isUploading) return;
            setErrorMessage(null);

            if (!title.trim()) {
              showError(t('editPassageDialog.titleRequired'));
              return;
            }

            if (isListening) {
              const missingAudio = editablePassages.some((p) => !p.audioUrl?.trim());
              if (missingAudio) {
                showError(t('editPassageDialog.missingAudioError'));
                return;
              }
            } else {
              for (let i = 0; i < editablePassages.length; i++) {
                const p = editablePassages[i]!;
                const hasText = Boolean(p.content?.trim());
                const hasImg = Boolean(p.imageUrl?.trim());
                if (!hasText && !hasImg) {
                  showError(t('editPassageDialog.passageEmptyError', { index: i + 1 }));
                  return;
                }
                if (hasText && hasImg) {
                  showError(t('editPassageDialog.passageExclusiveError', { index: i + 1 }));
                  return;
                }
              }
            }

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
                {t('editPassageDialog.linkedQuestionsCount', { count: questions.length })}
              </span>
            </div>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
              <span>{t('editPassageDialog.title')}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {isListening
                ? t('editPassageDialog.descriptionListening')
                : t('editPassageDialog.descriptionReading')}
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div
              id="edit-passage-error-alert"
              tabIndex={-1}
              role="alert"
              className="p-3.5 rounded border-2 border-red-300 bg-red-50 text-xs text-red-700 font-medium"
            >
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
                <span>{t('editPassageDialog.section1Title')}</span>
              </span>
              <span className="text-[11px] font-semibold text-blue-700">
                Part {passageGroup.part} ({passageGroup.section})
              </span>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                {t('editPassageDialog.titleLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('editPassageDialog.titlePlaceholder')}
                className="w-full h-8.5 px-3 rounded border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {editablePassages.map((p, index) => (
              <div key={p._id || index} className="space-y-3 rounded border border-slate-200 bg-white p-3">
                <div className="text-xs font-bold text-slate-800">
                  {p.imageUrl ? t('editPassageDialog.passageItemImage') : t('editPassageDialog.passageItemText')} #{index + 1}
                </div>
                {!isListening && (
                  <label className="block space-y-1 text-xs font-semibold text-slate-700">
                    {t('editPassageDialog.contentTypeLabel')}
                    <select value={p.inputMode || 'TEXT'} disabled={isUploading || updateMutation.isPending}
                      onChange={(e) => updatePassage(index, { inputMode: e.target.value as 'TEXT' | 'IMAGE', content: '', imageUrl: '' })}
                      className="block h-9 w-full rounded border border-slate-200 px-3 text-xs">
                      <option value="TEXT">{t('editPassageDialog.contentTypeText')}</option>
                      <option value="IMAGE">{t('editPassageDialog.contentTypeImage')}</option>
                    </select>
                    <span className="block font-normal text-slate-500">{t('editPassageDialog.contentTypeHint')}</span>
                  </label>
                )}
                {(isListening || p.inputMode === 'IMAGE') && (<ImageUploadField value={p.imageUrl || ''}
                  onChange={(url) => updatePassage(index, { imageUrl: url, ...(!isListening ? { content: '' } : {}) })}
                  onUploaded={draftUploads.track}
                  onBusyChange={(busy) => setUploadingPassages((prev) => ({ ...prev, [p._id || index]: busy }))}
                  onError={setErrorMessage} disabled={updateMutation.isPending} />)}
                {isListening && (
                  <label className="block space-y-1 text-xs font-semibold text-slate-700">
                    {t('editPassageDialog.audioUrlLabel')}
                    <input type="url" value={p.audioUrl || ''} disabled={updateMutation.isPending}
                      onChange={(e) => updatePassage(index, { audioUrl: e.target.value })}
                      className="h-9 w-full rounded border border-slate-200 px-3 text-xs" />
                    {p.audioUrl && <audio controls src={p.audioUrl} className="w-full h-8" />}
                  </label>
                )}
                {!isListening && p.inputMode !== 'IMAGE' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>{t('editPassageDialog.tiptapContentLabel')}</span>
                      <span className="text-[11px] font-normal text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                        Part {passageGroup?.part}
                      </span>
                    </label>
                    <TiptapEditor
                      value={p.content || ''}
                      onChange={(content) => updatePassage(index, { content })}
                      disabled={updateMutation.isPending}
                      showToeicBlankHelper={passageGroup?.part === 6}
                      minHeight="140px"
                    />
                  </div>
                ) : (
                  (isListening || p.inputMode !== 'IMAGE') && (
                    <label className="block space-y-1 text-xs font-semibold text-slate-700">
                      {isListening ? t('editPassageDialog.transcriptLabel') : t('editPassageDialog.textContentLabel')}
                      {p.imageUrl && <span className="ml-1 font-normal text-slate-400">{t('editPassageDialog.optionalWithImage')}</span>}
                      <AutoResizeTextarea value={p.content || ''} disabled={updateMutation.isPending}
                        onChange={(e) => updatePassage(index, { content: e.target.value })}
                        placeholder={p.imageUrl ? t('editPassageDialog.imageContentPlaceholder') : t('editPassageDialog.textContentPlaceholder')}
                        className="min-h-[120px] w-full rounded border border-slate-200 bg-white p-3 text-xs leading-relaxed" />
                    </label>
                  )
                )}
              </div>
            ))}
          </div>

          {/* CARD 2: DANH SÁCH CÂU HỎI & CÁC CÂU TRẢ LỜI */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>{t('editPassageDialog.section2Title', { count: questions.length })}</span>
              </span>
              <span className="text-[11px] text-slate-500">
                {t('editPassageDialog.section2Hint')}
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
                        {t('editPassageDialog.questionLabel', { order: q.order })}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {t('editPassageDialog.correctAnswerBadge')} <strong>{q.correctAnswer}</strong>
                      </span>
                    </div>

                    <AutoResizeTextarea
                      required
                      value={q.content}
                      onChange={(e) =>
                        handleQuestionContentChange(qIdx, e.target.value)
                      }
                      placeholder={t('editPassageDialog.questionContentPlaceholder', { order: q.order })}
                      className="w-full p-2.5 rounded border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[44px]"
                    />
                  </div>

                  {/* 2x2 Grid of Answer Options */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-slate-600">
                      {t('editPassageDialog.optionsLabel')}
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
                              title={t('editPassageDialog.selectCorrectOption', { key: opt.key })}
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
                              placeholder={t('editPassageDialog.optionPlaceholder', { key: opt.key })}
                              className="flex-1 h-7 text-xs bg-transparent focus:outline-none text-slate-800"
                            />
                            {isCorrect && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded shrink-0">
                                {t('editPassageDialog.correctBadge')}
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
                      <span>{t('editPassageDialog.explanationLabel')}</span>
                    </label>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) =>
                        handleExplanationChange(qIdx, e.target.value)
                      }
                      placeholder={t('editPassageDialog.explanationPlaceholder', { order: q.order })}
                      className="w-full h-7.5 px-2.5 rounded border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 sticky bottom-0 translate-y-5 bg-white/95 backdrop-blur-xs py-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border rounded border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {t('editPassageDialog.cancelBtn')}
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending || isUploading}
              className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs transition-colors"
            >
              {updateMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              <span>
                {updateMutation.isPending
                  ? t('editPassageDialog.savingBtn')
                  : t('editPassageDialog.saveBtn')}
              </span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
