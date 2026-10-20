"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  "rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-40";
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t("config")} · {game.name}
          </DialogTitle>
          <DialogDescription>{t("configHint")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <p role="status">{t("loading")}</p>
        ) : query.isError ? (
          <div role="alert">
            <p>{t("error")}</p>
            <button className={button} onClick={() => void query.refetch()}>
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
  function MeaningTypingConfigForm({
    code,
    initial,
    onClose,
  }: {
    code: string;
    initial: MeaningTypingSettings;
    onClose: () => void;
  }) {
    const { t } = useTranslation("games");
    const client = useQueryClient();
    const [settings, setSettings] = useState({ ...initial });
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
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4">
          {fields.map(([key, min, max]) => (
            <label key={key} className="block space-y-2 text-sm">
              <span className="font-medium text-slate-700">{t(key)}</span>
              <input
                required
                type="number"
                min={min}
                max={max}
                value={settings[key]}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    [key]: Number(event.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <span className="block text-xs text-slate-500">
                {t(key + "Hint")}
              </span>
            </label>
          ))}
          {mutation.isError && (
            <p role="alert" className="text-sm text-red-600">
              {t("settingsError")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={button} onClick={onClose}>
              {t("cancel")}
            </button>
            <button
              type="submit"
              className={button + " bg-blue-600 text-white"}
            >
              {t(mutation.isPending ? "loading" : "save")}
            </button>
          </div>
        </fieldset>
      </form>
    );
  }
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
  const { t } = useTranslation("games");
  const client = useQueryClient();
  const [settings, setSettings] = useState({ ...initial });
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
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <fieldset disabled={mutation.isPending} className="space-y-4">
        {settingsFields.map(({ key, min, max }) => (
          <label key={key} className="block space-y-2 text-sm">
            <span className="font-medium text-slate-700">{t(key)}</span>
            <input
              required
              type="number"
              step={1}
              min={key === "maxLives" ? settings.lives : min}
              max={max}
              value={settings[key]}
              onChange={(e) =>
                setSettings({ ...settings, [key]: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            <span className="block text-xs text-slate-500">
              {t(key + "Hint")}
            </span>
          </label>
        ))}
        {mutation.isError && (
          <p role="alert" className="text-sm text-red-600">
            {t("settingsError")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={button} onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={button + " bg-blue-600 text-white"}>
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
  const { t } = useTranslation("games");
  const client = useQueryClient();
  const [settings, setSettings] = useState({ ...initial });
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
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <fieldset disabled={mutation.isPending} className="space-y-4">
        {fields.map(([key, min, max]) => (
          <label key={key} className="block space-y-2 text-sm">
            <span className="font-medium text-slate-700">{t(key)}</span>
            <input
              required
              type="number"
              step={1}
              min={min}
              max={max}
              value={settings[key]}
              onChange={(e) =>
                setSettings({ ...settings, [key]: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            <span className="block text-xs text-slate-500">
              {t(key + "Hint")}
            </span>
          </label>
        ))}
        {mutation.isError && (
          <p role="alert" className="text-sm text-red-600">
            {t("settingsError")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={button} onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={button + " bg-blue-600 text-white"}>
            {t(mutation.isPending ? "loading" : "save")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
