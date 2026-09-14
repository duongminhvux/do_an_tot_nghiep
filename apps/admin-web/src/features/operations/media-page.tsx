"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Copy,
  FileAudio,
  FileText,
  Grid2X2,
  Image as ImageIcon,
  List,
  Plus,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  adminMediaApi,
  type AdminMediaDto,
} from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { useProtectedMediaUrl } from "@/lib/use-protected-media-url";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";

const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const iconFor = (type: string) =>
  type === "IMAGE"
    ? ImageIcon
    : type === "AUDIO"
      ? FileAudio
      : type === "VIDEO"
        ? Video
        : FileText;
const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function MediaPage() {
  const user = useAdminSession((state) => state.user)!;
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [grid, setGrid] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["media", user.id],
    queryFn: () => adminMediaApi.list(user),
  });
  const upload = useMutation({
    mutationFn: (file: File) => adminMediaApi.upload(user, file),
    onSuccess: async () => {
      setMessage("Media uploaded.");
      await queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (error) => setMessage(error.message),
  });
  const archive = useMutation({
    mutationFn: (id: string) => adminMediaApi.archive(user, id),
    onSuccess: async () => {
      setMessage("Media archived.");
      await queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (error) => setMessage(error.message),
  });
  const items = (query.data ?? []).filter(
    (item) =>
      (type === "ALL" || item.type === type) &&
      item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const copyUrl = async (item: AdminMediaDto) => {
    await navigator.clipboard.writeText(
      `${apiBase.replace(/\/api\/v1\/?$/, "")}${item.url}`,
    );
    setMessage("Media URL copied.");
  };

  return (
    <div>
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        accept="image/*,audio/*,video/mp4,video/webm,application/pdf"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.mutate(file);
          event.currentTarget.value = "";
        }}
      />
      <PageHeader
        title="Media Library"
        description="Upload, preview, and safely archive real media records."
        action={
          <Button
            disabled={upload.isPending}
            onClick={() => fileInput.current?.click()}
          >
            <Plus className="size-4" />
            {upload.isPending ? "Uploading…" : "Upload Media"}
          </Button>
        }
      />
      {message && (
        <p className="mb-3 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {message}
        </p>
      )}
      <div className="admin-surface mb-4 flex flex-wrap gap-3 p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 flex-1 rounded-lg border border-slate-200 px-3"
          placeholder="Search media..."
        />
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="h-10 rounded-lg border border-slate-200 px-3"
        >
          <option value="ALL">All media types</option>
          <option>IMAGE</option>
          <option>AUDIO</option>
          <option>VIDEO</option>
          <option>DOCUMENT</option>
        </select>
        <div className="flex rounded-lg border border-slate-200 p-1">
          <button
            onClick={() => setGrid(true)}
            className={`grid size-8 place-items-center rounded ${grid ? "bg-blue-600 text-white" : ""}`}
            aria-label="Grid view"
          >
            <Grid2X2 className="size-4" />
          </button>
          <button
            onClick={() => setGrid(false)}
            className={`grid size-8 place-items-center rounded ${!grid ? "bg-blue-600 text-white" : ""}`}
            aria-label="List view"
          >
            <List className="size-4" />
          </button>
        </div>
      </div>
      {query.isLoading ? (
        <TableSkeleton />
      ) : query.error ? (
        <ErrorState message={query.error.message} />
      ) : items.length === 0 ? (
        <EmptyState title="No media found" description="Upload a supported file to begin." />
      ) : (
        <div
          className={
            grid ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "space-y-3"
          }
        >
          {items.map((item) => {
            const Icon = iconFor(item.type);
            return (
              <article
                key={item.id}
                className={`admin-surface admin-card-hover ${
                  grid ? "overflow-hidden" : "flex items-center gap-4 p-4"
                }`}
              >
                <MediaPreview item={item} grid={grid} Icon={Icon} />
                <div className={grid ? "p-4" : "min-w-0 flex-1"}>
                  <strong className="block truncate">{item.name}</strong>
                  <p className="text-xs text-slate-500">
                    {sizeLabel(item.sizeBytes)} · {item.mimeType}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <StatusBadge status={item.type} />
                    <div className="flex">
                      <button
                        onClick={() => void copyUrl(item)}
                        className="grid size-9 place-items-center"
                        aria-label="Copy URL"
                      >
                        <Copy className="size-4" />
                      </button>
                      <button
                        onClick={() => archive.mutate(item.id)}
                        disabled={archive.isPending}
                        className="grid size-9 place-items-center text-red-500 disabled:text-slate-300"
                        aria-label="Archive media"
                      >
                        <Archive className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MediaPreview({
  item,
  grid,
  Icon,
}: {
  item: AdminMediaDto;
  grid: boolean;
  Icon: LucideIcon;
}) {
  const preview = useProtectedMediaUrl(
    item.type === "IMAGE" ? item.url : undefined,
  );
  return (
    <div
      className={
        grid
          ? "grid h-40 place-items-center bg-gradient-to-br from-blue-50 to-slate-100"
          : "grid size-14 shrink-0 place-items-center rounded-lg bg-blue-50"
      }
    >
      {item.type === "IMAGE" && preview.url ? (
        <img
          src={preview.url}
          alt={item.name}
          className="size-full object-cover"
        />
      ) : (
        <Icon className="size-8 text-blue-600" />
      )}
    </div>
  );
}

