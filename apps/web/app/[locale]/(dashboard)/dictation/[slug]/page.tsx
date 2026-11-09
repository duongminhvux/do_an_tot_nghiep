'use client';

import { useTranslation } from 'react-i18next';

import Link from 'next/link';
import { KeyboardEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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
  Keyboard,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  X,
  XCircle,
} from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import type { DictationLessonDetail, DictationProgress, DictationSegment } from '@/types/dictation';
import { Badge, ErrorState, LoadingState, PageHeader, PageShell, Tabs, surface, tones, type Crumb } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];
const SEEK_STEP = 5;

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

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function hasTiming(segment?: DictationSegment): boolean {
  return !!segment && Number.isFinite(segment.startMs) && Number.isFinite(segment.endMs) && segment.endMs > segment.startMs;
}

/** Sentence being read at `ms`: the last one that has started (gaps belong to the previous sentence). */
function segmentAt(segments: DictationSegment[], ms: number) {
  let found = -1;
  for (let i = 0; i < segments.length; i++) {
    if ((segments[i]?.startMs ?? Infinity) <= ms + 1) found = i;
    else break;
  }
  return found;
}

/** Mouse clicks on player controls shouldn't steal focus, so Space keeps meaning play/pause afterwards. */
const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();

function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-slate-200 bg-white px-1 font-sans text-[11px] font-semibold text-slate-500 shadow-[0_1px_0_rgb(226_232_240)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export default function DictationPracticePage() {
  const { t } = useTranslation('dictation');
  const params = useParams();
  const requestedSegmentRaw = useSearchParams().get('segment');
  const requestedSegment = requestedSegmentRaw === null ? -1 : Number(requestedSegmentRaw);
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
  const [showShortcuts, setShowShortcuts] = useState(false);
  /** A single sentence is playing (dictation mode). */
  const [isPlaying, setIsPlaying] = useState(false);
  /** The lesson audio element is playing at all (transcript mode uses this). */
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState<DictationProgress | null>(null);

  const lessonAudioRef = useRef<HTMLAudioElement | null>(null);
  const legacyAudioRef = useRef<HTMLAudioElement | null>(null);
  const segmentEndMsRef = useRef<number | null>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sentenceRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const segments = useMemo(() => lesson?.segments || [], [lesson?.segments]);
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
  const timed = !!lesson?.fullAudioUrl && segments.length > 0 && segments.every(hasTiming);
  const transcriptIndex = timed ? segmentAt(segments, currentTime * 1000) : -1;
  const activeIndex = tab === 'transcript' ? transcriptIndex : currentIndex;

  useEffect(() => {
    if (!lesson) return;
    setProgress(lesson.progress || null);
    const nextIndex = lesson.progress?.completed
      ? 0
      : Math.min(lesson.progress?.currentSegment || 0, Math.max((lesson.segments?.length || 1) - 1, 0));
    setCurrentIndex(Number.isInteger(requestedSegment) && requestedSegment >= 0 && requestedSegment < lesson.segments.length ? requestedSegment : nextIndex);
  }, [lesson?._id, requestedSegment]);

  useEffect(() => () => {
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    legacyAudioRef.current?.pause();
  }, []);

  const updateProgressCaches = (next: DictationProgress) => {
    setProgress(next);
    queryClient.invalidateQueries({ queryKey: ['dictation-topics'] });
    queryClient.invalidateQueries({ queryKey: ['dictation-topic'] });
    queryClient.invalidateQueries({ queryKey: ['dictation-progress-overview'] });
  };

  const attemptMutation = useMutation({
    mutationFn: ({ index, correct, submittedText }: { index: number; correct: boolean; submittedText: string }) =>
      dictationService.recordAttempt(lesson._id, index, correct, submittedText),
  });
  const revealMutation = useMutation({
    mutationFn: (index: number) => dictationService.revealSegment(lesson._id, index),
  });
  const transcriptMutation = useMutation({
    mutationFn: () => dictationService.revealTranscript(lesson._id),
  });

  const stopAll = useCallback(() => {
    lessonAudioRef.current?.pause();
    legacyAudioRef.current?.pause();
    segmentEndMsRef.current = null;
  }, []);

  const goTo = useCallback((index: number) => {
    if (!segments.length) return;
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    const safe = Math.max(0, Math.min(index, segments.length - 1));
    stopAll();
    setIsPlaying(false);
    setCurrentIndex(safe);
    setAnswer('');
    setResult(null);
    const isRevealed = Boolean(progress?.revealedSegments?.includes(safe) || progress?.segmentProgress?.find((item) => item.segmentIndex === safe)?.revealed);
    setShowAnswer(isRevealed);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [segments.length, progress, stopAll]);

  // Audio element wiring: stop at the end of a sentence in dictation mode, track time for the player.
  useEffect(() => {
    const audio = lessonAudioRef.current;
    if (!audio) return;
    let frame = 0;
    const sync = () => {
      setCurrentTime(audio.currentTime);
      const endMs = segmentEndMsRef.current;
      if (endMs !== null && audio.currentTime * 1000 >= endMs) {
        audio.pause();
        segmentEndMsRef.current = null;
      }
    };
    // rAF while playing keeps the sentence highlight in step with the voice (timeupdate is ~4Hz).
    const loop = () => {
      sync();
      frame = requestAnimationFrame(loop);
    };
    const handlePlay = () => {
      setAudioPlaying(true);
      setIsPlaying(segmentEndMsRef.current !== null);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
    };
    const handlePause = () => {
      cancelAnimationFrame(frame);
      setAudioPlaying(false);
      setIsPlaying(false);
      setCurrentTime(audio.currentTime);
    };
    const handleDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    handleDuration();
    audio.addEventListener('timeupdate', sync);
    audio.addEventListener('seeked', sync);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handlePause);
    audio.addEventListener('loadedmetadata', handleDuration);
    audio.addEventListener('durationchange', handleDuration);
    return () => {
      cancelAnimationFrame(frame);
      audio.removeEventListener('timeupdate', sync);
      audio.removeEventListener('seeked', sync);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handlePause);
      audio.removeEventListener('loadedmetadata', handleDuration);
      audio.removeEventListener('durationchange', handleDuration);
    };
  }, [lesson?.fullAudioUrl]);

  useEffect(() => {
    if (lessonAudioRef.current) lessonAudioRef.current.playbackRate = playbackRate;
    if (legacyAudioRef.current) legacyAudioRef.current.playbackRate = playbackRate;
  }, [playbackRate, lesson?.fullAudioUrl]);

  const playCurrent = useCallback((track = true) => {
    if (!hasTiming(current) && current?.audioUrl) {
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
      legacy.playbackRate = playbackRate;
      if (legacy.paused) {
        legacy.currentTime = 0;
        legacy.play().catch(() => setIsPlaying(false));
      } else legacy.pause();
      if (track && lesson?._id) dictationService.recordReplay(lesson._id, currentIndex).catch(() => undefined);
      return;
    }

    const audio = lessonAudioRef.current;
    if (!audio || !lesson?.fullAudioUrl || !current || !hasTiming(current)) return;
    const timedCurrent = current;
    legacyAudioRef.current?.pause();
    const sameSegmentPlaying = !audio.paused && segmentEndMsRef.current === timedCurrent.endMs;
    if (sameSegmentPlaying) {
      audio.pause();
      return;
    }
    segmentEndMsRef.current = timedCurrent.endMs;
    audio.currentTime = Math.max(0, timedCurrent.startMs) / 1000;
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
    if (!segment || !audio || !lesson?.fullAudioUrl || !hasTiming(segment)) return;
    segmentEndMsRef.current = segment.endMs;
    audio.currentTime = segment.startMs / 1000;
    audio.playbackRate = playbackRate;
    audio.play().catch(() => undefined);
    dictationService.recordReplay(lesson._id, index).catch(() => undefined);
  }, [segments, lesson?._id, lesson?.fullAudioUrl, playbackRate]);

  // ---- Full-transcript player: continuous playback, no stop at sentence end.
  const seekTo = useCallback((seconds: number) => {
    const audio = lessonAudioRef.current;
    if (!audio) return;
    segmentEndMsRef.current = null;
    const max = Number.isFinite(audio.duration) ? audio.duration : seconds;
    audio.currentTime = Math.max(0, Math.min(seconds, max));
    setCurrentTime(audio.currentTime);
  }, []);

  const toggleFull = useCallback(() => {
    const audio = lessonAudioRef.current;
    if (!audio || !lesson?.fullAudioUrl) return;
    legacyAudioRef.current?.pause();
    segmentEndMsRef.current = null;
    if (audio.paused) {
      if (audio.ended) audio.currentTime = 0;
      audio.playbackRate = playbackRate;
      audio.play().catch(() => undefined);
    } else audio.pause();
  }, [lesson?.fullAudioUrl, playbackRate]);

  const playFromSentence = useCallback((index: number) => {
    const segment = segments[Math.max(0, Math.min(index, segments.length - 1))];
    const audio = lessonAudioRef.current;
    if (!segment || !audio || !hasTiming(segment)) return;
    seekTo(segment.startMs / 1000);
    audio.playbackRate = playbackRate;
    audio.play().catch(() => undefined);
  }, [segments, seekTo, playbackRate]);

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
      const response = await attemptMutation.mutateAsync({ index: currentIndex, correct, submittedText: answer });
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

  const revealCurrent = useCallback(async () => {
    if (!current || revealMutation.isPending || showAnswer) return;
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
  }, [current, currentIndex, playCurrent, revealMutation, showAnswer]);

  const openDictation = useCallback(() => {
    stopAll();
    setTab('dictation');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [stopAll]);

  const openTranscript = useCallback(() => {
    stopAll();
    setTab('transcript');
    // Start the full player at the sentence the learner is working on.
    const segment = segments[currentIndex];
    if (segment && hasTiming(segment) && lessonAudioRef.current) {
      lessonAudioRef.current.currentTime = segment.startMs / 1000;
      setCurrentTime(segment.startMs / 1000);
    }
  }, [currentIndex, segments, stopAll]);

  const requestTranscript = useCallback(() => {
    if (progress?.transcriptRevealed || progress?.completed) {
      openTranscript();
      return;
    }
    setShowTranscriptPrompt(true);
  }, [openTranscript, progress?.completed, progress?.transcriptRevealed]);

  const confirmTranscript = async () => {
    try {
      const response = await transcriptMutation.mutateAsync();
      const next = unwrap<DictationProgress>(response);
      updateProgressCaches(next);
    } finally {
      setShowTranscriptPrompt(false);
      openTranscript();
    }
  };

  const changeSpeed = useCallback((direction: 1 | -1) => {
    setPlaybackRate((rate) => {
      const index = SPEEDS.indexOf(rate);
      return SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (index === -1 ? 2 : index) + direction))] ?? rate;
    });
  }, []);

  const togglePlay = useCallback(() => (tab === 'transcript' ? toggleFull() : playCurrent()), [tab, toggleFull, playCurrent]);
  const stepSentence = useCallback((direction: 1 | -1) => {
    if (tab === 'transcript') playFromSentence((transcriptIndex === -1 ? 0 : transcriptIndex) + direction);
    else goTo(currentIndex + direction);
  }, [tab, transcriptIndex, currentIndex, goTo, playFromSentence]);

  // ---- Keyboard shortcuts.
  // Ctrl/⌘ combos work everywhere (also while typing an answer); single keys only outside text fields.
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (showTranscriptPrompt) {
        if (event.key === 'Escape') setShowTranscriptPrompt(false);
        return;
      }
      if (showShortcuts) {
        if (event.key === 'Escape' || event.key === '?') {
          event.preventDefault();
          setShowShortcuts(false);
        }
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target?.isContentEditable;
      // Native buttons/links already react to Space/Enter themselves (tabs don't need it: they select on click).
      const control = (tag === 'BUTTON' && target?.getAttribute('role') !== 'tab') || tag === 'A';
      const mod = event.ctrlKey || event.metaKey;

      if (mod && !event.altKey) {
        if (event.code === 'Space') {
          event.preventDefault();
          togglePlay();
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          stepSentence(event.key === 'ArrowUp' ? -1 : 1);
        } else if (event.key === '[' || event.key === ']') {
          event.preventDefault();
          changeSpeed(event.key === '[' ? -1 : 1);
        } else if (event.key === 'Enter' && event.shiftKey && tab === 'dictation') {
          event.preventDefault();
          void revealCurrent();
        }
        return;
      }
      if (typing || event.altKey) return;

      if (event.key === '?') {
        event.preventDefault();
        setShowShortcuts(true);
      } else if (event.code === 'Space' && !control) {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        stepSentence(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (tab === 'transcript' && (event.key.toLowerCase() === 'j' || event.key.toLowerCase() === 'l')) {
        event.preventDefault();
        seekTo(currentTime + (event.key.toLowerCase() === 'j' ? -SEEK_STEP : SEEK_STEP));
      } else if (tab === 'dictation' && event.key === 'Enter' && !control && showAnswer && currentIndex < segments.length - 1) {
        // The answer box is locked once the answer is shown, so Enter moves on from anywhere.
        event.preventDefault();
        goTo(currentIndex + 1);
      } else if (tab === 'dictation' && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        playCurrent();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [changeSpeed, currentIndex, currentTime, goTo, playCurrent, revealCurrent, seekTo, segments.length, showAnswer, showShortcuts, showTranscriptPrompt, stepSentence, tab, togglePlay]);

  useEffect(() => {
    if (!autoScroll || activeIndex < 0) return;
    rowRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (tab === 'transcript') sentenceRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex, autoScroll, tab]);

  const accuracy = useMemo(() => {
    if (!progress?.attempts) return 0;
    return Math.round((progress.correctCount / progress.attempts) * 100);
  }, [progress]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if (result === 'correct' && currentIndex < segments.length - 1) goTo(currentIndex + 1);
      else void checkAnswer();
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState label={t('loading_lesson')} className="min-h-[60vh]" />
      </PageShell>
    );
  }
  if (isError || !lesson || !current) {
    return (
      <PageShell>
        <PageHeader back={{ href: `/${locale}/dictation`, label: t('all_topics') }} title="Dictation" />
        <ErrorState message={t('lesson_not_found')} />
      </PageShell>
    );
  }

  const breadcrumbs: Crumb[] = [{ label: t('all_topics'), href: `/${locale}/dictation` }];
  if (lesson.topicInfo) breadcrumbs.push({ label: lesson.topicInfo.title, href: `/${locale}/dictation/topic/${lesson.topicInfo.slug}` });
  if (lesson.sectionInfo) breadcrumbs.push({ label: lesson.sectionInfo.title });
  breadcrumbs.push({ label: lesson.title });

  const sentenceProgress = hasTiming(current) && isPlaying
    ? Math.max(0, Math.min(1, (currentTime * 1000 - current.startMs) / (current.endMs - current.startMs)))
    : 0;
  const currentWasRevealed = Boolean(revealed.includes(currentIndex) || currentSegmentProgress?.revealed);
  const total = duration || (timed ? (segments[segments.length - 1]?.endMs ?? 0) / 1000 : 0);
  const playedPct = total ? Math.min(100, (currentTime / total) * 100) : 0;

  const shortcutRows: { keys: ReactNode[]; label: string; scope?: string }[] = [
    { keys: [<Kbd key="a">Space</Kbd>], label: t('sc_play') },
    { keys: [<Kbd key="a">Ctrl</Kbd>, <Kbd key="b">Space</Kbd>], label: t('sc_play_anywhere') },
    { keys: [<Kbd key="a">←</Kbd>, <Kbd key="b">→</Kbd>], label: t('sc_prev_next') },
    { keys: [<Kbd key="a">Ctrl</Kbd>, <Kbd key="b">↑</Kbd>, <Kbd key="c">↓</Kbd>], label: t('sc_prev_next_anywhere') },
    { keys: [<Kbd key="a">Enter</Kbd>], label: t('sc_check'), scope: 'Dictation' },
    { keys: [<Kbd key="a">Ctrl</Kbd>, <Kbd key="b">Shift</Kbd>, <Kbd key="c">Enter</Kbd>], label: t('sc_reveal'), scope: 'Dictation' },
    { keys: [<Kbd key="a">R</Kbd>], label: t('sc_replay'), scope: 'Dictation' },
    { keys: [<Kbd key="a">J</Kbd>, <Kbd key="b">L</Kbd>], label: t('sc_seek'), scope: t('transcript') },
    { keys: [<Kbd key="a">Ctrl</Kbd>, <Kbd key="b">[</Kbd>, <Kbd key="c">]</Kbd>], label: t('sc_speed') },
    { keys: [<Kbd key="a">?</Kbd>], label: t('sc_help') },
  ];

  return (
    <PageShell>
      <audio ref={lessonAudioRef} src={lesson.fullAudioUrl} preload="metadata" className="hidden" />

      <PageHeader
        breadcrumbs={breadcrumbs}
        title={lesson.title}
        description={`${lesson.level} · ${t('sentence_accuracy', { count: lesson.sentenceCount, accuracy })}`}
        actions={
          <div className="w-full min-w-64 sm:w-72">
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500">
              <span>{t('progress')}</span>
              <span className="tabular-nums">{handledCount}/{segments.length} · {percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-blue-600 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
            </div>
          </div>
        }
      />

      <section className={cn(surface, 'overflow-hidden')}>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-3">
          <Tabs
            className="border-b-0"
            value={tab}
            onChange={(next) => (next === 'dictation' ? openDictation() : requestTranscript())}
            items={[
              { value: 'dictation', label: 'Dictation' },
              {
                value: 'transcript',
                label: (
                  <>
                    {t('transcript')} {progress?.transcriptRevealed && <span className="ml-1 font-medium text-amber-600">{t('viewed')}</span>}
                  </>
                ),
              },
            ]}
          />
          <div className="flex items-center gap-2 pb-2">
            {tab === 'dictation' && (
              <label className="hidden cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:flex">
                <input type="checkbox" className="size-3.5 accent-blue-600" checked={autoPlayNext} onChange={(e) => setAutoPlayNext(e.target.checked)} /> {t('auto_play')}
              </label>
            )}
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="sr-only sm:not-sr-only">{t('speed')}</span>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold tabular-nums text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}x</option>)}
              </select>
            </label>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-slate-600" onClick={() => setShowShortcuts(true)} aria-keyshortcuts="?">
              <Keyboard className="size-4" />
              <span className="hidden md:inline">{t('shortcuts_title')}</span>
            </Button>
          </div>
        </div>

        <div className="grid min-h-[560px] lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.62fr)]">
          <div className="flex min-w-0 flex-col border-b border-slate-200 p-4 sm:p-6 lg:border-b-0 lg:border-r">
            {tab === 'dictation' ? (
              <>
                <div className="flex flex-1 flex-col justify-center py-4">
                  <div className="mx-auto w-full max-w-2xl">
                    <div className="flex flex-col items-center text-center">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tabular-nums text-slate-600">
                          {t('sentence')} {currentIndex + 1} / {segments.length}
                        </span>
                        {currentIsCompleted && <Badge tone="emerald"><Check className="size-3.5" /> {t('status_done')}</Badge>}
                        {!currentIsCompleted && currentWasRevealed && <Badge tone="amber"><Eye className="size-3.5" /> {t('revealed')}</Badge>}
                      </div>
                      <div className="relative mt-6">
                        {isPlaying && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-blue-400/30 motion-reduce:hidden" />}
                        <button
                          type="button"
                          onMouseDown={keepFocus}
                          onClick={() => playCurrent()}
                          aria-label={isPlaying ? t('pause') : t('play')}
                          aria-keyshortcuts="Space Control+Space"
                          className={cn(
                            'relative flex size-20 cursor-pointer items-center justify-center rounded-full text-white shadow-lg shadow-blue-600/25 transition-[transform,background-color] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 active:scale-95 motion-reduce:transition-none',
                            isPlaying ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700',
                          )}
                        >
                          {isPlaying ? <Pause className="size-7 fill-current" /> : <Play className="ml-1 size-7 fill-current" />}
                        </button>
                      </div>
                      <div className="mt-5 h-1 w-40 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${sentenceProgress * 100}%` }} />
                      </div>
                      <p className="mt-3 max-w-md text-xs leading-5 text-slate-500">{t('replay_help')}</p>
                    </div>

                    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                      <label htmlFor="dictation-answer" className="sr-only">{t('answer_placeholder')}</label>
                      <input
                        id="dictation-answer"
                        ref={inputRef}
                        value={answer}
                        onChange={(e) => { setAnswer(e.target.value); if (result === 'incorrect' && !showAnswer) setResult(null); }}
                        onKeyDown={handleInputKeyDown}
                        disabled={showAnswer && !currentIsCompleted}
                        autoFocus
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder={t('answer_placeholder')}
                        className={cn(
                          'h-14 w-full rounded-lg border bg-white px-4 text-base text-slate-900 outline-none transition focus:ring-4 disabled:bg-slate-100 disabled:text-slate-500',
                          result === 'correct'
                            ? 'border-emerald-400 focus:ring-emerald-500/15'
                            : result === 'incorrect'
                              ? 'border-red-300 focus:ring-red-500/15'
                              : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/15',
                        )}
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!showAnswer && (
                          <Button onClick={() => void checkAnswer()} disabled={!answer.trim() || attemptMutation.isPending} aria-keyshortcuts="Enter">
                            {attemptMutation.isPending ? <Loader2 className="animate-spin" /> : <Check />} {t('check')}
                            <Kbd className="ml-1 hidden border-white/30 bg-white/15 text-white shadow-none sm:inline-flex">Enter</Kbd>
                          </Button>
                        )}
                        {!showAnswer && (
                          <Button variant="outline" onClick={() => void revealCurrent()} disabled={revealMutation.isPending} aria-keyshortcuts="Control+Shift+Enter">
                            <Eye /> {t('reveal_answer')}
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => playCurrent()} aria-keyshortcuts="Control+Space">
                          <Volume2 /> {t('replay')}
                          <Kbd className="ml-1 hidden sm:inline-flex">Ctrl Space</Kbd>
                        </Button>
                        {showAnswer && currentIndex < segments.length - 1 && (
                          <Button className="ml-auto" onClick={() => goTo(currentIndex + 1)} aria-keyshortcuts="Enter">
                            {t('next')} <ArrowRight />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div aria-live="polite">
                      {result === 'correct' && (
                        <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                          <div>
                            <p className="font-semibold">{t('correct')}</p>
                            <p className="mt-1 leading-6 text-emerald-900">{current.text}</p>
                            {currentIndex < segments.length - 1 && <p className="mt-1 text-xs text-emerald-700">{t('next_delay', { seconds: (autoNextDelay / 1000).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN') })}</p>}
                          </div>
                        </div>
                      )}
                      {result === 'incorrect' && !showAnswer && (
                        <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                          <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
                          <div>
                            <p className="font-semibold">{t('incorrect')}</p>
                            <p className="mt-1 text-xs text-red-700">{t('wrong_attempts', { wrong: wrongAttempts, max: maxAttempts })}</p>
                          </div>
                        </div>
                      )}
                      {showAnswer && result !== 'correct' && (
                        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          <Eye className="mt-0.5 size-5 shrink-0 text-amber-600" />
                          <div>
                            <p className="font-semibold">{t('answer')}</p>
                            <p className="mt-1 leading-6">{current.text}</p>
                            {!currentIsCompleted && <p className="mt-2 text-xs text-amber-700">{t('reveal_help')}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-2 py-1.5">
                  <Button variant="ghost" size="sm" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} aria-keyshortcuts="ArrowLeft">
                    <ChevronLeft /> <span className="hidden sm:inline">{t('prev_sentence')}</span>
                  </Button>
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    {segments.length <= 24
                      ? segments.map((segment, index) => (
                          <span
                            key={segment._id}
                            className={cn(
                              'h-1.5 rounded-full transition-all motion-reduce:transition-none',
                              index === currentIndex ? 'w-5 bg-blue-600' : completed.includes(index) ? 'w-1.5 bg-emerald-400' : revealed.includes(index) ? 'w-1.5 bg-amber-400' : 'w-1.5 bg-slate-300',
                            )}
                          />
                        ))
                      : <span className="text-xs font-semibold tabular-nums text-slate-600">{currentIndex + 1} / {segments.length}</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === segments.length - 1} aria-keyshortcuts="ArrowRight">
                    <span className="hidden sm:inline">{t('next_sentence')}</span> <ChevronRight />
                  </Button>
                </div>
              </>
            ) : (
              <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
                {lesson.fullAudioUrl && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="icon" onMouseDown={keepFocus} onClick={() => stepSentence(-1)} disabled={!timed} aria-label={t('prev_sentence')} title={t('prev_sentence')}>
                        <SkipBack className="fill-current" />
                      </Button>
                      <button
                        type="button"
                        onMouseDown={keepFocus}
                        onClick={toggleFull}
                        aria-label={audioPlaying ? t('pause') : t('play')}
                        aria-keyshortcuts="Space Control+Space"
                        className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/25 transition-[transform,background-color] hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 active:scale-95 motion-reduce:transition-none"
                      >
                        {audioPlaying ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
                      </button>
                      <Button variant="ghost" size="icon" onMouseDown={keepFocus} onClick={() => stepSentence(1)} disabled={!timed} aria-label={t('next_sentence')} title={t('next_sentence')}>
                        <SkipForward className="fill-current" />
                      </Button>
                      <div className="ml-1 min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {transcriptIndex >= 0 ? t('now_playing', { index: transcriptIndex + 1, total: segments.length }) : lesson.title}
                        </p>
                        <p className="text-xs tabular-nums text-slate-500">
                          {formatTime(currentTime)} / {formatTime(total)}
                        </p>
                      </div>
                    </div>
                    <div className="relative mt-4 h-5">
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-blue-600" style={{ width: `${playedPct}%` }} />
                      </div>
                      {timed && total > 0 && segments.slice(1).map((segment) => (
                        <span
                          key={segment._id}
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-white"
                          style={{ left: `${Math.min(100, (segment.startMs / 1000 / total) * 100)}%` }}
                        />
                      ))}
                      <input
                        type="range"
                        min={0}
                        max={total || 0}
                        step={0.1}
                        value={Math.min(currentTime, total || 0)}
                        onChange={(e) => seekTo(Number(e.target.value))}
                        aria-label={t('seek_label')}
                        aria-valuetext={`${formatTime(currentTime)} / ${formatTime(total)}`}
                        className="dictation-seek absolute inset-0 h-5 w-full cursor-pointer appearance-none bg-transparent"
                      />
                    </div>
                  </div>
                )}

                <article className="flex-1 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Headphones className="size-4" /> {t('transcript')}
                    </h2>
                    {timed && <p className="text-xs text-slate-400">{t('transcript_hint')}</p>}
                  </div>
                  {timed ? (
                    <p className="mt-4 text-[17px] leading-9 text-slate-500">
                      {segments.map((segment, index) => {
                        const active = index === transcriptIndex;
                        return (
                          <span key={segment._id}>
                            <span
                              ref={(node) => { sentenceRefs.current[index] = node; }}
                              role="button"
                              tabIndex={0}
                              aria-current={active ? 'true' : undefined}
                              onMouseDown={keepFocus}
                              onClick={() => playFromSentence(index)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  playFromSentence(index);
                                }
                              }}
                              className={cn(
                                'cursor-pointer rounded-md px-1 py-0.5 outline-none transition-colors [box-decoration-break:clone] [-webkit-box-decoration-break:clone] focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none',
                                active
                                  ? 'bg-blue-100 text-slate-900'
                                  : index < transcriptIndex
                                    ? 'text-slate-700 hover:bg-slate-100'
                                    : 'hover:bg-slate-100 hover:text-slate-700',
                              )}
                            >
                              {segment.text}
                            </span>{' '}
                          </span>
                        );
                      })}
                    </p>
                  ) : (
                    <>
                      <p className="mt-4 whitespace-pre-wrap text-[17px] leading-9 text-slate-700">{lesson.sourceText}</p>
                      <p className="mt-4 text-xs text-slate-400">{t('no_timing')}</p>
                    </>
                  )}
                </article>
              </div>
            )}
          </div>

          <aside className="flex min-h-0 flex-col bg-slate-50/60">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{tab === 'dictation' ? t('sentence_progress') : t('sentence_transcript')}</p>
                <p className="mt-0.5 text-xs text-slate-500">{tab === 'dictation' ? t('jump_help') : t('jump_help_transcript')}</p>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-slate-500">
                <input type="checkbox" className="size-3.5 accent-blue-600" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> {t('auto_scroll')}
              </label>
            </div>
            <div className="max-h-[480px] flex-1 overflow-y-auto p-2 lg:max-h-[620px]">
              {segments.map((segment, index) => {
                const done = completed.includes(index);
                const wasRevealed = Boolean(revealed.includes(index) || progress?.segmentProgress?.find((item) => item.segmentIndex === index)?.revealed);
                const active = index === activeIndex;
                const revealText = tab === 'transcript' || done || wasRevealed;
                const playingHere = active && (tab === 'transcript' ? audioPlaying : isPlaying);
                return (
                  <button
                    type="button"
                    key={segment._id}
                    ref={(node) => { rowRefs.current[index] = node; }}
                    aria-current={active ? 'true' : undefined}
                    onMouseDown={keepFocus}
                    onClick={() => (tab === 'transcript' ? playFromSentence(index) : goTo(index))}
                    className={cn(
                      'mb-1 flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none',
                      active ? 'border-blue-200 bg-blue-50' : 'border-transparent bg-white hover:border-slate-200',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border',
                        active
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : done
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                            : wasRevealed
                              ? 'border-amber-200 bg-amber-50 text-amber-600'
                              : 'border-slate-300 text-slate-400',
                      )}
                    >
                      {done && !active ? <Check className="size-3.5" /> : wasRevealed && !active ? <Eye className="size-3.5" /> : playingHere ? <Pause className="size-3 fill-current" /> : <Play className="ml-0.5 size-3 fill-current" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('sentence_label')} {index + 1}</span>
                        {tab === 'transcript' && hasTiming(segment) && (
                          <span className="text-[11px] tabular-nums text-slate-400">{formatTime(segment.startMs / 1000)}</span>
                        )}
                        {tab === 'dictation' && wasRevealed && !done && <span className="text-[11px] font-semibold uppercase text-amber-600">{t('revealed')}</span>}
                      </div>
                      <p className={cn('mt-1 text-sm leading-6', active ? 'text-blue-900' : revealText ? 'text-slate-600' : 'tracking-widest text-slate-300')}>
                        {revealText ? segment.text : '••••••••••••••••••••'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><Kbd>Space</Kbd> {t('sc_short_play')}</span>
              <span className="inline-flex items-center gap-1"><Kbd>←</Kbd><Kbd>→</Kbd> {t('sc_short_nav')}</span>
              {tab === 'transcript'
                ? <span className="inline-flex items-center gap-1"><Kbd>J</Kbd><Kbd>L</Kbd> ±{SEEK_STEP}s</span>
                : <span className="inline-flex items-center gap-1"><Kbd>Enter</Kbd> {t('sc_short_check')}</span>}
              <button type="button" onClick={() => setShowShortcuts(true)} className="ml-auto inline-flex items-center gap-1 font-medium text-blue-600 hover:underline">
                <Kbd>?</Kbd> {t('shortcuts_more')}
              </button>
            </div>
          </aside>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link
          href={lesson.topicInfo ? `/${locale}/dictation/topic/${lesson.topicInfo.slug}` : `/${locale}/dictation`}
          className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition-colors hover:text-blue-600"
        >
          <ArrowLeft className="size-4" /> {t('back_to_lessons')}
        </Link>
        {progress?.completed && <Badge tone="emerald"><CheckCircle2 className="size-3.5" /> {t('lesson_completed')}</Badge>}
      </div>

      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setShowShortcuts(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dictation-shortcuts-title"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="dictation-shortcuts-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Keyboard className="size-5 text-blue-600" /> {t('shortcuts_title')}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{t('shortcuts_intro')}</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowShortcuts(false)} aria-label={t('close')} autoFocus><X /></Button>
            </div>
            <dl className="mt-5 divide-y divide-slate-100">
              {shortcutRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-sm text-slate-700">
                    {row.label}
                    {row.scope && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">{row.scope}</span>}
                  </dt>
                  <dd className="flex shrink-0 items-center gap-1">{row.keys}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {showTranscriptPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="dictation-transcript-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <span className={cn('flex size-10 items-center justify-center rounded-lg', tones.amber)}><AlertTriangle className="size-5" /></span>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowTranscriptPrompt(false)} aria-label={t('close')}><X /></Button>
            </div>
            <h3 id="dictation-transcript-title" className="mt-4 text-lg font-semibold text-slate-900">{t('view_transcript_title')}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{t('transcript_help')}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTranscriptPrompt(false)}>{t('continue_practice')}</Button>
              <Button onClick={confirmTranscript} disabled={transcriptMutation.isPending} autoFocus>
                {transcriptMutation.isPending ? <Loader2 className="animate-spin" /> : <Eye />} {t('view_transcript')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
