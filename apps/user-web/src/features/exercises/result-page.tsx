"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleX,
  Lightbulb,
  RotateCcw,
  Target,
} from "lucide-react";
import { attemptsApi } from "@/lib/api/client";
import { ErrorState, LoadingSkeleton } from "@/components/ui/states";
import { ResultSummary } from "@/components/exercises/result-summary";
import { FeedbackSegments } from "@/components/exercises/feedback-segments";
import { Button } from "@/components/ui/button";
import { ExerciseType } from "@/domain/enums";
import type { DictationResultDto, ToeicResultDto } from "@/domain/dto";
function DictationResult({ result }: { result: DictationResultDto }) {
  return (
    <div className="space-y-5">
      <ResultSummary
        score={result.score}
        passed={result.passed}
        threshold={result.threshold}
        detail={`${result.accuracy.correctWords} of ${result.accuracy.totalWords} words correct`}
      />
      <section className="surface divide-y divide-slate-100 p-5">
        <div className="pb-5">
          <h3 className="text-sm font-bold text-slate-500">Your Answer</h3>
          <p className="mt-2 text-sm leading-7">{result.studentAnswer}</p>
        </div>
        <div className="py-5">
          <h3 className="text-sm font-bold text-slate-500">Correct Answer</h3>
          <p className="mt-2 text-sm leading-7">
            {result.correctAnswer ||
              "Answer review is disabled for this exercise."}
          </p>
        </div>
        <div className="py-5">
          <h3 className="text-sm font-bold text-slate-500">
            Word-level Feedback
          </h3>
          <div className="mt-3">
            <FeedbackSegments segments={result.feedbackSegments} />
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="rounded bg-green-100 px-2 py-1">Correct</span>
            <span className="rounded bg-amber-100 px-2 py-1">Missing</span>
            <span className="rounded bg-orange-100 px-2 py-1">Replaced</span>
            <span className="rounded bg-red-100 px-2 py-1">Extra</span>
          </div>
        </div>
        <div className="pt-5">
          <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-blue-600" />
            <div>
              <h3 className="font-bold text-blue-900">Feedback</h3>
              <p className="mt-1 text-sm text-blue-800">
                {result.feedbackMessage}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
export function ToeicResult({ result }: { result: ToeicResultDto }) {
  return (
    <div className="space-y-5">
      <ResultSummary
        score={result.score}
        passed={result.passed}
        threshold={result.threshold}
        detail={`${result.correctCount} of ${result.totalQuestions} questions correct`}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <section className="surface p-5">
          <h3 className="flex items-center gap-2 font-bold">
            <Target className="size-5 text-blue-600" />
            Part Breakdown
          </h3>
          <div className="mt-4 space-y-3">
            {result.partBreakdown.map((part) => (
              <div
                key={part.part}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm"
              >
                <span className="font-semibold">{part.part}</span>
                <strong>
                  {part.correct} / {part.total}
                </strong>
              </div>
            ))}
          </div>
        </section>
        <section className="surface p-5">
          <h3 className="font-bold">Result Summary</h3>
          <div className="mt-4">
            <p className="text-sm font-semibold text-green-700">
              Your strengths
            </p>
            {result.strengths.map((item) => (
              <p key={item} className="mt-2 flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-green-500" />
                {item}
              </p>
            ))}
            <p className="mt-5 text-sm font-semibold text-amber-700">
              Keep improving
            </p>
            {result.improvements.map((item) => (
              <p key={item} className="mt-2 flex items-center gap-2 text-sm">
                <CircleX className="size-4 text-amber-500" />
                {item}
              </p>
            ))}
          </div>
        </section>
      </div>
      <section className="surface p-5">
        <h3 className="font-bold">Answer Review</h3>
        {result.answerReviewEnabled ? (
          <div className="mt-4 divide-y divide-slate-100">
            {result.answers.map((answer, index) => (
              <div key={answer.questionId} className="py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">
                    Question {index + 1}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${answer.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    {answer.isCorrect ? "Correct" : "Incorrect"}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <ReviewAnswer
                    label="Your answer"
                    optionLabel={answer.selectedOptionLabel}
                    text={answer.selectedOptionText}
                  />
                  <ReviewAnswer
                    label="Correct answer"
                    optionLabel={answer.correctOptionLabel}
                    text={answer.correctOptionText}
                    correct
                  />
                </div>
                {answer.explanation && (
                  <div className="mt-3 rounded-lg bg-blue-50 p-3">
                    <p className="text-xs font-bold text-blue-700">
                      Explanation
                    </p>
                    <p className="mt-1 text-sm text-blue-900">
                      {answer.explanation}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            Answer review is disabled for this exercise.
          </p>
        )}
      </section>
      {result.transcripts?.length ? (
        <section className="surface p-5">
          <h3 className="flex items-center gap-2 font-bold">
            <BookOpen className="size-5 text-blue-600" />
            Listening Transcript
          </h3>
          <div className="mt-4 space-y-4">
            {result.transcripts.map((transcript) => (
              <article
                key={transcript.groupId}
                className="rounded-xl border border-slate-200 p-4"
              >
                <h4 className="text-sm font-bold">{transcript.label}</h4>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">
                  {transcript.text}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ReviewAnswer({
  label,
  optionLabel,
  text,
  correct = false,
}: {
  label: string;
  optionLabel?: string;
  text?: string;
  correct?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-3 ${correct ? "bg-green-50" : "bg-slate-50"}`}
    >
      <p
        className={`text-xs font-bold ${correct ? "text-green-700" : "text-slate-500"}`}
      >
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">
        {[optionLabel, text].filter(Boolean).join(". ") || "No answer"}
      </p>
    </div>
  );
}
export function ResultPage({
  exerciseId,
  attemptId,
}: {
  exerciseId: string;
  attemptId: string;
}) {
  const resultQuery = useQuery({
    queryKey: ["result", attemptId],
    queryFn: () => attemptsApi.getResult(exerciseId, attemptId),
    retry: false,
  });
  if (resultQuery.isLoading) return <LoadingSkeleton rows={3} />;
  if (resultQuery.error || !resultQuery.data)
    return (
      <ErrorState
        message={
          resultQuery.error instanceof Error
            ? resultQuery.error.message
            : "Result unavailable."
        }
      />
    );
  const result = resultQuery.data;
  const exercise = result.exercise;
  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/app/courses/${exercise.courseSlug}/lessons/${exercise.lessonSlug}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft className="size-4" />
        Back to lesson
      </Link>
      <header className="mb-5">
        <p className="text-sm font-bold text-blue-600">EXERCISE RESULT</p>
        <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">
          {exercise.title}
        </h1>
      </header>
      {result.type === ExerciseType.DICTATION ? (
        <DictationResult result={result.result} />
      ) : (
        <ToeicResult result={result.result} />
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Link
          href={`/app/courses/${exercise.courseSlug}/lessons/${exercise.lessonSlug}`}
        >
          <Button variant="secondary">
            <BookOpen className="size-4" />
            Back to Lesson
          </Button>
        </Link>
        <Link href={`/app/exercises/${exerciseId}`}>
          <Button>
            <RotateCcw className="size-4" />
            Try Again
          </Button>
        </Link>
      </div>
    </div>
  );
}
