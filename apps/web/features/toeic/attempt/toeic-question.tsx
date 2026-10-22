"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Headphones, Loader2, Play, RotateCcw, ZoomIn } from "lucide-react";
import { isAxiosError } from "axios";
import {
  audioPlayKey,
  type AudioIdentity,
} from "@/services/toeic-attempt.service";
import { useToeicAudioPolicy } from "./toeic-audio-policy";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AttemptQuestion,
  AnswerFeedback,
} from "@/services/toeic-attempt.service";

export function ToeicAudioPlayer({
  src,
  playbackRate = 1,
  audioIdentity,
}: {
  src: string;
  playbackRate?: number;
  audioIdentity?: AudioIdentity;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const requesting = useRef(false);
  const policy = useToeicAudioPolicy();
  const restricted = policy?.restricted ?? false;
  const { t } = useTranslation("toeic");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [localUsed, setLocalUsed] = useState(0);
  const [playError, setPlayError] = useState(false);
  const used = Math.max(
    localUsed,
    audioIdentity ? (policy?.counts[audioPlayKey(audioIdentity)] ?? 0) : 0,
  );
  const rate = restricted ? 1 : playbackRate;
  const formatTime = (value: number) =>
    `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  useEffect(() => {
    if (ref.current) {
      ref.current.playbackRate = rate;
      if (restricted) ref.current.setAttribute("disableremoteplayback", "");
      else ref.current.removeAttribute("disableremoteplayback");
    }
  }, [rate, src, restricted]);
  useEffect(() => {
    const audio = ref.current;
    return () => audio?.pause();
  }, [src]);
  useEffect(() => {
    if (restricted && policy?.disabled) ref.current?.pause();
  }, [restricted, policy?.disabled]);
  async function startListening() {
    if (
      !ref.current ||
      !audioIdentity ||
      !policy ||
      requesting.current ||
      used >= 2 ||
      policy.disabled
    )
      return;
    requesting.current = true;
    setStarting(true);
    setPlayError(false);
    try {
      const nextUsed = await policy.requestPlay(audioIdentity);
      setLocalUsed(nextUsed);
      const audio = ref.current;
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio.playbackRate = 1;
      await audio.play();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409)
        setLocalUsed(2);
      setPlayError(true);
    } finally {
      requesting.current = false;
      setStarting(false);
    }
  }
  return (
    <div
      className={`space-y-2 ${restricted ? "rounded-lg border border-slate-200 bg-white p-3" : ""}`}
    >
      <audio
        key={src}
        ref={ref}
        controls={!restricted}
        controlsList={
          restricted ? "nodownload noplaybackrate noremoteplayback" : undefined
        }
        preload="metadata"
        src={src}
        className={restricted ? "hidden" : "w-full"}
        onPlay={(event) => {
          setPlaying(true);
          document.querySelectorAll("audio").forEach((audio) => {
            if (audio !== event.currentTarget) audio.pause();
          });
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onDurationChange={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : 0,
          )
        }
        onRateChange={(event) => {
          if (restricted && event.currentTarget.playbackRate !== 1)
            event.currentTarget.playbackRate = 1;
        }}
        onError={() => setFailedSrc(src)}
        onLoadedData={() => setFailedSrc(null)}
        onLoadedMetadata={(event) => {
          event.currentTarget.playbackRate = rate;
        }}
      />
      {restricted && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Headphones className="size-4" />
              {t("attempt.audio_plays", { used, limit: 2 })}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => void startListening()}
              disabled={
                starting ||
                used >= 2 ||
                policy?.disabled ||
                !audioIdentity ||
                failedSrc === src
              }
            >
              {starting ? (
                <Loader2 className="animate-spin" />
              ) : used > 0 ? (
                <RotateCcw />
              ) : (
                <Play />
              )}
              {t(used > 0 ? "attempt.listen_again" : "attempt.listen")}
            </Button>
          </div>
          <div
            role="progressbar"
            aria-label={t("attempt.audio_progress")}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration) || 1}
            aria-valuenow={Math.min(
              Math.round(position),
              Math.round(duration) || 1,
            )}
            className="h-1.5 overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className="h-full rounded-full bg-blue-600"
              style={{
                width: `${duration ? Math.min((position / duration) * 100, 100) : 0}%`,
              }}
            />
          </div>
          <div className="flex justify-between gap-3 text-xs text-slate-500">
            <span aria-live="polite">
              {playing
                ? t("attempt.audio_playing")
                : used >= 2
                  ? t("attempt.audio_limit")
                  : t("attempt.audio_test_hint")}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatTime(position)} / {formatTime(duration)}
            </span>
          </div>
        </>
      )}
      {playError && (
        <p role="alert" className="text-sm text-amber-700">
          {t("attempt.audio_play_error")}
        </p>
      )}
      {failedSrc === src && (
        <p role="alert" className="text-sm text-amber-700">
          {t("attempt.audio_load_error")}
        </p>
      )}
    </div>
  );
}

export function QuestionMedia({
  content,
  imageUrl,
  audioUrl,
  playbackRate = 1,
  audioIdentity,
}: {
  content?: string;
  imageUrl?: string;
  audioUrl?: string;
  playbackRate?: number;
  audioIdentity?: AudioIdentity;
}) {
  const { t } = useTranslation("toeic");
  const [imageOpen, setImageOpen] = useState(false);
  return (
    <div className="space-y-4">
      {imageUrl && (
        <>
          <button
            type="button"
            onClick={() => setImageOpen(true)}
            aria-label={t("attempt.enlarge_image")}
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:p-3"
          >
            <img
              src={imageUrl}
              alt={t("attempt.question_image")}
              className="block h-auto max-h-[min(35dvh,360px)] w-full rounded-lg object-contain sm:max-h-[min(50dvh,540px)] xl:max-h-[min(calc(100dvh-360px),600px)]"
            />
            <span className="absolute right-3 top-3 rounded-lg border border-slate-200 bg-white/95 p-2 text-slate-500 shadow-sm transition group-hover:text-blue-600">
              <ZoomIn className="size-4" />
            </span>
          </button>
          <Dialog open={imageOpen} onOpenChange={setImageOpen}>
            <DialogContent
              className="max-h-[94dvh] max-w-[96vw] overflow-y-auto rounded-2xl border-slate-200 p-3 pt-12 sm:max-w-[90vw]"
              closeLabel={t("attempt.close_image")}
            >
              <DialogTitle className="sr-only">
                {t("attempt.question_image")}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t("attempt.enlarge_image")}
              </DialogDescription>
              <img
                src={imageUrl}
                alt={t("attempt.question_image")}
                className="mx-auto block h-auto w-full object-contain"
              />
            </DialogContent>
          </Dialog>
        </>
      )}
      {audioUrl && (
        <ToeicAudioPlayer
          src={audioUrl}
          playbackRate={playbackRate}
          audioIdentity={audioIdentity}
        />
      )}
      {content && <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800 sm:text-base">{content}</p>}
    </div>
  );
}

// Both modes use these renderers; only server-authorized feedback is displayed.
export function ToeicQuestion({
  question,
  answer,
  disabled,
  feedback,
  onAnswer,
  showContext = true,
  playbackRate = 1,
}: {
  question: AttemptQuestion;
  answer?: string;
  disabled: boolean;
  feedback?: AnswerFeedback;
  onAnswer: (answer: string) => void;
  showContext?: boolean;
  playbackRate?: number;
}) {
  const { t } = useTranslation("toeic");
  const compactChoices = question.part <= 2;
  return (
    <div className="space-y-5">
      {showContext &&
        question.passages.map((passage, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <QuestionMedia
              {...passage}
              content={question.part <= 4 ? undefined : passage.content}
              playbackRate={playbackRate}
              audioIdentity={{
                questionId: question._id,
                passageId: passage._id,
                ...(passage._id
                  ? {}
                  : {
                      passageIndex: index,
                      passageGroupId: question.passageGroupId,
                    }),
              }}
            />
          </div>
        ))}
      <QuestionMedia
        content={question.part <= 2 ? undefined : question.content}
        imageUrl={showContext ? question.imageUrl : undefined}
        audioUrl={showContext ? question.audioUrl : undefined}
        playbackRate={playbackRate}
        audioIdentity={{ questionId: question._id }}
      />
      <div
        role="radiogroup"
        aria-label={t("attempt.choose_answer")}
        className={compactChoices ? "flex flex-wrap gap-2" : "grid gap-2"}
      >
        {question.options.map((option) => (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={answer === option.key}
            disabled={disabled}
            onClick={() => onAnswer(option.key)}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-default ${answer === option.key ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"} ${feedback?.correctAnswer === option.key ? "ring-2 ring-emerald-500" : ""} ${feedback && answer === option.key && !feedback.correct ? "border-red-400 bg-red-50" : ""}`}
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${answer === option.key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-500"}`}
            >
              {option.key}
            </span>
            {!compactChoices && (
              <span className="min-w-0 pt-0.5 leading-6">{option.text}</span>
            )}
          </button>
        ))}
      </div>
      {feedback && (
        <div
          className={`space-y-3 rounded-lg border p-4 text-sm ${feedback.correct ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}
          aria-live="polite"
        >
          <p className="font-semibold">
            {t(feedback.correct ? "attempt.correct" : "attempt.incorrect")} ·{" "}
            {t("attempt.correct_answer")}: {feedback.correctAnswer}
          </p>
          {feedback.explanation && (
            <p className="whitespace-pre-wrap">{feedback.explanation}</p>
          )}
          {feedback.transcript && (
            <div>
              <h3 className="font-semibold">{t("attempt.transcript")}</h3>
              <p className="whitespace-pre-wrap">{feedback.transcript}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
