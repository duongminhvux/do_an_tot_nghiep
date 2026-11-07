"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileAudio,
  FileImage,
  Folder,
  FolderOpen,
  Gamepad2,
  Headphones,
  Home,
  ImageOff,
  LayoutGrid,
  List,
  Music,
  RefreshCw,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import type { MediaCategory, MediaItemKind, MediaReference } from "@repo/shared-types";
import { mediaLibraryService } from "@/services/media-library.service";
import { ListPagination } from "@/components/ui/list-pagination";
import { LoadError } from "@/components/ui/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useListPagination } from "@/hooks/use-list-pagination";
import { cn } from "@/lib/utils";

type AssetType = "all" | "image" | "audio";
type View = "grid" | "list";

const groups: { id: MediaCategory; name: string; vi: string; en: string; icon: LucideIcon; tone: string }[] = [
  { id: "vocab", name: "Vocab", vi: "Bộ sưu tập, bài học, ảnh và phát âm từ vựng", en: "Collections, lessons, word images and pronunciation", icon: BookOpen, tone: "text-emerald-500" },
  { id: "toeic", name: "TOEIC", vi: "Ảnh và audio của đề thi, câu hỏi, đoạn văn", en: "Exam, question and passage images and audio", icon: FileAudio, tone: "text-amber-500" },
  { id: "dictation", name: "Dictation", vi: "Ảnh và audio của bài luyện nghe", en: "Lesson images and dictation recordings", icon: Headphones, tone: "text-blue-500" },
  { id: "games", name: "Games", vi: "Ảnh, nhạc nền và âm thanh minigame", en: "Minigame images, music and sound effects", icon: Gamepad2, tone: "text-violet-500" },
];
const defaults: Record<MediaCategory, MediaItemKind> = { dictation: "lesson", vocab: "lesson", toeic: "exam", games: "game" };
const vocabKinds = [
  { kind: "lesson" as const, vi: "Bài học", en: "Lessons" },
  { kind: "collection" as const, vi: "Bộ sưu tập", en: "Collections" },
  { kind: "word" as const, vi: "Từ điển", en: "Dictionary" },
];

const fileName = (url: string) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").at(-1) || url);
  } catch {
    return url.split("/").at(-1) || url;
  }
};
const extension = (url: string) => {
  const name = fileName(url);
  const ext = name.split(".").at(-1);
  return ext && ext.length <= 5 && ext !== name ? ext.toUpperCase() : null;
};
const statusTone = (status: string) =>
  ["PUBLISHED", "ACTIVE", "READY"].includes(status.toUpperCase())
    ? "bg-emerald-50 text-emerald-700"
    : ["DRAFT", "PENDING"].includes(status.toUpperCase())
      ? "bg-slate-100 text-slate-600"
      : "bg-amber-50 text-amber-700";

const checker = "bg-[repeating-conic-gradient(#eef2f6_0_25%,#fff_0_50%)] bg-[length:14px_14px]";

function useCopy() {
  const [copied, setCopied] = useState<"idle" | "ok" | "error">("idle");
  useEffect(() => {
    if (copied === "idle") return;
    const timer = setTimeout(() => setCopied("idle"), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  return {
    copied,
    copy: async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied("ok");
      } catch {
        setCopied("error");
      }
    },
  };
}

/* ───────────────────────── Assets ───────────────────────── */

function Thumb({ asset, className, iconSize = "size-8" }: { asset: MediaReference; className?: string; iconSize?: string }) {
  const [failed, setFailed] = useState(false);
  if (asset.type === "audio")
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-500", className)}>
        <Music aria-hidden="true" className={iconSize} />
      </div>
    );
  return (
    <div className={cn("flex items-center justify-center overflow-hidden", checker, className)}>
      {failed ? (
        <ImageOff aria-hidden="true" className="size-6 text-slate-400" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-contain" />
      )}
    </div>
  );
}

function AssetTile({ asset, selected, onSelect, en }: { asset: MediaReference; selected: boolean; onSelect: () => void; en: boolean }) {
  const name = fileName(asset.url);
  const ext = extension(asset.url);
  const { copied, copy } = useCopy();
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-white transition-shadow",
        selected ? "border-blue-500 ring-2 ring-blue-500/30" : "border-slate-200 hover:shadow-md",
      )}
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={name} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
        <Thumb asset={asset} className="aspect-square w-full" />
        <div className="border-t border-slate-100 px-2.5 py-2">
          <p title={name} className="truncate text-xs font-medium text-slate-800">{name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] text-slate-500">
            {asset.type === "image" ? <FileImage aria-hidden="true" className="size-3" /> : <FileAudio aria-hidden="true" className="size-3" />}
            {ext ?? (asset.type === "image" ? "IMG" : "AUDIO")}
            <span className="text-slate-300">·</span>
            {asset.usages.length} {en ? "uses" : "nơi dùng"}
          </p>
        </div>
      </button>
      <div className="pointer-events-none absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => void copy(asset.url)}
          title={en ? "Copy URL" : "Sao chép URL"}
          aria-label={en ? "Copy URL" : "Sao chép URL"}
          className="flex size-7 items-center justify-center rounded-md bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 hover:text-blue-600"
        >
          {copied === "ok" ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
        </button>
        <a
          href={asset.url}
          target="_blank"
          rel="noopener noreferrer"
          title={en ? "Open" : "Mở"}
          aria-label={en ? "Open" : "Mở"}
          className="flex size-7 items-center justify-center rounded-md bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 hover:text-blue-600"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function DetailsPanel({ asset, en, onClose }: { asset: MediaReference; en: boolean; onClose: () => void }) {
  const { copied, copy } = useCopy();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setSize(null);
    setFailed(false);
  }, [asset.url]);
  const name = fileName(asset.url);
  const rows: [string, ReactNode][] = [
    [en ? "Type" : "Loại", asset.type === "image" ? (en ? "Image" : "Hình ảnh") : "Audio"],
    [en ? "Format" : "Định dạng", extension(asset.url) ?? "—"],
    ...(asset.type === "image" ? ([[en ? "Dimensions" : "Kích thước", size ? `${size.w} × ${size.h}` : "—"]] as [string, ReactNode][]) : []),
    [en ? "Used in" : "Số nơi dùng", asset.usages.length],
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{en ? "Asset details" : "Chi tiết file"}</h2>
        <button type="button" onClick={onClose} aria-label={en ? "Close" : "Đóng"} className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {asset.type === "image" ? (
          <div className={cn("flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-slate-200", checker)}>
            {failed ? (
              <div className="flex flex-col items-center gap-1 text-xs text-slate-500">
                <ImageOff className="size-6 text-slate-400" />
                {en ? "Preview unavailable" : "Không tải được ảnh"}
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.url}
                alt={name}
                referrerPolicy="no-referrer"
                onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                onError={() => setFailed(true)}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
            <Music aria-hidden="true" className="mx-auto size-10 text-blue-500" />
            <audio controls preload="metadata" src={asset.url} className="w-full" aria-label={name} />
          </div>
        )}
        <div>
          <p className="break-all text-sm font-semibold text-slate-900">{name}</p>
          <dl className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 px-3 py-2">
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-medium tabular-nums text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="asset-url" className="text-xs font-semibold text-slate-600">URL</label>
          <div className="flex gap-1.5">
            <input id="asset-url" readOnly value={asset.url} onFocus={(e) => e.currentTarget.select()} className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 font-mono text-[11px] text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-500" />
            <button type="button" onClick={() => void copy(asset.url)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              {copied === "ok" ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied === "ok" ? (en ? "Copied" : "Đã chép") : copied === "error" ? (en ? "Failed" : "Lỗi") : en ? "Copy" : "Chép"}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-slate-600">{en ? "Used in" : "Đang được dùng ở"}</h3>
          <ul className="space-y-1">
            {asset.usages.map((usage) => (
              <li key={`${usage.sourceId}-${usage.label}`} className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs leading-5 text-slate-700 [overflow-wrap:anywhere]">
                {en ? usage.labelEn : usage.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 p-3">
        <a href={asset.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
          <ExternalLink className="size-4" />
          {en ? "Open original" : "Mở file gốc"}
        </a>
      </div>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function MediaLibraryPage() {
  const { locale } = useParams();
  const en = locale === "en";
  const router = useRouter();
  const params = useSearchParams();
  const group = groups.find((item) => item.id === params.get("category"));
  const category = group?.id;
  const requestedKind = params.get("kind");
  const kind: MediaItemKind =
    category === "vocab" && ["lesson", "collection", "word"].includes(requestedKind || "")
      ? (requestedKind as MediaItemKind)
      : defaults[category || "dictation"];
  const id = params.get("id");
  const query = (params.get("q") || "").slice(0, 150);
  const type: AssetType = params.get("type") === "image" ? "image" : params.get("type") === "audio" ? "audio" : "all";
  const view: View = params.get("view") === "list" ? "list" : "grid";
  const page = Math.min(100000, Math.max(1, Math.floor(Number(params.get("page"))) || 1));
  const pageSize = [5, 10, 20, 50].includes(Number(params.get("size"))) ? Number(params.get("size")) : 20;
  const [search, setSearch] = useState(query);
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [openTree, setOpenTree] = useState<Record<string, boolean>>({ vocab: true });
  useEffect(() => setSearch(query), [query, category, kind]);
  useEffect(() => {
    setSelectedUrl(null);
    setAssetSearch("");
  }, [id]);

  const href = (change: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(change)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    return `/${locale}/media${next.size ? `?${next}` : ""}`;
  };
  const setParams = (change: Record<string, string | null>, replace = false) =>
    replace ? router.replace(href(change), { scroll: false }) : router.push(href(change), { scroll: false });

  const list = useQuery({
    queryKey: ["media-library", category, kind, query, page, pageSize],
    queryFn: () => mediaLibraryService.list(category!, { kind, search: query, page, pageSize }),
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
    if (!id && list.isSuccess && page > totalPages) setParams({ page: String(totalPages) }, true);
    // URL is the pagination source; clamp when records are removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, list.isSuccess, page, totalPages]);

  const assets = useMemo(() => detail.data?.assets ?? [], [detail.data]);
  const counts = { all: assets.length, image: assets.filter((a) => a.type === "image").length, audio: assets.filter((a) => a.type === "audio").length };
  const visibleAssets = useMemo(() => {
    const term = assetSearch.trim().toLowerCase();
    return assets.filter(
      (asset) =>
        (type === "all" || asset.type === type) &&
        (!term || fileName(asset.url).toLowerCase().includes(term) || asset.usages.some((u) => `${u.label} ${u.labelEn}`.toLowerCase().includes(term))),
    );
  }, [assets, type, assetSearch]);
  const assetPage = useListPagination(visibleAssets, `${category}/${kind}/${id}/${type}/${assetSearch}`, 20);
  const selected = assets.find((asset) => asset.url === selectedUrl) ?? null;
  const fetching = id ? detail.isFetching : list.isFetching;
  const title = en ? "Media library" : "Thư viện media";
  const kindLabel = category === "vocab" ? vocabKinds.find((k) => k.kind === kind)?.[en ? "en" : "vi"] : null;

  const crumbs: { label: string; to?: string }[] = [{ label: title, to: `/${locale}/media` }];
  if (group) crumbs.push({ label: group.name, to: href({ id: null, kind: null, q: null, page: null }) });
  if (kindLabel) crumbs.push({ label: kindLabel, to: href({ id: null }) });
  if (id) crumbs.push({ label: detail.data?.item.title ?? "…" });

  return (
    <main className="flex h-[calc(100dvh-4rem)] min-h-[32rem] w-full min-w-0 flex-col bg-white">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 px-4 py-2.5">
        <nav aria-label={en ? "Folder path" : "Đường dẫn thư mục"} className="flex min-w-0 flex-1 items-center gap-1 text-sm">
          {crumbs.map((crumb, index) => (
            <span key={index} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-slate-300" />}
              {crumb.to && index < crumbs.length - 1 ? (
                <Link href={crumb.to} scroll={false} className="flex shrink-0 items-center gap-1.5 rounded px-1 font-medium text-slate-500 hover:text-blue-600">
                  {index === 0 && <Home aria-hidden="true" className="size-4" />}
                  <span className={index === 0 ? "hidden sm:inline" : ""}>{crumb.label}</span>
                </Link>
              ) : (
                <span aria-current="page" className="flex min-w-0 items-center gap-1.5 truncate px-1 font-semibold text-slate-900">
                  {index === 0 && <Home aria-hidden="true" className="size-4 shrink-0" />}
                  <span className="truncate">{crumb.label}</span>
                </span>
              )}
            </span>
          ))}
        </nav>

        {category && (
          <div className="relative w-full sm:w-64">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            {id ? (
              <input
                type="search"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                aria-label={en ? "Search files" : "Tìm file"}
                placeholder={en ? "Search files in this folder" : "Tìm file trong thư mục"}
                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-sm outline-none placeholder:text-slate-400 focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100"
              />
            ) : (
              <form
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  setParams({ q: search.trim() || null, page: null });
                }}
              >
                <input
                  type="search"
                  value={search}
                  maxLength={150}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={en ? "Search folders" : "Tìm thư mục"}
                  placeholder={en ? "Search folders, press Enter" : "Tìm thư mục, nhấn Enter"}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-sm outline-none placeholder:text-slate-400 focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100"
                />
              </form>
            )}
          </div>
        )}

        {id && (
          <div role="group" aria-label={en ? "File type" : "Loại file"} className="inline-flex rounded-md border border-slate-200 p-0.5">
            {(["all", "image", "audio"] as const).map((value) => (
              <Link
                key={value}
                href={href({ type: value === "all" ? null : value })}
                scroll={false}
                aria-current={type === value ? "true" : undefined}
                className={cn("inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium", type === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
              >
                {value === "all" ? (en ? "All" : "Tất cả") : value === "image" ? (en ? "Images" : "Ảnh") : "Audio"}
                <span className="tabular-nums opacity-70">{counts[value]}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1">
          <div role="group" aria-label={en ? "View" : "Kiểu xem"} className="inline-flex rounded-md border border-slate-200 p-0.5">
            {(["grid", "list"] as const).map((value) => (
              <Link
                key={value}
                href={href({ view: value === "grid" ? null : value })}
                scroll={false}
                aria-label={value === "grid" ? (en ? "Grid view" : "Dạng lưới") : en ? "List view" : "Dạng danh sách"}
                aria-current={view === value ? "true" : undefined}
                className={cn("flex size-7 items-center justify-center rounded", view === value ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100")}
              >
                {value === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
              </Link>
            ))}
          </div>
          {category && (
            <button
              type="button"
              onClick={() => void (id ? detail.refetch() : list.refetch())}
              disabled={fetching}
              aria-label={en ? "Refresh" : "Làm mới"}
              title={en ? "Refresh" : "Làm mới"}
              className="flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={cn("size-4", fetching && "motion-safe:animate-spin")} />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Folder tree */}
        <aside aria-label={en ? "Folders" : "Thư mục"} className="hidden w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50/60 p-2 md:block">
          <Link
            href={`/${locale}/media`}
            className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold", !category ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100")}
          >
            <Home aria-hidden="true" className="size-4" />
            {title}
          </Link>
          <ul className="mt-1 space-y-0.5">
            {groups.map(({ id: key, name, tone }) => {
              const active = category === key;
              const expandable = key === "vocab";
              const expanded = expandable && (openTree[key] ?? active);
              return (
                <li key={key}>
                  <div className={cn("flex items-center rounded-md", active && !expandable ? "bg-blue-50" : "hover:bg-slate-100")}>
                    {expandable ? (
                      <button
                        type="button"
                        onClick={() => setOpenTree((s) => ({ ...s, [key]: !expanded }))}
                        aria-expanded={expanded}
                        aria-label={expanded ? (en ? "Collapse" : "Thu gọn") : en ? "Expand" : "Mở rộng"}
                        className="flex size-6 shrink-0 items-center justify-center text-slate-400"
                      >
                        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </button>
                    ) : (
                      <span className="size-6 shrink-0" />
                    )}
                    <Link
                      href={`/${locale}/media?category=${key}`}
                      aria-current={active && !expandable ? "page" : undefined}
                      className={cn("flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-sm", active ? "font-semibold text-slate-900" : "text-slate-700")}
                    >
                      {active ? <FolderOpen aria-hidden="true" className={cn("size-4 shrink-0", tone)} /> : <Folder aria-hidden="true" className={cn("size-4 shrink-0 fill-current", tone)} />}
                      <span className="truncate">{name}</span>
                    </Link>
                  </div>
                  {expanded && (
                    <ul className="ml-6 border-l border-slate-200 pl-1.5">
                      {vocabKinds.map((item) => {
                        const current = active && kind === item.kind;
                        return (
                          <li key={item.kind}>
                            <Link
                              href={`/${locale}/media?category=vocab&kind=${item.kind}`}
                              aria-current={current ? "page" : undefined}
                              className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm", current ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-100")}
                            >
                              <Folder aria-hidden="true" className="size-3.5 shrink-0 fill-current text-emerald-400" />
                              {en ? item.en : item.vi}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 px-2 text-[11px] leading-4 text-slate-400">
            {en ? "Read-only: files are managed from the content editors." : "Chỉ xem: file được quản lý trong trình sửa nội dung."}
          </p>
        </aside>

        {/* Content */}
        <section aria-label={en ? "Folder contents" : "Nội dung thư mục"} className="min-w-0 flex-1 overflow-y-auto bg-slate-50/40 p-4">
          {/* Mobile folder switcher */}
          <div className="mb-3 flex gap-1.5 overflow-x-auto md:hidden">
            {groups.map(({ id: key, name }) => (
              <Link key={key} href={`/${locale}/media?category=${key}`} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", category === key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600")}>
                {name}
              </Link>
            ))}
          </div>

          {!category ? (
            <FolderGrid
              view={view}
              folders={groups.map((g) => ({ key: g.id, title: g.name, subtitle: en ? g.en : g.vi, to: `/${locale}/media?category=${g.id}`, tone: g.tone }))}
            />
          ) : id ? (
            detail.isLoading ? (
              <AssetSkeleton view={view} />
            ) : detail.isError ? (
              <LoadError onRetry={() => void detail.refetch()} />
            ) : !visibleAssets.length ? (
              <Empty
                icon={type === "audio" ? FileAudio : FileImage}
                title={assetSearch ? (en ? "No matching files" : "Không có file khớp") : en ? "This folder has no files of this type" : "Thư mục này chưa có file thuộc loại đã chọn"}
              />
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  {visibleAssets.length} {en ? "files" : "file"}
                  {category === "games" && (en ? " · Shared word images and pronunciation are under Vocab." : " · Ảnh và phát âm từ vựng dùng chung nằm trong thư mục Vocab.")}
                </p>
                {view === "grid" ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                    {assetPage.items.map((asset) => (
                      <AssetTile key={asset.url} asset={asset} en={en} selected={selectedUrl === asset.url} onSelect={() => setSelectedUrl(selectedUrl === asset.url ? null : asset.url)} />
                    ))}
                  </div>
                ) : (
                  <AssetTable assets={assetPage.items} selectedUrl={selectedUrl} onSelect={setSelectedUrl} en={en} />
                )}
                <div className="rounded-lg border border-slate-200 bg-white">
                  <ListPagination pagination={assetPage} />
                </div>
              </div>
            )
          ) : list.isLoading ? (
            <AssetSkeleton view={view} />
          ) : list.isError ? (
            <LoadError onRetry={() => void list.refetch()} />
          ) : !list.data?.items.length ? (
            <Empty icon={Search} title={query ? (en ? `No folder matches “${query}”` : `Không có thư mục khớp “${query}”`) : en ? "No folders" : "Chưa có thư mục"} />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                {list.data.total} {en ? "folders" : "thư mục"}
              </p>
              <FolderGrid
                view={view}
                folders={list.data.items.map((item) => ({ key: item.id, title: item.title, subtitle: item.subtitle, status: item.status, to: href({ id: item.id }) }))}
              />
              <div className="rounded-lg border border-slate-200 bg-white">
                <ListPagination
                  disabled={list.isFetching}
                  pagination={{
                    page,
                    pageSize,
                    totalPages,
                    totalItems: list.data.total,
                    setPage: (value) => setParams({ page: String(value) }),
                    setPageSize: (value) => setParams({ size: String(value), page: null }),
                  }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Details panel: docked on wide screens, sheet below xl */}
        {selected && (
          <aside aria-label={en ? "Asset details" : "Chi tiết file"} className="hidden w-80 shrink-0 border-l border-slate-200 bg-white xl:block">
            <DetailsPanel asset={selected} en={en} onClose={() => setSelectedUrl(null)} />
          </aside>
        )}
      </div>
      <SmallScreenDetails selected={selected} en={en} onClose={() => setSelectedUrl(null)} />
    </main>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

/** Below the xl breakpoint the details panel opens as a sheet instead of a docked column. */
function SmallScreenDetails({ selected, en, onClose }: { selected: MediaReference | null; en: boolean; onClose: () => void }) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <Sheet open={narrow && !!selected} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[22rem] max-w-[92vw] p-0 [&>button]:hidden">
        <SheetTitle className="sr-only">{en ? "Asset details" : "Chi tiết file"}</SheetTitle>
        <SheetDescription className="sr-only">{selected ? fileName(selected.url) : ""}</SheetDescription>
        {selected && <DetailsPanel asset={selected} en={en} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function FolderGrid({
  folders,
  view,
}: {
  folders: { key: string; title: string; subtitle?: string; status?: string; to: string; tone?: string }[];
  view: View;
}) {
  if (view === "list")
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {folders.map((folder) => (
            <li key={folder.key}>
              <Link href={folder.to} scroll={false} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                <Folder aria-hidden="true" className={cn("size-5 shrink-0 fill-current", folder.tone ?? "text-amber-400")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{folder.title}</span>
                  {folder.subtitle && <span className="block truncate text-xs text-slate-500">{folder.subtitle}</span>}
                </span>
                {folder.status && <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", statusTone(folder.status))}>{folder.status}</span>}
                <ChevronRight aria-hidden="true" className="size-4 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
      {folders.map((folder) => (
        <Link
          key={folder.key}
          href={folder.to}
          scroll={false}
          title={folder.title}
          className="group flex flex-col items-center rounded-lg border border-transparent px-2 py-3 text-center outline-none transition-colors hover:border-slate-200 hover:bg-white focus-visible:border-blue-400 focus-visible:bg-white"
        >
          <Folder aria-hidden="true" strokeWidth={1.25} className={cn("size-16 fill-current opacity-90 transition-transform group-hover:scale-105 motion-reduce:transition-none", folder.tone ?? "text-amber-400")} />
          <span className="mt-1 line-clamp-2 w-full text-sm font-medium leading-tight text-slate-900">{folder.title}</span>
          {folder.subtitle && <span className="mt-0.5 line-clamp-1 w-full text-[11px] text-slate-500">{folder.subtitle}</span>}
          {folder.status && <span className={cn("mt-1 rounded px-1.5 py-0.5 text-[10px] font-semibold", statusTone(folder.status))}>{folder.status}</span>}
        </Link>
      ))}
    </div>
  );
}

function AssetTable({ assets, selectedUrl, onSelect, en }: { assets: MediaReference[]; selectedUrl: string | null; onSelect: (url: string | null) => void; en: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th scope="col" className="w-14 px-3 py-2"><span className="sr-only">{en ? "Preview" : "Xem trước"}</span></th>
            <th scope="col" className="px-3 py-2">{en ? "Name" : "Tên file"}</th>
            <th scope="col" className="hidden w-24 px-3 py-2 sm:table-cell">{en ? "Format" : "Định dạng"}</th>
            <th scope="col" className="hidden px-3 py-2 lg:table-cell">{en ? "Used in" : "Dùng ở"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assets.map((asset) => {
            const active = selectedUrl === asset.url;
            return (
              <tr key={asset.url} onClick={() => onSelect(active ? null : asset.url)} className={cn("cursor-pointer", active ? "bg-blue-50" : "hover:bg-slate-50")}>
                <td className="px-3 py-1.5">
                  <Thumb asset={asset} className="size-9 rounded" iconSize="size-4" />
                </td>
                <td className="px-3 py-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(active ? null : asset.url);
                    }}
                    className="block w-full truncate text-left font-medium text-slate-800 hover:text-blue-600"
                  >
                    {fileName(asset.url)}
                  </button>
                </td>
                <td className="hidden px-3 py-1.5 text-xs text-slate-500 sm:table-cell">{extension(asset.url) ?? (asset.type === "image" ? "IMG" : "AUDIO")}</td>
                <td className="hidden truncate px-3 py-1.5 text-xs text-slate-500 lg:table-cell">
                  {asset.usages[0] ? (en ? asset.usages[0].labelEn : asset.usages[0].label) : "—"}
                  {asset.usages.length > 1 && ` +${asset.usages.length - 1}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssetSkeleton({ view }: { view: View }) {
  return view === "grid" ? (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
      ))}
    </div>
  ) : (
    <div className="space-y-1.5">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-11 rounded-md" />
      ))}
    </div>
  );
}

function Empty({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <Icon aria-hidden="true" className="size-8 text-slate-300" />
      <p className="mt-2 text-sm font-medium text-slate-600">{title}</p>
    </div>
  );
}
