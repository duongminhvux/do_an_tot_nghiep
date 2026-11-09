"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Loader2, Save } from "lucide-react";
import { examService } from "@/services/assessment.service";
import type { ExamItem } from "@/types";
import { VisibilityBar } from "@/components/publication/publication-controls";

function TimingForm({ exam }: { exam: ExamItem }) {
  const { t } = useTranslation("assessment");
  const queryClient = useQueryClient();
  const [testMinutes, setTestMinutes] = useState(
    String(
      exam.timingSettings?.testDurationMinutes ?? (exam.durationMinutes || 120),
    ),
  );
  const [practiceMinutes, setPracticeMinutes] = useState(
    String(exam.timingSettings?.practiceDurationMinutes ?? 0),
  );
  const [unlimited, setUnlimited] = useState(Number(practiceMinutes) === 0);
  const mutation = useMutation({
    mutationFn: () =>
      examService.update(exam._id, {
        timingSettings: {
          testDurationMinutes: Number(testMinutes),
          practiceDurationMinutes: unlimited ? 0 : Number(practiceMinutes),
        },
      }),
    onSuccess: async () => {
      await Promise.all(
        [
          "admin-exam",
          "admin-exams",
          "admin-exam-group-exams",
          "admin-exams-unassigned",
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
  const valid =
    Number.isInteger(Number(testMinutes)) &&
    Number(testMinutes) >= 1 &&
    Number(testMinutes) <= 1440 &&
    (unlimited ||
      (Number.isInteger(Number(practiceMinutes)) &&
        Number(practiceMinutes) >= 1 &&
        Number(practiceMinutes) <= 1440));
  const inputClass =
    "mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !mutation.isPending) mutation.mutate();
      }}
      className="space-y-5"
    >
      <fieldset
        disabled={mutation.isPending}
        onChange={() => mutation.reset()}
        className="grid gap-5 md:grid-cols-2 disabled:opacity-60"
      >
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <Clock className="mb-3 size-6 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">
            {t("timing.testTitle")}
          </h2>
          <p className="mb-5 mt-2 text-sm text-slate-500">
            {t("timing.testDescription")}
          </p>
          <label
            htmlFor="test-minutes"
            className="text-sm font-medium text-slate-700"
          >
            {t("timing.minutesLabel")}
          </label>
          <input
            id="test-minutes"
            type="number"
            min={1}
            max={1440}
            step={1}
            required
            value={testMinutes}
            onChange={(event) => setTestMinutes(event.target.value)}
            className={inputClass}
          />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <Clock className="mb-3 size-6 text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-900">
            {t("timing.practiceTitle")}
          </h2>
          <p className="mb-5 mt-2 text-sm text-slate-500">
            {t("timing.practiceDescription")}
          </p>
          <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={unlimited}
              onChange={(event) => {
                setUnlimited(event.target.checked);
                if (!event.target.checked && Number(practiceMinutes) < 1)
                  setPracticeMinutes("120");
              }}
              className="size-4 accent-blue-600"
            />
            {t("timing.unlimited")}
          </label>
          <label
            htmlFor="practice-minutes"
            className="text-sm font-medium text-slate-700"
          >
            {t("timing.minutesLabel")}
          </label>
          <input
            id="practice-minutes"
            type="number"
            min={1}
            max={1440}
            step={1}
            required={!unlimited}
            disabled={unlimited}
            value={unlimited ? "" : practiceMinutes}
            onChange={(event) => setPracticeMinutes(event.target.value)}
            className={`${inputClass} disabled:bg-slate-100`}
          />
        </section>
      </fieldset>
      <p className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        {t("timing.scopeHint")}
      </p>
      <div role="status" aria-live="polite" className="text-sm">
        {mutation.isSuccess && (
          <p className="text-emerald-700">{t("timing.saved")}</p>
        )}
        {mutation.isError && (
          <p className="text-red-600">{t("timing.saveError")}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={!valid || mutation.isPending}
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        {t(mutation.isPending ? "timing.saving" : "timing.save")}
      </button>
    </form>
  );
}

export default function ExamSettingsPage() {
  const { id, locale } = useParams<{ id: string; locale: string }>();
  const { t } = useTranslation("assessment");
  const query = useQuery({
    queryKey: ["admin-exam", id],
    queryFn: () => examService.getById(id),
    enabled: !!id,
  });
  const exam = query.data?.data;
  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      <Link
        href={`/${locale}/assessment/settings`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft className="size-4" />
        {t("timing.selectExam")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t("timing.title")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {exam?.name || t("timing.subtitle")}
        </p>
      </div>
      {exam && <VisibilityBar kind="exams" id={id} version={query.data} />}
      {query.isPending ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-slate-500"
        >
          <Loader2 className="size-4 animate-spin" />
          {t("timing.loading")}
        </p>
      ) : query.isError || !exam ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{t("timing.loadError")}</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-2 font-semibold underline"
          >
            {t("timing.retry")}
          </button>
        </div>
      ) : (
        <TimingForm key={exam._id} exam={exam} />
      )}
    </div>
  );
}
