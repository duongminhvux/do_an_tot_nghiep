"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import { UnifiedAudioPlayer } from "@/components/audio/unified-audio-player";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ExerciseDto } from "@/domain/dto";
import type { ExerciseGroup, ExerciseQuestion } from "@/domain/entities";
import { ToeicPart } from "@/domain/enums";
import { attemptsApi, exercisesApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { useProtectedMediaUrl } from "@/lib/use-protected-media-url";

export interface QuestionEntry {
  group: ExerciseGroup;
  question: ExerciseQuestion;
}

export function buildQuestionEntries(
  groups: ExerciseGroup[] = [],
): QuestionEntry[] {
  return groups.flatMap((group) =>
    group.questions.map((question) => ({ group, question })),
  );
}

export function ToeicPractice({ exercise }: { exercise: ExerciseDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const entries = useMemo(
    () => buildQuestionEntries(exercise.groups),
    [exercise.groups],
  );
  const saved = Object.fromEntries(
    exercise.attempt.answers
      .filter((answer) => answer.questionId)
      .map((answer) => [answer.questionId!, answer.value]),
  );
  const [answers, setAnswers] = useState<Record<string, string>>(saved);
  const [listenCounts, setListenCounts] = useState<Record<string, number>>(
    Object.fromEntries(
      (exercise.groups ?? []).map((item) => [item.id, item.listenCount ?? 0]),
    ),
  );
  const [index, setIndex] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const entry = entries[index];
  const question = entry?.question;
  const group = entry?.group;
  const audioSource = group?.audio?.url;
  const audio = useProtectedMediaUrl(audioSource);
  const image = useProtectedMediaUrl(question?.image || group?.image);
  const hidesSpokenText =
    exercise.toeicPart === ToeicPart.PART_1 ||
    exercise.toeicPart === ToeicPart.PART_2;
  const showsGraphic = exercise.toeicPart !== ToeicPart.PART_2;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (Object.keys(answers).length) {
        void exercisesApi.saveDraft(
          exercise.id,
          exercise.attempt.id,
          Object.entries(answers).map(([questionId, value]) => ({
            questionId,
            value,
          })),
        );
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [answers, exercise.id, exercise.attempt.id]);

  const submit = async () => {
    setConfirm(false);
    setSubmitting(true);
    try {
      const result = await attemptsApi.submitToeic(
        exercise.id,
        exercise.attempt.id,
        answers,
      );
      queryClient.removeQueries({ queryKey: ["exercise", exercise.id] });
      router.push(`/app/exercises/${exercise.id}/results/${result.attemptId}`);
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  };

  if (!question || !group) {
    return <div className="surface p-8">No questions are available.</div>;
  }

  return (
    <div className="space-y-5">
      <UnifiedAudioPlayer
        key={`${exercise.id}-${group.id}`}
        id={`${exercise.id}-${group.id}`}
        sourceUrl={audio.url}
        disabled={!audioSource || audio.loading || Boolean(audio.error)}
        duration={group.audio?.duration ?? 0}
        currentListenCount={listenCounts[group.id] ?? 0}
        maximumListenCount={exercise.maxListenCount}
        onListenCountConsumed={async () => {
          const listenCount = await exercisesApi.consumeListen(
            exercise.id,
            exercise.attempt.id,
            group.id,
          );
          setListenCounts((current) => ({
            ...current,
            [group.id]: listenCount,
          }));
          return listenCount;
        }}
      />
      {!audioSource && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Audio is not available yet.
        </div>
      )}
      {showsGraphic && image.url && (
        <div className="relative min-h-56 overflow-hidden rounded-2xl border border-slate-200">
          <img
            src={image.url}
            alt="TOEIC question visual"
            className="absolute inset-0 size-full object-contain"
          />
          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold">
            <ImageIcon className="size-4 text-blue-600" />
            Question visual
          </div>
        </div>
      )}
      {(audio.error || image.error) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {audio.error || image.error}
        </div>
      )}
      <section className="surface p-5 md:p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-blue-600">
            Question {index + 1} of {entries.length}
          </span>
          <span className="text-xs text-slate-500">
            {Object.keys(answers).length} answered
          </span>
        </div>
        {!hidesSpokenText && (
          <h2 className="mt-4 text-xl font-bold">{question.prompt}</h2>
        )}
        <fieldset className="mt-5 space-y-3">
          <legend className="sr-only">Choose an answer</legend>
          {question.options.map((option) => (
            <label
              key={option.id}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 transition",
                answers[question.id] === option.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-blue-300",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={question.id}
                value={option.id}
                checked={answers[question.id] === option.id}
                onChange={() =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: option.id,
                  }))
                }
              />
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border text-sm font-bold",
                  answers[question.id] === option.id
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 text-slate-500",
                )}
              >
                {option.label}
              </span>
              {!hidesSpokenText && (
                <span className="min-w-0 text-sm font-medium">
                  {option.text}
                </span>
              )}
            </label>
          ))}
        </fieldset>
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            disabled={index === 0}
            onClick={() => setIndex((value) => value - 1)}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          {index < entries.length - 1 ? (
            <Button onClick={() => setIndex((value) => value + 1)}>
              Next
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              disabled={
                Object.keys(answers).length !== entries.length || submitting
              }
              onClick={() => setConfirm(true)}
            >
              <CheckCircle2 className="size-4" />
              {submitting ? "Submitting…" : "Submit Answers"}
            </Button>
          )}
        </div>
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}
      </section>
      <ConfirmDialog
        open={confirm}
        title="Submit your answers?"
        description="You won’t be able to change your choices after submission. You can review the result next."
        confirmLabel="Submit answers"
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
      />
    </div>
  );
}
