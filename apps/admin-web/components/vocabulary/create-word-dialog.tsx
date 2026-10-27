'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Volume2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { wordService } from '@/services/vocabulary.service';
import { audioService } from '@/services/audio.service';
import type { CreateWordDto, WordPartDetail } from '@/types/vocabulary';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const POS = ['noun', 'verb', 'adjective', 'adverb', 'phrasal_verb', 'idiom', 'preposition', 'conjunction', 'pronoun', 'interjection', 'phrase', 'other'];

type MeaningDraft = {
  id: string;
  partOfSpeech: string;
  definition: string;
  translation: string;
  synonyms: string;
  antonyms: string;
  exampleEn: string;
  exampleVi: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (createdWord: any) => void;
}

const newMeaning = (): MeaningDraft => ({
  id: crypto.randomUUID(),
  partOfSpeech: 'noun',
  definition: '',
  translation: '',
  synonyms: '',
  antonyms: '',
  exampleEn: '',
  exampleVi: '',
});

const splitList = (value: string) => value.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);

export function CreateWordDialog({ open, onOpenChange, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [word, setWord] = useState('');
  const [level, setLevel] = useState('A1');
  const [meanings, setMeanings] = useState<MeaningDraft[]>([newMeaning()]);
  const [advanced, setAdvanced] = useState(false);
  const [usIpa, setUsIpa] = useState('');
  const [ukIpa, setUkIpa] = useState('');
  const [variations, setVariations] = useState('');
  const [relatedWords, setRelatedWords] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [generateUs, setGenerateUs] = useState(true);
  const [generateUk, setGenerateUk] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setWord('');
    setLevel('A1');
    setMeanings([newMeaning()]);
    setAdvanced(false);
    setUsIpa('');
    setUkIpa('');
    setVariations('');
    setRelatedWords('');
    setImageUrl('');
    setIsActive(true);
    setGenerateUs(true);
    setGenerateUk(false);
    setError('');
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!word.trim()) throw new Error('Vui lòng nhập từ vựng.');
      const validMeanings = meanings.filter((item) => item.definition.trim() || item.translation.trim());
      if (!validMeanings.length) throw new Error('Vui lòng nhập ít nhất một nghĩa.');

      const grouped = new Map<string, WordPartDetail>();
      for (const item of validMeanings) {
        const key = item.partOfSpeech.toUpperCase();
        if (!grouped.has(key)) grouped.set(key, { partOfSpeech: key, meanings: [] });
        grouped.get(key)!.meanings.push({
          definition: item.definition.trim(),
          translation: splitList(item.translation),
          synonyms: splitList(item.synonyms),
          antonyms: splitList(item.antonyms),
          examples: item.exampleEn.trim() || item.exampleVi.trim()
            ? [{ en: item.exampleEn.trim(), vi: item.exampleVi.trim() }]
            : [],
        });
      }

      const payload: CreateWordDto = {
        word: word.trim(),
        level,
        ipa: { us: usIpa.trim() || undefined, uk: ukIpa.trim() || undefined },
        variations: splitList(variations),
        relatedWords: splitList(relatedWords),
        image: imageUrl.trim() || undefined,
        parts: [...grouped.values()],
        isActive,
      };

      const response: any = await wordService.create(payload);
      const created = response?.data || response;
      if (created?._id) {
        const tasks: Promise<unknown>[] = [];
        if (generateUs) tasks.push(audioService.generateVocabulary(created._id, 'us'));
        if (generateUk) tasks.push(audioService.generateVocabulary(created._id, 'uk'));
        if (tasks.length) {
          const results = await Promise.allSettled(tasks);
          const failed = results.filter((result) => result.status === 'rejected');
          if (failed.length) console.warn('Word created, but some TTS jobs failed', failed);
        }
      }
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
      onOpenChange(false);
      onSuccess?.(created);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || err?.message || 'Không thể tạo từ vựng.');
    },
  });

  const updateMeaning = (id: string, patch: Partial<MeaningDraft>) => {
    setMeanings((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[92dvh] overflow-y-auto p-0 rounded-lg border border-slate-200 bg-white">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
          <DialogTitle className="text-xl font-bold text-slate-900">Tạo từ vựng</DialogTitle>
          <p className="mt-1 text-sm text-slate-500">Nhập thông tin cốt lõi trước. Các trường nâng cao có thể bổ sung sau.</p>
        </div>

        <form
          className="p-6 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            mutation.mutate();
          }}
        >
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <section className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4">
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Từ / cụm từ *</span>
              <input value={word} onChange={(e) => setWord(e.target.value)} autoFocus placeholder="reservation" className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Level</span>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Nghĩa</h3>
                <p className="text-xs text-slate-500">Chỉ cần nghĩa Việt hoặc định nghĩa Anh là có thể lưu.</p>
              </div>
              <button type="button" onClick={() => setMeanings((items) => [...items, newMeaning()])} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Plus className="h-3.5 w-3.5" /> Thêm nghĩa
              </button>
            </div>

            {meanings.map((meaning, index) => (
              <div key={meaning.id} className="rounded-lg border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">{index + 1}</span>
                    <Select value={meaning.partOfSpeech} onValueChange={(value) => updateMeaning(meaning.id, { partOfSpeech: value })}>
                      <SelectTrigger className="w-full min-w-0 bg-white sm:w-[170px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{POS.map((item) => <SelectItem key={item} value={item}>{item.replace('_', ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {meanings.length > 1 && <button type="button" onClick={() => setMeanings((items) => items.filter((item) => item.id !== meaning.id))} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={meaning.translation} onChange={(e) => updateMeaning(meaning.id, { translation: e.target.value })} placeholder="Nghĩa tiếng Việt, có thể ngăn cách bằng dấu phẩy" className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
                  <input value={meaning.definition} onChange={(e) => updateMeaning(meaning.id, { definition: e.target.value })} placeholder="English definition (optional)" className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
                {advanced && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <input value={meaning.synonyms} onChange={(e) => updateMeaning(meaning.id, { synonyms: e.target.value })} placeholder="Synonyms" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                    <input value={meaning.antonyms} onChange={(e) => updateMeaning(meaning.id, { antonyms: e.target.value })} placeholder="Antonyms" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                    <input value={meaning.exampleEn} onChange={(e) => updateMeaning(meaning.id, { exampleEn: e.target.value })} placeholder="Example sentence" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                    <input value={meaning.exampleVi} onChange={(e) => updateMeaning(meaning.id, { exampleVi: e.target.value })} placeholder="Dịch câu ví dụ" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                  </div>
                )}
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Volume2 className="h-4 w-4 text-blue-600" /> Phát âm Kokoro</div>
            <p className="mt-1 text-xs text-slate-600">Audio được tạo một lần và lưu local. User chỉ playback file đã tạo.</p>
            <div className="mt-3 flex flex-wrap gap-5 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={generateUs} onChange={(e) => setGenerateUs(e.target.checked)} /> Tạo US sau khi lưu</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={generateUk} onChange={(e) => setGenerateUk(e.target.checked)} /> Tạo UK sau khi lưu</label>
            </div>
          </section>

          <button type="button" onClick={() => setAdvanced((value) => !value)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <span>Thông tin nâng cao</span>
            {advanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {advanced && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-slate-200 p-4">
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">IPA US</span><input value={usIpa} onChange={(e) => setUsIpa(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">IPA UK</span><input value={ukIpa} onChange={(e) => setUkIpa(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">Biến thể</span><input value={variations} onChange={(e) => setVariations(e.target.value)} placeholder="booked, booking" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">Từ liên quan</span><input value={relatedWords} onChange={(e) => setRelatedWords(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="space-y-1 md:col-span-2"><span className="text-xs font-semibold text-slate-600">Image URL (optional)</span><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Kích hoạt ngay</label>
            </section>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Hủy</button>
            <button type="submit" disabled={mutation.isPending} className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Tạo từ
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
