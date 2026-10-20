'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
import { audioService } from '@/services/audio.service';
import { useDraftUploads } from '@/hooks/use-draft-uploads';
import { ImageUploadField } from './image-upload-field';
import { QuestionItem, PassageItem, GeneratedAudioMeta } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Upload, Volume2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface EditQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: QuestionItem | null;
  passagesList: PassageItem[];
  examId: string;
}

export function EditQuestionDialog({
  open,
  onOpenChange,
  question,
  passagesList,
  examId,
}: EditQuestionDialogProps) {
  const { t, i18n } = useTranslation('assessment');
  const queryClient = useQueryClient();

  const [content, setContent] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioMeta, setAudioMeta] = useState<GeneratedAudioMeta | undefined>();
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [order, setOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const draftUploads = useDraftUploads([imageUrl], open);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => {
      document.getElementById('edit-question-error-alert')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const part = Number(question?.part) || 1;
  const section = question?.section || (part >= 5 ? 'READING' : 'LISTENING');

  useEffect(() => {
    if (question) {
      setContent(question.content || '');
      const optA = question.options?.find((o) => o.key === 'A')?.text || '';
      const optB = question.options?.find((o) => o.key === 'B')?.text || '';
      const optC = question.options?.find((o) => o.key === 'C')?.text || '';
      const optD = question.options?.find((o) => o.key === 'D')?.text || '';
      setOptionA(optA);
      setOptionB(optB);
      setOptionC(optC);
      setOptionD(optD);
      setCorrectAnswer(question.correctAnswer || 'A');
      setExplanation(question.explanation || '');
      setImageUrl(question.imageUrl || '');
      setAudioUrl(question.audioUrl || '');
      setAudioMeta(question.audioMeta);
      setOrder(Number(question.order) || 1);
      const activeState = question.isActive ?? true;
      setIsActive(activeState);
      setErrorMessage(null);
    }
  }, [question, open]);

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!question?._id) return;
      draftUploads.startSaving();
      try {
        const res = await examService.updateQuestion(question._id, payload);
        draftUploads.commit([payload.imageUrl]);
        return res;
      } finally {
        draftUploads.finishSaving();
      }
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
      if (res?.data?.learning?.status === 'failed') {
        showError(res.data.learning.message);
        return;
      }
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || t('detailPage.errorUpdateQuestion');
      showError(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const getPartColor = (partNum: number) => {
    switch (partNum) {
      case 1:
        return 'bg-amber-100 text-amber-800 font-bold';
      case 2:
        return 'bg-rose-100 text-rose-800 font-bold';
      case 3:
        return 'bg-blue-100 text-blue-800 font-bold';
      case 4:
        return 'bg-purple-100 text-purple-800 font-bold';
      case 5:
        return 'bg-emerald-100 text-emerald-800 font-bold';
      case 6:
        return 'bg-teal-100 text-teal-800 font-bold';
      case 7:
        return 'bg-indigo-100 text-indigo-800 font-bold';
      default:
        return 'bg-slate-100 text-slate-800 font-bold';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading || updateMutation.isPending) return;
    setErrorMessage(null);

    if (![1, 2].includes(part) && !content.trim() && !([6, 7].includes(part) && imageUrl.trim())) {
      showError(t('createQuestionPage.msgInputQuestionContent'));
      return;
    }

    if (![1, 2].includes(part)) {
      if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
        showError(t('createQuestionPage.msgOptionsRequired'));
        return;
      }
    }

    const optionsPayload = [
      { key: 'A', text: optionA.trim() },
      { key: 'B', text: optionB.trim() },
      { key: 'C', text: optionC.trim() },
    ];
    if (part !== 2) {
      optionsPayload.push({ key: 'D', text: optionD.trim() });
    }

    const payload: any = {
      order: Number(order) || 1,
      content: content.trim(),
      options: optionsPayload,
      correctAnswer,
      explanation: explanation.trim(),
      isActive,
    };

    // Only update media links if relevant to the Part
    if (part === 1) {
      if (!imageUrl.trim()) {
        setErrorMessage(t('createQuestionPage.msgPart1ImageRequired'));
        return;
      }
      payload.imageUrl = imageUrl.trim();
      payload.audioUrl = audioUrl.trim();
    } else if (part === 2) {
      payload.audioUrl = audioUrl.trim();
    } else if ([6, 7].includes(part)) {
      payload.imageUrl = imageUrl.trim();
    }

    updateMutation.mutate(payload);
  };

  const unwrapAudioResult = (value: any) => value?.data?.data ?? value?.data ?? value;

  const handleGenerateAudio = async () => {
    if (!question?._id || ![1, 2].includes(part)) return;
    setErrorMessage(null);
    setIsGeneratingAudio(true);
    try {
      const optionsForAudio = [
        { key: 'A', text: optionA.trim() },
        { key: 'B', text: optionB.trim() },
        { key: 'C', text: optionC.trim() },
        ...(part === 2 ? [] : [{ key: 'D', text: optionD.trim() }]),
      ];
      await examService.updateQuestion(question._id, {
        content: content.trim(),
        options: optionsForAudio,
        correctAnswer,
        explanation: explanation.trim(),
        order: Number(order) || 1,
        isActive,
        ...(part === 1 ? { imageUrl: imageUrl.trim() } : {}),
      });
      const response = await audioService.generateToeicQuestion(question._id);
      const updated = unwrapAudioResult(response);
      if (updated?.audioUrl) setAudioUrl(updated.audioUrl);
      if (updated?.audioMeta) setAudioMeta(updated.audioMeta);
      await queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể tạo audio bằng Kokoro.';
      showError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleUploadAudio = async (file?: File) => {
    if (!question?._id || !file) return;
    setErrorMessage(null);
    setIsUploadingAudio(true);
    try {
      const response = await audioService.uploadToeicQuestion(question._id, file);
      const updated = unwrapAudioResult(response);
      if (updated?.audioUrl) setAudioUrl(updated.audioUrl);
      if (updated?.audioMeta) setAudioMeta(updated.audioMeta);
      await queryClient.invalidateQueries({ queryKey: ['admin-exam-questions', examId] });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể tải audio lên.';
      showError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const audioStatus = audioMeta?.status || (audioUrl ? 'READY' : 'NONE');

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded border border-slate-200 bg-white p-0 shadow-lg">
        <DialogHeader className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[11px] ${getPartColor(part)}`}>
              Part {part}
            </span>
            <DialogTitle className="text-sm font-bold text-slate-900">
              {t('detailPage.editQuestionTitle', { order: question.order })}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            {t('detailPage.editQuestionDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {errorMessage && (
            <div
              id="edit-question-error-alert"
              tabIndex={-1}
              role="alert"
              className="p-3 bg-red-50 border-2 border-red-300 rounded text-xs text-red-700 font-medium"
            >
              {errorMessage}
            </div>
          )}

          {/* Top Bar: Part & Section Info, Order, Status Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-slate-50 border rounded border-slate-200 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-xs ${getPartColor(part)}`}>
                Part {part}
              </span>
              <span className="font-semibold text-slate-700">
                {section === 'READING' ? 'Reading' : 'Listening'}
              </span>
              {question.passageTitle && (
                <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-medium text-[11px]">
                  {question.passageTitle}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Order input */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">{t('detailPage.tableOrder')}:</span>
                <input
                  type="number"
                  min={1}
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                  className="w-14 h-7 px-2 rounded border border-slate-200 bg-white text-slate-900 font-bold text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <span className={`text-[11px] font-semibold ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {isActive ? t('status.active') : t('status.inactive')}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Question Content */}
          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-700">
              {part === 1 || part === 2 ? (i18n.language.startsWith('vi') ? 'Script câu hỏi và lựa chọn' : 'Listening question and answer script') : t('createQuestionPage.questionContentLabel')} <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={part === 5 ? 4 : 3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                part === 1
                  ? t('createQuestionPage.part1Placeholder')
                  : part === 2
                  ? t('createQuestionPage.part2Placeholder')
                  : t('createQuestionPage.part5Placeholder')
              }
              className="w-full p-2.5 rounded border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none bg-white"
            />
          </div>

          {/* Options A, B, C, D */}
          <div className="space-y-1.5 text-xs">
            <label className="font-semibold text-slate-700">
              {t('createQuestionPage.optionsTitle')} {part === 2 && t('createQuestionPage.part2OptionsNotice')}
            </label>
            <div className={`grid grid-cols-1 ${part === 2 ? '' : 'sm:grid-cols-2'} gap-2`}>
              {/* Option A */}
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                  A
                </span>
                <input
                  type="text"
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                  placeholder={t('createQuestionPage.inputOptionPlaceholder', { key: 'A' })}
                  className="flex-1 h-8 px-2.5 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Option B */}
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                  B
                </span>
                <input
                  type="text"
                  value={optionB}
                  onChange={(e) => setOptionB(e.target.value)}
                  placeholder={t('createQuestionPage.inputOptionPlaceholder', { key: 'B' })}
                  className="flex-1 h-8 px-2.5 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Option C */}
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                  C
                </span>
                <input
                  type="text"
                  value={optionC}
                  onChange={(e) => setOptionC(e.target.value)}
                  placeholder={t('createQuestionPage.inputOptionPlaceholder', { key: 'C' })}
                  className="flex-1 h-8 px-2.5 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Option D (Omitted for Part 2) */}
              {part !== 2 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                    D
                  </span>
                  <input
                    type="text"
                    value={optionD}
                    onChange={(e) => setOptionD(e.target.value)}
                    placeholder={t('createQuestionPage.inputOptionPlaceholder', { key: 'D' })}
                    className="flex-1 h-8 px-2.5 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Correct Answer Selection */}
          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-700">
              {t('createQuestionPage.correctAnswerLabel')} <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              {(part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCorrectAnswer(key as any)}
                  className={`w-8 h-8 rounded border text-xs font-bold transition-all cursor-pointer ${
                    correctAnswer === key
                      ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-700">
              {t('createQuestionPage.explanationLabel')}
            </label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder={t('createQuestionPage.explanationPlaceholder')}
              className="w-full p-2.5 rounded border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none bg-white"
            />
          </div>

          {/* Media Links (Image / Audio) - STRICTLY CONDITIONAL: Part 5 NEVER renders this! */}
          {part !== 5 && (part === 1 || part === 2 || part === 6 || part === 7) && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-700">
                {t('createQuestionPage.questionResourcesCardTitle')}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Image URL only for Part 1 or Part 7 */}
                {(part === 1 || part === 6 || part === 7) && (
                  <ImageUploadField value={imageUrl} onChange={setImageUrl}
                    onUploaded={draftUploads.track} onBusyChange={setIsUploading}
                    onError={setErrorMessage} disabled={updateMutation.isPending || isUploading} />
                )}

                {/* Audio for Listening parts (Part 1, 2) */}
                {(part === 1 || part === 2) && (
                  <div className="space-y-2 rounded border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                          <Volume2 className="h-3.5 w-3.5 text-blue-600" />
                          Audio Listening
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Part {part === 1 ? '1 đọc A–D bằng 1 giọng' : '2 dùng giọng hỏi + giọng đáp'}.
                        </p>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        audioStatus === 'READY' ? 'bg-emerald-100 text-emerald-700' :
                        audioStatus === 'STALE' ? 'bg-amber-100 text-amber-700' :
                        audioStatus === 'FAILED' ? 'bg-red-100 text-red-700' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {audioStatus}
                      </span>
                    </div>

                    {audioMeta?.status === 'STALE' && (
                      <div className="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5" /> Nội dung đã đổi, nên generate lại audio.
                      </div>
                    )}

                    {audioUrl && <audio controls src={audioUrl} className="w-full h-8" />}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateAudio}
                        disabled={isGeneratingAudio || updateMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isGeneratingAudio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : audioStatus === 'READY' ? <RefreshCw className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                        {audioStatus === 'READY' || audioStatus === 'STALE' ? 'Regenerate Kokoro' : 'Generate Kokoro'}
                      </button>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                        {isUploadingAudio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Upload audio
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          disabled={isUploadingAudio || updateMutation.isPending}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            void handleUploadAudio(file);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>

                    <details className="text-[11px] text-slate-500">
                      <summary className="cursor-pointer font-medium">URL thủ công / tương thích dữ liệu cũ</summary>
                      <input
                        type="text"
                        value={audioUrl}
                        onChange={(e) => setAudioUrl(e.target.value)}
                        placeholder="/media/... hoặc https://..."
                        className="mt-1.5 h-8 w-full rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </details>
                    {audioMeta?.source && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        {audioStatus === 'READY' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                        Source: {audioMeta.source}{audioMeta.voiceIds?.length ? ` · ${audioMeta.voiceIds.join(', ')}` : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending || isUploading}
              className="px-3.5 py-1.5 rounded border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {t('editDialog.cancel')}
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending || isUploading}
              className="px-4 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{t('detailPage.savingQuestion')}</span>
                </>
              ) : (
                <span>{t('detailPage.saveQuestionBtn')}</span>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
