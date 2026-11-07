"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileAudio,
  FileImage,
  FolderOpen,
  Gamepad2,
  Headphones,
  ImageOff,
  Maximize2,
  RefreshCw,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  MediaCategory,
  MediaItemKind,
  MediaReference,
} from "@repo/shared-types";
import { mediaLibraryService } from "@/services/media-library.service";
import { ListPagination } from "@/components/ui/list-pagination";
import { LoadError } from "@/components/ui/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useListPagination } from "@/hooks/use-list-pagination";
import { cn } from "@/lib/utils";

type MediaType = "image" | "audio";

const groups: {
  id: MediaCategory;
  name: string;
  vi: string;
  en: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  {
    id: "dictation",
    name: "Dictation",
    vi: "Ảnh và audio của các bài luyện nghe.",
    en: "Lesson images and dictation recordings.",
    icon: Headphones,
    tone: "bg-blue-50 text-blue-600 ring-blue-100",
  },
  {
    id: "games",
    name: "Games",
    vi: "Ảnh đại diện, nhạc nền và âm thanh minigame.",
    en: "Minigame images, music and sound effects.",
    icon: Gamepad2,
    tone: "bg-violet-50 text-violet-600 ring-violet-100",
  },
  {
    id: "vocab",
    name: "Vocab",
    vi: "Bộ sưu tập, bài học, ảnh và phát âm từ vựng.",
    en: "Collections, lessons, word images and pronunciation.",
    icon: BookOpen,
    tone: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  },
  {
    id: "toeic",
    name: "TOEIC",
    vi: "Ảnh và audio của đề thi, câu hỏi và đoạn văn.",
    en: "Exam, question and passage images and audio.",
    icon: FileAudio,
    tone: "bg-amber-50 text-amber-600 ring-amber-100",
  },
];
const defaults: Record<MediaCategory, MediaItemKind> = {
  dictation: "lesson",
  vocab: "lesson",
  toeic: "exam",
  games: "game",
};
const typeTabs: { type: MediaType; vi: string; en: string; icon: LucideIcon }[] =
  [
    { type: "image", vi: "Hình ảnh", en: "Images", icon: FileImage },
    { type: "audio", vi: "Âm thanh", en: "Audios", icon: FileAudio },
  ];
const secondaryButton =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50";
const iconButton =
  "inline-flex size-8 items-center justify-center rounded-lg text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500";

function fileName(url: string) {
  try {
    return decodeURIComponent(
      new URL(url).pathname.split("/").at(-1) || url,
    );
  } catch {
    return url;
  }
}
function extension(url: string) {
  const ext = fileName(url).split(".").at(-1);
  return ext && ext.length <= 5 ? ext.toUpperCase() : null;
}

function statusTone(status: string) {
  const value = status.toUpperCase();
  if (["PUBLISHED", "ACTIVE", "READY"].includes(value))
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["DRAFT", "PENDING"].includes(value))
    return "bg-slate-100 text-slate-600 ring-slate-200";
  if (["ARCHIVED", "HIDDEN", "INACTIVE", "UNPUBLISHED"].includes(value))
    return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function useCopy() {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("error");
    }
  };
  return { state, copy };
}

function CopyButton({ url, english }: { url: string; english: boolean }) {
  const { state, copy } = useCopy();
  const label =
    state === "copied"
      ? english
        ? "Copied"
        : "Đã sao chép"
      : state === "error"
        ? english
          ? "Cannot copy"
          : "Không sao chép được"
        : english
          ? "Copy link"
          : "Sao chép link";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        iconButton,
        state === "copied" && "text-emerald-600",
        state === "error" && "text-red-600",
      )}
      onClick={() => void copy(url)}
    >
      {state === "copied" ? (
        <Check aria-hidden="true" className="size-4" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
      <span aria-live="polite" className="sr-only">
        {state !== "idle" ? label : ""}
      </span>
    </button>
  );
}

function UsageSummary({
  asset,
  english,
}: {
  asset: MediaReference;
  english: boolean;
}) {
  const first = asset.usages[0];
  return (
    <p className="truncate text-xs text-slate-500">
      {first ? (english ? first.labelEn : first.label) : "—"}
      {asset.usages.length > 1 && (
        <span className="text-slate-400"> +{asset.usages.length - 1}</span>
      )}
    </p>
  );
}

function ImageTile({
  asset,
  english,
  onPreview,
}: {
  asset: MediaReference;
  english: boolean;
  onPreview: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const name = fileName(asset.url);
  const ext = extension(asset.url);
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onPreview}
        aria-label={`${english ? "Preview" : "Xem trước"} ${name}`}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        {failed ? (
          <span className="flex size-full flex-col items-center justify-center gap-2 bg-slate-50 p-4 text-center text-xs text-slate-500">
            <ImageOff aria-hidden="true" className="size-6 text-slate-400" />
            {english ? "Preview unavailable" : "Không tải được ảnh"}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none"
            onError={() => setFailed(true)}
          />
        )}
        {ext && (
          <span className="absolute left-2 top-2 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
            {ext}
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md bg-white/90 text-slate-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
        >
          <Maximize2 className="size-3.5" />
        </span>
      </button>
      <div className="flex min-w-0 items-center gap-1 border-t border-slate-100 py-2 pl-3 pr-1.5">
        <div className="min-w-0 flex-1">
          <p
            title={name}
            className="truncate text-[13px] font-medium text-slate-800"
          >
            {name}
          </p>
          <UsageSummary asset={asset} english={english} />
        </div>
        <CopyButton url={asset.url} english={english} />
      </div>
    </article>
  );
}

function AudioRow({
  asset,
  english,
}: {
  asset: MediaReference;
  english: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const name = fileName(asset.url);
  return (
    <li className="grid min-w-0 gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <FileAudio aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <p title={name} className="truncate text-sm font-medium text-slate-800">
            {name}
          </p>
          <UsageSummary asset={asset} english={english} />
        </div>
      </div>
      {failed ? (
        <p role="status" className="text-xs text-red-600">
          {english
            ? "Audio unavailable. Try opening the file."
            : "Không tải được audio. Hãy thử mở file."}
        </p>
      ) : (
        <audio
          controls
          preload="none"
          src={asset.url}
          className="h-9 w-full min-w-0"
          aria-label={name}
          onError={() => setFailed(true)}
        />
      )}
      <div className="flex items-center gap-1 justify-self-end">
        <a
          href={asset.url}
          target="_blank"
          rel="noopener noreferrer"
          title={english ? "Open file" : "Mở file"}
          aria-label={english ? "Open file" : "Mở file"}
          className={iconButton}
        >
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
        <CopyButton url={asset.url} english={english} />
      </div>
    </li>
  );
}

function PreviewDialog({
  asset,
  english,
  onClose,
}: {
  asset: MediaReference | null;
  english: boolean;
  onClose: () => void;
}) {
  const { state, copy } = useCopy();
  return (
    <Dialog open={!!asset} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-4xl">
        {asset && (
          <div className="grid max-h-[92vh] min-h-0 md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-h-64 items-center justify-center bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:20px_20px] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.url}
                alt={fileName(asset.url)}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] max-w-full object-contain"
              />
            </div>
            <div className="flex min-h-0 flex-col border-t border-slate-200 md:border-l md:border-t-0">
              <div className="space-y-1 border-b border-slate-100 p-5 pr-12">
                <DialogTitle className="break-all text-sm font-semibold text-slate-900">
                  {fileName(asset.url)}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {english ? "Image" : "Hình ảnh"}
                  {extension(asset.url) ? ` · ${extension(asset.url)}` : ""}
                </DialogDescription>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {english ? "Used in" : "Vị trí sử dụng"} (
                  {asset.usages.length})
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {asset.usages.map((usage) => (
                    <li
                      key={`${usage.sourceId}-${usage.label}`}
                      className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700 [overflow-wrap:anywhere]"
                    >
                      {english ? usage.labelEn : usage.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2 border-t border-slate-100 p-4">
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(secondaryButton, "flex-1")}
                >
                  <ExternalLink aria-hidden="true" className="size-4" />
                  {english ? "Open file" : "Mở file"}
                </a>
                <button
                  type="button"
                  className={cn(secondaryButton, "flex-1")}
                  onClick={() => void copy(asset.url)}
                >
                  {state === "copied" ? (
                    <Check aria-hidden="true" className="size-4 text-emerald-600" />
                  ) : (
                    <Copy aria-hidden="true" className="size-4" />
                  )}
                  {state === "copied"
                    ? english
                      ? "Copied"
                      : "Đã sao chép"
                    : state === "error"
                      ? english
                        ? "Cannot copy"
                        : "Không sao chép được"
                      : english
                        ? "Copy link"
                        : "Sao chép link"}
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default function MediaLibraryPage() {
  const { locale } = useParams();
  const english = locale === "en";
  const router = useRouter();
  const params = useSearchParams();
  const group = groups.find((item) => item.id === params.get("category"));
  const category = group?.id;
  const requestedKind = params.get("kind");
  const kind: MediaItemKind =
    category === "vocab" &&
    ["lesson", "collection", "word"].includes(requestedKind || "")
      ? (requestedKind as MediaItemKind)
      : defaults[category || "dictation"];
  const id = params.get("id");
  const query = (params.get("q") || "").slice(0, 150);
  const [search, setSearch] = useState(query);
  const [preview, setPreview] = useState<MediaReference | null>(null);
  useEffect(() => setSearch(query), [query, category, kind]);
  const page = Math.min(
    100000,
    Math.max(1, Math.floor(Number(params.get("page"))) || 1),
  );
  const pageSize = [5, 10, 20, 50].includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 10;
  const type: MediaType = params.get("type") === "audio" ? "audio" : "image";
  const href = (change: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(change)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    return `/${locale}/media${next.size ? "?" + next : ""}`;
  };
  const setParams = (
    change: Record<string, string | null>,
    replace = false,
  ) => {
    const url = href(change);
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };
  const list = useQuery({
    queryKey: ["media-library", category, kind, query, page, pageSize],
    queryFn: () =>
      mediaLibraryService.list(category!, {
        kind,
        search: query,
        page,
        pageSize,
      }),
    enabled: !!category && !id,
  });
  const detail = useQuery({
    queryKey: ["media-library-detail", category, kind, id],
    queryFn: () => mediaLibraryService.detail(category!, id!, kind),
    enabled: !!category && !!id,
    staleTime: 0,
  });
  const totalPages = Math.max(1, Math.ceil((list.data?.total || 0) / pageSize));
  useEffect(() => {
    if (!id && list.isSuccess && page > totalPages)
      setParams({ page: String(totalPages) }, true);
    // URL state is the pagination source; clamp when records are removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, list.isSuccess, page, totalPages]);
  const assets = detail.data?.assets;
  const counts = useMemo(
    () => ({
      image: (assets || []).filter((asset) => asset.type === "image").length,
      audio: (assets || []).filter((asset) => asset.type === "audio").length,
    }),
    [assets],
  );
  const visibleAssets = useMemo(
    () => (assets || []).filter((asset) => asset.type === type),
    [assets, type],
  );
  const assetPage = useListPagination(
    visibleAssets,
    `${category}/${kind}/${id}/${type}`,
    type === "image" ? 20 : 10,
  );
  const title = english ? "Media library" : "Quản lý media";
  const typeLabel = (value: MediaType) =>
    typeTabs.find((tab) => tab.type === value)![english ? "en" : "vi"];
  const loading = id ? detail.isLoading : list.isLoading;
  const fetching = id ? detail.isFetching : list.isFetching;
  const failed = id ? detail.isError : list.isError;
  const refetch = () => void (id ? detail.refetch() : list.refetch());

  return (
    <main className="w-full min-w-0 space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav
            aria-label={english ? "Breadcrumb" : "Đường dẫn"}
            className="mb-1.5 flex flex-wrap items-center gap-1 text-xs text-slate-500"
          >
            <Link
              href={`/${locale}/media?type=${type}`}
              className="rounded hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              {title}
            </Link>
            {group && (
              <>
                <ChevronRight aria-hidden="true" className="size-3 text-slate-300" />
                <Link
                  href={href({ id: null })}
                  aria-current={!id ? "page" : undefined}
                  className={cn(
                    "rounded hover:text-blue-600",
                    !id && "font-medium text-slate-700",
                  )}
                >
                  {group.name}
                </Link>
              </>
            )}
            {id && detail.data && (
              <>
                <ChevronRight aria-hidden="true" className="size-3 text-slate-300" />
                <span
                  aria-current="page"
                  className="max-w-[40ch] truncate font-medium text-slate-700"
                >
                  {detail.data.item.title}
                </span>
              </>
            )}
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {english
              ? "Browse images and audio referenced by learning content."
              : "Tra cứu hình ảnh và âm thanh đang được nội dung học tập sử dụng."}
          </p>
        </div>
        {category && (
          <button
            type="button"
            onClick={refetch}
            disabled={fetching}
            className={secondaryButton}
          >
            <RefreshCw
              aria-hidden="true"
              className={cn("size-4", fetching && "motion-safe:animate-spin")}
            />
            {english ? "Refresh" : "Làm mới"}
          </button>
        )}
      </header>

      <div className="flex flex-col gap-3 border-b border-slate-200 lg:flex-row lg:items-end lg:justify-between">
        <nav
          aria-label={english ? "Content groups" : "Nhóm nội dung"}
          className="-mb-px flex min-w-0 gap-1 overflow-x-auto"
        >
          {groups.map(({ id: key, name, icon: Icon }) => {
            const active = category === key;
            return (
              <Link
                key={key}
                href={`/${locale}/media?type=${type}&category=${key}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium outline-none transition-colors focus-visible:bg-slate-100",
                  active
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {name}
              </Link>
            );
          })}
        </nav>
        <div
          role="group"
          aria-label={english ? "Media type" : "Loại media"}
          className="mb-2 inline-flex w-fit shrink-0 rounded-lg bg-slate-100 p-1"
        >
          {typeTabs.map(({ type: value, icon: Icon, vi, en }) => (
            <Link
              key={value}
              href={href({ type: value })}
              scroll={false}
              aria-current={type === value ? "true" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500",
                type === value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {english ? en : vi}
              {id && detail.data && (
                <span
                  className={cn(
                    "rounded px-1.5 text-xs tabular-nums",
                    type === value
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-200/70 text-slate-500",
                  )}
                >
                  {counts[value]}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {!category ? (
        <section
          aria-label={english ? "Content groups" : "Nhóm nội dung"}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {groups.map(({ id: key, name, vi, en, icon: Icon, tone }) => (
            <Link
              key={key}
              href={`/${locale}/media?type=${type}&category=${key}`}
              className="group flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-5 outline-none transition-[border-color,box-shadow] hover:border-blue-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg ring-1 ring-inset",
                  tone,
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-slate-900">
                {name}
              </h2>
              <p className="mt-1 flex-1 text-sm leading-6 text-slate-500">
                {english ? en : vi}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600">
                {english ? "Browse" : "Xem"} {typeLabel(type).toLowerCase()}
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </span>
            </Link>
          ))}
        </section>
      ) : id ? (
        <section
          aria-label={english ? "Media in content" : "Media của nội dung"}
          className="min-w-0 space-y-4"
        >
          <div className="flex flex-wrap items-start gap-3">
            <button
              type="button"
              aria-label={english ? "Back to content" : "Về danh sách"}
              title={english ? "Back to content" : "Về danh sách"}
              className={cn(secondaryButton, "w-9 px-0")}
              onClick={() => setParams({ id: null })}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </button>
            {detail.data ? (
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-lg font-semibold text-slate-900">
                    {detail.data.item.title}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                      statusTone(detail.data.item.status),
                    )}
                  >
                    {detail.data.item.status}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {detail.data.item.subtitle}
                </p>
              </div>
            ) : (
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-4 w-40" />
              </div>
            )}
          </div>
          {category === "games" && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
              {english
                ? "Game images and configured sound effects appear here. Shared word images and pronunciation are available under Vocab."
                : "Ảnh và âm thanh cấu hình của trò chơi được liệt kê ở đây. Ảnh và phát âm từ vựng dùng chung nằm trong nhóm Vocab."}
            </p>
          )}
          {loading ? (
            type === "image" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {Array.from({ length: 10 }, (_, index) => (
                  <Skeleton key={index} className="aspect-[4/3.6] rounded-xl" />
                ))}
              </div>
            ) : (
              <ListSkeleton />
            )
          ) : failed ? (
            <LoadError onRetry={refetch} />
          ) : !visibleAssets.length ? (
            <EmptyPanel
              icon={type === "image" ? ImageOff : FileAudio}
              title={
                english
                  ? `No ${typeLabel(type).toLowerCase()} in this content`
                  : `Nội dung này chưa có ${typeLabel(type).toLowerCase()}`
              }
              description={
                counts[type === "image" ? "audio" : "image"]
                  ? english
                    ? `It has ${counts[type === "image" ? "audio" : "image"]} ${typeLabel(type === "image" ? "audio" : "image").toLowerCase()}.`
                    : `Nội dung có ${counts[type === "image" ? "audio" : "image"]} mục ${typeLabel(type === "image" ? "audio" : "image").toLowerCase()}.`
                  : undefined
              }
              action={
                counts[type === "image" ? "audio" : "image"] ? (
                  <Link
                    href={href({ type: type === "image" ? "audio" : "image" })}
                    scroll={false}
                    className={secondaryButton}
                  >
                    {english ? "View" : "Xem"}{" "}
                    {typeLabel(type === "image" ? "audio" : "image").toLowerCase()}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {type === "image" ? (
                <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {assetPage.items.map((asset) => (
                    <ImageTile
                      key={asset.url}
                      asset={asset}
                      english={english}
                      onPreview={() => setPreview(asset)}
                    />
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {assetPage.items.map((asset) => (
                    <AudioRow key={asset.url} asset={asset} english={english} />
                  ))}
                </ul>
              )}
              <ListPagination pagination={assetPage} />
            </div>
          )}
        </section>
      ) : (
        <section
          aria-label={english ? "Content" : "Nội dung"}
          className="min-w-0 space-y-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {category === "vocab" && (
              <div
                role="group"
                aria-label={
                  english ? "Vocabulary resources" : "Loại nội dung từ vựng"
                }
                className="inline-flex w-fit shrink-0 rounded-lg border border-slate-200 bg-white p-1"
              >
                {(["lesson", "collection", "word"] as const).map(
                  (value, index) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={kind === value}
                      className={cn(
                        "h-8 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500",
                        kind === value
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-500 hover:text-slate-800",
                      )}
                      onClick={() =>
                        setParams({ kind: value, page: null, q: null })
                      }
                    >
                      {
                        (english
                          ? ["Lessons", "Collections", "Dictionary"]
                          : ["Bài học", "Bộ sưu tập", "Từ điển"])[index]
                      }
                    </button>
                  ),
                )}
              </div>
            )}
            <form
              role="search"
              className="relative min-w-0 flex-1 sm:max-w-md"
              onSubmit={(event) => {
                event.preventDefault();
                setParams({ q: search.trim() || null, page: null });
              }}
            >
              <label className="sr-only" htmlFor="media-search">
                {english ? "Search content" : "Tìm nội dung"}
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              />
              <input
                id="media-search"
                type="search"
                maxLength={150}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100 [&::-webkit-search-cancel-button]:hidden"
                placeholder={
                  english
                    ? "Search by title, press Enter…"
                    : "Tìm theo tên, nhấn Enter…"
                }
              />
              {(search || query) && (
                <button
                  type="button"
                  aria-label={english ? "Clear search" : "Xoá tìm kiếm"}
                  className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => {
                    setSearch("");
                    if (query) setParams({ q: null, page: null });
                  }}
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              )}
            </form>
            {list.data && (
              <p className="text-xs text-slate-500 sm:ml-auto">
                {english
                  ? `${list.data.total} items`
                  : `${list.data.total} nội dung`}
              </p>
            )}
          </div>
          {loading ? (
            <ListSkeleton />
          ) : failed ? (
            <LoadError onRetry={refetch} />
          ) : !list.data?.items.length ? (
            <EmptyPanel
              icon={Search}
              title={
                english ? "No matching content" : "Không tìm thấy nội dung phù hợp"
              }
              description={
                query
                  ? english
                    ? `Nothing matches “${query}”.`
                    : `Không có kết quả cho “${query}”.`
                  : undefined
              }
              action={
                query ? (
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => setParams({ q: null, page: null })}
                  >
                    {english ? "Clear search" : "Xoá tìm kiếm"}
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_120px_32px] gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs font-semibold text-slate-500 md:grid">
                <span>{english ? "Content" : "Nội dung"}</span>
                <span>{english ? "Belongs to" : "Thuộc"}</span>
                <span>{english ? "Status" : "Trạng thái"}</span>
                <span className="sr-only">{english ? "Open" : "Mở"}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {list.data.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={href({ id: item.id })}
                      scroll={false}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 outline-none transition-colors hover:bg-slate-50 focus-visible:bg-blue-50/60 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_120px_32px]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                          <FolderOpen aria-hidden="true" className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {item.title}
                          </span>
                          <span className="block truncate text-xs text-slate-500 md:hidden">
                            {item.subtitle}
                          </span>
                        </span>
                      </span>
                      <span className="hidden truncate text-sm text-slate-600 md:block">
                        {item.subtitle || "—"}
                      </span>
                      <span className="justify-self-end md:justify-self-start">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                            statusTone(item.status),
                          )}
                        >
                          {item.status}
                        </span>
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="hidden size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 motion-reduce:transition-none md:block"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
              <ListPagination
                disabled={list.isFetching}
                pagination={{
                  page,
                  pageSize,
                  totalPages,
                  totalItems: list.data?.total || 0,
                  setPage: (value) => setParams({ page: String(value) }),
                  setPageSize: (value) =>
                    setParams({ size: String(value), page: null }),
                }}
              />
            </div>
          )}
        </section>
      )}
      <PreviewDialog
        asset={preview}
        english={english}
        onClose={() => setPreview(null)}
      />
    </main>
  );
}
