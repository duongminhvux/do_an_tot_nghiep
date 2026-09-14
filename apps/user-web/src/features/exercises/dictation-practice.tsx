"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Send } from "lucide-react";
import type { ExerciseDto } from "@/domain/dto";
import { UnifiedAudioPlayer } from "@/components/audio/unified-audio-player";
import { Button } from "@/components/ui/button";
import { exercisesApi, attemptsApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useProtectedMediaUrl } from "@/lib/use-protected-media-url";
export function DictationPractice({ exercise }: { exercise: ExerciseDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const initial = exercise.attempt.answers[0]?.value ?? "";
  const [answer, setAnswer] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const audio = useProtectedMediaUrl(exercise.audio?.url);
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const submit = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await exercisesApi.saveDraft(exercise.id, exercise.attempt.id, [
        { value: answer },
      ]);
      const result = await attemptsApi.submitDictation(
        exercise.id,
        exercise.attempt.id,
        answer,
      );
      queryClient.removeQueries({ queryKey: ["exercise", exercise.id] });
      router.push(`/app/exercises/${exercise.id}/results/${result.attemptId}`);
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  };
  return (
    <div className="space-y-5">
      <UnifiedAudioPlayer
        id={exercise.id}
        sourceUrl={audio.url}
        disabled={!exercise.audio?.url || audio.loading || Boolean(audio.error)}
        duration={exercise.audio?.duration ?? 0}
        currentListenCount={exercise.attempt.listenCount}
        maximumListenCount={exercise.maxListenCount}
        onListenCountConsumed={() =>
          exercisesApi.consumeListen(exercise.id, exercise.attempt.id)
        }
      />
      {!exercise.audio?.url && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Audio is not available yet.
        </div>
      )}
      {audio.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {audio.error}
        </div>
      )}
      <section className="surface p-5 md:p-6">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-blue-600" />
          <h2 className="font-bold">Type what you hear</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Type the entire sentence exactly as you hear it. Punctuation and
          capitalization are flexible.
        </p>
        <label className="mt-5 block">
          <span className="sr-only">Your dictation answer</span>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitting}
            className="min-h-48 w-full resize-y rounded-xl border border-slate-200 p-4 text-base outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:bg-slate-50"
            placeholder="Type what you hear..."
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {answer.length.toLocaleString()} characters • {words} words
          </span>
          <Button onClick={submit} disabled={!answer.trim() || submitting}>
            {submitting ? (
              "Checking answer…"
            ) : (
              <>
                <Send className="size-4" />
                Submit
              </>
            )}
          </Button>
        </div>
        {error && (
          <div
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}
      </section>
    </div>
  );
}
