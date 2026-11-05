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

  const hasMedia = part === 1 || part === 2 || part === 6 || part === 7;
  const hasAudio = part === 1 || part === 2;
  const hasImage = part === 1 || part === 6 || part === 7;
  const optionKeys = (part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']) as Array<'A' | 'B' | 'C' | 'D'>;
  const optionState: Record<'A' | 'B' | 'C' | 'D', [string, (v: string) => void, string]> = {
    A: [optionA, setOptionA, 'bg-blue-100 text-blue-700'],
    B: [optionB, setOptionB, 'bg-emerald-100 text-emerald-700'],
    C: [optionC, setOptionC, 'bg-amber-100 text-amber-700'],
    D: [optionD, setOptionD, 'bg-rose-100 text-rose-700'],
  };
  const busy = updateMutation.isPending || isUploading;
  const labelCls = 'text-sm font-semibold text-slate-700';
  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-xl ${hasMedia ? 'max-w-6xl' : 'max-w-2xl'}`}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-slate-50 px-6 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${getPartColor(part)}`}>
              Part {part}
            </span>
            <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {section === 'READING' ? 'Reading' : 'Listening'}
            </span>
            {question.passageTitle && (
              <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {question.passageTitle}
              </span>
            )}
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {t('detailPage.editQuestionTitle', { order: question.order })}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {t('detailPage.editQuestionDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {errorMessage && (
              <div
                id="edit-question-error-alert"
                tabIndex={-1}
                role="alert"
                className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-700"
              >
                {errorMessage}
              </div>
            )}

            <div className={`grid gap-6 ${hasMedia ? 'lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]' : ''}`}>
              {/* Left: question content */}
              <div className="min-w-0 space-y-5">
                {/* Order & status */}
                <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-600">{t('detailPage.tableOrder')}</span>
                    <input
                      type="number"
                      min={1}
                      value={order}
                      onChange={(e) => setOrder(Number(e.target.value))}
                      className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </label>
                  <label className="ml-auto flex cursor-pointer items-center gap-2.5">
                    <span className={`text-sm font-semibold ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {isActive ? t('status.active') : t('status.inactive')}
                    </span>
                    <span className="relative inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span className="h-5 w-9 rounded-full bg-slate-200 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-4 peer-checked:after:border-white peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40" />
                    </span>
                  </label>
                </div>

                {/* Question content / script */}
                <div className="space-y-1.5">
                  <label htmlFor="edit-question-content" className={labelCls}>
                    {part === 1 || part === 2
                      ? i18n.language.startsWith('vi')
                        ? 'Script câu hỏi và lựa chọn'
                        : 'Listening question and answer script'
                      : t('createQuestionPage.questionContentLabel')}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="edit-question-content"
                    rows={part === 1 || part === 2 ? 6 : 5}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={
                      part === 1
                        ? t('createQuestionPage.part1Placeholder')
                        : part === 2
                          ? t('createQuestionPage.part2Placeholder')
                          : t('createQuestionPage.part5Placeholder')
                    }
                    className={`${inputCls} min-h-28 resize-y p-3 leading-relaxed`}
                  />
                </div>

                {/* Options */}
                <fieldset className="space-y-2">
                  <legend className={`${labelCls} mb-1.5`}>
                    {t('createQuestionPage.optionsTitle')}{' '}
                    {part === 2 && (
                      <span className="font-normal text-slate-500">{t('createQuestionPage.part2OptionsNotice')}</span>
                    )}
                  </legend>
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                    {optionKeys.map((key) => {
                      const [value, setValue, tone] = optionState[key];
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tone}`}>
                            {key}
                          </span>
                          <input
                            type="text"
                            aria-label={`${t('createQuestionPage.optionsTitle')} ${key}`}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={t('createQuestionPage.inputOptionPlaceholder', { key })}
                            className={`${inputCls} h-10 px-3 ${correctAnswer === key ? 'border-blue-400 bg-blue-50/40' : ''}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Correct answer */}
                <div className="space-y-1.5">
                  <span className={labelCls}>
                    {t('createQuestionPage.correctAnswerLabel')} <span className="text-red-500">*</span>
                  </span>
                  <div className="flex items-center gap-2" role="radiogroup">
                    {optionKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={correctAnswer === key}
                        onClick={() => setCorrectAnswer(key as any)}
                        className={`size-10 cursor-pointer rounded-lg border text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                          correctAnswer === key
                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Explanation */}
                <div className="space-y-1.5">
                  <label htmlFor="edit-question-explanation" className={labelCls}>
                    {t('createQuestionPage.explanationLabel')}
                  </label>
                  <textarea
                    id="edit-question-explanation"
                    rows={4}
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder={t('createQuestionPage.explanationPlaceholder')}
                    className={`${inputCls} resize-y p-3 leading-relaxed`}
                  />
                </div>
              </div>

              {/* Right: media (Part 5 never renders this) */}
              {hasMedia && (
                <aside className="min-w-0 space-y-4 lg:border-l lg:border-slate-100 lg:pl-6">
                  <h3 className={labelCls}>{t('createQuestionPage.questionResourcesCardTitle')}</h3>

                  {hasAudio && (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                            <Volume2 className="h-4 w-4 text-blue-600" />
                            Audio Listening
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Part {part === 1 ? '1 đọc A–D bằng 1 giọng' : '2 dùng giọng hỏi + giọng đáp'}.
                          </p>
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                            audioStatus === 'READY'
                              ? 'bg-emerald-100 text-emerald-700'
                              : audioStatus === 'STALE'
                                ? 'bg-amber-100 text-amber-700'
                                : audioStatus === 'FAILED'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {audioStatus}
                        </span>
                      </div>

                      {audioMeta?.status === 'STALE' && (
                        <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Nội dung đã đổi, nên generate lại audio.
                        </div>
                      )}

                      {audioUrl && <audio controls src={audioUrl} className="h-10 w-full" />}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateAudio}
                          disabled={isGeneratingAudio || updateMutation.isPending}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isGeneratingAudio ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : audioStatus === 'READY' ? (
                            <RefreshCw className="h-3.5 w-3.5" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" />
                          )}
                          {audioStatus === 'READY' || audioStatus === 'STALE' ? 'Regenerate Kokoro' : 'Generate Kokoro'}
                        </button>
                        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500/40">
                          {isUploadingAudio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Upload audio
                          <input
                            type="file"
                            accept="audio/*"
                            className="sr-only"
                            disabled={isUploadingAudio || updateMutation.isPending}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              void handleUploadAudio(file);
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>
                      </div>

                      <details className="text-xs text-slate-500">
                        <summary className="cursor-pointer font-medium">URL thủ công / tương thích dữ liệu cũ</summary>
                        <input
                          type="text"
                          value={audioUrl}
                          onChange={(e) => setAudioUrl(e.target.value)}
                          placeholder="/media/... hoặc https://..."
                          className={`${inputCls} mt-2 h-9 px-3`}
                        />
                      </details>
                      {audioMeta?.source && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          {audioStatus === 'READY' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                          Source: {audioMeta.source}
                          {audioMeta.voiceIds?.length ? ` · ${audioMeta.voiceIds.join(', ')}` : ''}
                        </div>
                      )}
                    </div>
                  )}

                  {hasImage && (
                    <ImageUploadField
                      value={imageUrl}
                      onChange={setImageUrl}
                      onUploaded={draftUploads.track}
                      onBusyChange={setIsUploading}
                      onError={setErrorMessage}
                      disabled={busy}
                    />
                  )}
                </aside>
              )}
            </div>
          </div>

          {/* Footer stays visible while the body scrolls */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="h-10 cursor-pointer rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {t('editDialog.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
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
