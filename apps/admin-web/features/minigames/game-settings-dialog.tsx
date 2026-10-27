"use client";

import { useState } from "react";
import { GameAudioFields } from "./game-audio-fields";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  SlidersHorizontal,
  Gamepad2,
  Save,
  Loader2,
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
  type GameSettings,
  type WordShooterSettings,
  type MeaningTypingSettings,
  type TypingRushSettings,
} from "@/services/games.service";

const settingsFields = [
  { key: "meaningDurationSeconds", min: 1, max: 30 },
  { key: "minWordCount", min: 1, max: 500 },
  { key: "lives", min: 1, max: 10 },
  { key: "maxLives", min: 1, max: 10 },
  { key: "initialFallSpeed", min: 10, max: 300 },
  { key: "spawnInterval", min: 300, max: 10000 },
  { key: "heartEveryWords", min: 1, max: 200 },
] as const;

const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function GameSettingsDialog({
  game,
  onClose,
}: {
  game: GameDefinition;
  onClose: () => void;
}) {
  const { t } = useTranslation("games");
  const query = useQuery({
    queryKey: ["admin-game-settings", game.code],
    queryFn: () => gamesService.configuration(game.code),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto w-[96vw] max-w-5xl p-6 sm:p-7">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
              <Gamepad2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {t("config")} · {game.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {t("configHint")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {query.isPending ? (
          <div role="status" className="flex items-center justify-center py-12 gap-2 text-slate-500">
            <Loader2 className="size-5 animate-spin text-blue-600" />
            <span className="text-sm font-medium">{t("loading")}</span>
          </div>
        ) : query.isError ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
            <p className="text-sm font-medium text-red-700">{t("error")}</p>
            <button
              className={button + " mt-3 bg-white text-slate-700 hover:bg-slate-50"}
              onClick={() => void query.refetch()}
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          <GameConfigForm
            key={game.code}
            code={game.code}
            configuration={query.data}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GameConfigForm({
  code,
  configuration,
  onClose,
}: {
  code: string;
  configuration: GameSettings;
  onClose: () => void;
}) {
  // Each implemented game has a dedicated form and a matching backend validator.
  switch (configuration.gameType) {
    case "WORD_SHOOTER":
      return (
        <WordShooterConfigForm
          code={code}
          initial={configuration.settings as WordShooterSettings}
          onClose={onClose}
        />
      );
    case "TYPING_RUSH":
      return (
        <TypingRushConfigForm
          code={code}
          initial={configuration.settings as TypingRushSettings}
          onClose={onClose}
        />
      );
    case "MEANING_TYPING":
      return (
        <MeaningTypingConfigForm
          code={code}
          initial={configuration.settings as MeaningTypingSettings}
          onClose={onClose}
        />
      );
  }
}

function MeaningTypingConfigForm({
  code,
  initial,
  onClose,
}: {
  code: string;
  initial: MeaningTypingSettings;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("games");
  const isVi = i18n.language?.startsWith("vi") ?? true;
  const client = useQueryClient();
  const [settings, setSettings] = useState({ ...initial });
  const [uploading, setUploading] = useState(false);
  const mutation = useMutation({
    mutationFn: () => gamesService.saveConfiguration(code, settings),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["admin-game-settings", code],
      });
      onClose();
    },
  });

  const fields = [
    ["minWordCount", 1, 500],
    ["lives", 1, 10],
    ["maxLives", settings.lives, 10],
    ["initialFallSpeed", 10, 300],
    ["spawnInterval", 300, 10000],
    ["heartEveryWords", 1, 200],
    ["hintPercent", 1, 100],
  ] as const;

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <fieldset
        disabled={mutation.isPending || uploading}
        className="space-y-6"
      >
        {/* Game Parameters Section in Grid */}
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60 shadow-2xs">
              <SlidersHorizontal className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {isVi ? "Thông số trò chơi" : "Game Parameters"}
              </h3>
              <p className="text-xs text-slate-500">
                {isVi
                  ? "Cấu hình số mạng, tốc độ từ rơi, tỷ lệ gợi ý và chu kỳ xuất hiện tim"
                  : "Configure lives, fall speed, hint ratio, and heart spawns"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {fields.map(([key, min, max]) => (
              <div
                key={key}
                className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 transition-colors hover:border-slate-300 hover:bg-slate-50 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <label
                      htmlFor={`field-${key}`}
                      className="text-xs font-semibold text-slate-700"
                    >
                      {t(key)}
                    </label>
                    <span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      [{min} - {max}]
                    </span>
                  </div>
                  <input
                    id={`field-${key}`}
                    required
                    type="number"
                    step={1}
                    min={min}
                    max={max}
                    value={settings[key]}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        [key]: Number(event.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
                  />
                </div>
                <span className="mt-2 block text-[11px] leading-relaxed text-slate-500">
                  {t(key + "Hint")}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Audio Section */}
        <GameAudioFields
          onBusyChange={setUploading}
          settings={settings}
          onChange={(audio) =>
            setSettings((current) => ({ ...current, ...audio }))
          }
        />

        {mutation.isError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
            {t("settingsError")}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            className={button + " bg-white text-slate-700 hover:bg-slate-50"}
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            className={button + " border-blue-600 bg-blue-600 text-white hover:bg-blue-700"}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t(mutation.isPending ? "loading" : "save")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function TypingRushConfigForm({
  code,
  initial,
  onClose,
}: {
  code: string;
  initial: TypingRushSettings;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("games");
  const isVi = i18n.language?.startsWith("vi") ?? true;
  const client = useQueryClient();
  const [settings, setSettings] = useState({ ...initial });
  const [uploading, setUploading] = useState(false);
  const mutation = useMutation({
    mutationFn: () => gamesService.saveConfiguration(code, settings),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["admin-game-settings", code],
      });
      onClose();
    },
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <fieldset
        disabled={mutation.isPending || uploading}
        className="space-y-6"
      >
        {/* Game Parameters Section in Grid */}
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60 shadow-2xs">
              <SlidersHorizontal className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {isVi ? "Thông số trò chơi" : "Game Parameters"}
              </h3>
              <p className="text-xs text-slate-500">
                {isVi
                  ? "Cấu hình tốc độ rơi, số mạng, khoảng cách xuất hiện từ và thời gian hiển thị"
                  : "Configure fall speed, lives count, word intervals, and display timer"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {settingsFields.map(({ key, min, max }) => {
              const minVal = key === "maxLives" ? settings.lives : min;
              return (
                <div
                  key={key}
                  className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 transition-colors hover:border-slate-300 hover:bg-slate-50 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <label
                        htmlFor={`field-${key}`}
                        className="text-xs font-semibold text-slate-700"
                      >
                        {t(key)}
                      </label>
                      <span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        [{minVal} - {max}]
                      </span>
                    </div>
                    <input
                      id={`field-${key}`}
                      required
                      type="number"
                      step={1}
                      min={minVal}
                      max={max}
                      value={settings[key]}
                      onChange={(e) =>
                        setSettings({ ...settings, [key]: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
                    />
                  </div>
                  <span className="mt-2 block text-[11px] leading-relaxed text-slate-500">
                    {t(key + "Hint")}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Audio Section */}
        <GameAudioFields
          onBusyChange={setUploading}
          settings={settings}
          onChange={(audio) =>
            setSettings((current) => ({ ...current, ...audio }))
          }
        />

        {mutation.isError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
            {t("settingsError")}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            className={button + " bg-white text-slate-700 hover:bg-slate-50"}
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            className={button + " border-blue-600 bg-blue-600 text-white hover:bg-blue-700"}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t(mutation.isPending ? "loading" : "save")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function WordShooterConfigForm({
  code,
  initial,
  onClose,
}: {
  code: string;
  initial: WordShooterSettings;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("games");
  const isVi = i18n.language?.startsWith("vi") ?? true;
  const client = useQueryClient();
  const [settings, setSettings] = useState({ ...initial });
  const [uploading, setUploading] = useState(false);
  const mutation = useMutation({
    mutationFn: () => gamesService.saveConfiguration(code, settings),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["admin-game-settings", code],
      });
      onClose();
    },
  });

  const fields = [
    ["wordsPerRound", 2, 12],
    ["minWordCount", settings.wordsPerRound, 500],
    ["roundDurationSeconds", 3, 120],
    [
      "wrongShotPenaltySeconds",
      1,
      Math.min(60, settings.roundDurationSeconds - 1),
    ],
  ] as const;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <fieldset
        disabled={mutation.isPending || uploading}
        className="space-y-6"
      >
        {/* Game Parameters Section in Grid */}
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60 shadow-2xs">
              <SlidersHorizontal className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {isVi ? "Thông số trò chơi" : "Game Parameters"}
              </h3>
              <p className="text-xs text-slate-500">
                {isVi
                  ? "Cấu hình số từ mỗi lượt, thời gian bắn và mức phạt khi bắn sai"
                  : "Configure targets per round, duration, and miss penalties"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {fields.map(([key, min, max]) => (
              <div
                key={key}
                className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 transition-colors hover:border-slate-300 hover:bg-slate-50 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <label
                      htmlFor={`field-${key}`}
                      className="text-xs font-semibold text-slate-700"
                    >
                      {t(key)}
                    </label>
                    <span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      [{min} - {max}]
                    </span>
                  </div>
                  <input
                    id={`field-${key}`}
                    required
                    type="number"
                    step={1}
                    min={min}
                    max={max}
                    value={settings[key]}
                    onChange={(e) =>
                      setSettings({ ...settings, [key]: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
                  />
                </div>
                <span className="mt-2 block text-[11px] leading-relaxed text-slate-500">
                  {t(key + "Hint")}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Audio Section */}
        <GameAudioFields
          onBusyChange={setUploading}
          settings={settings}
          onChange={(audio) =>
            setSettings((current) => ({ ...current, ...audio }))
          }
        />

        {mutation.isError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
            {t("settingsError")}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            className={button + " bg-white text-slate-700 hover:bg-slate-50"}
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            className={button + " border-blue-600 bg-blue-600 text-white hover:bg-blue-700"}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t(mutation.isPending ? "loading" : "save")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
