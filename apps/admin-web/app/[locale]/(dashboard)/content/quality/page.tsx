"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertOctagon,
  AlertTriangle,
  ChevronDown,
  ClipboardCheck,
  FileWarning,
  Loader2,
  RefreshCw,
  ScanSearch,
  Search,
  SquarePen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  QUALITY_GROUPS,
  contentQualityService,
  type QualityArea,
  type QualityFinding,
  type QualityGroup,
  type QualityReportItem,
} from "@/services/content-quality.service";

const ALL = "ALL";
const PHASE_KINDS = ["words", "lessons", "dictation", "exams"] as const;
const RECHECKABLE = new Set(["exams", "words", "lessons", "dictation"]);

/** Where to fix a finding: the exact editor position when the page supports it. */
function fixHref(locale: string, item: QualityReportItem, finding?: QualityFinding) {
  const focus = finding?.path ? `focus=${encodeURIComponent(finding.path)}` : "";
  if (item.kind === "exams") return `/${locale}/assessment/${item.resourceId}?tab=checks${focus ? `&${focus}` : ""}`;
  if (item.kind === "dictation") return `/${locale}/dictation/${item.resourceId}${focus ? `?${focus}` : ""}`;
  return `/${locale}${item.editPath}`;
}

export default function ContentQualityPage() {
  const { t, i18n } = useTranslation("common");
  const { locale } = useParams<{ locale: string }>();
  const lang = i18n.language.startsWith("en") ? "en" : "vi";
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [area, setArea] = useState<QualityArea | undefined>();
  const [severity, setSeverity] = useState<"error" | "warning" | undefined>("error");
  const [group, setGroup] = useState<QualityGroup | undefined>();
  const [sort, setSort] = useState<"severity" | "recent">("severity");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [recheckResult, setRecheckResult] = useState<Record<string, { tone: "ok" | "warn" | "error"; text: string }>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters = { area, severity, group, q, sort, page, lang };
  const query = useQuery({
    queryKey: ["content-quality", filters],
    queryFn: () => contentQualityService.list(filters),
    placeholderData: (previous) => previous,
    refetchInterval: (state) =>
      ["PENDING", "RUNNING"].includes(state.state.data?.job?.state ?? "") ? 3000 : false,
  });
  const scan = useMutation({
    mutationFn: contentQualityService.scan,
    onSuccess: () => {
      setPage(1);
      void cache.invalidateQueries({ queryKey: ["content-quality"] });
    },
  });
  const recheck = useMutation({
    mutationFn: (item: QualityReportItem) => contentQualityService.recheck(item.kind, item.resourceId, lang),
    onSuccess: (result, item) => {
      setRecheckResult((current) => ({
        ...current,
        [`${item.kind}:${item.resourceId}`]: {
          tone: result.errors ? "warn" : "ok",
          text: t("contentQuality.recheckDone", result),
        },
      }));
      void cache.invalidateQueries({ queryKey: ["content-quality"] });
    },
    onError: (error: any, item) => {
      const busy = error?.response?.status === 409;
      setRecheckResult((current) => ({
        ...current,
        [`${item.kind}:${item.resourceId}`]: {
          tone: "error",
          text: t(busy ? "contentQuality.recheckBusy" : "contentQuality.recheckError"),
        },
      }));
    },
  });

  const data = query.data;
  const active = data?.job?.state === "PENDING" || data?.job?.state === "RUNNING";
  const date = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString(lang === "en" ? "en-GB" : "vi-VN") : "—";
  const filtered = Boolean(area || severity || group || q);
  const resetFilters = () => {
    setArea(undefined);
    setSeverity(undefined);
    setGroup(undefined);
    setSearch("");
    setQ("");
    setPage(1);
  };

  const kpis = data
    ? ([
        { key: "scanned", value: data.stats.scanned, hint: t("contentQuality.kpiHint.scanned"), Icon: ScanSearch, tone: "text-slate-700 bg-slate-100" },
        { key: "resourcesWithErrors", value: data.stats.resourcesWithErrors, hint: t("contentQuality.kpiHint.resourcesWithErrors", { total: data.stats.resourcesWithIssues }), Icon: FileWarning, tone: "text-red-700 bg-red-50" },
        { key: "errorFindings", value: data.stats.errorFindings, hint: t("contentQuality.kpiHint.errorFindings"), Icon: AlertOctagon, tone: "text-red-700 bg-red-50" },
        { key: "warningFindings", value: data.stats.warningFindings, hint: t("contentQuality.kpiHint.warningFindings"), Icon: AlertTriangle, tone: "text-amber-800 bg-amber-50" },
        { key: "brokenMedia", value: data.stats.brokenMedia, hint: t("contentQuality.kpiHint.brokenMedia", { count: data.stats.unverifiedMedia }), Icon: ClipboardCheck, tone: "text-rose-700 bg-rose-50" },
      ] as const)
    : [];

  return (
    <div className="w-full space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{t("contentQuality.title")}</h1>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-500">{t("contentQuality.description")}</p>
          {data && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500" aria-live="polite">
              <span>
                {t("contentQuality.snapshot")}: <strong className="font-semibold text-slate-700">{date(data.snapshotAt)}</strong>
              </span>
              {active && (
                <span className="inline-flex items-center gap-1.5 text-blue-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {data.job!.phase < 4
                    ? `${t("contentQuality.phase")}: ${t(`contentQuality.kind.${PHASE_KINDS[data.job!.phase]}`)}`
                    : t("contentQuality.phaseMedia")}{" "}
                  · {t("contentQuality.processed", { count: data.job!.scanned_count })}
                </span>
              )}
            </p>
          )}
        </div>
        <Button onClick={() => scan.mutate()} disabled={scan.isPending || active || query.isPending}>
          {active || scan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {t(active ? "contentQuality.scanning" : "contentQuality.scan")}
        </Button>
      </header>

      {scan.isError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{t("contentQuality.scanError")}</p>}
      {scan.isSuccess && active && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">{t("contentQuality.queued")}</p>}
      {data?.job?.state === "FAILED" && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{t("contentQuality.workerError")}</p>}
      {data?.stale && data.snapshotAt && !active && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{t("contentQuality.stale")}</p>
      )}

      {query.isPending && (
        <div role="status" aria-label={t("contentQuality.loading")} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}
      {query.isError && !data && (
        <div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm">
          <p className="text-red-700">{t("contentQuality.loadError")}</p>
          <Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>{t("contentQuality.retry")}</Button>
        </div>
      )}

      {data && (
        <>
          <section aria-label={t("contentQuality.title")} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {kpis.map(({ key, value, hint, Icon, tone }) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-500">{t(`contentQuality.kpi.${key}`)}</p>
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", tone)}><Icon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value.toLocaleString(lang === "en" ? "en-GB" : "vi-VN")}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
              </div>
            ))}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("contentQuality.filters.search")}
                  aria-label={t("contentQuality.filters.search")}
                  className="h-9 pl-9 text-sm"
                  maxLength={120}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Select value={area ?? ALL} onValueChange={(value) => { setArea(value === ALL ? undefined : (value as QualityArea)); setPage(1); }}>
                  <SelectTrigger aria-label={t("contentQuality.filters.area")} className="h-9 text-xs sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("contentQuality.filters.allAreas")}</SelectItem>
                    {(["toeic", "dictation", "vocabulary"] as const).map((value) => (
                      <SelectItem key={value} value={value}>{t(`contentQuality.area.${value}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={group ?? ALL} onValueChange={(value) => { setGroup(value === ALL ? undefined : (value as QualityGroup)); setPage(1); }}>
                  <SelectTrigger aria-label={t("contentQuality.filters.group")} className="h-9 text-xs sm:w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("contentQuality.filters.allGroups")}</SelectItem>
                    {QUALITY_GROUPS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`contentQuality.groups.${value}`)} ({data.groups[value]?.resources ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(value) => { setSort(value as "severity" | "recent"); setPage(1); }}>
                  <SelectTrigger aria-label={t("contentQuality.filters.sort")} className="h-9 text-xs sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="severity">{t("contentQuality.filters.sortSeverity")}</SelectItem>
                    <SelectItem value="recent">{t("contentQuality.filters.sortRecent")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div role="group" aria-label={t("contentQuality.filters.severity")} className="inline-flex rounded-lg border border-slate-200 p-0.5">
                {([undefined, "error", "warning"] as const).map((value) => (
                  <button
                    key={value ?? "all"}
                    type="button"
                    aria-pressed={severity === value}
                    onClick={() => { setSeverity(value); setPage(1); }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                      severity === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {value ? t(`contentQuality.severityTab.${value}`) : t("contentQuality.filters.allSeverity")}
                  </button>
                ))}
              </div>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                {query.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("contentQuality.total", { count: data.total })}
                {filtered && (
                  <button type="button" onClick={resetFilters} className="font-semibold text-blue-700 hover:underline">
                    {t("contentQuality.filters.reset")}
                  </button>
                )}
              </p>
            </div>
          </section>

          {!data.snapshotAt && !data.items.length ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{t("contentQuality.noScan")}</p>
          ) : !data.items.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              <p>{t(filtered ? "contentQuality.empty" : "contentQuality.emptyAll")}</p>
              {filtered && <Button variant="outline" size="sm" className="mt-3" onClick={resetFilters}>{t("contentQuality.filters.reset")}</Button>}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {data.items.map((item) => (
                <QualityRow
                  key={`${item.kind}:${item.resourceId}`}
                  item={item}
                  locale={locale}
                  date={date}
                  expanded={Boolean(open[`${item.kind}:${item.resourceId}`])}
                  onToggle={() => setOpen((current) => ({ ...current, [`${item.kind}:${item.resourceId}`]: !current[`${item.kind}:${item.resourceId}`] }))}
                  rechecking={recheck.isPending && recheck.variables?.resourceId === item.resourceId}
                  onRecheck={RECHECKABLE.has(item.kind) ? () => recheck.mutate(item) : undefined}
                  result={recheckResult[`${item.kind}:${item.resourceId}`]}
                />
              ))}
            </ul>
          )}
          {data.total > data.pageSize && (
            <Pagination
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
              totalItems={data.total}
              pageSize={data.pageSize}
              onPageChange={setPage}
              itemLabel={t("contentQuality.items")}
            />
          )}
          <p className="text-xs text-slate-500">{t("contentQuality.mediaScope", { count: data.stats.externalMedia })}</p>
        </>
      )}
    </div>
  );
}

function QualityRow({
  item,
  locale,
  date,
  expanded,
  onToggle,
  rechecking,
  onRecheck,
  result,
}: {
  item: QualityReportItem;
  locale: string;
  date: (value: string | null | undefined) => string;
  expanded: boolean;
  onToggle: () => void;
  rechecking: boolean;
  onRecheck?: () => void;
  result?: { tone: "ok" | "warn" | "error"; text: string };
}) {
  const { t } = useTranslation("common");
  // "8 × Missing audio" style summary, errors first.
  const summary = useMemo(() => {
    const counts = new Map<string, { code: string; severity: string; count: number }>();
    for (const finding of item.findings) {
      const entry = counts.get(finding.code) ?? { code: finding.code, severity: finding.severity, count: 0 };
      entry.count += 1;
      counts.set(finding.code, entry);
    }
    return [...counts.values()].sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === "error" ? -1 : 1));
  }, [item.findings]);
  const panelId = `quality-${item.kind}-${item.resourceId}`;
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{t(`contentQuality.kind.${item.kind}`)}</span>
            <Link href={fixHref(locale, item)} className="min-w-0 truncate text-sm font-bold text-slate-900 hover:text-blue-700 hover:underline">
              {item.title || item.resourceId}
            </Link>
            {item.errors > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">{t("contentQuality.counts.errors", { count: item.errors })}</span>}
            {item.warnings > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">{t("contentQuality.counts.warnings", { count: item.warnings })}</span>}
            {item.stale && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{t("contentQuality.staleItem")}</span>}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {summary.slice(0, 4).map((entry) => (
              <li key={entry.code} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", entry.severity === "error" ? "bg-red-500" : "bg-amber-500")} />
                {entry.count} × {t(`contentQuality.code.${entry.code}`, { defaultValue: entry.code })}
              </li>
            ))}
            {summary.length > 4 && <li className="text-slate-400">+{summary.length - 4}</li>}
          </ul>
          <p className="text-[11px] text-slate-400">
            {t("contentQuality.id")}: <span className="font-mono">{item.resourceId}</span> ·{" "}
            {t(item.rechecked ? "contentQuality.recheckedAt" : "contentQuality.checkedAt", { time: date(item.checkedAt) })}
          </p>
          {result && (
            <p role="status" className={cn("text-xs font-medium", result.tone === "ok" ? "text-emerald-700" : result.tone === "warn" ? "text-amber-800" : "text-red-700")}>
              {result.text}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onRecheck && (
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={rechecking} onClick={onRecheck}>
              {rechecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {t(rechecking ? "contentQuality.rechecking" : "contentQuality.recheck")}
            </Button>
          )}
          <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
            <Link href={fixHref(locale, item)}>
              <SquarePen className="h-3.5 w-3.5" />
              {t("contentQuality.edit")}
            </Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}>
            {t(expanded ? "contentQuality.hideFindings" : "contentQuality.showFindings", { count: item.findings.length })}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
          </Button>
        </div>
      </div>
      {expanded && (
        <ul id={panelId} className="divide-y divide-slate-100 border-t border-slate-100">
          {item.findings.map((finding, index) => (
            <li key={`${finding.code}-${finding.path}-${index}`} className="flex flex-col gap-1.5 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="min-w-0">
                <p className="flex items-start gap-2">
                  <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", finding.severity === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800")}>
                    {t(`contentQuality.severity.${finding.severity}`)}
                  </span>
                  <span className="text-slate-800">{finding.message}</span>
                </p>
                <p className="mt-0.5 pl-12 text-[11px] text-slate-400">
                  {t(`contentQuality.groups.${finding.group}`)} · {locationLabel(t, finding.path)}
                </p>
              </div>
              <Link href={fixHref(locale, item, finding)} className="shrink-0 pl-12 text-xs font-semibold text-blue-700 hover:underline sm:pl-0">
                {t("contentQuality.fix")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function locationLabel(t: (key: string, options?: Record<string, unknown>) => string, path: string) {
  const [scope, ref, field] = path.split(".");
  if (scope === "questions" && ref) return t(field === "audioUrl" ? "contentQuality.location.questionAudio" : field === "imageUrl" ? "contentQuality.location.questionImage" : "contentQuality.location.question");
  if (scope === "passages" && ref) return t(field === "audioUrl" ? "contentQuality.location.passageAudio" : field === "imageUrl" ? "contentQuality.location.passageImage" : "contentQuality.location.passage");
  if (scope === "segments") return t("contentQuality.location.segment");
  if (scope === "part") return t("contentQuality.location.part", { part: ref });
  if (scope === "questions") return t("contentQuality.location.exam");
  if (["fullAudioUrl", "status", "audio"].includes(scope ?? "")) return t("contentQuality.location.audio");
  if (scope === "imageUrl") return t("contentQuality.location.image");
  if (scope === "words") return t("contentQuality.location.words");
  if (scope === "lessons") return t("contentQuality.location.lessons");
  return t("contentQuality.location.general");
}
