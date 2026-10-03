'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  AudioLines,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  Send,
} from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import {
  DictationLesson,
  DictationLevel,
  DictationVoice,
} from '@/types/dictation';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

export default function DictationDetailPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const id = String(params?.id || '');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dictation-detail', id],
    queryFn: () => dictationService.getById(id),
    enabled: Boolean(id),
  });
  const lesson = unwrap<DictationLesson>(data);

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
    mutationFn: () =>
      dictationService.update(id, {
        title,
        description,
        topic,
        level,
        sourceText,
        language,
        voiceIds: [voice1, voice2].filter(Boolean),
        speed,
        pauseAfterMs,
      }),
    onSuccess: () => {
      setMessage('Đã lưu. Nếu nội dung/voice thay đổi, hãy regenerate audio trước khi publish.');
      refresh();
    },
    onError: (error: any) =>
      setMessage(error?.response?.data?.message || error?.message || 'Không thể lưu thay đổi.'),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      await dictationService.update(id, {
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
      return dictationService.generateAudio(id);
    },
    onSuccess: () => {
      setMessage('Generate audio hoàn tất. Bài đang ở trạng thái READY.');
      refresh();
    },
    onError: (error: any) =>
      setMessage(error?.response?.data?.message || error?.message || 'Generate audio thất bại.'),
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      lesson?.status === 'PUBLISHED'
        ? dictationService.unpublish(id)
        : dictationService.publish(id),
    onSuccess: () => {
      setMessage(lesson?.status === 'PUBLISHED' ? 'Đã unpublish bài.' : 'Đã publish bài.');
      refresh();
    },
    onError: (error: any) =>
      setMessage(error?.response?.data?.message || error?.message || 'Không thể đổi trạng thái publish.'),
  });

  if (isLoading || !lesson) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải bài Dictation...
      </div>
    );
  }

  const busy = saveMutation.isPending || generateMutation.isPending || publishMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/dictation`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{lesson.title}</h1>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                  {lesson.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {lesson.level} · {lesson.topic} · {lesson.sentenceCount} câu
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={busy || !title.trim() || !sourceText.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Lưu thay đổi
            </button>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={busy || !sourceText.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerate toàn bộ
            </button>
            {(lesson.status === 'READY' || lesson.status === 'PUBLISHED') && (
              <button
                onClick={() => publishMutation.mutate()}
                disabled={busy}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {lesson.status === 'PUBLISHED' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {lesson.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {message}
          </div>
        )}
        {lesson.processingError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {lesson.processingError}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900">Nội dung & cấu hình</h2>
              <div className="mt-4 space-y-4">
                <label className="block text-xs font-semibold text-slate-600">
                  Tiêu đề
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Level
                    <select
                      value={level}
                      onChange={(event) => setLevel(event.target.value as DictationLevel)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    >
                      {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Chủ đề
                    <input
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                    />
                  </label>
                </div>
                <label className="block text-xs font-semibold text-slate-600">
                  Mô tả
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Đoạn văn
                  <textarea
                    value={sourceText}
                    onChange={(event) => setSourceText(event.target.value)}
                    rows={12}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm leading-6 outline-none focus:border-blue-500 focus:bg-white"
                  />
                  <span className="mt-1.5 block text-[11px] font-normal leading-5 text-slate-400">
                    Xuống dòng = ép thành một segment. Nếu chỉ có một đoạn liên tục, backend tự tách theo câu tiếng Anh.
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Accent
                    <select
                      value={language}
                      onChange={(event) => {
                        const next = event.target.value as 'en-US' | 'en-GB';
                        setLanguage(next);
                        setVoice1(next === 'en-US' ? 'af_heart' : 'bf_emma');
                        setVoice2('');
                      }}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Speed
                    <input
                      type="number"
                      min="0.5"
                      max="2"
                      step="0.05"
                      value={speed}
                      onChange={(event) => setSpeed(Number(event.target.value))}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Voice 1
                    <select
                      value={voice1}
                      onChange={(event) => setVoice1(event.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    >
                      {availableVoices.map((voice) => (
                        <option key={voice.id} value={voice.id}>{voice.name} · {voice.gender}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Voice 2
                    <select
                      value={voice2}
                      onChange={(event) => setVoice2(event.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="">Không dùng</option>
                      {availableVoices
                        .filter((voice) => voice.id !== voice1)
                        .map((voice) => (
                          <option key={voice.id} value={voice.id}>{voice.name} · {voice.gender}</option>
                        ))}
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-semibold text-slate-600">
                  Pause giữa các segment (ms)
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    step="50"
                    value={pauseAfterMs}
                    onChange={(event) => setPauseAfterMs(Number(event.target.value))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <AudioLines className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Full audio</h2>
              </div>
              {lesson.fullAudioUrl ? (
                <audio className="mt-4 w-full" controls src={lesson.fullAudioUrl} />
              ) : (
                <p className="mt-4 text-xs text-slate-400">Chưa có audio.</p>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-slate-400">Thời lượng</dt>
                  <dd className="mt-1 font-semibold text-slate-700">
                    {lesson.totalDurationMs ? `${Math.round(lesson.totalDurationMs / 1000)}s` : '—'}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-slate-400">Segments</dt>
                  <dd className="mt-1 font-semibold text-slate-700">{lesson.sentenceCount}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-bold text-slate-900">Sentence audio</h2>
              <p className="mt-1 text-xs text-slate-400">
                Mỗi segment đã được backend gán voice theo thứ tự và upload riêng.
              </p>
            </div>
            {generateMutation.isPending ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="mt-4 text-sm font-bold text-slate-700">Đang generate từng câu...</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                  NestJS đang lần lượt gọi Kokoro, upload từng WAV lên Cloudinary rồi tạo full audio.
                </p>
              </div>
            ) : (
              <div className="max-h-[820px] divide-y divide-slate-100 overflow-y-auto">
                {(lesson.segments || []).length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-400">Chưa có sentence audio. Bấm Regenerate toàn bộ.</div>
                ) : (
                  (lesson.segments || []).map((segment) => (
                    <div
                      key={segment._id}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[40px_minmax(0,1fr)_240px] sm:items-center"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                        {segment.order + 1}
                      </div>
                      <div>
                        <p className="text-sm leading-6 text-slate-700">{segment.text}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">
                          {segment.voiceId} · {Math.round(segment.durationMs / 100) / 10}s
                        </p>
                      </div>
                      <audio controls className="h-9 w-full" src={segment.audioUrl} />
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
