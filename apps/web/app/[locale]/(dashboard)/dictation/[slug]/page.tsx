'use client';

import Link from 'next/link';
import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Headphones,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  XCircle,
} from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import { DictationLessonDetail, DictationProgress } from '@/types/dictation';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function DictationPracticePage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const slug = String(params?.slug || '');
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dictation-detail', slug],
    queryFn: () => dictationService.getBySlug(slug),
    enabled: Boolean(slug),
  });
  const lesson = unwrap<DictationLessonDetail>(data);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [tab, setTab] = useState<'dictation' | 'transcript'>('dictation');
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const lessonAudioRef = useRef<HTMLAudioElement | null>(null);
  const legacyAudioRef = useRef<HTMLAudioElement | null>(null);
  const segmentEndMsRef = useRef<number | null>(null);
  const segmentPlaybackRef = useRef(false);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [progress, setProgress] = useState<DictationProgress | null>(null);

  useEffect(() => {
    if (!lesson) return;
    setProgress(lesson.progress || null);
    const nextIndex = lesson.progress?.completed
      ? 0
      : Math.min(lesson.progress?.currentSegment || 0, Math.max((lesson.segments?.length || 1) - 1, 0));
    setCurrentIndex(nextIndex);
  }, [lesson?._id]);

  const segments = lesson?.segments || [];
  const current = segments[currentIndex];
  const completed = progress?.completedSegments || [];
  const completedCount = completed.length;
  const percent = segments.length ? Math.round((completedCount / segments.length) * 100) : 0;

  const attemptMutation = useMutation({
    mutationFn: ({ index, correct }: { index: number; correct: boolean }) =>
      dictationService.recordAttempt(lesson._id, index, correct),
    onSuccess: (response) => {
      const next = unwrap<DictationProgress>(response);
      setProgress(next);
      queryClient.invalidateQueries({ queryKey: ['dictation-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['dictation-progress-overview'] });
    },
  });

  const resetSentenceState = useCallback(() => {
    setAnswer('');
    setResult(null);
    setShowAnswer(false);
  }, []);

  const goTo = useCallback((index: number) => {
    if (!segments.length) return;
    const safe = Math.max(0, Math.min(index, segments.length - 1));
    lessonAudioRef.current?.pause();
    legacyAudioRef.current?.pause();
    segmentEndMsRef.current = null;
    setIsPlaying(false);
    setCurrentIndex(safe);
    resetSentenceState();
  }, [segments.length, resetSentenceState]);

  useEffect(() => {
    const audio = lessonAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const endMs = segmentEndMsRef.current;
      if (endMs !== null && audio.currentTime * 1000 >= endMs) {
        audio.pause();
        segmentEndMsRef.current = null;
      }
    };
    const handlePlay = () => setIsPlaying(segmentEndMsRef.current !== null);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [lesson?.fullAudioUrl]);

  const playCurrent = useCallback(() => {
    const hasUnifiedTiming =
      current?.startMs !== undefined &&
      current?.endMs !== undefined &&
      current.endMs > current.startMs;

    if (!hasUnifiedTiming && current?.audioUrl) {
      lessonAudioRef.current?.pause();
      if (!legacyAudioRef.current || legacyAudioRef.current.src !== current.audioUrl) {
        legacyAudioRef.current?.pause();
        const legacy = new Audio(current.audioUrl);
        legacy.addEventListener('play', () => setIsPlaying(true));
        legacy.addEventListener('pause', () => setIsPlaying(false));
        legacy.addEventListener('ended', () => setIsPlaying(false));
        legacyAudioRef.current = legacy;
      }
      const legacy = legacyAudioRef.current;
      if (legacy.paused) {
        legacy.currentTime = 0;
        legacy.play().catch(() => setIsPlaying(false));
      } else {
        legacy.pause();
      }
      return;
    }

    const audio = lessonAudioRef.current;
    if (!audio || !lesson?.fullAudioUrl || !hasUnifiedTiming) return;

    legacyAudioRef.current?.pause();
    const sameSegmentPlaying = !audio.paused && segmentEndMsRef.current === current.endMs;
    if (sameSegmentPlaying) {
      audio.pause();
      return;
    }

    segmentPlaybackRef.current = true;
    segmentEndMsRef.current = current.endMs;
    audio.currentTime = Math.max(0, current.startMs) / 1000;
    audio.play()
      .catch(() => {
        segmentEndMsRef.current = null;
        setIsPlaying(false);
      })
      .finally(() => {
        segmentPlaybackRef.current = false;
      });
  }, [current?.startMs, current?.endMs, current?.audioUrl, lesson?.fullAudioUrl]);

  const checkAnswer = useCallback(() => {
    if (!current || !answer.trim() || attemptMutation.isPending) return;
    const correct = normalizeAnswer(answer) === normalizeAnswer(current.text);
    setResult(correct ? 'correct' : 'incorrect');
    if (correct) setShowAnswer(true);
    attemptMutation.mutate({ index: currentIndex, correct });
  }, [answer, attemptMutation, current, currentIndex]);

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (typing) return;
      if (event.code === 'Space') {
        event.preventDefault();
        playCurrent();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(currentIndex - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(currentIndex + 1);
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        playCurrent();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, goTo, playCurrent]);

  useEffect(() => {
    if (autoScroll) rowRefs.current[currentIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex, autoScroll]);

  const accuracy = useMemo(() => {
    if (!progress?.attempts) return 0;
    return Math.round((progress.correctCount / progress.attempts) * 100);
  }, [progress]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      checkAnswer();
    }
  };

  if (isLoading) {
    return <div className="flex min-h-[70vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải bài Dictation...</div>;
  }
  if (isError || !lesson || !current) {
    return <div className="p-8"><div className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">Không tìm thấy bài Dictation hoặc bài chưa được publish.</div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/dictation`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /></Link>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-bold text-slate-900 sm:text-xl">{lesson.title}</h1><span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">{lesson.level}</span></div>
              <p className="mt-1 text-xs text-slate-400">{lesson.topic} · {lesson.sentenceCount} câu · Accuracy {accuracy}%</p>
            </div>
          </div>
          <div className="min-w-[220px]">
            <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-500">Tiến độ</span><span className="font-bold text-slate-700">{completedCount}/{segments.length}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} /></div>
          </div>
        </div>

        {progress?.completed && (
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5" /> Bạn đã hoàn thành bài này · Accuracy {accuracy}%</div>
            <button onClick={async () => { await dictationService.resetProgress(lesson._id); setProgress(null); goTo(0); }} className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><RotateCcw className="h-3.5 w-3.5" /> Luyện lại từ đầu</button>
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-4 pt-3">
            <button onClick={() => setTab('dictation')} className={`border-b-2 px-4 py-2 text-xs font-bold transition ${tab === 'dictation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Dictation</button>
            <button onClick={() => setTab('transcript')} className={`border-b-2 px-4 py-2 text-xs font-bold transition ${tab === 'transcript' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Full transcript</button>
          </div>

          <div className="grid min-h-[560px] lg:grid-cols-[minmax(0,1fr)_minmax(360px,.78fr)]">
            <div className="flex flex-col border-b border-slate-200 p-4 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <audio
                  ref={lessonAudioRef}
                  controls
                  src={lesson.fullAudioUrl}
                  className="h-9 w-full"
                  onPlay={() => {
                    if (!segmentPlaybackRef.current) segmentEndMsRef.current = null;
                  }}
                />
              </div>

              {tab === 'dictation' ? (
                <div className="flex flex-1 flex-col justify-center py-8">
                  <div className="mx-auto w-full max-w-2xl">
                    <div className="mb-5 text-center">
                      <button onClick={playCurrent} className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-sm transition ${isPlaying ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                        {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-1 h-6 w-6 fill-current" />}
                      </button>
                      <p className="mt-3 text-xs font-semibold text-slate-500">Câu {currentIndex + 1} / {segments.length}</p>
                      <p className="mt-1 text-[11px] text-slate-400">Nghe kỹ rồi gõ lại câu bạn nghe được.</p>
                    </div>

                    <div className="space-y-3">
                      <input
                        value={answer}
                        onChange={(e) => { setAnswer(e.target.value); if (result) setResult(null); }}
                        onKeyDown={handleInputKeyDown}
                        autoFocus
                        placeholder="Type what you hear..."
                        className={`h-12 w-full rounded-xl border bg-white px-4 text-sm outline-none transition focus:ring-2 ${result === 'correct' ? 'border-emerald-400 focus:ring-emerald-500/10' : result === 'incorrect' ? 'border-rose-400 focus:ring-rose-500/10' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'}`}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={checkAnswer} disabled={!answer.trim() || attemptMutation.isPending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><Check className="h-4 w-4" /> Check answer</button>
                        <button onClick={() => setShowAnswer(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50"><Eye className="h-4 w-4" /> Hiện đáp án</button>
                        <button onClick={playCurrent} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50"><Volume2 className="h-4 w-4" /> Nghe lại</button>
                      </div>
                    </div>

                    {result === 'correct' && <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-bold">Chính xác!</p><p className="mt-1 text-xs leading-5">{current.text}</p></div></div>}
                    {result === 'incorrect' && <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-bold">Chưa đúng, nghe lại thử nhé.</p>{showAnswer && <p className="mt-1 text-xs leading-5"><span className="font-semibold">Đáp án:</span> {current.text}</p>}</div></div>}
                    {showAnswer && !result && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><span className="font-bold">Đáp án:</span> {current.text}</div>}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col justify-center py-8">
                  <div className="mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Headphones className="h-4 w-4" /> Full transcript</div>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{lesson.sourceText}</p>
                  </div>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <button onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-xs font-bold text-slate-600">{currentIndex + 1} / {segments.length}</span>
                <button onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === segments.length - 1} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="flex min-h-0 flex-col bg-slate-50/40">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div><p className="text-xs font-bold text-slate-700">{tab === 'dictation' ? 'Danh sách câu' : 'Transcript từng câu'}</p><p className="mt-0.5 text-[11px] text-slate-400">Bấm một câu để chuyển nhanh.</p></div>
                <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500"><input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Auto scroll</label>
              </div>
              <div className="max-h-[500px] flex-1 overflow-y-auto p-2 lg:max-h-none">
                {segments.map((segment, index) => {
                  const done = completed.includes(index);
                  const active = index === currentIndex;
                  const reveal = tab === 'transcript' || done || (active && showAnswer);
                  return (
                    <button
                      key={segment._id}
                      ref={(node) => { rowRefs.current[index] = node; }}
                      onClick={() => goTo(index)}
                      className={`mb-1 flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${active ? 'border-blue-200 bg-blue-50' : 'border-transparent bg-white hover:border-slate-200'}`}
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${active ? 'border-blue-500 bg-blue-600 text-white' : done ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-300 text-slate-400'}`}>
                        {done && !active ? <Check className="h-3.5 w-3.5" /> : active && isPlaying ? <Pause className="h-3 w-3 fill-current" /> : <Play className="ml-0.5 h-3 w-3 fill-current" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sentence {index + 1}</span><span className="text-[10px] text-slate-300">{segment.voiceId}</span></div>
                        <p className={`mt-1 text-xs leading-5 ${active ? 'text-blue-900' : 'text-slate-600'}`}>{reveal ? segment.text : '••••••••••••••••••••••••'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-slate-200 bg-white px-4 py-3 text-[11px] leading-5 text-slate-400">
                <span className="font-semibold text-slate-500">Phím tắt:</span> Space / R: nghe lại · ← →: đổi câu · Ctrl + Enter: kiểm tra
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <Link href={`/${locale}/dictation`} className="inline-flex items-center gap-1.5 font-semibold hover:text-blue-600"><ArrowLeft className="h-3.5 w-3.5" /> Danh sách bài</Link>
          {currentIndex < segments.length - 1 && <button onClick={() => goTo(currentIndex + 1)} className="inline-flex items-center gap-1.5 font-bold text-blue-600">Câu tiếp theo <ArrowRight className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
    </div>
  );
}
