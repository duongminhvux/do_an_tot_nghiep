'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  AudioLines,
  CheckCircle2,
  FileAudio,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Send,
  Upload,
} from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import {
  DictationLesson,
  DictationLevel,
  DictationSegmentEditPayload,
  DictationVoice,
} from '@/types/dictation';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

function formatMs(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function DictationDetailPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const id = String(params?.id || '');
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopHandlerRef = useRef<(() => void) | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dictation-detail', id],
    queryFn: () => dictationService.getById(id),
    enabled: Boolean(id),
  });
  const lesson = unwrap<DictationLesson>(data);
  const effectiveAudioSource = lesson?.audioSource || 'TTS';

  const { data: voicesData } = useQuery({
    queryKey: ['dictation-voices'],
    queryFn: () => dictationService.getVoices(),
    retry: 1,
  });
  const voices = unwrap<{ voices: DictationVoice[] }>(voicesData)?.voices || [];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('General');
  const [level, setLevel] = useState<DictationLevel>('B1');
  const [sourceText, setSourceText] = useState('');
  const [language, setLanguage] = useState<'en-US' | 'en-GB'>('en-US');
  const [voice1, setVoice1] = useState('af_heart');
  const [voice2, setVoice2] = useState('');
  const [speed, setSpeed] = useState(1);
  const [pauseAfterMs, setPauseAfterMs] = useState(300);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [segmentDrafts, setSegmentDrafts] = useState<DictationSegmentEditPayload[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!lesson?._id) return;
    setTitle(lesson.title || '');
    setDescription(lesson.description || '');
    setTopic(lesson.topic || 'General');
    setLevel(lesson.level || 'B1');
    setSourceText(lesson.sourceText || '');
    setLanguage(lesson.language || 'en-US');
    setVoice1(lesson.voiceIds?.[0] || (lesson.language === 'en-GB' ? 'bf_emma' : 'af_heart'));
    setVoice2(lesson.voiceIds?.[1] || '');
    setSpeed(lesson.speed || 1);
    setPauseAfterMs(lesson.pauseAfterMs ?? 300);
    setSegmentDrafts((lesson.segments || []).map((segment) => ({
      order: segment.order,
      text: segment.text,
      startMs: segment.startMs ?? 0,
      endMs: segment.endMs ?? Math.max(segment.durationMs || 0, 1),
      speaker: segment.speaker || '',
    })));
  }, [lesson?._id, lesson?.updatedAt]);

  const availableVoices = useMemo(
    () => voices.filter((voice) => voice.language === language),
    [voices, language],
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-dictation-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['admin-dictation'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => dictationService.update(id, {
      title,
      description,
      topic,
      level,
      ...(effectiveAudioSource === 'TTS' ? { sourceText } : {}),
      language,
      voiceIds: [voice1, voice2].filter(Boolean),
      speed,
      pauseAfterMs,
    }),
    onSuccess: () => {
      setMessage(effectiveAudioSource === 'TTS'
        ? 'Đã lưu. Nếu transcript/voice thay đổi, regenerate lại audio trước khi publish.'
        : 'Đã lưu thông tin bài. Transcript upload chỉnh trực tiếp ở danh sách segment.');
      refresh();
    },
    onError: (error: any) => setMessage(error?.response?.data?.message || error?.message || 'Không thể lưu thay đổi.'),
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      await dictationService.update(id, {
        title,
        description,
        topic,
        level,
        audioSource: effectiveAudioSource,
        ...(effectiveAudioSource === 'TTS' ? { sourceText } : {}),
        language,
        voiceIds: [voice1, voice2].filter(Boolean),
        speed,
        pauseAfterMs,
      });
      if (effectiveAudioSource === 'TTS') return dictationService.generateAudio(id);
      if (!replacementFile) throw new Error('Chọn file audio mới trước khi phân tích lại.');
      return dictationService.analyzeAudio(id, replacementFile);
    },
    onSuccess: () => {
      setMessage(effectiveAudioSource === 'TTS'
        ? 'Kokoro đã tạo một full audio và metadata timestamp cho toàn bộ segment.'
        : 'Faster Whisper đã transcript audio và tạo timestamp cho từng segment. Hãy review trước khi publish.');
      setReplacementFile(null);
      refresh();
    },
    onError: (error: any) => setMessage(error?.response?.data?.message || error?.message || 'Xử lý audio thất bại.'),
  });

  const saveSegmentsMutation = useMutation({
    mutationFn: () => dictationService.updateSegments(id, segmentDrafts),
    onSuccess: () => {
      setMessage('Đã lưu transcript và timestamp segment. Audio không bị generate/upload lại.');
      refresh();
    },
    onError: (error: any) => setMessage(error?.response?.data?.message || error?.message || 'Không thể lưu segment.'),
  });

  const publishMutation = useMutation({
    mutationFn: () => lesson?.status === 'PUBLISHED' ? dictationService.unpublish(id) : dictationService.publish(id),
    onSuccess: () => {
      setMessage(lesson?.status === 'PUBLISHED' ? 'Đã unpublish bài.' : 'Đã publish bài.');
      refresh();
    },
    onError: (error: any) => setMessage(error?.response?.data?.message || error?.message || 'Không thể đổi trạng thái publish.'),
  });

  const updateDraft = (index: number, patch: Partial<DictationSegmentEditPayload>) => {
    setSegmentDrafts((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const playSegment = (startMs: number, endMs: number) => {
    const audio = audioRef.current;
    if (!audio || !lesson.fullAudioUrl) return;
    if (stopHandlerRef.current) audio.removeEventListener('timeupdate', stopHandlerRef.current);
    audio.currentTime = startMs / 1000;
    const stopAtEnd = () => {
      if (audio.currentTime * 1000 >= endMs) {
        audio.pause();
        audio.removeEventListener('timeupdate', stopAtEnd);
        stopHandlerRef.current = null;
      }
    };
    stopHandlerRef.current = stopAtEnd;
    audio.addEventListener('timeupdate', stopAtEnd);
    audio.play().catch(() => undefined);
  };

  if (isLoading || !lesson) {
    return <div className="flex min-h-[60vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải bài Dictation...</div>;
  }

  const busy = saveMutation.isPending || processMutation.isPending || publishMutation.isPending || saveSegmentsMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/dictation`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /></Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{lesson.title}</h1>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{lesson.status}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{effectiveAudioSource}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{lesson.level} · {lesson.topic} · {lesson.sentenceCount} segment</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => saveMutation.mutate()} disabled={busy || !title.trim() || (effectiveAudioSource === 'TTS' && !sourceText.trim())} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu thông tin</button>
            {effectiveAudioSource === 'TTS' && <button onClick={() => processMutation.mutate()} disabled={busy || !sourceText.trim()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">{processMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regenerate Kokoro</button>}
            {(lesson.status === 'READY' || lesson.status === 'PUBLISHED') && <button onClick={() => publishMutation.mutate()} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{lesson.status === 'PUBLISHED' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}{lesson.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</button>}
          </div>
        </div>

        {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}
        {lesson.processingError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{lesson.processingError}</div>}

        <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900">Thông tin & cấu hình</h2>
              <div className="mt-4 space-y-4">
                <label className="block text-xs font-semibold text-slate-600">Tiêu đề<input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-600">Level<select value={level} onChange={(e) => setLevel(e.target.value as DictationLevel)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{['A1','A2','B1','B2','C1','C2'].map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label className="text-xs font-semibold text-slate-600">Chủ đề<input value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
                </div>
                <label className="block text-xs font-semibold text-slate-600">Mô tả<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                <label className="block text-xs font-semibold text-slate-600">Accent<select value={language} onChange={(e) => setLanguage(e.target.value as 'en-US' | 'en-GB')} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option></select></label>
              </div>
            </section>

            {effectiveAudioSource === 'TTS' ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2"><AudioLines className="h-4 w-4 text-blue-600" /><h2 className="text-sm font-bold text-slate-900">Kokoro TTS</h2></div>
                <textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)} rows={12} className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-600">Voice 1<select value={voice1} onChange={(e) => setVoice1(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">{availableVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
                  <label className="text-xs font-semibold text-slate-600">Voice 2<select value={voice2} onChange={(e) => setVoice2(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="">Không dùng</option>{availableVoices.filter((voice) => voice.id !== voice1).map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
                  <label className="text-xs font-semibold text-slate-600">Speed<input type="number" min="0.5" max="2" step="0.05" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-600">Pause ms<input type="number" min="0" max="10000" step="50" value={pauseAfterMs} onChange={(e) => setPauseAfterMs(Number(e.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
                </div>
              </section>
            ) : (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2"><FileAudio className="h-4 w-4 text-blue-600" /><h2 className="text-sm font-bold text-slate-900">Faster Whisper</h2></div>
                <p className="mt-2 text-xs leading-5 text-slate-500">Upload file mới nếu muốn chạy lại ASR. File hiện tại không bị cắt thành sentence audio.</p>
                <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600 hover:border-blue-400"><Upload className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{replacementFile?.name || 'Chọn audio mới'}</span><input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm" className="hidden" onChange={(e) => setReplacementFile(e.target.files?.[0] || null)} /></label>
                <button onClick={() => processMutation.mutate()} disabled={busy || !replacementFile} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-blue-200 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">{processMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Phân tích lại audio</button>
              </section>
            )}
          </div>

          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">Full audio duy nhất</h2><p className="mt-1 text-xs text-slate-400">{lesson.audioProcessor || '—'} · {lesson.audioProcessorDevice || '—'} · {lesson.totalDurationMs ? formatMs(lesson.totalDurationMs) : '—'}</p></div></div>
              {lesson.fullAudioUrl ? <audio ref={audioRef} className="mt-4 w-full" controls src={lesson.fullAudioUrl} /> : <p className="mt-4 text-xs text-slate-400">Chưa có audio.</p>}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="text-sm font-bold text-slate-900">Transcript & metadata</h2><p className="mt-1 text-xs text-slate-400">Cả Kokoro và Faster Whisper đều dùng chung text + startMs + endMs trên full audio.</p></div>
                <button onClick={() => saveSegmentsMutation.mutate()} disabled={busy || !segmentDrafts.length} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">{saveSegmentsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu segment</button>
              </div>
              <div className="max-h-[850px] divide-y divide-slate-100 overflow-y-auto">
                {segmentDrafts.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Chưa có metadata. Hãy generate hoặc phân tích audio.</div> : segmentDrafts.map((segment, index) => {
                  const original = lesson.segments?.[index];
                  return (
                    <div key={`${segment.order}-${index}`} className="p-4">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => playSegment(segment.startMs, segment.endMs)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"><Play className="ml-0.5 h-3.5 w-3.5 fill-current" /></button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400"><span className="font-bold text-slate-600">#{index + 1}</span><span>{original?.source || effectiveAudioSource}</span>{original?.voiceId && <span>{original.voiceId}</span>}{typeof original?.confidence === 'number' && original.source === 'ASR' && <span>confidence {Math.round(original.confidence * 100)}%</span>}</div>
                          <textarea value={segment.text} onChange={(e) => updateDraft(index, { text: e.target.value })} rows={2} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6" />
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 pl-11 sm:grid-cols-3">
                        <label className="text-[11px] font-semibold text-slate-500">Start ms<input type="number" min="0" value={segment.startMs} onChange={(e) => updateDraft(index, { startMs: Number(e.target.value) })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs" /></label>
                        <label className="text-[11px] font-semibold text-slate-500">End ms<input type="number" min="1" value={segment.endMs} onChange={(e) => updateDraft(index, { endMs: Number(e.target.value) })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs" /></label>
                        <label className="text-[11px] font-semibold text-slate-500">Speaker<input value={segment.speaker || ''} onChange={(e) => updateDraft(index, { speaker: e.target.value })} placeholder="A / B / ..." className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs" /></label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
