"use client";
import { useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PublicationInfo,
  PublicationKind,
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
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
const states = ["DRAFT", "IN_REVIEW", "PUBLISHED"] as const;
export function PublicationBadge({ item }: { item: Partial<PublicationInfo> }) {
  const { t } = useTranslation("common");
  const issues = item.publicationValidation?.issues ?? [];
  return (
    <span
      title={issues.map((issue) => issue.message).join("\n")}
      className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${item.publicationStatus === "PUBLISHED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}
    >
      {t(`publication.${item.publicationStatus ?? "DRAFT"}`)}
      {issues.length > 0
        ? ` · ${t("publication.errors", { count: issues.length })}`
        : ""}
    </span>
  );
}
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
      <SelectTrigger
        aria-label={t("publication.filter")}
        className={cn("h-10 w-auto rounded-lg", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{t("publication.all")}</SelectItem>
        {states.map((state) => (
          <SelectItem key={state} value={state}>
            {t(`publication.${state}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function PublicationBar({
  kind,
  id,
  version,
  dirty = false,
  compact = false,
}: {
  kind: PublicationKind;
  id: string;
  version?: unknown;
  dirty?: boolean;
  /** Single-row layout for use inside dialogs. */
  compact?: boolean;
}) {
  const { t } = useTranslation("common");
  const { locale = "vi" } = useParams<{ locale: string }>();
  const client = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  const key = ["publication", kind, id, version, locale];
  const query = useQuery({
    queryKey: key,
    queryFn: () => publicationService.info(kind, id),
    refetchInterval: 10000,
  });
  const mutation = useMutation({
    mutationFn: (action: "validate" | "publish" | "unpublish") =>
      publicationService.action(kind, id, action, locale),
    onSuccess: (data) => {
      client.setQueryData(key, data);
      void client.invalidateQueries({
        predicate: (item) =>
          item.queryKey[0] !== "publication" &&
          item.queryKey[0] !== "publication-preview",
      });
    },
    onError: () => void query.refetch(),
  });
  const issues = query.data?.publicationValidation?.issues ?? [];
  const canPublish =
    query.data?.publicationStatus === "IN_REVIEW" &&
    query.data.publicationValidation?.revision ===
      query.data.publicationRevision &&
    !issues.some((issue) => issue.severity === "error");
  const actions = (
        <div className="flex flex-wrap gap-2">
          <Button
            size={compact ? "sm" : undefined}
            className={compact ? "h-7 px-2.5 text-xs" : undefined}
            type="button"
            variant="outline"
            disabled={dirty || !query.data || mutation.isPending}
            onClick={() => mutation.mutate("validate")}
          >
            {t("publication.validate")}
          </Button>
          <Button
            size={compact ? "sm" : undefined}
            className={compact ? "h-7 px-2.5 text-xs" : undefined}
            type="button"
            variant="outline"
            disabled={dirty || !query.data || mutation.isPending}
            onClick={() => setPreviewOpen(true)}
          >
            {t("publication.preview")}
          </Button>
          <Button
            size={compact ? "sm" : undefined}
            className={compact ? "h-7 px-2.5 text-xs" : undefined}
            type="button"
            disabled={dirty || !canPublish || mutation.isPending}
            onClick={() => mutation.mutate("publish")}
          >
            {t("publication.publish")}
          </Button>
          {query.data?.publicationStatus === "PUBLISHED" && (
            <Button
            size={compact ? "sm" : undefined}
            className={compact ? "h-7 px-2.5 text-xs" : undefined}
              type="button"
              variant="secondary"
              disabled={mutation.isPending || dirty}
              onClick={() => mutation.mutate("unpublish")}
            >
              {t("publication.unpublish")}
            </Button>
          )}
        </div>
  );
  return (
    <section
      className={
        compact
          ? "space-y-2 rounded-[6px] border border-slate-200 bg-slate-50/60 px-3 py-2.5"
          : "space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      }
      aria-label={t("publication.title")}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className={compact ? "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1" : ""}>
          <h2 className={compact ? "text-sm font-semibold text-slate-900" : "font-semibold text-slate-900"}>
            {t("publication.title")}
          </h2>
          {compact ? (
            query.data && <PublicationBadge item={query.data} />
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {t("publication.savedOnly")}
            </p>
          )}
        </div>
        {!compact && query.data && <PublicationBadge item={query.data} />}
        {compact && actions}
      </div>
      <ol className={compact ? "flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500" : "flex flex-wrap gap-3 text-xs text-slate-500"}>
        {states.map((state, index) => (
          <li
            key={state}
            aria-current={
              query.data?.publicationStatus === state ? "step" : undefined
            }
            className={
              query.data?.publicationStatus === state
                ? "font-bold text-blue-700"
                : ""
            }
          >
            {index + 1}. {t(`publication.${state}`)}
          </li>
        ))}
      </ol>
      {query.isPending && (
        <div role="status" className="h-10 animate-pulse rounded bg-slate-100">
          {t("publication.loading")}
        </div>
      )}
      {query.isError && (
        <div role="alert">
          <p>{t("publication.error")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            {t("publication.retry")}
          </Button>
        </div>
      )}
      {dirty && (
        <p role="status" className="text-sm text-amber-700">
          {t("publication.unsaved")}
        </p>
      )}
      {!compact && actions}
      {mutation.isPending && (
        <p role="status" className="text-sm">
          {t("publication.saving")}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-sm text-emerald-700">
          {t("publication.saved")}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t("publication.actionError")}
        </p>
      )}
      {!!issues.length && (
        <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {issues.map((issue, index) => (
            <li key={index}>
              <strong>{issue.path}: </strong>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      {query.data?.publicationValidation && !issues.length && (
        <p role="status" className="text-sm text-emerald-700">
          {t("publication.valid")}
        </p>
      )}
      {query.data?.publishedAt && (
        <p className="break-all text-xs text-slate-500">
          {t("publication.publishedAt")}:{" "}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(query.data.publishedAt))}
        </p>
      )}
      {!!query.data?.audit?.length && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">
            {t("publication.history")}
          </summary>
          <ul className="mt-2 space-y-1">
            {query.data.audit.map((item, index) => (
              <li key={index} className="break-all">
                {t(`publication.${item.action}`)} ·{" "}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(item.createdAt))}
              </li>
            ))}
          </ul>
        </details>
      )}
      {previewOpen && (
        <PublicationPreviewDialog
          kind={kind}
          id={id}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </section>
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
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <header className="shrink-0 space-y-2 border-b border-slate-200 px-4 py-5 pr-12 sm:px-6 sm:pr-14">
          <DialogTitle>{t("publication.preview")}</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {t("publication.previewHint")}
          </DialogDescription>
        </header>
        <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain p-4 [overflow-wrap:anywhere] sm:p-6">
          {query.isPending ? (
            <p role="status">{t("publication.loading")}</p>
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
  return (
    <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
      <h3 className="text-xl font-bold">{data.title}</h3>
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
