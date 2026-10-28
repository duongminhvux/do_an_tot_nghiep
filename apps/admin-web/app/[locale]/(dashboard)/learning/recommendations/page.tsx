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
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("recommendations.title")}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {t("recommendations.description")}
          </p>
        </div>
        <Button
          disabled={!dirty || !valid || save.isPending}
          onClick={() => save.mutate(rules)}
        >
          {t(
            save.isPending ? "recommendations.saving" : "recommendations.save",
          )}
        </Button>
      </div>
      {dirty && (
        <p role="status" className="text-sm text-amber-700">
          {t("recommendations.unsaved")}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-green-700">
          {t("recommendations.saved")}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t("recommendations.saveError")}
        </p>
      )}
      <section className="space-y-5 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">
          {t("recommendations.display")}
        </h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rules.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
          />
          {t("recommendations.enabled")}
        </label>
        {(
          [
            "maxSuggestions",
            "minSamples",
            "minQuestions",
            "weakAccuracy",
          ] as const
        ).map((key) => {
          const [min, max] =
            key === "maxSuggestions"
              ? [1, 3]
              : key === "minSamples"
                ? [2, 30]
                : key === "minQuestions"
                  ? [5, 200]
                  : [1, 99];
          return (
            <div key={key}>
              <label className="block text-sm font-medium" htmlFor={key}>
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
                aria-invalid={
                  !Number.isInteger(rules[key]) ||
                  rules[key] < min ||
                  rules[key] > max
                }
                onChange={(event) => update(key, event.target.valueAsNumber)}
                className="mt-2 w-32 rounded-lg border p-2"
              />
              <p id={`${key}-hint`} className="mt-1 text-xs text-slate-500">
                {t("recommendations.range", { min, max })}
              </p>
            </div>
          );
        })}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rules.prioritizeDue}
            onChange={(event) => update("prioritizeDue", event.target.checked)}
          />
          {t("recommendations.prioritizeDue")}
        </label>
        <h3 className="font-medium">{t("recommendations.sources")}</h3>
        <p className="text-sm text-slate-500">
          {t("recommendations.sourcesHint")}
        </p>
        {sources.map((source) => (
          <div key={source} className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.sources.includes(source)}
                onChange={(event) =>
                  update(
                    "sources",
                    event.target.checked
                      ? [...rules.sources, source]
                      : rules.sources.filter((item) => item !== source),
                  )
                }
              />
              {t(`recommendations.${source}`)}
            </label>
            {rules.sources.includes(source) && (
              <label className="text-sm">
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
                  className="ml-2 rounded border p-1"
                >
                  {rules.sources.map((_, index) => (
                    <option key={index} value={index}>
                      {index + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => {
            setRules({
              ...DEFAULT_RECOMMENDATION_RULES,
              sources: [...DEFAULT_RECOMMENDATION_RULES.sources],
            });
            preview.reset();
            setSaved(false);
          }}
        >
          {t("recommendations.reset")}
        </Button>
        {!valid && (
          <p role="alert" className="text-sm text-red-700">
            {t("recommendations.invalid")}
          </p>
        )}
      </section>
      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">
          {t("recommendations.preview")}
        </h2>
        <p className="text-sm text-slate-500">
          {t("recommendations.simulated")}
        </p>
        <div className="flex flex-wrap gap-3">
          <select
            aria-label={t("recommendations.scenario")}
            value={scenario}
            onChange={(event) => {
              setScenario(event.target.value);
              preview.reset();
            }}
            className="rounded-lg border p-2"
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
            {t(
              preview.isPending
                ? "recommendations.loading"
                : "recommendations.preview",
            )}
          </Button>
        </div>
        {preview.isError && <p role="alert">{t("recommendations.error")}</p>}
        {preview.data && (
          <div className="grid gap-3 md:grid-cols-3">
            {preview.data.items.length ? (
              previewPage.items.map((item) => (
                <article key={item.id} className="rounded-xl border p-4">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="my-2 text-sm text-slate-600">{item.reason}</p>
                  <p className="text-xs text-slate-500">
                    {t("recommendations.minutes", {
                      count: item.estimatedMinutes,
                    })}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm">{t("recommendations.disabled")}</p>
            )}
            <ListPagination pagination={previewPage} />
          </div>
        )}
      </section>
    </div>
  );
}
