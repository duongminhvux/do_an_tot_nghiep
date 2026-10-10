'use client';

import Link from 'next/link';
import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
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
  Settings2,
  Volume2,
  X,
  XCircle,
} from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import type { DictationLessonDetail, DictationProgress } from '@/types/dictation';

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
  const [showTranscriptPrompt, setShowTranscriptPrompt] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState<DictationProgress | null>(null);

  const lessonAudioRef = useRef<HTMLAudioElement | null>(null);
  const legacyAudioRef = useRef<HTMLAudioElement | null>(null);
  const segmentEndMsRef = useRef<number | null>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const segments = lesson?.segments || [];
  const current = segments[currentIndex];
  const completed = progress?.completedSegments || [];
  const revealed = progress?.revealedSegments || [];
  const currentSegmentProgress = progress?.segmentProgress?.find((item) => item.segmentIndex === currentIndex);
  const maxAttempts = lesson?.practiceSettings?.maxAttemptsBeforeReveal || 3;
  const autoNextDelay = lesson?.practiceSettings?.autoNextDelayMs ?? 700;
  const wrongAttempts = currentSegmentProgress?.wrongAttempts || 0;
  const currentIsCompleted = completed.includes(currentIndex);
  const handledCount = new Set([...(completed || []), ...(revealed || [])]).size;
  const percent = segments.length ? Math.round((handledCount / segments.length) * 100) : 0;

  useEffect(() => {
    if (!lesson) return;
    setProgress(lesson.progress || null);
    const nextIndex = lesson.progress?.completed
      ? 0
      : Math.min(lesson.progress?.currentSegment || 0, Math.max((lesson.segments?.length || 1) - 1, 0));
    setCurrentIndex(nextIndex);
  }, [lesson?._id]);

  useEffect(() => () => {
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
  }, []);

  const updateProgressCaches = (next: DictationProgress) => {
    setProgress(next);
    queryClient.invalidateQueries({ queryKey: ['dictation-topics'] });
    queryClient.invalidateQueries({ queryKey: ['dictation-topic'] });
    queryClient.invalidateQueries({ queryKey: ['dictation-progress-overview'] });
  };

  const attemptMutation = useMutation({
    mutationFn: ({ index, correct }: { index: number; correct: boolean }) =>
      dictationService.recordAttempt(lesson._id, index, correct),
  });
  const revealMutation = useMutation({
    mutationFn: (index: number) => dictationService.revealSegment(lesson._id, index),
  });
  const transcriptMutation = useMutation({
    mutationFn: () => dictationService.revealTranscript(lesson._id),
  });

  const goTo = useCallback((index: number) => {
    if (!segments.length) return;
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    const safe = Math.max(0, Math.min(index, segments.length - 1));
    lessonAudioRef.current?.pause();
    legacyAudioRef.current?.pause();
    segmentEndMsRef.current = null;
    setIsPlaying(false);
    setCurrentIndex(safe);
    setAnswer('');
    setResult(null);
    const isRevealed = Boolean(progress?.revealedSegments?.includes(safe) || progress?.segmentProgress?.find((item) => item.segmentIndex === safe)?.revealed);
    setShowAnswer(isRevealed);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [segments.length, progress]);

  useEffect(() => {
    const audio = lessonAudioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;

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
  }, [lesson?.fullAudioUrl, playbackRate]);

  const playCurrent = useCallback((track = true) => {
    const hasUnifiedTiming = current?.startMs !== undefined && current?.endMs !== undefined && current.endMs > current.startMs;
    if (!hasUnifiedTiming && current?.audioUrl) {
      lessonAudioRef.current?.pause();
      if (!legacyAudioRef.current || legacyAudioRef.current.src !== current.audioUrl) {
        legacyAudioRef.current?.pause();
        const legacy = new Audio(current.audioUrl);
        legacy.playbackRate = playbackRate;
        legacy.addEventListener('play', () => setIsPlaying(true));
        legacy.addEventListener('pause', () => setIsPlaying(false));
        legacy.addEventListener('ended', () => setIsPlaying(false));
        legacyAudioRef.current = legacy;
      }
      const legacy = legacyAudioRef.current;
      if (legacy.paused) {
        legacy.currentTime = 0;
        legacy.play().catch(() => setIsPlaying(false));
      } else legacy.pause();
      if (track && lesson?._id) dictationService.recordReplay(lesson._id, currentIndex).catch(() => undefined);
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
    segmentEndMsRef.current = current.endMs;
    audio.currentTime = Math.max(0, current.startMs) / 1000;
    audio.playbackRate = playbackRate;
    audio.play().catch(() => {
      segmentEndMsRef.current = null;
      setIsPlaying(false);
    });
    if (track) dictationService.recordReplay(lesson._id, currentIndex).catch(() => undefined);
  }, [current, currentIndex, lesson?._id, lesson?.fullAudioUrl, playbackRate]);

  const playSegmentAtIndex = useCallback((index: number) => {
    const segment = segments[index];
    const audio = lessonAudioRef.current;
    if (!segment || !audio || !lesson?.fullAudioUrl || segment.endMs <= segment.startMs) return;
    segmentEndMsRef.current = segment.endMs;
    audio.currentTime = segment.startMs / 1000;
    audio.playbackRate = playbackRate;
    audio.play().catch(() => undefined);
    dictationService.recordReplay(lesson._id, index).catch(() => undefined);
  }, [segments, lesson?._id, lesson?.fullAudioUrl, playbackRate]);

  const scheduleNext = useCallback((fromIndex: number) => {
    if (fromIndex >= segments.length - 1) return;
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    autoNextTimerRef.current = setTimeout(() => {
      goTo(fromIndex + 1);
      if (autoPlayNext) setTimeout(() => playSegmentAtIndex(fromIndex + 1), 160);
    }, autoNextDelay);
  }, [segments.length, autoNextDelay, autoPlayNext, goTo, playSegmentAtIndex]);

  const checkAnswer = useCallback(async () => {
    if (!current || !answer.trim() || attemptMutation.isPending || showAnswer) return;
    const correct = normalizeAnswer(answer) === normalizeAnswer(current.text);
    setResult(correct ? 'correct' : 'incorrect');
    try {
      const response = await attemptMutation.mutateAsync({ index: currentIndex, correct });
      const next = unwrap<DictationProgress>(response);
      updateProgressCaches(next);
      const state = next.segmentProgress?.find((item) => item.segmentIndex === currentIndex);
      if (correct) {
        setShowAnswer(true);
        scheduleNext(currentIndex);
      } else if (state?.revealed || next.revealedSegments?.includes(currentIndex)) {
        setShowAnswer(true);
        setTimeout(() => playCurrent(false), 180);
      } else {
        setTimeout(() => playCurrent(false), 180);
      }
    } catch {
      // keep local result; API error state is intentionally non-blocking for playback
    }
  }, [answer, attemptMutation, current, currentIndex, playCurrent, scheduleNext, showAnswer]);

  const revealCurrent = async () => {
    if (!current || revealMutation.isPending) return;
    try {
      const response = await revealMutation.mutateAsync(currentIndex);
      const next = unwrap<DictationProgress>(response);
      updateProgressCaches(next);
      setShowAnswer(true);
      setResult('incorrect');
      setTimeout(() => playCurrent(false), 180);
    } catch {
      // no-op
    }
  };

  const requestTranscript = () => {
    if (progress?.transcriptRevealed || progress?.completed) {
      lessonAudioRef.current?.pause();
      legacyAudioRef.current?.pause();
      setTab('transcript');
      return;
    }
    setShowTranscriptPrompt(true);
  };

  const confirmTranscript = async () => {
    try {
      const response = await transcriptMutation.mutateAsync();
      const next = unwrap<DictationProgress>(response);
      updateProgressCaches(next);
    } finally {
      lessonAudioRef.current?.pause();
      legacyAudioRef.current?.pause();
      setShowTranscriptPrompt(false);
      setTab('transcript');
    }
  };

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (typing) return;
      if (event.code === 'Space' || event.key.toLowerCase() === 'r') {
        event.preventDefault();
        playCurrent();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(currentIndex - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(currentIndex + 1);
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
    if (event.key === 'Enter') {
      event.preventDefault();
      checkAnswer();
    }
  };

  if (isLoading) return <div className="flex min-h-[70vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải bài Dictation...</div>;
  if (isError || !lesson || !current) return <div className="p-8"><div className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">Không tìm thấy bài Dictation hoặc bài chưa có segment hợp lệ.</div></div>;

  return (
    <div className="min-h-screen bg-slate-50/40 p-4 sm:p-6 lg:p-8">
      <audio ref={lessonAudioRef} src={lesson.fullAudioUrl} className="hidden" />
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Link href={`/${locale}/dictation`} className="font-semibold text-blue-600 hover:underline">Tất cả Topic</Link>
          {lesson.topicInfo && <><span>/</span><Link href={`/${locale}/dictation/topic/${lesson.topicInfo.slug}`} className="font-semibold text-blue-600 hover:underline">{lesson.topicInfo.title}</Link></>}
          {lesson.sectionInfo && <><span>/</span><span>{lesson.sectionInfo.title}</span></>}
          <span>/</span><span>{lesson.title}</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-xl font-bold text-slate-900">{lesson.title}</h1><p className="mt-1 text-xs text-slate-500">{lesson.level} · {lesson.sentenceCount} câu · Accuracy {accuracy}%</p></div>
          <div className="min-w-64"><div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-500"><span>Tiến độ</span><span>{handledCount}/{segments.length} · {percent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} /></div></div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 pt-2">
            <div className="flex">
              <button onClick={() => setTab('dictation')} className={`border-b-2 px-4 py-2 text-xs font-bold ${tab === 'dictation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Dictation</button>
              <button onClick={requestTranscript} className={`border-b-2 px-4 py-2 text-xs font-bold ${tab === 'transcript' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Full transcript {progress?.transcriptRevealed && <span className="ml-1 text-amber-500">• viewed</span>}</button>
            </div>
            <div className="hidden items-center gap-3 pb-2 sm:flex">
              <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500"><Settings2 className="h-3.5 w-3.5" /><input type="checkbox" checked={autoPlayNext} onChange={(e) => setAutoPlayNext(e.target.checked)} /> Auto-play câu sau</label>
              <select value={playbackRate} onChange={(e) => setPlaybackRate(Number(e.target.value))} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-600"><option value={0.75}>0.75x</option><option value={1}>1x</option><option value={1.25}>1.25x</option></select>
            </div>
          </div>

          <div className="grid min-h-[590px] lg:grid-cols-[minmax(0,1.1fr)_minmax(330px,.65fr)]">
            <div className="flex flex-col border-b border-slate-200 p-4 sm:p-6 lg:border-b-0 lg:border-r">
              {tab === 'dictation' ? (
                <div className="flex flex-1 flex-col justify-center py-6">
                  <div className="mx-auto w-full max-w-2xl">
                    <div className="text-center">
                      <button onClick={() => playCurrent()} className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition ${isPlaying ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white hover:scale-[1.02] hover:bg-blue-700'}`}>{isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}</button>
                      <p className="mt-4 text-sm font-bold text-slate-700">Câu {currentIndex + 1} / {segments.length}</p>
                      <p className="mt-1 text-xs text-slate-400">Nghe lại bao nhiêu lần tùy ý. Attempts chỉ tăng khi bạn kiểm tra đáp án.</p>
                    </div>

                    <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                      <input ref={inputRef} value={answer} onChange={(e) => { setAnswer(e.target.value); if (result === 'incorrect' && !showAnswer) setResult(null); }} onKeyDown={handleInputKeyDown} disabled={showAnswer && !currentIsCompleted} autoFocus placeholder="Type what you hear..." className={`h-14 w-full rounded-xl border bg-white px-4 text-base outline-none transition focus:ring-2 disabled:bg-slate-50 ${result === 'correct' ? 'border-emerald-400 focus:ring-emerald-500/10' : result === 'incorrect' ? 'border-rose-300 focus:ring-rose-500/10' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'}`} />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!showAnswer && <button onClick={checkAnswer} disabled={!answer.trim() || attemptMutation.isPending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><Check className="h-4 w-4" /> Check</button>}
                        {!showAnswer && <button onClick={revealCurrent} disabled={revealMutation.isPending} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-white"><Eye className="h-4 w-4" /> Hiện đáp án</button>}
                        <button onClick={() => playCurrent()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-white"><Volume2 className="h-4 w-4" /> Nghe lại</button>
                        {showAnswer && !currentIsCompleted && currentIndex < segments.length - 1 && <button onClick={() => goTo(currentIndex + 1)} className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800">Next <ArrowRight className="h-4 w-4" /></button>}
                      </div>
                    </div>

                    {result === 'correct' && <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-bold">Chính xác!</p><p className="mt-1 text-xs leading-5">{current.text}</p>{currentIndex < segments.length - 1 && <p className="mt-1 text-[11px] text-emerald-600">Tự chuyển câu sau trong {autoNextDelay}ms.</p>}</div></div>}
                    {result === 'incorrect' && !showAnswer && <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-bold">Chưa đúng, audio sẽ phát lại.</p><p className="mt-1 text-xs">Sai {wrongAttempts}/{maxAttempts} lần. Đủ {maxAttempts} lần hệ thống sẽ hiện đáp án.</p></div></div>}
                    {showAnswer && !currentIsCompleted && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex items-start gap-2"><Eye className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-bold">Đáp án</p><p className="mt-1 leading-6">{current.text}</p><p className="mt-2 text-xs text-amber-700">Nghe lại một lần rồi tự bấm Next khi bạn đã sẵn sàng.</p></div></div></div>}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col py-5">
                  <div className="mx-auto w-full max-w-3xl">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><audio controls src={lesson.fullAudioUrl} className="h-10 w-full" /></div>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Headphones className="h-4 w-4" /> Full transcript</div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{lesson.sourceText}</p></div>
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
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><p className="text-xs font-bold text-slate-700">{tab === 'dictation' ? 'Tiến độ từng câu' : 'Transcript từng câu'}</p><p className="mt-0.5 text-[11px] text-slate-400">Bấm một câu để chuyển nhanh.</p></div><label className="flex items-center gap-2 text-[11px] font-medium text-slate-500"><input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Auto scroll</label></div>
              <div className="max-h-[520px] flex-1 overflow-y-auto p-2 lg:max-h-none">
                {segments.map((segment, index) => {
                  const done = completed.includes(index);
                  const wasRevealed = Boolean(revealed.includes(index) || progress?.segmentProgress?.find((item) => item.segmentIndex === index)?.revealed);
                  const active = index === currentIndex;
                  const revealText = tab === 'transcript' || done || wasRevealed;
                  return <button key={segment._id} ref={(node) => { rowRefs.current[index] = node; }} onClick={() => { goTo(index); if (tab === 'transcript') setTimeout(() => playSegmentAtIndex(index), 100); }} className={`mb-1 flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${active ? 'border-blue-200 bg-blue-50' : 'border-transparent bg-white hover:border-slate-200'}`}>
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${active ? 'border-blue-500 bg-blue-600 text-white' : done ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : wasRevealed ? 'border-amber-200 bg-amber-50 text-amber-600' : 'border-slate-300 text-slate-400'}`}>{done && !active ? <Check className="h-3.5 w-3.5" /> : wasRevealed && !active ? <Eye className="h-3.5 w-3.5" /> : active && isPlaying ? <Pause className="h-3 w-3 fill-current" /> : <Play className="ml-0.5 h-3 w-3 fill-current" />}</span>
                    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sentence {index + 1}</span>{wasRevealed && !done && <span className="text-[9px] font-bold uppercase text-amber-500">revealed</span>}</div><p className={`mt-1 text-xs leading-5 ${active ? 'text-blue-900' : 'text-slate-600'}`}>{revealText ? segment.text : '••••••••••••••••••••••••'}</p></div>
                  </button>;
                })}
              </div>
              <div className="border-t border-slate-200 bg-white px-4 py-3 text-[11px] leading-5 text-slate-400"><span className="font-semibold text-slate-500">Phím tắt:</span> Space / R: nghe lại · ← →: đổi câu · Enter: kiểm tra khi đang gõ</div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between text-xs text-slate-400"><Link href={lesson.topicInfo ? `/${locale}/dictation/topic/${lesson.topicInfo.slug}` : `/${locale}/dictation`} className="inline-flex items-center gap-1.5 font-semibold hover:text-blue-600"><ArrowLeft className="h-3.5 w-3.5" /> Quay lại danh sách Lesson</Link>{progress?.completed && <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Đã hoàn thành bài</span>}</div>
      </div>

      {showTranscriptPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle className="h-5 w-5" /></div><button onClick={() => setShowTranscriptPrompt(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Xem Full transcript?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Đây là web luyện kỹ năng nên bạn vẫn có thể xem đáp án bất cứ lúc nào. Hệ thống chỉ ghi nhận rằng transcript đã được mở để thống kê tiến độ học chính xác hơn.</p>
            <div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowTranscriptPrompt(false)} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">Tiếp tục luyện</button><button onClick={confirmTranscript} disabled={transcriptMutation.isPending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50">{transcriptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Xem transcript</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
