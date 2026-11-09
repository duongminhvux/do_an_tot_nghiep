'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AudioLines, Link2, Loader2, Upload, Volume2 } from 'lucide-react';
import { VisibilityBar } from '@/components/publication/publication-controls';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { wordService } from '@/services/vocabulary.service';
import { audioService } from '@/services/audio.service';
import type { WordDetail } from '@/types/vocabulary';
import { AUDIO_URL_PATTERN, WordFormFields, emptyWordForm, sameWordForm, wordFormFromDetail, wordFormToPayload, type WordFormState } from './word-form';

interface Props {
  wordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_TONE: Record<string, string> = {
  READY: 'bg-emerald-100 text-emerald-700',
  STALE: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-rose-100 text-rose-700',
};

export function EditWordDialog({ wordId, open, onOpenChange }: Props) {
  const { t: publicationT } = useTranslation('common');
  const queryClient = useQueryClient();
  const [form, setForm] = useState<WordFormState>(emptyWordForm);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [audioBusy, setAudioBusy] = useState<'us' | 'uk' | null>(null);
  const [linkAccent, setLinkAccent] = useState<'us' | 'uk' | null>(null);
  const [linkValue, setLinkValue] = useState('');
  const usInput = useRef<HTMLInputElement>(null);
  const ukInput = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ['word-detail', wordId],
    queryFn: () => wordService.getById(wordId!),
    enabled: open && !!wordId,
  });
  const detail: WordDetail | undefined = useMemo(() => {
    const response: any = query.data;
    return response?.data || response;
  }, [query.data]);
  const saved = useMemo(() => wordFormFromDetail(detail), [detail]);

  useEffect(() => {
    if (!detail) return;
    setForm(saved);
    setError('');
    // Reset only when a different word / a newer saved version arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?._id, detail?.updatedAt]);

  const dirty = Boolean(detail) && !sameWordForm(form, saved);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!wordId) throw new Error('Missing word id.');
      for (const accent of ['us', 'uk'] as const) {
        const ipa = (accent === 'us' ? form.usIpa : form.ukIpa).trim();
        if (!ipa && detail?.audio?.[accent])
          throw new Error(`Giọng ${accent.toUpperCase()} đang có phát âm nên không thể để trống phiên âm ${accent.toUpperCase()}.`);
      }
      return wordService.update(wordId, wordFormToPayload(form));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
      queryClient.invalidateQueries({ queryKey: ['word-detail', wordId] });
      onOpenChange(false);
    },
    onError: (err: any) => setError(err?.response?.data?.message || err?.message || 'Không thể cập nhật từ vựng.'),
  });

  const refreshWord = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['words'] }),
      queryClient.invalidateQueries({ queryKey: ['word-detail', wordId] }),
    ]);

  const runAudio = async (accent: 'us' | 'uk', task: () => Promise<unknown>, failure: string) => {
    try {
      setAudioBusy(accent);
      setError('');
      await task();
      await refreshWord();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || failure);
    } finally {
      setAudioBusy(null);
    }
  };

  const audioRow = (accent: 'us' | 'uk') => {
    const url = detail?.audio?.[accent];
    const meta = detail?.audioMeta?.[accent];
    const status = meta?.status || (url ? 'READY' : 'NONE');
    // Audio is only allowed once the accent has a saved IPA transcription.
    const savedIpa = detail?.ipa?.[accent]?.trim() || '';
    const typedIpa = (accent === 'us' ? form.usIpa : form.ukIpa).trim();
    const noIpa = !savedIpa;
    return (
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="w-6 text-xs font-bold text-slate-900">{accent.toUpperCase()}</span>
        <span className={`rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
          {status === 'STALE' ? 'Nội dung đã đổi, nên tạo lại' : status === 'FAILED' && meta?.error ? meta.error : meta?.source === 'UPLOAD' ? 'File tải lên' : 'Kokoro TTS'}
        </span>
        {url && (
          <button type="button" onClick={() => void new Audio(url).play()} aria-label={`Nghe ${accent.toUpperCase()}`} className="rounded-[4px] border border-slate-200 p-1.5 text-blue-600 hover:bg-blue-50">
            <Volume2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          disabled={!!audioBusy || !wordId || noIpa}
          onClick={() => void runAudio(accent, () => audioService.generateVocabulary(wordId!, accent), 'Tạo audio thất bại.')}
          className="inline-flex items-center gap-1 rounded-[4px] bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {audioBusy === accent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AudioLines className="h-3.5 w-3.5" />} {url ? 'Tạo lại' : 'Tạo'}
        </button>
        <button
          type="button"
          disabled={!!audioBusy || noIpa}
          onClick={() => {
            setLinkAccent(linkAccent === accent ? null : accent);
            setLinkValue(url || '');
          }}
          className="inline-flex items-center gap-1 rounded-[4px] border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <Link2 className="h-3.5 w-3.5" /> Dán link
        </button>
        <button type="button" disabled={!!audioBusy || noIpa} onClick={() => (accent === 'us' ? usInput : ukInput).current?.click()} className="inline-flex items-center gap-1 rounded-[4px] border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <Upload className="h-3.5 w-3.5" /> Tải file
        </button>
        <input
          ref={accent === 'us' ? usInput : ukInput}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = '';
            if (file && wordId) void runAudio(accent, () => audioService.uploadVocabulary(wordId, accent, file), 'Upload audio thất bại.');
          }}
        />
        {noIpa && (
          <p className="w-full pl-8 text-[11px] font-medium text-amber-700">
            {typedIpa
              ? `Lưu thay đổi để ghi phiên âm ${accent.toUpperCase()} trước khi thêm phát âm.`
              : `Chưa có phiên âm ${accent.toUpperCase()}. Nhập phiên âm ở trên rồi lưu để thêm phát âm.`}
          </p>
        )}
        {linkAccent === accent && !noIpa && (
          <div className="flex w-full items-center gap-2 pl-8">
            <input
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value.trim())}
              placeholder="https://.../audio.mp3"
              aria-label={`Link audio ${accent.toUpperCase()}`}
              className="w-full rounded-[4px] border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
            />
            <button
              type="button"
              disabled={!AUDIO_URL_PATTERN.test(linkValue) || !!audioBusy || !wordId}
              onClick={() =>
                void runAudio(
                  accent,
                  async () => {
                    await wordService.update(wordId!, { audio: { ...(detail?.audio || {}), [accent]: linkValue } });
                    setLinkAccent(null);
                  },
                  'Lưu link audio thất bại.',
                )
              }
              className="shrink-0 rounded-[4px] bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Lưu link
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-[6px] border border-slate-200 bg-white p-0">
        <div className="shrink-0 border-b border-slate-200 px-5 py-3 pr-12">
          <DialogTitle className="text-base font-bold text-slate-900">
            Chỉnh sửa từ vựng{detail?.word ? `: ${detail.word}` : ''}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs text-slate-500">Sửa nội dung, ảnh và phát âm trong một màn hình.</DialogDescription>
        </div>

        {query.isLoading ? (
          <div className="flex h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
        ) : (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              updateMutation.mutate();
            }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
              {wordId && <VisibilityBar kind="words" id={wordId} version={detail?.updatedAt} blockedReason={dirty || audioBusy !== null || updateMutation.isPending ? publicationT('publication.unsaved') : undefined} />}
              {error && <div role="alert" className="rounded-[4px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
              <WordFormFields
                value={form}
                onChange={setForm}
                onUploadingChange={setUploading}
                extra={
                  <section className="rounded-[6px] border border-slate-200">
                    <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-900">
                      <Volume2 className="h-3.5 w-3.5 text-blue-600" /> Phát âm
                    </div>
                    <div className="divide-y divide-slate-100">{audioRow('us')}{audioRow('uk')}</div>
                  </section>
                }
              />
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
              {dirty && <span className="mr-auto text-xs font-medium text-amber-700">Có thay đổi chưa lưu</span>}
              <button type="button" onClick={() => onOpenChange(false)} className="rounded-[4px] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Hủy</button>
              <button type="submit" disabled={updateMutation.isPending || uploading || !dirty} className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-[4px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {(updateMutation.isPending || uploading) && <Loader2 className="h-4 w-4 animate-spin" />} {uploading ? 'Đang tải ảnh...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
