"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sentenceAtTime } from "@repo/ui/dictation-timeline";
import { DictationStudio, type StudioGrade } from "@repo/ui/dictation-studio";
import { dictationDictionaryEntry } from "@repo/ui/dictation-dictionary";
import {
  YoutubePlayer,
  type YoutubePlayerHandle,
} from "@repo/ui/youtube-player";
import { gradeDictation } from "@repo/shared-types/dictation-score";
import { useParams } from "next/navigation";
import type { PublicationPreview } from "@/services/publication.service";
import apiClient from "@/lib/axios";
import type { WordDetail } from "@/services/types";

export function DictationStudioPreview({ data }: { data: PublicationPreview }) {
  const { locale } = useParams<{ locale: string }>();
  const segments = data.segments || [];
  const [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(""),
    [completed, setCompleted] = useState<number[]>([]),
    [revealed, setRevealed] = useState<number[]>([]),
    [showAnswer, setShowAnswer] = useState(false),
    [transcript, setTranscript] = useState(false),
    [playing, setPlaying] = useState(false),
    [rate, setRate] = useState(1),
    [autoNext, setAutoNext] = useState(true),
    [grading, setGrading] = useState<StudioGrade | null>(null),
    [error, setError] = useState("");
  const player = useRef<YoutubePlayerHandle>(null),
    audio = useRef<HTMLAudioElement>(null),
    end = useRef(0),
    input = useRef<HTMLTextAreaElement>(null);
  const playAt = useCallback(
    (i: number) => {
      const s = segments[i];
      if (!s) return;
      if (data.youtubeVideoId) player.current?.play(s.startMs, s.endMs);
      else if (audio.current) {
        end.current = s.endMs;
        audio.current.currentTime = s.startMs / 1000;
        audio.current.playbackRate = rate;
        void audio.current
          .play()
          .catch(() => setError("Không phát được audio."));
      }
    },
    [segments, data.youtubeVideoId, rate],
  );
  const select = (i: number) => {
    const old = live.current;
    drafts.current.set(old.index, {
      answer: old.answer,
      grading: old.grading,
      showAnswer: old.showAnswer,
    });
    const saved = drafts.current.get(i);
    audio.current?.pause();
    player.current?.pause();
    setIndex(i);
    setAnswer(saved?.answer || "");
    setGrading(saved?.grading || null);
    setError("");
    setShowAnswer(saved?.showAnswer || revealed.includes(i));
    live.current = {
      index: i,
      answer: saved?.answer || "",
      grading: saved?.grading || null,
      showAnswer: saved?.showAnswer || revealed.includes(i),
    };
    playAt(i);
  };
  const live = useRef({ index, answer, grading, showAnswer });
  live.current = { index, answer, grading, showAnswer };
  const drafts = useRef(
    new Map<
      number,
      { answer: string; grading: StudioGrade | null; showAnswer: boolean }
    >(),
  );
  const followVideo = (timeMs: number) => {
    const next = sentenceAtTime(segments, timeMs),
      old = live.current;
    if (next < 0 || next === old.index) return;
    drafts.current.set(old.index, {
      answer: old.answer,
      grading: old.grading,
      showAnswer: old.showAnswer,
    });
    const saved = drafts.current.get(next),
      visible = saved?.showAnswer || revealed.includes(next);
    live.current = {
      index: next,
      answer: saved?.answer || "",
      grading: saved?.grading || null,
      showAnswer: visible,
    };
    setIndex(next);
    setAnswer(saved?.answer || "");
    setGrading(saved?.grading || null);
    setShowAnswer(visible);
    setError("");
  };
  useEffect(() => {
    if (!autoNext || !grading?.isCorrect || index >= segments.length - 1)
      return;
    const timer = setTimeout(() => {
      setIndex(index + 1);
      setAnswer("");
      setGrading(null);
      setShowAnswer(revealed.includes(index + 1));
      if (autoNext) playAt(index + 1);
    }, 700);
    return () => clearTimeout(timer);
  }, [grading, index, segments.length, autoNext, playAt, revealed]);
  const check = () => {
    try {
      const result = gradeDictation(segments[index]!.text, answer);
      setGrading(result);
      if (result.isCorrect) {
        setCompleted((old) => (old.includes(index) ? old : [...old, index]));
        setShowAnswer(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không chấm được câu trả lời.");
    }
  };
  if (!segments.length)
    return (
      <p className="p-6 text-slate-300">Bài nghe chưa có câu để xem trước.</p>
    );
  return (
    <>
      <audio
        ref={audio}
        src={data.fullAudioUrl || undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => {
          if (audio.current && audio.current.currentTime * 1000 >= end.current)
            audio.current.pause();
        }}
      />
      <DictationStudio
        preview
        locale={locale}
        title={data.title}
        level={data.level}
        segments={segments}
        currentIndex={index}
        completed={completed}
        revealed={revealed}
        answer={answer}
        onAnswer={setAnswer}
        answerRef={input}
        onSelect={select}
        onCheck={check}
        onPause={() => {
          audio.current?.pause();
          player.current?.pause();
          setPlaying(false);
        }}
        onPronounce={async (entry, accent) =>
          (
            await apiClient.get<{ data: { audio: string } }>(
              "/learning/saved-words/pronunciation",
              { params: { word: entry.word, accent } },
            )
          ).data.data.audio
        }
        onLookup={async (value) => {
          const word = value.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
          const found = (
            await apiClient.get<{
              data:
                | (WordDetail & {
                    sourceName?: string;
                    sourceUrl?: string;
                    ipaDerivedFrom?: string;
                    licenseUrl?: string;
                    translationSource?: string;
                  })
                | null;
            }>("/learning/saved-words/lookup", { params: { word } })
          ).data.data;
          return dictationDictionaryEntry(found, word);
        }}
        onPlay={() => {
          if (!data.youtubeVideoId && audio.current && !audio.current.paused)
            audio.current.pause();
          else playAt(index);
        }}
        onReveal={() => {
          setShowAnswer(true);
          setRevealed((old) => (old.includes(index) ? old : [...old, index]));
        }}
        onTranscript={() => setTranscript((v) => !v)}
        transcriptVisible={transcript}
        media={
          data.youtubeVideoId ? (
            <YoutubePlayer
              aspectRatio
              ref={player}
              onTimeChange={followVideo}
              segments={segments}
              videoId={data.youtubeVideoId}
              playbackRate={rate}
              onPlayingChange={setPlaying}
            />
          ) : undefined
        }
        isPlaying={playing}
        playbackRate={rate}
        onPlaybackRate={setRate}
        autoPlayNext={autoNext}
        onAutoPlayNext={setAutoNext}
        showAnswer={showAnswer}
        grading={grading}
        error={error}
      />
    </>
  );
}
