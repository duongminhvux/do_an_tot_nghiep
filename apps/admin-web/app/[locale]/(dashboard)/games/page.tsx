"use client";
import { useListPagination } from '@/hooks/use-list-pagination';
import { ListPagination } from '@/components/ui/list-pagination';
import { GameSettingsDialog } from "@/features/minigames/game-settings-dialog";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  Gamepad2,
  Settings2,
  Pencil,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  gamesService,
  type GameDefinition,
  type GameInput,
} from "@/services/games.service";
import { uploadService } from "@/services/upload.service";
const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
export default function GamesAdminPage() {
  const { t } = useTranslation("games");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-games"],
    queryFn: gamesService.list,
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [editor, setEditor] = useState<{
    id: string;
    code: string;
    destination: string;
    form: GameInput;
  } | null>(null);
  const [configGame, setConfigGame] = useState<GameDefinition | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: async (
      action:
        | { id: string; data: Partial<GameInput> }
        | { items: { id: string; order: number }[] },
    ) => {
      if ("items" in action) await gamesService.reorder(action.items);
      else await gamesService.save(action.id, action.data);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-games"] });
      setError("");
      setMessage(t("saved"));
    },
    onError: () => {
      setMessage("");
      setError(t("error"));
    },
  });
  const games = query.data ?? [];
  const filtered = games.filter(
    (game) =>
      (!category || game.category === category) &&
      (game.name + " " + game.nameEn)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const gamePage = useListPagination(filtered, search + category);
  const busy = mutation.isPending || uploading;
  function open(game: GameDefinition) {
    setError("");
    setMessage("");
    const { _id, code, destination, ...form } = game;
    setEditor({
      id: _id,
      code,
      destination,
      form: {
        name: form.name,
        nameEn: form.nameEn,
        description: form.description,
        descriptionEn: form.descriptionEn,
        imageUrl: form.imageUrl,
        badge: form.badge,
        category: form.category,
        order: form.order,
        isActive: form.isActive,
      },
    });
  }
  function field<K extends keyof GameInput>(key: K, value: GameInput[K]) {
    setEditor((current) =>
      current ? { ...current, form: { ...current.form, [key]: value } } : null,
    );
  }
  function move(game: GameDefinition, offset: number) {
    const ordered = [...games];
    const index = ordered.findIndex((g) => g._id === game._id);
    const target = index + offset;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
    mutation.mutate({
      items: ordered.map((g, order) => ({ id: g._id, order })),
    });
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setError(t("uploadError"));
      return;
    }
    setUploading(true);
    setError("");
    try {
      field("imageUrl", (await uploadService.uploadFile(file)).url);
    } catch {
      setError(t("uploadError"));
    } finally {
      setUploading(false);
    }
  }
  return (
    <main className="w-full space-y-5 p-4 sm:p-6 xl:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
        </div>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {message}
        </p>
      )}
      {error && !editor && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <input
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass + " max-w-sm"}
          />
          <select
            aria-label={t("category")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass + " w-auto!"}
          >
            <option value="">{t("all")}</option>
            <option value="SOLO">{t("SOLO")}</option>
            <option value="MULTIPLAYER">{t("MULTIPLAYER")}</option>
          </select>
        </div>
        <p className="px-4 pt-3 text-xs text-slate-500">{t("reorderHint")}</p>
        {query.isPending ? (
          <p className="p-8 text-center text-slate-500">{t("loading")}</p>
        ) : query.isError ? (
          <div role="alert" className="space-y-3 p-8 text-center">
            <p>{t("error")}</p>
            <button
              className={buttonClass}
              onClick={() => void query.refetch()}
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          <div className="min-w-0 max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  {[
                    "order",
                    "name",
                    "category",
                    "badge",
                    "destination",
                    "status",
                    "actions",
                  ].map((key) => (
                    <th
                      key={key}
                      className="whitespace-nowrap px-4 py-3 font-medium"
                    >
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gamePage.items.map((game) => (
                  <tr key={game._id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="mr-2 tabular-nums">{game.order}</span>
                        <button
                          title={t("up")}
                          aria-label={t("up") + ": " + game.name}
                          className={buttonClass + " p-1!"}
                          disabled={busy || games[0]?._id === game._id}
                          onClick={() => move(game, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </button>
                        <button
                          title={t("down")}
                          aria-label={t("down") + ": " + game.name}
                          className={buttonClass + " p-1!"}
                          disabled={busy || games.at(-1)?._id === game._id}
                          onClick={() => move(game, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {game.imageUrl ? (
                          <img
                            src={game.imageUrl}
                            alt=""
                            className="h-12 w-20 rounded-lg bg-slate-50 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-20 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                            <Gamepad2 className="size-6" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-800">
                            {game.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {game.nameEn}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-slate-400">
                            {game.code}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {t(game.category)}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-blue-600">
                      {game.badge ? t(game.badge) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {game.destination}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        role="switch"
                        aria-checked={game.isActive}
                        aria-label={t("status") + ": " + game.name}
                        disabled={busy}
                        onClick={() =>
                          mutation.mutate({
                            id: game._id,
                            data: { isActive: !game.isActive },
                          })
                        }
                        className={
                          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-40 " +
                          (game.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500")
                        }
                      >
                        <span
                          className={
                            "size-2 rounded-full " +
                            (game.isActive ? "bg-emerald-500" : "bg-slate-400")
                          }
                        />
                        {t(game.isActive ? "active" : "inactive")}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className={buttonClass}
                        onClick={() => open(game)}
                        disabled={busy}
                      >
                        <Pencil className="size-3.5" />
                        {t("editAction")}
                      </button>
                      <button
                        className={buttonClass + " ml-2"}
                        onClick={() => setConfigGame(game)}
                        disabled={busy}
                      >
                        <Settings2 className="size-3.5" />
                        {t("config")}
                      </button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-500">
                      {t("empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <ListPagination pagination={gamePage} />
          </div>
        )}
      </section>
      {configGame && (
        <GameSettingsDialog
          game={configGame}
          onClose={() => setConfigGame(null)}
        />
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(value) => {
          if (!value && !busy) {
            setEditor(null);
            setError("");
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("edit")}</DialogTitle>
            <DialogDescription>{t("englishHint")}</DialogDescription>
          </DialogHeader>
          {editor && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await mutation.mutateAsync({
                    id: editor.id,
                    data: editor.form,
                  });
                  setEditor(null);
                } catch {
                  /* Mutation exposes the error in the dialog. */
                }
              }}
            >
              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  ["name", "nameEn", "description", "descriptionEn"] as const
                ).map((key) => (
                  <label
                    key={key}
                    className="flex min-w-0 flex-col gap-1.5 text-sm font-medium leading-5 text-slate-700"
                  >
                    <span>{t(key)}</span>
                    {key.startsWith("description") ? (
                      <textarea
                        rows={3}
                        maxLength={1000}
                        className={inputClass}
                        value={editor.form[key]}
                        onChange={(e) => field(key, e.target.value)}
                      />
                    ) : (
                      <input
                        required={key === "name"}
                        maxLength={120}
                        className={inputClass}
                        value={editor.form[key]}
                        onChange={(e) => field(key, e.target.value)}
                      />
                    )}
                  </label>
                ))}
              </div>
              <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 sm:grid-cols-2">
                <div>
                  <p>{t("gameType")}</p>
                  <p className="mt-1 font-mono text-slate-700">{editor.code}</p>
                </div>
                <div>
                  <p>{t("destination")}</p>
                  <p className="mt-1 font-mono text-slate-700">
                    {editor.destination}
                  </p>
                </div>
                <p className="sm:col-span-2">{t("fixedImplementation")}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium leading-5 text-slate-700">
                  <span>{t("category")}</span>
                  <select
                    className={inputClass}
                    value={editor.form.category}
                    onChange={(e) =>
                      field("category", e.target.value as GameInput["category"])
                    }
                  >
                    <option value="SOLO">{t("SOLO")}</option>
                    <option value="MULTIPLAYER">{t("MULTIPLAYER")}</option>
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium leading-5 text-slate-700">
                  <span>{t("badge")}</span>
                  <select
                    className={inputClass}
                    value={editor.form.badge ?? ""}
                    onChange={(e) =>
                      field(
                        "badge",
                        (e.target.value || null) as GameInput["badge"],
                      )
                    }
                  >
                    <option value="">{t("noBadge")}</option>
                    <option value="NEW">{t("NEW")}</option>
                    <option value="POPULAR">{t("POPULAR")}</option>
                    <option value="FEATURED">{t("FEATURED")}</option>
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium leading-5 text-slate-700">
                  <span>{t("order")}</span>
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    required
                    className={inputClass}
                    value={editor.form.order}
                    onChange={(e) => field("order", Number(e.target.value))}
                  />
                </label>
              </div>
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium leading-5 text-slate-700">
                <span>{t("imageUrl")}</span>
                <input
                  maxLength={2000}
                  placeholder="https://..."
                  className={inputClass}
                  value={editor.form.imageUrl}
                  onChange={(e) => field("imageUrl", e.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center gap-4">
                {editor.form.imageUrl && (
                  <img
                    src={editor.form.imageUrl}
                    alt={t("preview")}
                    className="h-24 w-40 rounded-lg border border-slate-200 object-cover"
                  />
                )}
                <div>
                  <label
                    className={
                      buttonClass +
                      (uploading ? " opacity-50" : " cursor-pointer")
                    }
                  >
                    <Upload className="size-4" />
                    {t(uploading ? "loading" : "upload")}
                    <input
                      aria-label={t("upload")}
                      type="file"
                      accept="image/*"
                      disabled={busy}
                      className="sr-only"
                      onChange={(e) => {
                        void upload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p className="mt-2 text-xs text-slate-500">
                    {t("imageHint")}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editor.form.isActive}
                  onChange={(e) => field("isActive", e.target.checked)}
                />
                {t("enabledLabel")}
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => {
                    setEditor(null);
                    setError("");
                  }}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className={
                    buttonClass +
                    " border-blue-600! bg-blue-600! text-white hover:bg-blue-700!"
                  }
                  disabled={busy}
                >
                  {t(mutation.isPending ? "loading" : "save")}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
