'use client';
import {PublicationBar} from '@/components/publication/publication-controls';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, Upload, Volume2, WandSparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { wordService } from '@/services/vocabulary.service';
import { audioService } from '@/services/audio.service';
import type { UpdateWordDto, WordDetail, WordPartDetail } from '@/types/vocabulary';

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
  wordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const splitList = (value: string) => value.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
const newMeaning = (): MeaningDraft => ({ id: crypto.randomUUID(), partOfSpeech: 'noun', definition: '', translation: '', synonyms: '', antonyms: '', exampleEn: '', exampleVi: '' });

function toDrafts(word?: WordDetail): MeaningDraft[] {
  if (!word?.parts?.length) return [newMeaning()];
  const rows: MeaningDraft[] = [];
  for (const part of word.parts) {
    for (const meaning of part.meanings || []) {
      rows.push({
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
  return rows.length ? rows : [newMeaning()];
}

export function EditWordDialog({ wordId, open, onOpenChange }: Props) {
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
  const [error, setError] = useState('');
  const [audioBusy, setAudioBusy] = useState<'us' | 'uk' | null>(null);
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

  useEffect(() => {
    if (!detail) return;
    setWord(detail.word || '');
    setLevel(detail.level || 'A1');
    setMeanings(toDrafts(detail));
    setUsIpa(detail.ipa?.us || '');
    setUkIpa(detail.ipa?.uk || '');
    setVariations((detail.variations || []).join(', '));
    setRelatedWords((detail.relatedWords || []).join(', '));
    setImageUrl(detail.image || '');
    setIsActive(detail.isActive !== false);
    setError('');
  }, [detail?._id, detail?.updatedAt]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!wordId) throw new Error('Missing word id.');
      if (!word.trim()) throw new Error('Vui lòng nhập từ vựng.');
      const valid = meanings.filter((item) => item.definition.trim() || item.translation.trim());
      if (!valid.length) throw new Error('Vui lòng nhập ít nhất một nghĩa.');
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
      const payload: UpdateWordDto = {
        word: word.trim(),
        level,
        ipa: { us: usIpa.trim() || undefined, uk: ukIpa.trim() || undefined },
        variations: splitList(variations),
        relatedWords: splitList(relatedWords),
        image: imageUrl.trim() || undefined,
        parts: [...grouped.values()],
        isActive,
      };
      return wordService.update(wordId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
      queryClient.invalidateQueries({ queryKey: ['word-detail', wordId] });
      onOpenChange(false);
    },
    onError: (err: any) => setError(err?.response?.data?.message || err?.message || 'Không thể cập nhật từ vựng.'),
  });

  const refreshWord = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['words'] }),
      queryClient.invalidateQueries({ queryKey: ['word-detail', wordId] }),
    ]);
  };

  const generate = async (accent: 'us' | 'uk') => {
    if (!wordId) return;
    try {
      setAudioBusy(accent);
      setError('');
      await audioService.generateVocabulary(wordId, accent);
      await refreshWord();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Tạo audio thất bại.');
    } finally {
      setAudioBusy(null);
    }
  };

  const upload = async (accent: 'us' | 'uk', file?: File) => {
    if (!wordId || !file) return;
    try {
      setAudioBusy(accent);
      setError('');
      await audioService.uploadVocabulary(wordId, accent, file);
      await refreshWord();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Upload audio thất bại.');
    } finally {
      setAudioBusy(null);
    }
  };

  const updateMeaning = (id: string, patch: Partial<MeaningDraft>) => setMeanings((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));

  const audioCard = (accent: 'us' | 'uk') => {
    const url = detail?.audio?.[accent];
    const meta = detail?.audioMeta?.[accent];
    const label = accent.toUpperCase();
    const status = meta?.status || (url ? 'READY' : 'NONE');
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{label}</span><span className={`rounded px-2 py-0.5 text-[10px] font-bold ${status === 'READY' ? 'bg-emerald-100 text-emerald-700' : status === 'STALE' ? 'bg-amber-100 text-amber-700' : status === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{status}</span></div>
            <p className="mt-1 text-xs text-slate-500">{meta?.source === 'UPLOAD' ? 'Audio upload' : 'Kokoro TTS'}{meta?.voiceIds?.[0] ? ` · ${meta.voiceIds[0]}` : ''}</p>
          </div>
          {url && <button type="button" onClick={() => new Audio(url).play()} className="rounded-md border border-slate-200 p-2 text-blue-600 hover:bg-blue-50"><Volume2 className="h-4 w-4" /></button>}
        </div>
        {status === 'STALE' && <p className="text-xs text-amber-700">Nội dung từ đã thay đổi. Nên regenerate audio.</p>}
        {status === 'FAILED' && meta?.error && <p className="text-xs text-rose-600 line-clamp-2">{meta.error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!audioBusy} onClick={() => generate(accent)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
            {audioBusy === accent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />} {url ? 'Regenerate' : 'Generate'}
          </button>
          <button type="button" disabled={!!audioBusy} onClick={() => (accent === 'us' ? usInput.current : ukInput.current)?.click()} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"><Upload className="h-3.5 w-3.5" /> Upload</button>
          <input ref={accent === 'us' ? usInput : ukInput} type="file" accept="audio/*" className="hidden" onChange={(e) => { void upload(accent, e.target.files?.[0]); e.currentTarget.value = ''; }} />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] max-h-[92dvh] overflow-y-auto p-0 rounded-lg border border-slate-200 bg-white">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
          <DialogTitle className="text-xl font-bold text-slate-900">Chỉnh sửa từ vựng</DialogTitle>
          <p className="mt-1 text-sm text-slate-500">Sửa nội dung và quản lý phát âm ngay trong một màn hình.</p>
        </div>

        {query.isLoading ? (
          <div className="flex h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
        ) : (
          <form className="p-6 space-y-6" onSubmit={(e) => { e.preventDefault(); setError(''); updateMutation.mutate(); }}>
            {wordId && <PublicationBar kind="words" id={wordId} version={detail?.updatedAt} dirty={audioBusy!==null || updateMutation.isPending || word!==(detail?.word||'') || level!==(detail?.level||'A1') || usIpa!==(detail?.ipa?.us||'') || ukIpa!==(detail?.ipa?.uk||'') || imageUrl!==(detail?.image||'') || isActive!==(detail?.isActive!==false) || variations!==(detail?.variations||[]).join(', ') || relatedWords!==(detail?.relatedWords||[]).join(', ') || JSON.stringify(meanings.map(item=>({...item,id:undefined})))!==JSON.stringify(toDrafts(detail).map(item=>({...item,id:undefined})))} />}
            {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

            <section className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4">
              <label className="space-y-1.5"><span className="text-sm font-semibold text-slate-700">Từ / cụm từ *</span><input value={word} onChange={(e) => setWord(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label>
              <label className="space-y-1.5"><span className="text-sm font-semibold text-slate-700">Level</span><Select value={level} onValueChange={setLevel}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{LEVELS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-900">Nghĩa</h3><p className="text-xs text-slate-500">Quản lý các nghĩa chính, ví dụ và từ liên quan.</p></div><button type="button" onClick={() => setMeanings((items) => [...items, newMeaning()])} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold"><Plus className="h-3.5 w-3.5" /> Thêm nghĩa</button></div>
              {meanings.map((meaning, index) => (
                <div key={meaning.id} className="rounded-lg border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between"><div className="flex min-w-0 flex-1 items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">{index + 1}</span><Select value={meaning.partOfSpeech} onValueChange={(value) => updateMeaning(meaning.id, { partOfSpeech: value })}><SelectTrigger className="w-full min-w-0 bg-white sm:w-[170px]"><SelectValue /></SelectTrigger><SelectContent>{POS.map((item) => <SelectItem key={item} value={item}>{item.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div>{meanings.length > 1 && <button type="button" onClick={() => setMeanings((items) => items.filter((item) => item.id !== meaning.id))} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input value={meaning.translation} onChange={(e) => updateMeaning(meaning.id, { translation: e.target.value })} placeholder="Nghĩa tiếng Việt" className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm" /><input value={meaning.definition} onChange={(e) => updateMeaning(meaning.id, { definition: e.target.value })} placeholder="English definition" className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm" /></div>
                  {advanced && <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input value={meaning.synonyms} onChange={(e) => updateMeaning(meaning.id, { synonyms: e.target.value })} placeholder="Synonyms" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /><input value={meaning.antonyms} onChange={(e) => updateMeaning(meaning.id, { antonyms: e.target.value })} placeholder="Antonyms" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /><input value={meaning.exampleEn} onChange={(e) => updateMeaning(meaning.id, { exampleEn: e.target.value })} placeholder="Example sentence" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /><input value={meaning.exampleVi} onChange={(e) => updateMeaning(meaning.id, { exampleVi: e.target.value })} placeholder="Dịch câu ví dụ" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" /></div>}
                </div>
              ))}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2"><Volume2 className="h-4 w-4 text-blue-600" /><div><h3 className="text-sm font-bold text-slate-900">Audio pronunciation</h3><p className="text-xs text-slate-500">Generate bằng Kokoro hoặc upload file riêng. File được lưu local.</p></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{audioCard('us')}{audioCard('uk')}</div>
            </section>

            <button type="button" onClick={() => setAdvanced((value) => !value)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><span>Thông tin nâng cao</span>{advanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
            {advanced && <section className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-slate-200 p-4"><label className="space-y-1"><span className="text-xs font-semibold text-slate-600">IPA US</span><input value={usIpa} onChange={(e) => setUsIpa(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="space-y-1"><span className="text-xs font-semibold text-slate-600">IPA UK</span><input value={ukIpa} onChange={(e) => setUkIpa(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="space-y-1"><span className="text-xs font-semibold text-slate-600">Biến thể</span><input value={variations} onChange={(e) => setVariations(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="space-y-1"><span className="text-xs font-semibold text-slate-600">Từ liên quan</span><input value={relatedWords} onChange={(e) => setRelatedWords(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="space-y-1 md:col-span-2"><span className="text-xs font-semibold text-slate-600">Image URL</span><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Kích hoạt</label></section>}

            <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4"><button type="button" onClick={() => onOpenChange(false)} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Hủy</button><button type="submit" disabled={updateMutation.isPending} className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Lưu thay đổi</button></div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
