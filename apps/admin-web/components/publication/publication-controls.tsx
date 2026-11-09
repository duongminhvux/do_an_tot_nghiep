"use client";
import { useState } from "react";
import {YoutubePlayer} from '@repo/ui/youtube-player';
import {DictationStudioPreview} from '@/components/dictation/dictation-studio-preview';
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
  History,
  Loader2,
  MoreHorizontal,
  ScanEye,
} from "lucide-react";
import {
  publicationVisibility,
  type PublicationInfo,
  type PublicationIssue,
  type PublicationKind,
  type PublicationVisibility,
} from "@repo/shared-types/publication";
import {
  publicationService,
  type PublicationPreview,
} from "@/services/publication.service";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const STYLE: Record<PublicationVisibility, { pill: string; dot: string }> = {
  VISIBLE: { pill: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  HIDDEN: { pill: "border-slate-200 bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  INCOMPLETE: { pill: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
};

/** Status pill. `item` may be a list row (with `visibility`) or a publication info. */
export function PublicationBadge({
  item,
  className,
}: {
  item: Partial<PublicationInfo> & { visibility?: PublicationVisibility; isActive?: boolean };
  className?: string;
}) {
  const { t } = useTranslation("common");
  const state = item.visibility ?? publicationVisibility(item);
  return (
    <span
      title={t(`publication.hint.${state}`)}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold",
        STYLE[state].pill,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STYLE[state].dot)} />
      {t(`publication.visibility.${state}`)}
    </span>
  );
}

/** List filter. Values map to the API's `publicationStatus` query. */
export function PublicationFilter({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const { t } = useTranslation("common");
  return (
    <Select
      value={value || "ALL"}
      onValueChange={(nextValue) => onChange(nextValue === "ALL" ? "" : nextValue)}
    >
      <SelectTrigger aria-label={t("publication.filter")} className={cn("h-10 w-auto rounded-lg", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{t("publication.all")}</SelectItem>
        <SelectItem value="PUBLISHED">{t("publication.filterVisible")}</SelectItem>
        <SelectItem value="NOT_PUBLISHED">{t("publication.filterNotVisible")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

type Info = PublicationInfo & {
  audit?: (NonNullable<PublicationInfo["audit"]>[number] & { issueCount?: number })[];
};

/** Shared state for every visibility piece on a page (same query key → one request). */
export function useVisibility(kind: PublicationKind, id: string, version?: unknown) {
  const { locale = "vi" } = useParams<{ locale: string }>();
  const client = useQueryClient();
  const key = ["publication", kind, id, version, locale];
  const query = useQuery<Info>({
    queryKey: key,
    queryFn: () => publicationService.info(kind, id, locale) as Promise<Info>,
    enabled: Boolean(id),
  });
  const mutation = useMutation({
    mutationKey: ["publication-action", kind, id],
    mutationFn: (action: "publish" | "unpublish") =>
      publicationService.action(kind, id, action, locale),
    onSuccess: (data) => {
      client.setQueryData(key, data);
      // Lists and details carry `visibility`; refresh them.
      void client.invalidateQueries({
        predicate: (item) =>
          item.queryKey[0] !== "publication" && item.queryKey[0] !== "publication-preview",
      });
    },
    onError: () => void query.refetch(),
  });
  const state: PublicationVisibility | undefined = query.data
    ? (query.data.visibility ?? publicationVisibility(query.data))
    : undefined;
  const issues = (query.data?.currentIssues ?? []).filter((issue) => issue.severity === "error");
  return { query, mutation, state, issues, locale };
}

/** Status pill + one-line reason, placed next to the content title. */
export function VisibilityStatus({
  kind,
  id,
  version,
}: {
  kind: PublicationKind;
  id: string;
  version?: unknown;
}) {
  const { t } = useTranslation("common");
  const { query, state } = useVisibility(kind, id, version);
  if (query.isPending)
    return <span className="h-6 w-24 animate-pulse rounded-full bg-slate-100" aria-label={t("publication.loading")} />;
  if (!query.data || !state) return null;
  // Hidden by an edit made after the last "Show" (not by an explicit "Hide").
  const editedSinceShown = state !== "VISIBLE" && query.data.audit?.[0]?.action === "PUBLISH";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <PublicationBadge item={{ ...query.data, visibility: state }} />
      <span className="text-xs text-slate-500">
        {editedSinceShown ? t("publication.editedSinceShown") : t(`publication.hint.${state}`)}
      </span>
    </span>
  );
}

/**
 * Preview, Show/Hide and history. Show is validated by the server in one step;
 * a refusal lists what to fix (see VisibilityIssues).
 */
export function VisibilityActions({
  kind,
  id,
  version,
  blockedReason,
  size = "default",
}: {
  kind: PublicationKind;
  id: string;
  version?: unknown;
  /** e.g. unsaved changes or audio processing: Show/Hide are disabled with this hint. */
  blockedReason?: string;
  size?: "default" | "sm";
}) {
  const { t } = useTranslation("common");
  const { query, mutation, state, issues } = useVisibility(kind, id, version);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);
  const compact = size === "sm";
  const buttonClass = compact ? "h-8 gap-1.5 px-2.5 text-xs" : "h-9 gap-1.5 text-xs";
  const refused = (mutation.error as { response?: { status?: number; data?: { issues?: PublicationIssue[] } } } | null)?.response;
  const refusedCount = refused?.status === 409 ? (refused.data?.issues?.filter((i) => i.severity === "error").length ?? issues.length) : 0;
  const disabled = !query.data || mutation.isPending || Boolean(blockedReason);
  return (
    <div className="flex min-w-0 flex-col items-stretch gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={buttonClass}
          disabled={!query.data}
          onClick={() => setPreviewOpen(true)}
        >
          <ScanEye className="h-3.5 w-3.5" />
          {t("publication.preview")}
        </Button>
        {state === "VISIBLE" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={buttonClass}
            disabled={disabled}
            onClick={() => setConfirmHide(true)}
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
            {t("publication.hide")}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className={buttonClass}
            disabled={disabled}
            title={state === "INCOMPLETE" ? t("publication.showWillCheck") : undefined}
            onClick={() => mutation.mutate("publish")}
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            {t("publication.show")}
          </Button>
        )}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(buttonClass, "w-8 px-0")}
              aria-label={t("publication.more")}
              disabled={!query.data}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
              <History className="mr-2 h-4 w-4" />
              {t("publication.history")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div aria-live="polite" className="text-xs sm:text-right">
        {blockedReason ? (
          <p className="text-amber-700">{blockedReason}</p>
        ) : mutation.isError ? (
          <p role="alert" className="text-red-700">
            {refusedCount
              ? t("publication.showRefused", { count: refusedCount })
              : t("publication.actionError")}
          </p>
        ) : mutation.isSuccess ? (
          <p className="text-emerald-700">
            {state === "VISIBLE" ? t("publication.shownDone") : t("publication.hiddenDone")}
          </p>
        ) : query.isError ? (
          <button type="button" className="text-red-700 underline" onClick={() => void query.refetch()}>
            {t("publication.error")} · {t("publication.retry")}
          </button>
        ) : null}
      </div>
      {previewOpen && <PublicationPreviewDialog kind={kind} id={id} onClose={() => setPreviewOpen(false)} />}
      <Dialog open={confirmHide} onOpenChange={setConfirmHide}>
        <DialogContent className="max-w-md">
          <DialogTitle>{t("publication.hideTitle")}</DialogTitle>
          <DialogDescription>{t("publication.hideBody")}</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmHide(false)}>
              {t("publication.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmHide(false);
                mutation.mutate("unpublish");
              }}
            >
              <EyeOff className="mr-1.5 h-4 w-4" />
              {t("publication.hide")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{t("publication.history")}</DialogTitle>
          <DialogDescription>{t("publication.historyHint")}</DialogDescription>
          {query.data?.audit?.length ? (
            <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {query.data.audit.map((item, index) => (
                <li key={index} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">
                    {item.action === "VALIDATE" && item.issueCount
                      ? t("publication.audit.REFUSED", { count: item.issueCount })
                      : t(`publication.audit.${item.action}`)}
                  </span>
                  <time className="shrink-0 text-xs text-slate-500" dateTime={item.createdAt}>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{t("publication.noHistory")}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Short summary of what blocks "Show". Each issue can jump to its place
 * (question, passage, segment…) through `onSelect`.
 */
export function VisibilityIssues({
  kind,
  id,
  version,
  onSelect,
  onShowAll,
  limit = 4,
}: {
  kind: PublicationKind;
  id: string;
  version?: unknown;
  onSelect?: (issue: PublicationIssue) => void;
  onShowAll?: () => void;
  limit?: number;
}) {
  const { t } = useTranslation("common");
  const { state, issues } = useVisibility(kind, id, version);
  if (state === "VISIBLE" || !issues.length) return null;
  return (
    <section
      aria-label={t("publication.issuesTitle", { count: issues.length })}
      className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t("publication.issuesTitle", { count: issues.length })}
        </p>
        {onShowAll && issues.length > 0 && (
          <button type="button" onClick={onShowAll} className="text-xs font-semibold underline-offset-2 hover:underline">
            {t("publication.showAllIssues")}
          </button>
        )}
      </div>
      <ul className="mt-2 space-y-1">
        {issues.slice(0, limit).map((issue, index) => (
          <li key={`${issue.path}-${issue.code}-${index}`}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(issue)}
                className="group flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-amber-100/70 focus-visible:outline-2 focus-visible:outline-amber-500"
              >
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                <span>{issue.message}</span>
              </button>
            ) : (
              <span className="block px-1.5 py-1">{issue.message}</span>
            )}
          </li>
        ))}
      </ul>
      {issues.length > limit && (
        <p className="mt-1 px-1.5 text-xs text-amber-800">{t("publication.moreIssues", { count: issues.length - limit })}</p>
      )}
    </section>
  );
}

/** Status, actions and issues in one block (dialogs, secondary pages). */
export function VisibilityBar(props: {
  kind: PublicationKind;
  id: string;
  version?: unknown;
  blockedReason?: string;
  onSelect?: (issue: PublicationIssue) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <VisibilityStatus kind={props.kind} id={props.id} version={props.version} />
        <VisibilityActions kind={props.kind} id={props.id} version={props.version} blockedReason={props.blockedReason} size="sm" />
      </div>
      <VisibilityIssues kind={props.kind} id={props.id} version={props.version} onSelect={props.onSelect} limit={3} />
    </div>
  );
}

function PublicationPreviewDialog({
  kind,
  id,
  onClose,
}: {
  kind: PublicationKind;
  id: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const query = useQuery({
    queryKey: ["publication-preview", kind, id],
    queryFn: () => publicationService.preview(kind, id),
    staleTime: 0,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={`flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 ${kind==='dictation'?'max-w-[1660px] border-border bg-background text-foreground [&>button]:!bg-muted [&>button]:!text-muted-foreground':'max-w-6xl'}`}>
        <header className="shrink-0 space-y-2 border-b border-border px-4 py-5 pr-12 sm:px-6 sm:pr-14">
          <DialogTitle>{t("publication.preview")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("publication.previewHint")}
          </DialogDescription>
        </header>
        <div className={`min-h-0 min-w-0 overflow-y-auto overscroll-contain [overflow-wrap:anywhere] ${kind==='dictation'?'p-0':'p-4 sm:p-6'}`}>
          {query.isPending ? (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("publication.loading")}
            </p>
          ) : query.isError ? (
            <div role="alert" className="space-y-3">
              <p>{t("publication.error")}</p>
              <Button type="button" onClick={() => void query.refetch()}>
                {t("publication.retry")}
              </Button>
            </div>
          ) : (
            query.data && <PreviewContent data={query.data} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
function PreviewContent({ data }: { data: PublicationPreview }) {
  const { t } = useTranslation("common");
  const [revealed, setRevealed] = useState(false);
<<<<<<< HEAD
  const empty =
    !data.questions?.length && !data.segments?.length && !data.parts?.length && !data.words?.length && !data.fullAudioUrl;
=======
  if(data.kind==='dictation')return <DictationStudioPreview data={data}/>;
>>>>>>> 5f669d0 (update Dictation)
  return (
    <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
      <h3 className="text-xl font-bold">{data.title}</h3>
      {empty && <p className="text-sm text-slate-500">{t("publication.previewEmpty")}</p>}
      {data.questions?.map((q, index) => (
        <article key={q._id} className="min-w-0 space-y-3 rounded-xl border p-3 sm:p-5">
          <h4 className="font-medium">
            {t("publication.question", { count: index + 1 })} · Part {q.part}
          </h4>
          {q.passages.map((p, i) => (
            <div key={i}>
              {p.content && <p className="whitespace-pre-line">{p.content}</p>}
              {p.imageUrl && (
                <Image
                  unoptimized
                  width={720}
                  height={480}
                  src={p.imageUrl}
                  alt={t("publication.image")}
                  className="h-auto max-h-[32rem] w-auto max-w-full rounded-lg object-contain"
                />
              )}
              {p.audioUrl && (
                <audio controls src={p.audioUrl} className="block w-full min-w-0 max-w-full" />
              )}
            </div>
          ))}
          {q.imageUrl && (
            <Image
              unoptimized
              width={720}
              height={480}
              src={q.imageUrl}
              alt={t("publication.image")}
              className="h-auto max-h-[32rem] w-auto max-w-full rounded-lg object-contain"
            />
          )}
          {q.audioUrl && <audio controls src={q.audioUrl} className="block w-full min-w-0 max-w-full" />}
          <p className="whitespace-pre-line">{q.content}</p>
          {q.options.map((option) => (
            <label key={option.key} className="flex min-w-0 items-start gap-2 rounded border p-2">
              <input type="radio" name={`preview-${q._id}`} className="mt-1 shrink-0" />
              <span className="min-w-0 flex-1">{option.key}. {option.text}</span>
            </label>
          ))}
        </article>
      ))}
      {data.youtubeVideoId&&<YoutubePlayer videoId={data.youtubeVideoId}/>}
      {data.fullAudioUrl && (
        <audio controls src={data.fullAudioUrl} className="block w-full min-w-0 max-w-full" />
      )}
      {data.segments?.map((s, index) => (
        <div key={s.id} className="space-y-2 rounded-lg border p-3">
          <label className="block text-sm">
            {t("publication.question", { count: index + 1 })}
            <input
              className="mt-2 block w-full rounded border p-2"
              placeholder={t("publication.typeAnswer")}
            />
          </label>
          <details>
            <summary>{t("publication.reveal")}</summary>
            <p>{s.text}</p>
          </details>
          <p className="text-xs text-slate-500">
            {(s.startMs / 1000).toFixed(1)}–{(s.endMs / 1000).toFixed(1)}s
          </p>
        </div>
      ))}
      {data.audio && (data.audio.us || data.audio.uk) && (
        <audio
          controls
          src={data.audio.us || data.audio.uk}
          className="block w-full min-w-0 max-w-full"
        />
      )}
      {data.parts && (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRevealed((value) => !value)}
          >
            {t("publication.reveal")}
          </Button>
          {revealed &&
            data.parts.map((part, index) => (
              <div key={index}>
                <strong>{part.partOfSpeech}</strong>
                {part.meanings.map((meaning, i) => (
                  <p key={i}>
                    {[...(meaning.translation ?? []), meaning.definition]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ))}
              </div>
            ))}
        </>
      )}
      {data.words?.map((word) => (
        <p key={word.id} className="rounded border p-3">
          {word.word}{" "}
          {!word.available && (
            <span className="text-amber-700">
              · {t("publication.wordUnavailable")}
            </span>
          )}
        </p>
      ))}
    </div>
  );
}
