"use client";
import { GameAudioFields } from "../minigames/game-audio-fields";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  arenaAdminService as api,
  type ArenaConfig,
  type SettingsResponse,
} from "@/services/arena.service";
import {
  ArenaShell,
  Panel,
  QueryNotice,
  button,
  control,
  primary,
  useArenaUI,
} from "./common";
const fields: {
  section: "ranked" | "friendly" | "group";
  title: string;
  items: [string, number, number][];
}[] = [
  {
    section: "ranked",
    title: "values.RANK",
    items: [
      ["defaultRating", 0, 10000],
      ["kFactor", 1, 128],
      ["ratingRange", 0, 2000],
      ["questionCount", 1, 50],
      ["timePerQuestion", 5, 120],
      ["readyTimeout", 5, 120],
      ["reconnectGrace", 5, 120],
    ],
  },
  {
    section: "friendly",
    title: "values.FRIEND",
    items: [
      ["inviteTimeout", 5, 120],
      ["reconnectGrace", 5, 120],
    ],
  },
  {
    section: "group",
    title: "values.ROOM",
    items: [
      ["maxPlayers", 3, 8],
      ["roomIdleTimeout", 60, 86400],
      ["reconnectGrace", 5, 120],
    ],
  },
];
export function ArenaSettingsPage() {
  const { t } = useArenaUI();
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ["admin-arena", "settings"],
    queryFn: api.settings,
  });
  return (
    <ArenaShell title="settings" refresh={() => void query.refetch()}>
      {!query.data ? (
        <QueryNotice query={query} />
      ) : (
        <>
          <SettingsForm
            key={query.data.revision}
            initial={query.data}
            onSaved={() => setSaved(true)}
          />
          {saved && (
            <p
              role="status"
              className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
            >
              {t("saved")}
            </p>
          )}
        </>
      )}
    </ArenaShell>
  );
}
function SettingsForm({
  initial,
  onSaved,
}: {
  initial: SettingsResponse;
  onSaved: () => void;
}) {
  const { t } = useArenaUI();
  const client = useQueryClient();
  const [config, setConfig] = useState<ArenaConfig>(() =>
    structuredClone(initial.config),
  );
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api.saveSettings({ revision: initial.revision, config, reason }),
    onSuccess: async () => {
      setConfirm(false);
      onSaved();
      await client.invalidateQueries({ queryKey: ["admin-arena", "settings"] });
    },
  });
  return (
    <>
      <p className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-700">
        {t("settingsHint")}
      </p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setConfirm(true);
          mutation.reset();
        }}
      >
        <fieldset
          disabled={mutation.isPending || uploading}
          className="space-y-4"
        >
          <Panel>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={config.maintenance}
                onChange={(e) =>
                  setConfig({ ...config, maintenance: e.target.checked })
                }
              />
              {t("maintenance")}
            </label>
          </Panel>
          {fields.map((group) => (
            <Panel key={group.section} title={t(group.title)}>
              <label className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={config[group.section].enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      [group.section]: {
                        ...config[group.section],
                        enabled: e.target.checked,
                      },
                    })
                  }
                />
                {t("enabled")}
              </label>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map(([key, min, max]) => (
                  <label
                    key={key}
                    className="space-y-1.5 text-xs font-medium text-slate-500"
                  >
                    <span>{t(key)}</span>
                    <input
                      className={control}
                      type="number"
                      required
                      step={1}
                      min={min}
                      max={max}
                      value={Number(
                        (
                          config[group.section] as unknown as Record<
                            string,
                            unknown
                          >
                        )[key],
                      )}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          [group.section]: {
                            ...config[group.section],
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                    />
                    <span className="block text-[10px] font-normal">
                      {min}–{max}
                    </span>
                  </label>
                ))}
              </div>
            </Panel>
          ))}
          <GameAudioFields
            title={t("audioTitle")}
            hint={t("audioHint")}
            settings={config.audio ?? {}}
            onBusyChange={setUploading}
            onChange={(audio) =>
              setConfig((current) => ({
                ...current,
                audio: { ...current.audio, ...audio },
              }))
            }
          />
          <p className="text-xs leading-5 text-slate-500">{t("fixedRules")}</p>
          <div className="flex justify-end">
            <button className={primary} type="submit">
              {t("save")}
            </button>
          </div>
        </fieldset>
      </form>
      <Dialog
        open={confirm}
        onOpenChange={(value) => {
          if (!mutation.isPending) setConfirm(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settingsConfirm")}</DialogTitle>
            <DialogDescription>{t("settingsConfirmHint")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <label className="block space-y-2 text-sm">
              <span>{t("reason")}</span>
              <textarea
                className={control}
                required
                maxLength={500}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {mutation.isError && (
              <p role="alert" className="text-sm text-red-600">
                {t("settingsError")}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={button}
                disabled={mutation.isPending}
                onClick={() => setConfirm(false)}
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className={primary}
                disabled={mutation.isPending || !reason.trim()}
              >
                {t(mutation.isPending ? "loading" : "confirm")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
