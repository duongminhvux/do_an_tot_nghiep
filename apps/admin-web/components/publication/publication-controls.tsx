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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("common");
  return (
    <select
      aria-label={t("publication.filter")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
    >
      <option value="">{t("publication.all")}</option>
      {states.map((state) => (
        <option key={state} value={state}>
          {t(`publication.${state}`)}
        </option>
      ))}
    </select>
  );
}
export function PublicationBar({
  kind,
  id,
  version,
  dirty = false,
}: {
  kind: PublicationKind;
  id: string;
  version?: unknown;
  dirty?: boolean;
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
  return (
    <section
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      aria-label={t("publication.title")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">
            {t("publication.title")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {t("publication.savedOnly")}
          </p>
        </div>
        {query.data && <PublicationBadge item={query.data} />}
      </div>
      <ol className="flex flex-wrap gap-3 text-xs text-slate-500">
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
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={dirty || !query.data || mutation.isPending}
          onClick={() => mutation.mutate("validate")}
        >
          {t("publication.validate")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={dirty || !query.data || mutation.isPending}
          onClick={() => setPreviewOpen(true)}
        >
          {t("publication.preview")}
        </Button>
        <Button
          type="button"
          disabled={dirty || !canPublish || mutation.isPending}
          onClick={() => mutation.mutate("publish")}
        >
          {t("publication.publish")}
        </Button>
        {query.data?.publicationStatus === "PUBLISHED" && (
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.isPending || dirty}
            onClick={() => mutation.mutate("unpublish")}
          >
            {t("publication.unpublish")}
          </Button>
        )}
      </div>
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
          }).format(new Date(query.data.publishedAt))}{" "}
          · {t("publication.by")}:{" "}
          {query.data.publishedBy ?? t("publication.legacy")}
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
                {t(`publication.${item.action}`)} · {item.actorId} ·{" "}
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
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogTitle>{t("publication.preview")}</DialogTitle>
        <p className="text-sm text-slate-500">{t("publication.previewHint")}</p>
        {query.isPending ? (
          <p role="status">{t("publication.loading")}</p>
        ) : query.isError ? (
          <div role="alert">
            <p>{t("publication.error")}</p>
            <Button type="button" onClick={() => void query.refetch()}>
              {t("publication.retry")}
            </Button>
          </div>
        ) : (
          query.data && <PreviewContent data={query.data} />
        )}
      </DialogContent>
    </Dialog>
  );
}
function PreviewContent({ data }: { data: PublicationPreview }) {
  const { t } = useTranslation("common");
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">{data.title}</h3>
      {data.questions?.map((q, index) => (
        <article key={q._id} className="space-y-3 rounded-xl border p-4">
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
                  className="max-h-80 max-w-full object-contain"
                />
              )}
              {p.audioUrl && (
                <audio controls src={p.audioUrl} className="w-full" />
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
              className="max-h-80 max-w-full object-contain"
            />
          )}
          {q.audioUrl && <audio controls src={q.audioUrl} className="w-full" />}
          <p className="whitespace-pre-line">{q.content}</p>
          {q.options.map((option) => (
            <label key={option.key} className="flex gap-2 rounded border p-2">
              <input type="radio" name={`preview-${q._id}`} />
              {option.key}. {option.text}
            </label>
          ))}
        </article>
      ))}
      {data.fullAudioUrl && (
        <audio controls src={data.fullAudioUrl} className="w-full" />
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
          className="w-full"
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
