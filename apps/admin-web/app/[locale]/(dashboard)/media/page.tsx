"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Copy,
  ExternalLink,
  FileAudio,
  FileImage,
  FolderOpen,
  Gamepad2,
  Headphones,
  Images,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import type {
  MediaCategory,
  MediaItemKind,
  MediaReference,
} from "@repo/shared-types";
import { mediaLibraryService } from "@/services/media-library.service";
import { ListPagination } from "@/components/ui/list-pagination";
import { LoadError } from "@/components/ui/load-error";
import { useListPagination } from "@/hooks/use-list-pagination";

const groups = [
  {
    id: "dictation",
    name: "Dictation",
    vi: "Ảnh và audio của các bài luyện nghe.",
    en: "Lesson images and dictation recordings.",
    icon: Headphones,
    tone: "bg-blue-50 text-blue-600",
  },
  {
    id: "games",
    name: "Games",
    vi: "Ảnh đại diện, nhạc nền và âm thanh minigame.",
    en: "Minigame images, music and sound effects.",
    icon: Gamepad2,
    tone: "bg-violet-50 text-violet-600",
  },
  {
    id: "vocab",
    name: "Vocab",
    vi: "Bộ sưu tập, bài học, ảnh và phát âm từ vựng.",
    en: "Collections, lessons, word images and pronunciation.",
    icon: BookOpen,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "toeic",
    name: "TOEIC",
    vi: "Ảnh và audio của đề thi, câu hỏi và đoạn văn.",
    en: "Exam, question and passage images and audio.",
    icon: FileAudio,
    tone: "bg-amber-50 text-amber-600",
  },
] as const;
const control =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700";
const button =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50";
const defaults: Record<MediaCategory, MediaItemKind> = {
  dictation: "lesson",
  vocab: "lesson",
  toeic: "exam",
  games: "game",
};
const folders = [
  { type: "audio", name: "Audios", icon: FileAudio },
  { type: "image", name: "Images", icon: FileImage },
] as const;

function MediaCard({
  asset,
  english,
}: {
  asset: MediaReference;
  english: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  let name = asset.url;
  try {
    name = decodeURIComponent(
      new URL(asset.url).pathname.split("/").at(-1) || asset.url,
    );
  } catch {}
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="flex min-h-40 items-center justify-center border-b border-slate-100 bg-slate-50 p-3">
        {failed ? (
          <p role="status" className="p-4 text-center text-sm text-red-600">
            {english
              ? "File unavailable. Try opening the link."
              : "Không tải được file. Hãy thử mở đường dẫn."}
          </p>
        ) : asset.type === "image" ? (
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full"
            aria-label={english ? "Open image" : "Xem ảnh"}
          >
            <img
              src={asset.url}
              alt={asset.usages[0]?.[english ? "labelEn" : "label"] || name}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="mx-auto h-40 max-w-full object-contain"
              onError={() => setFailed(true)}
            />
          </a>
        ) : (
          <div className="w-full space-y-3">
            <FileAudio className="mx-auto h-8 w-8 text-blue-500" />
            <audio
              controls
              preload="none"
              src={asset.url}
              className="w-full min-w-0"
              aria-label={
                asset.usages[0]?.[english ? "labelEn" : "label"] || name
              }
              onError={() => setFailed(true)}
            />
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex min-w-0 items-start gap-2">
          {asset.type === "image" ? (
            <FileImage className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <FileAudio className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          )}
          <p
            title={name}
            className="break-all text-sm font-semibold text-slate-800"
          >
            {name}
          </p>
        </div>
        <details
          className="text-xs text-slate-500"
          open={asset.usages.length <= 2}
        >
          <summary className="cursor-pointer font-medium">
            {english ? "Used in" : "Vị trí sử dụng"} ({asset.usages.length})
          </summary>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto pl-3">
            {asset.usages.map((usage) => (
              <li
                key={`${usage.sourceId}-${usage.label}`}
                className="break-words"
              >
                {english ? usage.labelEn : usage.label}
              </li>
            ))}
          </ul>
        </details>
        <div className="flex flex-wrap gap-2">
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className={button}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {english ? "Open file" : "Mở file"}
          </a>
          <button
            type="button"
            className={button}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(asset.url);
                setCopied(true);
                setCopyError(false);
              } catch {
                setCopyError(true);
              }
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied
              ? english
                ? "Copied"
                : "Đã sao chép"
              : english
                ? "Copy link"
                : "Sao chép link"}
          </button>
        </div>
        {copyError && (
          <p role="status" className="text-xs text-red-600">
            {english
              ? "Cannot copy. Use Open file to get the link."
              : "Không sao chép được. Dùng Mở file để lấy đường dẫn."}
          </p>
        )}
      </div>
    </article>
  );
}
export default function MediaLibraryPage() {
  const { locale } = useParams();
  const english = locale === "en";
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("category");
  const group = groups.find((item) => item.id === selected);
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
  useEffect(() => setSearch(query), [query, category, kind]);
  const page = Math.min(
    100000,
    Math.max(1, Math.floor(Number(params.get("page"))) || 1),
  );
  const pageSize = [5, 10, 20, 50].includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 10;
  const type =
    params.get("type") === "image"
      ? "image"
      : params.get("type") === "audio" || category
        ? "audio"
        : null;
  const setParams = (
    change: Record<string, string | null>,
    replace = false,
  ) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(change)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const url = `/${locale}/media${next.size ? "?" + next : ""}`;
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
  const visibleAssets = useMemo(
    () => (assets || []).filter((asset) => asset.type === type),
    [assets, type],
  );
  const assetPage = useListPagination(
    visibleAssets,
    `${category}/${kind}/${id}/${type}`,
    10,
  );
  const title = english ? "Media library" : "Quản lý media";
  const loading = id ? detail.isLoading : list.isLoading;
  const failed = id ? detail.isError : list.isError;
  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Images className="h-6 w-6 text-blue-600" />
            {title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {english
              ? "Choose Audios or Images, then browse the content using them."
              : "Chọn Audios hoặc Images, sau đó chọn nội dung đang sử dụng."}
          </p>
        </div>
        {category && (
          <button
            type="button"
            onClick={() => void (id ? detail.refetch() : list.refetch())}
            disabled={loading}
            className={button}
          >
            <RefreshCw className="h-4 w-4" />
            {english ? "Refresh" : "Làm mới"}
          </button>
        )}
      </header>
      <nav
        aria-label={english ? "Media breadcrumbs" : "Điều hướng media"}
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <Link
          href={`/${locale}/media`}
          className="text-blue-600 hover:underline"
        >
          {title}
        </Link>
        {type && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <Link
              href={`/${locale}/media?type=${type}`}
              className="text-blue-600 hover:underline"
            >
              {type === "audio" ? "Audios" : "Images"}
            </Link>
          </>
        )}
        {group && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <button
              className="text-blue-600 hover:underline"
              onClick={() => setParams({ id: null })}
            >
              {group.name}
            </button>
          </>
        )}
        {id && detail.data && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="break-words text-slate-600">
              {detail.data.item.title}
            </span>
          </>
        )}
      </nav>
      <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside
          aria-label={english ? "Media folders" : "Cây thư mục media"}
          className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 lg:sticky lg:top-20"
        >
          {folders.map(({ type: folderType, name, icon: Icon }) => (
            <details
              key={folderType}
              open
              className="group/folder mb-2 last:mb-0"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 font-semibold text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open/folder:rotate-90" />
                <Icon className="h-4 w-4 shrink-0 text-blue-500" />
                <Link
                  href={`/${locale}/media?type=${folderType}`}
                  onClick={(event) => event.stopPropagation()}
                  className="min-w-0 flex-1"
                >
                  {name}
                </Link>
              </summary>
              <ul className="ml-5 space-y-1 border-l border-slate-200 py-1 pl-3">
                {groups.map(({ id: key, name: label, icon: GroupIcon }) => (
                  <li key={key}>
                    <Link
                      href={`/${locale}/media?type=${folderType}&category=${key}`}
                      aria-current={
                        type === folderType && category === key
                          ? "page"
                          : undefined
                      }
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${type === folderType && category === key ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      <GroupIcon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </aside>
        <section
          className="min-w-0 space-y-5"
          aria-label={english ? "Folder contents" : "Nội dung thư mục"}
        >
          {!type ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {folders.map(({ type: folderType, name, icon: Icon }) => (
                <Link
                  key={folderType}
                  href={`/${locale}/media?type=${folderType}`}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-300"
                >
                  <Icon className="h-10 w-10 shrink-0 text-blue-500" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {groups.map((group) => group.name).join(" · ")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : !category ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map(({ id: key, name, vi, en, icon: Icon, tone }) => (
                <Link
                  key={key}
                  href={`/${locale}/media?type=${type}&category=${key}`}
                  className="group flex min-w-0 items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-blue-300 hover:shadow-sm"
                >
                  <span
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${tone}`}
                  >
                    <Icon className="h-7 w-7" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {english ? en : vi}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          ) : (
            <>
              {!id && (
                <>
                  {category === "vocab" && (
                    <div
                      role="group"
                      aria-label={
                        english
                          ? "Vocabulary resources"
                          : "Loại nội dung từ vựng"
                      }
                      className="flex flex-wrap gap-2"
                    >
                      {(["lesson", "collection", "word"] as const).map(
                        (value, index) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={kind === value}
                            className={`${button} ${kind === value ? "!border-blue-300 !bg-blue-50 !text-blue-700" : ""}`}
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
                    className="flex flex-wrap gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setParams({ q: search.trim() || null, page: null });
                    }}
                  >
                    <label className="sr-only" htmlFor="media-search">
                      {english ? "Search content" : "Tìm nội dung"}
                    </label>
                    <input
                      id="media-search"
                      maxLength={150}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className={`${control} min-w-0 flex-1`}
                      placeholder={
                        english
                          ? "Search exams, lessons…"
                          : "Tìm đề thi, bài học…"
                      }
                    />
                    <button className={button} type="submit">
                      <Search className="h-4 w-4" />
                      {english ? "Search" : "Tìm kiếm"}
                    </button>
                  </form>
                </>
              )}
              {loading ? (
                <div
                  role="status"
                  className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {english ? "Loading media…" : "Đang tải media…"}
                </div>
              ) : failed ? (
                <LoadError
                  onRetry={() => void (id ? detail.refetch() : list.refetch())}
                />
              ) : id && detail.data ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="break-words text-xl font-semibold text-slate-900">
                        {detail.data.item.title}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {detail.data.item.subtitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={button}
                      onClick={() => setParams({ id: null })}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {english ? "Back to content" : "Về danh sách"}
                    </button>
                  </div>
                  {category === "games" && (
                    <p className="text-sm text-slate-500">
                      {english
                        ? "Game images and configured sound effects appear here. Shared word images and pronunciation are available under Vocab."
                        : "Ảnh và âm thanh cấu hình của trò chơi được liệt kê ở đây. Ảnh và phát âm từ vựng dùng chung nằm trong nhóm Vocab."}
                    </p>
                  )}
                  <p className="text-sm font-medium text-slate-600">
                    {type === "audio" ? "Audios" : "Images"} (
                    {visibleAssets.length})
                  </p>
                  {visibleAssets.length ? (
                    <>
                      <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {assetPage.items.map((asset) => (
                          <MediaCard
                            key={`${asset.type}/${asset.url}`}
                            asset={asset}
                            english={english}
                          />
                        ))}
                      </div>
                      <ListPagination pagination={assetPage} />
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                      {english
                        ? "No media of this type is referenced by this content."
                        : "Nội dung này chưa sử dụng media thuộc loại đã chọn."}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {list.data?.items.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {list.data.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setParams({ id: item.id })}
                          className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-blue-300"
                        >
                          <FolderOpen className="mt-0.5 h-6 w-6 shrink-0 text-blue-500" />
                          <div className="min-w-0 flex-1">
                            <h2 className="break-words text-sm font-semibold text-slate-900">
                              {item.title}
                            </h2>
                            <p className="mt-1 break-words text-xs text-slate-500">
                              {item.subtitle}
                            </p>
                            <span className="mt-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                              {item.status}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                      {english
                        ? "No matching content."
                        : "Không tìm thấy nội dung phù hợp."}
                    </p>
                  )}
                  <ListPagination
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
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
