"use client";

import { useListPagination } from '@/hooks/use-list-pagination';
import { ListPagination } from '@/components/ui/list-pagination';
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_RECOMMENDATION_RULES,
  type RecommendationRules,
  type RecommendationSource,
} from "@repo/shared-types/recommendations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { recommendationsService } from "@/services/recommendations.service";

export default function RecommendationRulesPage() {
  const { locale = "vi" } = useParams<{ locale: string }>();
  const { t } = useTranslation("common");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["recommendation-rules"],
    queryFn: recommendationsService.read,
  });
  if (query.isPending)
    return (
      <div
        role="status"
        aria-label={t("recommendations.loading")}
        className="m-6 h-96 animate-pulse rounded-xl bg-slate-100"
      />
    );
  if (query.isError)
    return (
      <div role="alert" className="p-6">
        <p>{t("recommendations.error")}</p>
        <Button onClick={() => void query.refetch()}>
          {t("recommendations.retry")}
        </Button>
      </div>
    );
  return (
    <RulesForm
      initial={query.data}
      locale={locale}
      onSaved={(rules) => client.setQueryData(["recommendation-rules"], rules)}
    />
  );
}

function RulesForm({
  initial,
  locale,
  onSaved,
}: {
  initial: RecommendationRules;
  locale: string;
  onSaved: (rules: RecommendationRules) => void;
}) {
  const { t } = useTranslation("common");
  const [rules, setRules] = useState<RecommendationRules>(initial);
  const [scenario, setScenario] = useState("new");
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(rules) !== JSON.stringify(initial);
  const save = useMutation({
    mutationFn: recommendationsService.save,
    onSuccess: (data) => {
      onSaved(data);
      setSaved(true);
    },
  });
  const preview = useMutation({
    mutationFn: () => recommendationsService.preview(rules, scenario, locale),
  });
  const previewPage = useListPagination(preview.data?.items ?? [], scenario + JSON.stringify(rules));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = <K extends keyof RecommendationRules>(
    key: K,
    value: RecommendationRules[K],
  ) => {
    setRules((current) => ({ ...current, [key]: value }));
    setSaved(false);
    preview.reset();
    save.reset();
  };
  const valid =
    Number.isInteger(rules.maxSuggestions) &&
    rules.maxSuggestions >= 1 &&
    rules.maxSuggestions <= 3 &&
    Number.isInteger(rules.minSamples) &&
    rules.minSamples >= 2 &&
    rules.minSamples <= 30 &&
    Number.isInteger(rules.minQuestions) &&
    rules.minQuestions >= 5 &&
    rules.minQuestions <= 200 &&
    Number.isInteger(rules.weakAccuracy) &&
    rules.weakAccuracy >= 1 &&
    rules.weakAccuracy <= 99;
  const sources: RecommendationSource[] = ["vocabulary", "toeic", "dictation"];
  const numberFields = [
    { key: "maxSuggestions", min: 1, max: 3 },
    { key: "minSamples", min: 2, max: 30 },
    { key: "minQuestions", min: 5, max: 200 },
    { key: "weakAccuracy", min: 1, max: 99 },
  ] as const;
  const resetRules = () => {
    setRules({
      ...DEFAULT_RECOMMENDATION_RULES,
      sources: [...DEFAULT_RECOMMENDATION_RULES.sources],
    });
    preview.reset();
    setSaved(false);
  };
  const card = "rounded-xl border border-slate-200 bg-white";
  const toggleRow =
    "flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50";
  return (
    <div className="w-full space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("recommendations.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            {t("recommendations.description")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span
              role="status"
              className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
            >
              {t("recommendations.unsaved")}
            </span>
          ) : saved ? (
            <span
              role="status"
              className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
            >
              {t("recommendations.saved")}
            </span>
          ) : null}
          <Button variant="outline" onClick={resetRules}>
            {t("recommendations.reset")}
          </Button>
          <Button
            disabled={!dirty || !valid || save.isPending}
            onClick={() => save.mutate(rules)}
          >
            {t(save.isPending ? "recommendations.saving" : "recommendations.save")}
          </Button>
        </div>
      </header>
      {save.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {t("recommendations.saveError")}
        </p>
      )}
      {!valid && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {t("recommendations.invalid")}
        </p>
      )}

      {/* Settings on the left, live preview on the right. */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <section className={card}>
            <h2 className="border-b border-slate-200 px-5 py-3.5 text-base font-semibold text-slate-900">
              {t("recommendations.display")}
            </h2>
            <div className="space-y-4 p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={toggleRow}>
                  <input
                    type="checkbox"
                    checked={rules.enabled}
                    onChange={(event) => update("enabled", event.target.checked)}
                    className="mt-0.5 size-4 accent-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    {t("recommendations.enabled")}
                  </span>
                </label>
                <label className={toggleRow}>
                  <input
                    type="checkbox"
                    checked={rules.prioritizeDue}
                    onChange={(event) => update("prioritizeDue", event.target.checked)}
                    className="mt-0.5 size-4 accent-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    {t("recommendations.prioritizeDue")}
                  </span>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {numberFields.map(({ key, min, max }) => {
                  const invalid =
                    !Number.isInteger(rules[key]) || rules[key] < min || rules[key] > max;
                  return (
                    <div key={key} className="min-w-0">
                      <label className="block text-sm font-medium text-slate-700" htmlFor={key}>
                        {t(`recommendations.${key}`)}
                      </label>
                      <input
                        id={key}
                        type="number"
                        min={min}
                        max={max}
                        step={1}
                        required
                        value={Number.isNaN(rules[key]) ? "" : rules[key]}
                        aria-describedby={`${key}-hint`}
                        aria-invalid={invalid}
                        onChange={(event) => update(key, event.target.valueAsNumber)}
                        className={cn(
                          "mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm tabular-nums outline-none focus:ring-2",
                          invalid
                            ? "border-red-300 focus:ring-red-100"
                            : "border-slate-200 focus:border-blue-500 focus:ring-blue-100",
                        )}
                      />
                      <p
                        id={`${key}-hint`}
                        className={cn("mt-1 text-xs", invalid ? "text-red-600" : "text-slate-500")}
                      >
                        {t("recommendations.range", { min, max })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className={card}>
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-base font-semibold text-slate-900">
                {t("recommendations.sources")}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">{t("recommendations.sourcesHint")}</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {sources.map((source) => {
                const enabled = rules.sources.includes(source);
                return (
                  <li
                    key={source}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-800">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(event) =>
                          update(
                            "sources",
                            event.target.checked
                              ? [...rules.sources, source]
                              : rules.sources.filter((item) => item !== source),
                          )
                        }
                        className="size-4 accent-blue-600"
                      />
                      {t(`recommendations.${source}`)}
                    </label>
                    {enabled && (
                      <label className="flex items-center gap-2 text-sm text-slate-500">
                        {t("recommendations.priority")}
                        <select
                          aria-label={`${t("recommendations.priority")} ${source}`}
                          value={rules.sources.indexOf(source)}
                          onChange={(event) => {
                            const order = [...rules.sources];
                            order.splice(order.indexOf(source), 1);
                            order.splice(Number(event.target.value), 0, source);
                            update("sources", order);
                          }}
                          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800"
                        >
                          {rules.sources.map((_, index) => (
                            <option key={index} value={index}>
                              {index + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <section className={cn(card, "min-w-0 xl:sticky xl:top-20")}>
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-base font-semibold text-slate-900">
              {t("recommendations.preview")}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{t("recommendations.simulated")}</p>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              <select
                aria-label={t("recommendations.scenario")}
                value={scenario}
                onChange={(event) => {
                  setScenario(event.target.value);
                  preview.reset();
                }}
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {["new", "little", "progress"].map((value) => (
                  <option key={value} value={value}>
                    {t(`recommendations.${value}`)}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                disabled={!valid || preview.isPending}
                onClick={() => preview.mutate()}
              >
                {t(preview.isPending ? "recommendations.loading" : "recommendations.preview")}
              </Button>
            </div>
            {preview.isError && (
              <p role="alert" className="text-sm text-red-700">
                {t("recommendations.error")}
              </p>
            )}
            {preview.data &&
              (preview.data.items.length ? (
                <div className="space-y-2">
                  {previewPage.items.map((item, index) => (
                    <article
                      key={item.id}
                      className="flex gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                        {(previewPage.page - 1) * previewPage.pageSize + index + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-0.5 text-sm text-slate-600">{item.reason}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {t("recommendations.minutes", { count: item.estimatedMinutes })}
                        </p>
                      </div>
                    </article>
                  ))}
                  <ListPagination pagination={previewPage} />
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                  {t("recommendations.disabled")}
                </p>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
