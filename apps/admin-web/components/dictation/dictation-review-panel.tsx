'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Headphones,
  Keyboard,
  Pause,
  Play,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import type { DictationLesson } from '@/types/dictation';

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

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600 shadow-[0_1px_0_rgb(226_232_240)]">
      {children}
    </kbd>
  );
}

function ShortcutRow({ keys, label, scope }: { keys: string[]; label: string; scope?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white/70 px-3 py-2">
      <span className="text-slate-600">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((key) => <Kbd key={key}>{key}</Kbd>)}
        {scope && <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{scope}</span>}
      </span>
    </div>
  );
}

export function DictationReviewPanel({ lesson }: { lesson: DictationLesson }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [modLabel, setModLabel] = useState('Ctrl');

  const segments = useMemo(() => lesson.segments || [], [lesson.segments]);
  const current = segments[currentIndex];
  const progress = segments.length ? Math.round(((currentIndex + 1) / segments.length) * 100) : 0;

  const stop = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const togglePlay = () => {
    void playCurrent();
  };

  const stepSentence = (direction: -1 | 1) => {
    goTo(currentIndex + direction);
  };

  const changeSpeed = (direction: -1 | 1) => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5];
    const index = speeds.indexOf(playbackRate);
    const next = speeds[Math.max(0, Math.min(speeds.length - 1, index + direction))] || 1;
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const seek = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, seconds);
    setCurrentTime(audioRef.current.currentTime);
  };

  const goTo = (index: number) => {
    if (!segments.length) return;
    stop();
    setCurrentIndex(Math.max(0, Math.min(index, segments.length - 1)));
    setAnswer('');
    setResult(null);
    setShowAnswer(false);
    setCurrentTime(0);
  };

  const playCurrent = async () => {
    if (!current || !audioRef.current) return;
    if (isPlaying) {
      stop();
      return;
    }
    audioRef.current.currentTime = Math.max(0, current.startMs / 1000);
    setCurrentTime(audioRef.current.currentTime);
    try {
      audioRef.current.playbackRate = playbackRate;
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const checkAnswer = () => {
    if (!current || !answer.trim()) return;
    setResult(normalizeAnswer(answer) === normalizeAnswer(current.text) ? 'correct' : 'incorrect');
  };

  useEffect(() => {
    setModLabel(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl');
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.currentTime >= current.endMs / 1000) stop();
    };
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [current]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTextControl = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
      const mod = event.ctrlKey || event.metaKey;
      if (event.key === 'Escape' && showShortcuts) {
        event.preventDefault();
        setShowShortcuts(false);
      } else if (event.key === '?' && !isTextControl) {
        event.preventDefault();
        setShowShortcuts((value) => !value);
      } else if (mod && !event.altKey && event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      } else if (mod && !event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        stepSentence(event.key === 'ArrowUp' ? -1 : 1);
      } else if (mod && !event.altKey && (event.key === '[' || event.key === ']')) {
        event.preventDefault();
        changeSpeed(event.key === '[' ? -1 : 1);
      } else if (mod && !event.altKey && event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        setShowAnswer(true);
        setResult(null);
      } else if (event.key === 'Enter' && isTextControl) {
        event.preventDefault();
        if (result === 'correct' && currentIndex < segments.length - 1) stepSentence(1);
        else checkAnswer();
      } else if (event.key === 'Tab' && !event.shiftKey && !mod && !event.altKey && target.tagName === 'INPUT') {
        event.preventDefault();
        void playCurrent();
      } else if (event.code === 'Space' && !isTextControl && !mod) {
        event.preventDefault();
        togglePlay();
      } else if (!isTextControl && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        stepSentence(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (!isTextControl && (event.key.toLowerCase() === 'j' || event.key.toLowerCase() === 'l')) {
        event.preventDefault();
        seek((audioRef.current?.currentTime || 0) + (event.key.toLowerCase() === 'j' ? -5 : 5));
      } else if (!isTextControl && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        void playCurrent();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changeSpeed, currentIndex, playbackRate, result, segments.length, showShortcuts]);

  if (!segments.length) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-3 text-sm font-bold text-amber-900">Chưa có segment để kiểm tra</h2>
        <p className="mt-1 text-xs text-amber-800">Hãy generate hoặc phân tích audio trước khi mở Review mode.</p>
      </section>
    );
  }
  if (!current) return null;

  const sentenceProgress = current && current.endMs > current.startMs
    ? Math.max(0, Math.min(1, (currentTime * 1000 - current.startMs) / (current.endMs - current.startMs)))
    : 0;
  const shortcutRows = [
    { keys: ['Space'], label: 'Phát / tạm dừng' },
    { keys: [modLabel, 'Space'], label: 'Phát / tạm dừng (cả khi đang gõ)' },
    { keys: ['←', '→'], label: 'Câu trước / câu sau' },
    { keys: [modLabel, '↑', '↓'], label: 'Câu trước / câu sau (cả khi đang gõ)' },
    { keys: ['Enter'], label: 'Kiểm tra · sang câu tiếp khi đã xong', scope: 'Dictation' },
    { keys: [modLabel, 'Shift', 'Enter'], label: 'Hiện đáp án', scope: 'Dictation' },
    { keys: ['Tab'], label: 'Nghe lại câu hiện tại (cả khi đang gõ)', scope: 'Dictation' },
    { keys: ['R'], label: 'Nghe lại câu hiện tại', scope: 'Dictation' },
    { keys: ['J', 'L'], label: 'Lùi / tới 5 giây', scope: 'Bản chép lời đầy đủ' },
    { keys: [modLabel, '[', ']'], label: 'Giảm / tăng tốc độ' },
    { keys: ['?'], label: 'Mở bảng phím tắt' },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <audio ref={audioRef} src={lesson.fullAudioUrl} preload="metadata" className="hidden" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Review như learner</h2>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">Không ghi tiến độ</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Kiểm tra transcript trực tiếp trước khi publish bài.</p>
        </div>
        <button type="button" onClick={() => setShowShortcuts((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50" aria-expanded={showShortcuts}>
          <Keyboard className="h-4 w-4" /> Phím tắt <Kbd>?</Kbd>
        </button>
      </div>

      {showShortcuts && (
        <div className="border-b border-blue-100 bg-blue-50/60 px-5 py-4">
          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            {shortcutRows.map((shortcut) => <ShortcutRow key={`${shortcut.label}-${shortcut.scope || ''}`} {...shortcut} />)}
          </div>
        </div>
      )}

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex min-h-[390px] flex-col items-center justify-center">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tabular-nums text-slate-600">Câu {currentIndex + 1} / {segments.length}</span>
            <span className="text-xs font-semibold text-slate-400">{progress}%</span>
          </div>
          <button type="button" onClick={() => void playCurrent()} className={`mt-7 flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg shadow-blue-600/25 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 ${isPlaying ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}`} aria-label={isPlaying ? 'Dừng audio' : 'Nghe câu hiện tại'} aria-keyshortcuts="Space Control+Space">
            {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
          </button>
          <div className="mt-5 h-1 w-44 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-500 transition-[width]" style={{ width: `${sentenceProgress * 100}%` }} />
          </div>
          <p className="mt-3 text-xs tabular-nums text-slate-400">{formatTime(currentTime)} · {formatTime(current.endMs / 1000)}</p>
          <label className="mt-7 w-full max-w-xl">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Transcript người kiểm tra nhập</span>
            <input
              value={answer}
              onChange={(event) => { setAnswer(event.target.value); setResult(null); }}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); checkAnswer(); } }}
              placeholder="Nghe rồi nhập lại câu..."
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              aria-describedby="dictation-review-feedback"
            />
          </label>
          <div className="mt-3 flex w-full max-w-xl flex-wrap items-center gap-2">
            <button type="button" onClick={checkAnswer} disabled={!answer.trim()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" aria-keyshortcuts="Enter">
              <CheckCircle2 className="h-4 w-4" /> Kiểm tra
            </button>
            <button type="button" onClick={() => { setShowAnswer(true); setResult(null); }} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50" aria-keyshortcuts="Control+Shift+Enter">
              <Eye className="h-4 w-4" /> Xem đáp án
            </button>
            {showAnswer && <span className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{current.text}</span>}
          </div>
          <div id="dictation-review-feedback" className="mt-3 min-h-6 w-full max-w-xl text-xs font-semibold" aria-live="polite">
            {result === 'correct' && <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Đúng transcript chuẩn.</span>}
            {result === 'incorrect' && <span className="inline-flex items-center gap-1.5 text-rose-700"><XCircle className="h-4 w-4" /> Chưa khớp. Kiểm tra lại chính tả, dấu cách và nội dung câu.</span>}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Câu trước</button>
            <button type="button" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === segments.length - 1} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Câu sau <ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Danh sách câu</p>
            <button type="button" onClick={() => goTo(0)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Về câu đầu"><RotateCcw className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[370px] space-y-1 overflow-y-auto">
            {segments.map((segment, index) => (
              <button key={segment._id} type="button" onClick={() => goTo(index)} className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${index === currentIndex ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-transparent text-slate-600 hover:bg-white'}`}>
                <span className="mr-2 font-bold">{String(index + 1).padStart(2, '0')}</span>
                <span className="line-clamp-2">{segment.text}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
