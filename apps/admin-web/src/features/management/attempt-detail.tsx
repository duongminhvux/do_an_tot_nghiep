"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Headphones,
  LockKeyhole,
  Target,
} from "lucide-react";
import { adminAttemptsApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, TableSkeleton } from "@/components/ui/states";

export function AttemptDetail({ id }: { id: string }) {
  const user = useAdminSession((state) => state.user)!;
  const query = useQuery({
    queryKey: ["attempt", id],
    queryFn: () => adminAttemptsApi.get(user, id),
  });
  if (query.isLoading) return <TableSkeleton />;
  if (query.error) return <ErrorState message={query.error.message} />;
  const attempt = query.data!;
  const result = attempt.result as {
    studentAnswer?: string;
    correctAnswer?: string;
    questionResults?: Array<{
      question: string;
      selectedText?: string;
      correctText?: string;
      isCorrect: boolean;
    }>;
  };
  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/attempts"
        className="mb-4 inline-flex items-center gap-1 font-semibold text-slate-500"
      >
        <ArrowLeft className="size-4" />
        Back to attempts
      </Link>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-blue-600">
            {attempt.student.fullName} · {attempt.exercise.courseTitle}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold">
            {attempt.exercise.title}
          </h1>
        </div>
        <StatusBadge status={attempt.status} />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={Target} label="Score" value={`${attempt.score}%`} />
        <Metric
          icon={CheckCircle2}
          label="Result"
          value={attempt.passed ? "PASS" : "FAIL"}
        />
        <Metric
          icon={Headphones}
          label={attempt.type === "TOEIC" ? "Total plays" : "Listens"}
          value={
            attempt.type === "TOEIC"
              ? String(attempt.listenCount)
              : `${attempt.listenCount} / ${attempt.maxListens}`
          }
        />
        <Metric
          icon={LockKeyhole}
          label="Attempt"
          value={`#${attempt.attemptNumber} · Locked`}
        />
      </div>
      {attempt.type === "TOEIC" && attempt.listenBreakdown?.length ? (
        <section className="admin-surface mt-4 p-5">
          <h2 className="font-bold">Plays by stimulus</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attempt.listenBreakdown.map((item) => (
              <div
                key={item.groupId}
                className="rounded-lg border border-slate-200 p-3"
              >
                <p className="text-xs font-semibold text-slate-500">
                  {item.label}
                </p>
                <strong className="mt-1 block">
                  {item.listenCount} / {item.maximum}
                </strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="admin-surface mt-4 p-5">
        <h2 className="font-bold">Answer review</h2>
        {attempt.type === "DICTATION" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Answer
              label="Student answer"
              value={result.studentAnswer ?? "—"}
            />
            <Answer
              label="Correct answer snapshot"
              value={result.correctAnswer ?? "Hidden by exercise settings"}
              correct
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {(result.questionResults ?? []).map((question, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-200 p-4"
              >
                <strong>{question.question}</strong>
                <p className="mt-2 text-sm">
                  Selected: {question.selectedText ?? "No answer"}
                </p>
                <p className="text-sm text-green-700">
                  Correct snapshot: {question.correctText ?? "—"}
                </p>
                <StatusBadge status={question.isCorrect ? "PASS" : "FAIL"} />
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <LockKeyhole className="size-3" />
          Submitted scores and answer snapshots cannot be edited.
        </p>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="admin-surface p-4">
      <Icon className="size-5 text-blue-600" />
      <p className="mt-3 text-xs text-slate-500">{label}</p>
      <strong className="text-xl">{value}</strong>
    </div>
  );
}

function Answer({
  label,
  value,
  correct,
}: {
  label: string;
  value: string;
  correct?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-4 ${correct ? "bg-green-50" : "bg-slate-50"}`}
    >
      <p
        className={`text-xs font-bold ${correct ? "text-green-700" : "text-slate-500"}`}
      >
        {label.toUpperCase()}
      </p>
      <p className="mt-2">{value}</p>
    </div>
  );
}
