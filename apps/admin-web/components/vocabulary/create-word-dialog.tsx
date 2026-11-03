'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, FileClock, Loader2, Save, Volume2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { wordService } from '@/services/vocabulary.service';
import { audioService } from '@/services/audio.service';
import {
  AUDIO_URL_PATTERN,
  AudioSourceField,
  type AudioChoice,
  WordBasicFields,
  WordImageField,
  WordMeaningsFields,
  WordRelationFields,
  emptyWordForm,
  sameWordForm,
  wordFormToPayload,
  type WordFormState,
} from './word-form';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (createdWord: any) => void;
}

const STEPS = [
  { title: 'Từ & phát âm', hint: 'Từ, cấp độ, phiên âm' },
  { title: 'Nghĩa', hint: 'Nghĩa, ví dụ' },
  { title: 'Ảnh & bổ sung', hint: 'Ảnh, audio, từ liên quan' },
  { title: 'Xem lại', hint: 'Kiểm tra và tạo' },
] as const;
const LAST = STEPS.length - 1;

/** The unfinished word is kept in this browser so the admin can come back to it later. */
const DRAFT_KEY = 'admin:create-word-draft:v1';
type AudioChoices = { us: AudioChoice; uk: AudioChoice };
type Draft = { form: WordFormState; step: number; audio: AudioChoices; savedAt: string };
const defaultAudio = (): AudioChoices => ({ us: { mode: 'tts', url: '' }, uk: { mode: 'none', url: '' } });

function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    const draft = raw ? (JSON.parse(raw) as Draft) : null;
    return draft?.form?.meanings ? draft : null;
  } catch {
    return null;
  }
}
function writeDraft(draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage unavailable (private mode, quota): drafts are a convenience only.
  }
}

/** Returns the first problem that blocks leaving `step`, or '' when the step is complete. */
function stepError(step: number, form: WordFormState) {
  if (step === 0 && !form.word.trim()) return 'Vui lòng nhập từ vựng.';
  if (step === 1 && !form.meanings.some((m) => m.translation.trim() || m.definition.trim()))
    return 'Vui lòng nhập ít nhất một nghĩa (tiếng Việt hoặc định nghĩa tiếng Anh).';
  return '';
}

/** Problems with the pronunciation choices on the media step. */
function audioError(audio: AudioChoices, files: { us: File | null; uk: File | null }, form: WordFormState) {
  for (const accent of ['us', 'uk'] as const) {
    const choice = audio[accent];
    const ipa = accent === 'us' ? form.usIpa : form.ukIpa;
    if (choice.mode !== 'none' && !ipa.trim())
      return `Giọng ${accent.toUpperCase()} chưa có phiên âm. Nhập phiên âm ở bước 1 hoặc chọn “Không” cho phát âm ${accent.toUpperCase()}.`;
    if (choice.mode === 'file' && !files[accent]) return `Chọn file audio cho giọng ${accent.toUpperCase()} hoặc đổi cách tạo phát âm.`;
    if (choice.mode === 'link' && !AUDIO_URL_PATTERN.test(choice.url)) return `Link audio ${accent.toUpperCase()} phải bắt đầu bằng http(s):// hoặc /.`;
  }
  return '';
}

const AUDIO_LABEL: Record<AudioChoice['mode'], string> = { tts: 'Tự sinh (TTS)', file: 'File tải lên', link: 'Link', none: 'Không' };

const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

export function CreateWordDialog({ open, onOpenChange, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<WordFormState>(emptyWordForm);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [audio, setAudio] = useState<AudioChoices>(defaultAudio);
  const [audioFiles, setAudioFiles] = useState<{ us: File | null; uk: File | null }>({ us: null, uk: null });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const created = useRef(false);
  const blank = useRef(emptyWordForm());

  // On open: offer to resume a saved draft; on close: reset the wizard.
  useEffect(() => {
    if (open) {
      created.current = false;
      setPendingDraft(readDraft());
      return;
    }
    setForm(emptyWordForm());
    setStep(0);
    setReached(0);
    setAudio(defaultAudio());
    setAudioFiles({ us: null, uk: null });
    setError('');
    setDraftSavedAt('');
    setPendingDraft(null);
  }, [open]);

  // Autosave while typing (skipped until the resume question is answered).
  useEffect(() => {
    if (!open || pendingDraft || created.current) return;
    if (sameWordForm(form, blank.current)) return;
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      writeDraft({ form, step, audio, savedAt });
      setDraftSavedAt(savedAt);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [open, pendingDraft, form, step, audio]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = wordFormToPayload(form);
      const links = Object.fromEntries(
        (['us', 'uk'] as const).filter((a) => audio[a].mode === 'link').map((a) => [a, audio[a].url]),
      );
      const response: any = await wordService.create({
        ...payload,
        image: payload.image || undefined,
        ...(Object.keys(links).length ? { audio: links } : {}),
      });
      const word = response?.data || response;
      if (word?._id) {
        // TTS jobs and uploads need the new word id, so they run after creation.
        const tasks: Promise<unknown>[] = [];
        for (const accent of ['us', 'uk'] as const) {
          if (audio[accent].mode === 'tts') tasks.push(audioService.generateVocabulary(word._id, accent));
          const file = audioFiles[accent];
          if (audio[accent].mode === 'file' && file) tasks.push(audioService.uploadVocabulary(word._id, accent, file));
        }
        if (tasks.length) {
          const failed = (await Promise.allSettled(tasks)).filter((result) => result.status === 'rejected');
          if (failed.length) console.warn('Word created, but some audio tasks failed', failed);
        }
      }
      return word;
    },
    onSuccess: (word) => {
      created.current = true;
      writeDraft(null);
      queryClient.invalidateQueries({ queryKey: ['words'] });
      onOpenChange(false);
      onSuccess?.(word);
    },
    onError: (err: any) => setError(err?.response?.data?.message || err?.message || 'Không thể tạo từ vựng.'),
  });

  const goTo = (target: number) => {
    // Moving forward requires every step in between to be complete.
    for (let index = step; index < target; index++) {
      const problem = stepError(index, form) || (index === 2 ? audioError(audio, audioFiles, form) : '');
      if (problem) {
        setStep(index);
        setError(problem);
        return;
      }
    }
    setError('');
    setStep(target);
    setReached((value) => Math.max(value, target));
  };

  const saveDraftAndClose = () => {
    const savedAt = new Date().toISOString();
    writeDraft({ form, step, audio, savedAt });
    onOpenChange(false);
  };

  const resume = (draft: Draft) => {
    setForm(draft.form);
    setStep(Math.min(draft.step, LAST));
    setReached(Math.min(draft.step, LAST));
    // Picked files can't be stored in a draft; those accents need choosing again.
    setAudio(draft.audio ?? defaultAudio());
    setDraftSavedAt(draft.savedAt);
    setPendingDraft(null);
  };

  const filledMeanings = form.meanings.filter((m) => m.translation.trim() || m.definition.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-[6px] border border-slate-200 bg-white p-0">
        <div className="shrink-0 border-b border-slate-200 px-5 py-3 pr-12">
          <DialogTitle className="text-base font-bold text-slate-900">Tạo từ vựng</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs text-slate-500">
            Điền lần lượt từng bước. Bản nháp được tự lưu để bạn có thể quay lại hoàn thành sau.
          </DialogDescription>
        </div>

        {pendingDraft ? (
          <div className="space-y-4 px-5 py-6">
            <div className="flex items-start gap-3 rounded-[6px] border border-amber-200 bg-amber-50 p-4">
              <FileClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Bạn có bản nháp chưa hoàn thành{pendingDraft.form.word ? `: “${pendingDraft.form.word}”` : ''}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Lưu lúc {timeLabel(pendingDraft.savedAt)} · đang ở bước {Math.min(pendingDraft.step, LAST) + 1}/{STEPS.length} ({STEPS[Math.min(pendingDraft.step, LAST)]?.title})
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  writeDraft(null);
                  setPendingDraft(null);
                }}
                className="rounded-[4px] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Bỏ nháp, tạo mới
              </button>
              <button type="button" onClick={() => resume(pendingDraft)} className="inline-flex items-center gap-1.5 rounded-[4px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Tiếp tục bản nháp <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (step < LAST) goTo(step + 1);
              else if (!mutation.isPending && !uploading) {
                const problem = audioError(audio, audioFiles, form);
                if (problem) {
                  setStep(2);
                  setError(problem);
                  return;
                }
                setError('');
                mutation.mutate();
              }
            }}
          >
            {/* Stepper */}
            <ol className="grid shrink-0 grid-cols-4 border-b border-slate-200 bg-slate-50/70">
              {STEPS.map((item, index) => {
                const done = index < step || (index <= reached && index !== step && !stepError(index, form));
                const current = index === step;
                const reachable = index <= reached || index === step + 1;
                return (
                  <li key={item.title} className="min-w-0 border-l border-slate-200 first:border-l-0">
                    <button
                      type="button"
                      disabled={!reachable}
                      onClick={() => goTo(index)}
                      aria-current={current ? 'step' : undefined}
                      className={`flex w-full min-w-0 items-center gap-2 px-2 py-2 text-left sm:px-3 ${current ? 'bg-white shadow-[inset_0_-2px_0_#2563eb]' : 'hover:bg-white/70'} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] text-[11px] font-bold ${
                          current ? 'bg-blue-600 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {done && !current ? <Check className="h-3 w-3" /> : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-xs font-semibold ${current ? 'text-blue-700' : 'text-slate-700'}`}>{item.title}</span>
                        <span className="hidden truncate text-[11px] text-slate-400 sm:block">{item.hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
              {error && <div role="alert" className="rounded-[4px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

              {step === 0 && <WordBasicFields value={form} onChange={setForm} autoFocus />}

              {step === 1 && <WordMeaningsFields value={form} onChange={setForm} />}

              {step === 2 && (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-[240px_minmax(0,1fr)]">
                  <WordImageField value={form.image} onChange={(image) => setForm({ ...form, image })} onUploadingChange={setUploading} />
                  <div className="space-y-4">
                    <section className="rounded-[6px] border border-slate-200">
                      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-900">
                        <Volume2 className="h-3.5 w-3.5 text-blue-600" /> Phát âm
                      </div>
                      <div className="divide-y divide-slate-100">
                        {(['us', 'uk'] as const).map((accent) => (
                          <AudioSourceField
                            key={accent}
                            accent={accent}
                            value={audio[accent]}
                            onChange={(choice) => setAudio((current) => ({ ...current, [accent]: choice }))}
                            file={audioFiles[accent]}
                            onFile={(file) => setAudioFiles((current) => ({ ...current, [accent]: file }))}
                            ipa={accent === 'us' ? form.usIpa : form.ukIpa}
                            onEditIpa={() => {
                              setError('');
                              setStep(0);
                            }}
                          />
                        ))}
                      </div>
                    </section>
                    <WordRelationFields value={form} onChange={setForm} collapsible={false} />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[4px] border border-slate-200 bg-slate-50 text-[11px] text-slate-400">
                    {form.image ? <img src={form.image} alt="" className="h-full w-full object-contain" /> : 'Không có ảnh'}
                  </div>
                  <dl className="divide-y divide-slate-100 rounded-[6px] border border-slate-200 text-sm">
                    {[
                      ['Từ', <span key="w" className="font-semibold text-slate-900">{form.word}</span>, 0],
                      ['Cấp độ / trạng thái', `${form.level} · ${form.isActive ? 'Kích hoạt' : 'Ẩn'}`, 0],
                      ['Phiên âm', [form.usIpa && `US ${form.usIpa}`, form.ukIpa && `UK ${form.ukIpa}`].filter(Boolean).join(' · ') || '—', 0],
                      [
                        `Nghĩa (${filledMeanings.length})`,
                        <ul key="m" className="space-y-0.5">
                          {filledMeanings.map((m) => (
                            <li key={m.id} className="truncate">
                              <span className="mr-1 rounded-[3px] bg-blue-50 px-1 text-[10px] font-bold uppercase text-blue-600">{m.partOfSpeech.replace('_', ' ')}</span>
                              {m.translation || m.definition}
                            </li>
                          ))}
                        </ul>,
                        1,
                      ],
                      ['Phát âm', `US: ${AUDIO_LABEL[audio.us.mode]} · UK: ${AUDIO_LABEL[audio.uk.mode]}`, 2],
                      ['Biến thể / liên quan', [form.variations, form.relatedWords].filter(Boolean).join(' · ') || '—', 2],
                    ].map(([title, content, target]) => (
                      <div key={String(title)} className="grid grid-cols-[130px_minmax(0,1fr)_auto] items-start gap-2 px-3 py-2">
                        <dt className="text-xs font-semibold text-slate-500">{title}</dt>
                        <dd className="min-w-0 text-[13px] text-slate-700">{content}</dd>
                        <button type="button" onClick={() => setStep(Number(target))} className="text-xs font-medium text-blue-600 hover:underline">Sửa</button>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-5 py-3">
              <span className="mr-auto text-[11px] text-slate-400">
                {draftSavedAt ? `Đã lưu nháp lúc ${timeLabel(draftSavedAt)}` : `Bước ${step + 1}/${STEPS.length}`}
              </span>
              <button
                type="button"
                onClick={saveDraftAndClose}
                disabled={mutation.isPending || sameWordForm(form, blank.current)}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Lưu nháp & đóng
              </button>
              {step > 0 && (
                <button type="button" onClick={() => { setError(''); setStep(step - 1); }} className="inline-flex items-center gap-1.5 rounded-[4px] border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <ArrowLeft className="h-4 w-4" /> Quay lại
                </button>
              )}
              <button
                type="submit"
                disabled={mutation.isPending || uploading}
                className="inline-flex min-w-[110px] items-center justify-center gap-1.5 rounded-[4px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {(mutation.isPending || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploading ? 'Đang tải ảnh...' : step < LAST ? <>Tiếp <ArrowRight className="h-4 w-4" /></> : 'Tạo từ'}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
