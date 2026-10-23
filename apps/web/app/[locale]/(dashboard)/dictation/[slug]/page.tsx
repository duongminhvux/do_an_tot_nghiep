'use client';

import { useTranslation } from 'react-i18next';

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
import { Badge, ErrorState, LoadingState, PageHeader, PageShell, Tabs, surface, tones, type Crumb } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  const { t } = useTranslation('dictation');
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

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState label={t('loading_lesson')} className="min-h-[60vh]" />
      </PageShell>
    );
  }
  if (isError || !lesson || !current) {
    return (
      <PageShell width="narrow">
        <PageHeader back={{ href: `/${locale}/dictation`, label: t('all_topics') }} title="Dictation" />
        <ErrorState message={t('lesson_not_found')} />
      </PageShell>
    );
  }

  const breadcrumbs: Crumb[] = [{ label: t('all_topics'), href: `/${locale}/dictation` }];
  if (lesson.topicInfo) breadcrumbs.push({ label: lesson.topicInfo.title, href: `/${locale}/dictation/topic/${lesson.topicInfo.slug}` });
  if (lesson.sectionInfo) breadcrumbs.push({ label: lesson.sectionInfo.title });
  breadcrumbs.push({ label: lesson.title });

  return (
    <PageShell>
      <audio ref={lessonAudioRef} src={lesson.fullAudioUrl} className="hidden" />

      <PageHeader
        breadcrumbs={breadcrumbs}
        title={lesson.title}
        description={`${lesson.level} · ${t('sentence_accuracy', { count: lesson.sentenceCount, accuracy })}`}
        actions={
          <div className="w-full min-w-64 sm:w-72">
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500">
              <span>{t('progress')}</span>
              <span>{handledCount}/{segments.length} · {percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
            </div>
          </div>
        }
      />

      <section className={cn(surface, 'overflow-hidden')}>
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 px-3">
          <Tabs
            className="border-b-0"
            value={tab}
            onChange={(next) => (next === 'dictation' ? setTab('dictation') : requestTranscript())}
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
          <div className="hidden items-center gap-3 pb-2 sm:flex">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500">
              <Settings2 className="h-3.5 w-3.5" />
              <input type="checkbox" className="accent-blue-600" checked={autoPlayNext} onChange={(e) => setAutoPlayNext(e.target.checked)} /> {t('auto_play')}
            </label>
            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(Number(e.target.value))}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
            </select>
          </div>
        </div>

        <div className="grid min-h-[590px] lg:grid-cols-[minmax(0,1.1fr)_minmax(330px,.65fr)]">
          <div className="flex flex-col border-b border-slate-200 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            {tab === 'dictation' ? (
              <div className="flex flex-1 flex-col justify-center py-6">
                <div className="mx-auto w-full max-w-2xl">
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => playCurrent()}
                      className={cn(
                        'mx-auto flex h-20 w-20 cursor-pointer items-center justify-center rounded-full text-white shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                        isPlaying ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700',
                      )}
                    >
                      {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
                    </button>
                    <p className="mt-4 text-sm font-semibold text-slate-700">{t('sentence')} {currentIndex + 1} / {segments.length}</p>
                    <p className="mt-1 text-xs text-slate-500">{t('replay_help')}</p>
                  </div>

                  <div className="mt-7 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <input
                      ref={inputRef}
                      value={answer}
                      onChange={(e) => { setAnswer(e.target.value); if (result === 'incorrect' && !showAnswer) setResult(null); }}
                      onKeyDown={handleInputKeyDown}
                      disabled={showAnswer && !currentIsCompleted}
                      autoFocus
                      placeholder={t('answer_placeholder')}
                      className={cn(
                        'h-14 w-full rounded-lg border bg-white px-4 text-base outline-none transition focus:ring-2 disabled:bg-slate-50',
                        result === 'correct'
                          ? 'border-emerald-400 focus:ring-emerald-500/20'
                          : result === 'incorrect'
                            ? 'border-red-300 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20',
                      )}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {!showAnswer && (
                        <Button onClick={checkAnswer} disabled={!answer.trim() || attemptMutation.isPending}>
                          <Check /> {t('check')}
                        </Button>
                      )}
                      {!showAnswer && (
                        <Button variant="outline" onClick={revealCurrent} disabled={revealMutation.isPending}>
                          <Eye /> {t('reveal_answer')}
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => playCurrent()}>
                        <Volume2 /> {t('replay')}
                      </Button>
                      {showAnswer && !currentIsCompleted && currentIndex < segments.length - 1 && (
                        <Button className="ml-auto" onClick={() => goTo(currentIndex + 1)}>
                          {t('next')} <ArrowRight />
                        </Button>
                      )}
                    </div>
                  </div>

                  {result === 'correct' && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">{t('correct')}</p>
                        <p className="mt-1 text-sm">{current.text}</p>
                        {currentIndex < segments.length - 1 && <p className="mt-1 text-xs text-emerald-600">{t('next_delay', { delay: autoNextDelay })}</p>}
                      </div>
                    </div>
                  )}
                  {result === 'incorrect' && !showAnswer && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">{t('incorrect')}</p>
                        <p className="mt-1 text-xs">{t('wrong_attempts', { wrong: wrongAttempts, max: maxAttempts })}</p>
                      </div>
                    </div>
                  )}
                  {showAnswer && !currentIsCompleted && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <div className="flex items-start gap-2">
                        <Eye className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-semibold">{t('answer')}</p>
                          <p className="mt-1 leading-6">{current.text}</p>
                          <p className="mt-2 text-xs text-amber-700">{t('reveal_help')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col py-5">
                <div className="mx-auto w-full max-w-3xl">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><audio controls src={lesson.fullAudioUrl} className="h-10 w-full" /></div>
                  <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><Headphones className="h-4 w-4" /> {t('transcript')}</div>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{lesson.sourceText}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-auto flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
              <Button variant="ghost" size="icon-sm" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}><ChevronLeft /></Button>
              <span className="text-xs font-semibold text-slate-600">{currentIndex + 1} / {segments.length}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === segments.length - 1}><ChevronRight /></Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-slate-50/60">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{tab === 'dictation' ? t('sentence_progress') : t('sentence_transcript')}</p>
                <p className="mt-0.5 text-xs text-slate-500">{t('jump_help')}</p>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-slate-500">
                <input type="checkbox" className="accent-blue-600" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> {t('auto_scroll')}
              </label>
            </div>
            <div className="max-h-[520px] flex-1 overflow-y-auto p-2 lg:max-h-none">
              {segments.map((segment, index) => {
                const done = completed.includes(index);
                const wasRevealed = Boolean(revealed.includes(index) || progress?.segmentProgress?.find((item) => item.segmentIndex === index)?.revealed);
                const active = index === currentIndex;
                const revealText = tab === 'transcript' || done || wasRevealed;
                return (
                  <button
                    type="button"
                    key={segment._id}
                    ref={(node) => { rowRefs.current[index] = node; }}
                    onClick={() => { goTo(index); if (tab === 'transcript') setTimeout(() => playSegmentAtIndex(index), 100); }}
                    className={cn(
                      'mb-1 flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                      active ? 'border-blue-200 bg-blue-50' : 'border-transparent bg-white hover:border-slate-200',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                        active
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : done
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                            : wasRevealed
                              ? 'border-amber-200 bg-amber-50 text-amber-600'
                              : 'border-slate-300 text-slate-400',
                      )}
                    >
                      {done && !active ? <Check className="h-3.5 w-3.5" /> : wasRevealed && !active ? <Eye className="h-3.5 w-3.5" /> : active && isPlaying ? <Pause className="h-3 w-3 fill-current" /> : <Play className="ml-0.5 h-3 w-3 fill-current" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('sentence_label')} {index + 1}</span>
                        {wasRevealed && !done && <span className="text-[11px] font-semibold uppercase text-amber-600">{t('revealed')}</span>}
                      </div>
                      <p className={cn('mt-1 text-sm leading-6', active ? 'text-blue-900' : 'text-slate-600')}>{revealText ? segment.text : '••••••••••••••••••••••••'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
              <span className="font-semibold text-slate-600">{t('shortcuts')}</span> {t('shortcuts_help')}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link
          href={lesson.topicInfo ? `/${locale}/dictation/topic/${lesson.topicInfo.slug}` : `/${locale}/dictation`}
          className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition-colors hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" /> {t('back_to_lessons')}
        </Link>
        {progress?.completed && <Badge tone="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> {t('lesson_completed')}</Badge>}
      </div>

      {showTranscriptPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tones.amber)}><AlertTriangle className="h-5 w-5" /></span>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowTranscriptPrompt(false)}><X /></Button>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{t('view_transcript_title')}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{t('transcript_help')}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTranscriptPrompt(false)}>{t('continue_practice')}</Button>
              <Button onClick={confirmTranscript} disabled={transcriptMutation.isPending}>
                {transcriptMutation.isPending ? <Loader2 className="animate-spin" /> : <Eye />} {t('view_transcript')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
