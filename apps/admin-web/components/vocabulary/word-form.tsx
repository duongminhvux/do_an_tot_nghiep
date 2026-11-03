'use client';

/**
 * Shared fields for the create / edit word dialogs: one state object, one layout,
 * and an image uploader, so both dialogs behave the same way.
 */
import React, { useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Image as ImageIcon, Link2, Loader2, Plus, Trash2, Upload, UploadCloud, Volume2, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { uploadService } from '@/services/upload.service';
import type { CreateWordDto, WordDetail, WordPartDetail } from '@/types/vocabulary';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const POS = ['noun', 'verb', 'adjective', 'adverb', 'phrasal_verb', 'idiom', 'preposition', 'conjunction', 'pronoun', 'interjection', 'phrase', 'other'];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type MeaningDraft = {
  id: string;
  partOfSpeech: string;
  definition: string;
  translation: string;
  synonyms: string;
  antonyms: string;
  exampleEn: string;
  exampleVi: string;
};

export type WordFormState = {
  word: string;
  level: string;
  usIpa: string;
  ukIpa: string;
  variations: string;
  relatedWords: string;
  image: string;
  isActive: boolean;
  meanings: MeaningDraft[];
};

const splitList = (value: string) => value.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);

export const newMeaning = (partOfSpeech = 'noun'): MeaningDraft => ({
  id: crypto.randomUUID(),
  partOfSpeech,
  definition: '',
  translation: '',
  synonyms: '',
  antonyms: '',
  exampleEn: '',
  exampleVi: '',
});

export const emptyWordForm = (): WordFormState => ({
  word: '',
  level: 'A1',
  usIpa: '',
  ukIpa: '',
  variations: '',
  relatedWords: '',
  image: '',
  isActive: true,
  meanings: [newMeaning()],
});

export function wordFormFromDetail(detail?: WordDetail): WordFormState {
  const meanings: MeaningDraft[] = [];
  for (const part of detail?.parts || []) {
    for (const meaning of part.meanings || []) {
      meanings.push({
        id: crypto.randomUUID(),
        partOfSpeech: (part.partOfSpeech || 'noun').toLowerCase(),
        definition: meaning.definition || '',
        translation: (meaning.translation || []).join(', '),
        synonyms: (meaning.synonyms || []).join(', '),
        antonyms: (meaning.antonyms || []).join(', '),
        exampleEn: meaning.examples?.[0]?.en || '',
        exampleVi: meaning.examples?.[0]?.vi || '',
      });
    }
  }
  return {
    word: detail?.word || '',
    level: detail?.level || 'A1',
    usIpa: detail?.ipa?.us || '',
    ukIpa: detail?.ipa?.uk || '',
    variations: (detail?.variations || []).join(', '),
    relatedWords: (detail?.relatedWords || []).join(', '),
    image: detail?.image || '',
    isActive: detail?.isActive !== false,
    meanings: meanings.length ? meanings : [newMeaning()],
  };
}

/** Compares two forms ignoring the client-only meaning ids. */
export function sameWordForm(a: WordFormState, b: WordFormState) {
  const strip = (form: WordFormState) => ({ ...form, meanings: form.meanings.map(({ id: _id, ...rest }) => rest) });
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

/** Validates the form and builds the API payload; throws a user-facing message. */
export function wordFormToPayload(form: WordFormState): CreateWordDto {
  if (!form.word.trim()) throw new Error('Vui lòng nhập từ vựng.');
  const valid = form.meanings.filter((item) => item.definition.trim() || item.translation.trim());
  if (!valid.length) throw new Error('Vui lòng nhập ít nhất một nghĩa (tiếng Việt hoặc định nghĩa tiếng Anh).');
  const grouped = new Map<string, WordPartDetail>();
  for (const item of valid) {
    const key = item.partOfSpeech.toUpperCase();
    if (!grouped.has(key)) grouped.set(key, { partOfSpeech: key, meanings: [] });
    grouped.get(key)!.meanings.push({
      definition: item.definition.trim(),
      translation: splitList(item.translation),
      synonyms: splitList(item.synonyms),
      antonyms: splitList(item.antonyms),
      examples: item.exampleEn.trim() || item.exampleVi.trim() ? [{ en: item.exampleEn.trim(), vi: item.exampleVi.trim() }] : [],
    });
  }
  return {
    word: form.word.trim(),
    level: form.level,
    ipa: { us: form.usIpa.trim() || undefined, uk: form.ukIpa.trim() || undefined },
    variations: splitList(form.variations),
    relatedWords: splitList(form.relatedWords),
    // An empty string clears a previously saved image on update.
    image: form.image.trim(),
    parts: [...grouped.values()],
    isActive: form.isActive,
  };
}

const input =
  'w-full rounded-[4px] border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50';
const label = 'mb-1 block text-xs font-semibold text-slate-600';

function Field({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className={label}>{title}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export function WordImageField({
  value,
  onChange,
  onUploadingChange,
}: {
  value: string;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [brokenUrl, setBrokenUrl] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const broken = Boolean(value) && brokenUrl === value;

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > IMAGE_MAX_BYTES) {
      setError('Chọn tệp ảnh (PNG, JPG, WEBP, GIF, SVG) tối đa 5 MB.');
      return;
    }
    setError('');
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const result = await uploadService.uploadFile(file);
      onChange(result.url);
    } catch {
      setError('Tải ảnh thất bại. Vui lòng thử lại.');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <div>
      <span className={label}>Ảnh minh hoạ</span>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInput.current?.click()}
        onPaste={(event) => void upload(event.clipboardData.files?.[0])}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files?.[0]);
        }}
        aria-label={value ? 'Đổi ảnh minh hoạ' : 'Tải ảnh minh hoạ lên'}
        className={`relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[4px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : value && !broken
              ? 'border-slate-200 bg-slate-50'
              : 'border-dashed border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40'
        }`}
      >
        {uploading ? (
          <span className="flex flex-col items-center gap-1.5 text-xs text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Đang tải ảnh...
          </span>
        ) : value && !broken ? (
          <img src={value} alt="" onError={() => setBrokenUrl(value)} className="h-full w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-3 text-center">
            {broken ? <ImageIcon className="h-5 w-5 text-rose-400" /> : <UploadCloud className="h-5 w-5 text-blue-600" />}
            <span className="text-xs font-semibold text-slate-700">{broken ? 'Không hiển thị được ảnh' : 'Nhấp, kéo thả hoặc dán ảnh'}</span>
            <span className="text-[11px] text-slate-400">PNG, JPG, WEBP, GIF · tối đa 5 MB</span>
          </span>
        )}
      </button>
      <div className="mt-1.5 flex items-center gap-1">
        {value && !uploading && (
          <>
            <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
              <Upload className="h-3.5 w-3.5" /> Đổi ảnh
            </button>
            <button type="button" onClick={() => onChange('')} className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">
              <Trash2 className="h-3.5 w-3.5" /> Bỏ ảnh
            </button>
          </>
        )}
        <button type="button" onClick={() => setShowUrl((v) => !v)} className="ml-auto inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
          <Link2 className="h-3.5 w-3.5" /> Dán link
        </button>
      </div>
      {showUrl && (
        <div className="relative mt-1">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value.trim())}
            placeholder="https://... hoặc /uploads/..."
            aria-label="Đường dẫn ảnh minh hoạ"
            className={`${input} pr-7 text-xs`}
          />
          {value && (
            <button type="button" onClick={() => onChange('')} aria-label="Xoá đường dẫn" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function MeaningCard({
  meaning,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  meaning: MeaningDraft;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<MeaningDraft>) => void;
  onRemove: () => void;
}) {
  const [relations, setRelations] = useState(Boolean(meaning.synonyms || meaning.antonyms));
  const id = (name: string) => `meaning-${meaning.id}-${name}`;
  return (
    <div className="rounded-[6px] border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-blue-600 text-[11px] font-bold text-white">{index + 1}</span>
        <Select value={meaning.partOfSpeech} onValueChange={(value) => onChange({ partOfSpeech: value })}>
          <SelectTrigger aria-label="Từ loại" className="h-7 w-[150px] bg-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{POS.map((item) => <SelectItem key={item} value={item}>{item.replace('_', ' ')}</SelectItem>)}</SelectContent>
        </Select>
        {canRemove && (
          <button type="button" onClick={onRemove} aria-label={`Xoá nghĩa ${index + 1}`} className="ml-auto rounded-[4px] p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2">
        <div>
          <label htmlFor={id('vi')} className={label}>Nghĩa tiếng Việt</label>
          <input id={id('vi')} value={meaning.translation} onChange={(e) => onChange({ translation: e.target.value })} placeholder="đặt chỗ, sự đặt trước" className={input} />
          <span className="mt-1 block text-[11px] text-slate-400">Nhiều nghĩa ngăn cách bằng dấu phẩy</span>
        </div>
        <div>
          <label htmlFor={id('en')} className={label}>Định nghĩa tiếng Anh</label>
          <input id={id('en')} value={meaning.definition} onChange={(e) => onChange({ definition: e.target.value })} placeholder="an arrangement to have something kept for you" className={input} />
        </div>
        <div>
          <label htmlFor={id('ex-en')} className={label}>Câu ví dụ</label>
          <input id={id('ex-en')} value={meaning.exampleEn} onChange={(e) => onChange({ exampleEn: e.target.value })} placeholder="I made a reservation for two." className={input} />
        </div>
        <div>
          <label htmlFor={id('ex-vi')} className={label}>Dịch câu ví dụ</label>
          <input id={id('ex-vi')} value={meaning.exampleVi} onChange={(e) => onChange({ exampleVi: e.target.value })} placeholder="Tôi đã đặt bàn cho hai người." className={input} />
        </div>
        {relations ? (
          <>
            <div>
              <label htmlFor={id('syn')} className={label}>Từ đồng nghĩa</label>
              <input id={id('syn')} value={meaning.synonyms} onChange={(e) => onChange({ synonyms: e.target.value })} placeholder="booking, appointment" className={input} />
              <span className="mt-1 block text-[11px] text-slate-400">Các từ cách nhau bởi dấu phẩy</span>
            </div>
            <div>
              <label htmlFor={id('ant')} className={label}>Từ trái nghĩa</label>
              <input id={id('ant')} value={meaning.antonyms} onChange={(e) => onChange({ antonyms: e.target.value })} placeholder="cancellation" className={input} />
              <span className="mt-1 block text-[11px] text-slate-400">Các từ cách nhau bởi dấu phẩy</span>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setRelations(true)} className="inline-flex w-fit items-center gap-1 text-xs font-medium text-blue-600 hover:underline sm:col-span-2">
            <Plus className="h-3 w-3" /> Thêm từ đồng nghĩa / trái nghĩa
          </button>
        )}
      </div>
    </div>
  );
}

type SectionProps = { value: WordFormState; onChange: (next: WordFormState) => void };

/** Word, level, pronunciation and visibility. */
export function WordBasicFields({ value, onChange, autoFocus }: SectionProps & { autoFocus?: boolean }) {
  const set = (patch: Partial<WordFormState>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3.5">
      <Field title="Từ / cụm từ *">
        <input
          value={value.word}
          onChange={(e) => set({ word: e.target.value })}
          autoFocus={autoFocus}
          placeholder="reservation"
          className={`${input} py-2 text-base font-semibold`}
        />
      </Field>
      <div>
        <span className={label}>Cấp độ</span>
        <div role="radiogroup" aria-label="Cấp độ" className="grid grid-cols-6 overflow-hidden rounded-[4px] border border-slate-300">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={value.level === level}
              onClick={() => set({ level })}
              className={`border-l border-slate-300 py-1.5 text-xs font-semibold first:border-l-0 ${value.level === level ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field title="Phiên âm US">
          <input value={value.usIpa} onChange={(e) => set({ usIpa: e.target.value })} placeholder="/ˌrez.ɚˈveɪ.ʃən/" className={`${input} font-mono text-xs`} />
        </Field>
        <Field title="Phiên âm UK">
          <input value={value.ukIpa} onChange={(e) => set({ ukIpa: e.target.value })} placeholder="/ˌrez.əˈveɪ.ʃən/" className={`${input} font-mono text-xs`} />
        </Field>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-[4px] border border-slate-200 px-2.5 py-2">
        <span>
          <span className="block text-xs font-semibold text-slate-700">Kích hoạt</span>
          <span className="block text-[11px] text-slate-400">Tắt để ẩn khỏi người học</span>
        </span>
        <input type="checkbox" checked={value.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4 accent-blue-600" />
      </label>
    </div>
  );
}

/** The list of meaning cards. */
export function WordMeaningsFields({ value, onChange }: SectionProps) {
  const set = (patch: Partial<WordFormState>) => onChange({ ...value, ...patch });
  const setMeaning = (id: string, patch: Partial<MeaningDraft>) =>
    set({ meanings: value.meanings.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Nghĩa ({value.meanings.length})</h3>
          <p className="text-[11px] text-slate-500">Cần ít nhất nghĩa tiếng Việt hoặc định nghĩa tiếng Anh.</p>
        </div>
        <button
          type="button"
          onClick={() => set({ meanings: [...value.meanings, newMeaning(value.meanings.at(-1)?.partOfSpeech)] })}
          className="inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" /> Thêm nghĩa
        </button>
      </div>
      {value.meanings.map((meaning, index) => (
        <MeaningCard
          key={meaning.id}
          meaning={meaning}
          index={index}
          canRemove={value.meanings.length > 1}
          onChange={(patch) => setMeaning(meaning.id, patch)}
          onRemove={() => set({ meanings: value.meanings.filter((item) => item.id !== meaning.id) })}
        />
      ))}
    </section>
  );
}

/** Variations and related words. */
export function WordRelationFields({ value, onChange, collapsible = true }: SectionProps & { collapsible?: boolean }) {
  const [open, setOpen] = useState(!collapsible || Boolean(value.variations || value.relatedWords));
  const set = (patch: Partial<WordFormState>) => onChange({ ...value, ...patch });
  const body = (
    <div className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${collapsible ? 'border-t border-slate-100 p-3' : ''}`}>
      <Field title="Biến thể" hint="Ngăn cách bằng dấu phẩy">
        <input value={value.variations} onChange={(e) => set({ variations: e.target.value })} placeholder="reservations, reserve" className={input} />
      </Field>
      <Field title="Từ liên quan" hint="Ngăn cách bằng dấu phẩy">
        <input value={value.relatedWords} onChange={(e) => set({ relatedWords: e.target.value })} placeholder="booking, appointment" className={input} />
      </Field>
    </div>
  );
  if (!collapsible) return body;
  return (
    <section className="rounded-[6px] border border-slate-200">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        <span>Biến thể & từ liên quan</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && body}
    </section>
  );
}

/** All fields on one screen (used by the edit dialog). */
export function WordFormFields({
  value,
  onChange,
  autoFocus,
  onUploadingChange,
  extra,
}: {
  value: WordFormState;
  onChange: (next: WordFormState) => void;
  autoFocus?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  /** Extra blocks rendered under the meanings (e.g. audio tools). */
  extra?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-3.5">
        <WordImageField value={value.image} onChange={(image) => onChange({ ...value, image })} onUploadingChange={onUploadingChange} />
      </aside>
      <div className="min-w-0 space-y-4">
        <WordBasicFields value={value} onChange={onChange} autoFocus={autoFocus} />
        <WordMeaningsFields value={value} onChange={onChange} />
        {extra}
        <WordRelationFields value={value} onChange={onChange} />
      </div>
    </div>
  );
}

/* ───────────── Pronunciation source (create wizard) ───────────── */

export type AudioMode = 'tts' | 'file' | 'link' | 'none';
export type AudioChoice = { mode: AudioMode; url: string };
export const AUDIO_URL_PATTERN = /^(?:https?:\/\/\S+|\/(?!\/)\S*)$/;
const AUDIO_MAX_BYTES = 10 * 1024 * 1024;

const AUDIO_MODES: { value: AudioMode; label: string }[] = [
  { value: 'tts', label: 'Tự sinh' },
  { value: 'file', label: 'Tải file' },
  { value: 'link', label: 'Dán link' },
  { value: 'none', label: 'Không' },
];

/** One accent: pick TTS, an audio file, a link, or nothing. */
export function AudioSourceField({
  accent,
  value,
  onChange,
  file,
  onFile,
  ipa,
  onEditIpa,
}: {
  accent: 'us' | 'uk';
  value: AudioChoice;
  onChange: (next: AudioChoice) => void;
  file: File | null;
  onFile: (file: File | null) => void;
  /** The accent's IPA; audio without a transcription is not allowed. */
  ipa: string;
  onEditIpa?: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const missingIpa = value.mode !== 'none' && !ipa.trim();
  const [error, setError] = useState('');
  const invalidLink = value.mode === 'link' && Boolean(value.url) && !AUDIO_URL_PATTERN.test(value.url);
  const preview = value.mode === 'link' && value.url && !invalidLink ? value.url : null;
  return (
    <div className="space-y-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-7 text-xs font-bold text-slate-900">{accent.toUpperCase()}</span>
        <div role="radiogroup" aria-label={`Nguồn phát âm ${accent.toUpperCase()}`} className="inline-flex overflow-hidden rounded-[4px] border border-slate-300">
          {AUDIO_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={value.mode === mode.value}
              onClick={() => {
                setError('');
                onChange({ ...value, mode: mode.value });
                if (mode.value === 'file' && !file) fileInput.current?.click();
              }}
              className={`border-l border-slate-300 px-2.5 py-1 text-xs font-semibold first:border-l-0 ${value.mode === mode.value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.currentTarget.value = '';
          if (!picked) return;
          if (!picked.type.startsWith('audio/') || picked.size > AUDIO_MAX_BYTES) {
            setError('Chọn file audio (MP3, WAV, OGG, M4A) tối đa 10 MB.');
            return;
          }
          setError('');
          onFile(picked);
        }}
      />
      {missingIpa ? (
        <p className="pl-9 text-[11px] font-medium text-amber-700">
          Chưa có phiên âm {accent.toUpperCase()}. Nhập phiên âm trước khi thêm phát âm, hoặc chọn “Không”.{' '}
          {onEditIpa && (
            <button type="button" onClick={onEditIpa} className="font-semibold text-blue-600 underline">Nhập phiên âm</button>
          )}
        </p>
      ) : (
        ipa.trim() && <p className="pl-9 font-mono text-[11px] text-slate-500">{ipa}</p>
      )}
      {value.mode === 'tts' && !missingIpa && <p className="pl-9 text-[11px] text-slate-500">Sinh bằng Kokoro TTS ngay sau khi tạo từ.</p>}
      {value.mode === 'file' && (
        <div className="flex flex-wrap items-center gap-2 pl-9 text-xs">
          {file ? (
            <>
              <span className="min-w-0 max-w-[220px] truncate font-medium text-slate-700" title={file.name}>{file.name}</span>
              <span className="text-slate-400">{Math.round(file.size / 1024)} KB</span>
              <button type="button" onClick={() => void new Audio(URL.createObjectURL(file)).play()} className="rounded-[4px] border border-slate-200 p-1 text-blue-600 hover:bg-blue-50" aria-label="Nghe thử"><Volume2 className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => fileInput.current?.click()} className="font-medium text-blue-600 hover:underline">Đổi file</button>
            </>
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1 rounded-[4px] border border-dashed border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50/40">
              <Upload className="h-3.5 w-3.5" /> Chọn file audio
            </button>
          )}
        </div>
      )}
      {value.mode === 'link' && (
        <div className="flex items-center gap-2 pl-9">
          <input
            value={value.url}
            onChange={(event) => onChange({ ...value, url: event.target.value.trim() })}
            placeholder="https://.../reservation-us.mp3"
            aria-label={`Link audio ${accent.toUpperCase()}`}
            aria-invalid={invalidLink}
            className={`${input} text-xs ${invalidLink ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : ''}`}
          />
          {preview && (
            <button type="button" onClick={() => void new Audio(preview).play()} className="shrink-0 rounded-[4px] border border-slate-200 p-1.5 text-blue-600 hover:bg-blue-50" aria-label="Nghe thử"><Volume2 className="h-3.5 w-3.5" /></button>
          )}
        </div>
      )}
      {invalidLink && <p className="pl-9 text-[11px] text-rose-600">Link phải bắt đầu bằng http(s):// hoặc /.</p>}
      {error && <p role="alert" className="pl-9 text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}

