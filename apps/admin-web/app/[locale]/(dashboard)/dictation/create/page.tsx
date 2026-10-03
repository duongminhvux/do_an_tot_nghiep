'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, AudioLines, Loader2, PlayCircle, Sparkles, WandSparkles } from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import { DictationLevel, DictationLesson, DictationVoice } from '@/types/dictation';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

export default function CreateDictationPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'vi';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('General');
  const [level, setLevel] = useState<DictationLevel>('B1');
  const [language, setLanguage] = useState<'en-US' | 'en-GB'>('en-US');
  const [voice1, setVoice1] = useState('af_heart');
  const [voice2, setVoice2] = useState('');
  const [speed, setSpeed] = useState(1);
  const [pauseAfterMs, setPauseAfterMs] = useState(300);
  const [sourceText, setSourceText] = useState('');
  const [preview, setPreview] = useState<Array<{ order: number; text: string }>>([]);
  const [publishAfter, setPublishAfter] = useState(true);
  const [error, setError] = useState('');

  const { data: voicesData, isLoading: loadingVoices } = useQuery({
    queryKey: ['dictation-voices'],
    queryFn: () => dictationService.getVoices(),
    retry: 1,
  });
  const voices = unwrap<{ voices: DictationVoice[] }>(voicesData)?.voices || [];
  const availableVoices = useMemo(
    () => voices.filter((voice) => voice.language === language),
    [voices, language],
  );

  const previewMutation = useMutation({
    mutationFn: () => dictationService.previewSplit(sourceText),
    onSuccess: (result) => {
      const data = unwrap<{ count: number; sentences: Array<{ order: number; text: string }> }>(result);
      setPreview(data.sentences || []);
    },
    onError: (err: any) => setError(err?.response?.data?.message || err?.message || 'Không thể tách câu.'),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const createdRes = await dictationService.create({
        title,
        description,
        topic,
        level,
        sourceText,
        language,
        voiceIds: [voice1, voice2].filter(Boolean),
        speed,
        pauseAfterMs,
      });
      const created = unwrap<DictationLesson>(createdRes);
      const generatedRes = await dictationService.generateAudio(created._id);
      const generated = unwrap<DictationLesson>(generatedRes);
      if (publishAfter) await dictationService.publish(generated._id);
      return generated;
    },
    onSuccess: (lesson) => router.push(`/${locale}/dictation/${lesson._id}`),
    onError: (err: any) => setError(err?.response?.data?.message || err?.message || 'Tạo bài thất bại.'),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!title.trim() || !sourceText.trim()) {
      setError('Nhập tiêu đề và đoạn văn trước khi generate.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/dictation`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tạo bài Dictation</h1>
            <p className="mt-1 text-sm text-slate-500">Backend sẽ tự tách câu, luân phiên voice và generate audio từng câu.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900">Thông tin bài luyện</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2 text-xs font-semibold text-slate-600">
                  Tiêu đề
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" placeholder="Oyster Bay Sailing Club" />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Level
                  <select value={level} onChange={(e) => setLevel(e.target.value as DictationLevel)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    {['A1','A2','B1','B2','C1','C2'].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Chủ đề
                  <input value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="Travel" />
                </label>
                <label className="sm:col-span-2 text-xs font-semibold text-slate-600">
                  Mô tả
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Mô tả ngắn cho học viên..." />
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Nội dung Dictation</h2>
                  <p className="mt-1 text-xs text-slate-500">Dán cả đoạn văn. Không cần tự tách từng câu.</p>
                </div>
                <button type="button" disabled={!sourceText.trim() || previewMutation.isPending} onClick={() => previewMutation.mutate()} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                  {previewMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                  Xem cách tách câu
                </button>
              </div>
              <textarea
                value={sourceText}
                onChange={(e) => { setSourceText(e.target.value); setPreview([]); }}
                rows={14}
                className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                placeholder={'Hello, Oyster Bay Sailing Club. How can I help you?\nOh hi. I\'d like to find out about sailing courses for beginners.\nNo problem. Is it for yourself?'}
              />
              {preview.length > 0 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-bold text-slate-600">Backend tách được {preview.length} câu</p>
                  <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                    {preview.map((item) => (
                      <div key={item.order} className="flex gap-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
                        <span className="w-6 shrink-0 font-bold text-blue-600">{item.order + 1}</span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <AudioLines className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Kokoro TTS</h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">Nếu chọn 2 voice, backend sẽ gán luân phiên: câu 1 → voice 1, câu 2 → voice 2, câu 3 → voice 1...</p>

              <div className="mt-4 space-y-4">
                <label className="block text-xs font-semibold text-slate-600">
                  Accent
                  <select value={language} onChange={(e) => { const next = e.target.value as 'en-US' | 'en-GB'; setLanguage(next); setVoice1(next === 'en-US' ? 'af_heart' : 'bf_emma'); setVoice2(''); }} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-600">
                  Voice 1
                  <select value={voice1} onChange={(e) => setVoice1(e.target.value)} disabled={loadingVoices} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    {availableVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.gender}</option>)}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-600">
                  Voice 2 <span className="font-normal text-slate-400">(tuỳ chọn)</span>
                  <select value={voice2} onChange={(e) => setVoice2(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    <option value="">Không dùng</option>
                    {availableVoices.filter((voice) => voice.id !== voice1).map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.gender}</option>)}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Speed
                    <input type="number" min="0.5" max="2" step="0.05" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Pause (ms)
                    <input type="number" min="0" max="10000" step="50" value={pauseAfterMs} onChange={(e) => setPauseAfterMs(Number(e.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={publishAfter} onChange={(e) => setPublishAfter(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                <span>
                  <span className="block text-xs font-bold text-slate-700">Publish sau khi generate xong</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">Nếu bỏ chọn, bài sẽ ở trạng thái READY để admin kiểm tra audio trước.</span>
                </span>
              </label>

              {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

              <button type="submit" disabled={createMutation.isPending || !title.trim() || !sourceText.trim()} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {createMutation.isPending ? 'Đang tách câu và generate audio...' : 'Tạo bài & Generate Audio'}
              </button>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700">
                <PlayCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Generate lần đầu có thể mất vài phút vì backend gọi Kokoro cho từng câu rồi ghép thêm full audio.
              </div>
            </section>
          </div>
        </form>
      </div>
    </div>
  );
}
