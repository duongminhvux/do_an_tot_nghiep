"use client";
import { GameAudioFields } from "../minigames/game-audio-fields";
import { useState } from "react";
import { AlertTriangle, RotateCcw, Settings2, ShieldCheck } from "lucide-react";
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
  const changed = JSON.stringify(config) !== JSON.stringify(initial.config);
  const updateField = (section: "ranked" | "friendly" | "group", key: string, value: number) =>
    setConfig(current => ({...current, [section]: {...current[section], [key]: value}}));
  const numericField = (section: "ranked" | "friendly" | "group", key: string, min: number, max: number) => (
    <label key={`${section}.${key}`} className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <span className="text-sm font-semibold text-slate-800">{t(key)}</span>
      <span className="min-h-9 text-xs leading-5 text-slate-500">{t(`fieldHelp.${key}`)}</span>
      <input className={control} type="number" required min={min} max={max} step={1}
        value={Number((config[section] as unknown as Record<string, unknown>)[key])}
        onChange={e => updateField(section,key,Number(e.target.value))}/>
      <span className="text-xs text-slate-400">{min}–{max}</span>
    </label>
  );
  const numericConnectionField = (key: "reloadGraceSeconds" | "disconnectTimeoutSeconds" | "resumeCountdownSeconds" | "maxTotalPauseSeconds" | "maxPauseCount", min: number, max: number) => (
    <label key={key} className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <span className="text-sm font-semibold text-slate-800">{t(key)}</span>
      <span className="min-h-9 text-xs leading-5 text-slate-500">{t(`fieldHelp.${key}`)}</span>
      <input className={control} type="number" required min={key === 'maxTotalPauseSeconds' ? Math.max(min, config.rankedConnection.disconnectTimeoutSeconds) : min} max={max} step={1}
        value={config.rankedConnection[key]} onChange={e => setConfig(current => ({...current, rankedConnection:{...current.rankedConnection,[key]:Number(e.target.value)}}))}/>
      <span className="text-xs text-slate-400">{min}–{max}</span>
    </label>
  );
  return (
    <>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <div className="flex items-start gap-2"><Settings2 className="mt-1 size-4 shrink-0"/><span>{t("settingsIntro")}</span></div>
      </div>
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
          <Panel title={t("generalTitle")}>
            <p className="mb-4 text-sm text-slate-500">{t("generalDescription")}</p>
            <label className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              <input type="checkbox" checked={config.maintenance} onChange={e => setConfig(current=>({...current,maintenance:e.target.checked}))}/>
              {t("maintenance")}
            </label>
            <p className="mt-2 text-xs text-slate-500">{t("maintenanceDescription")}</p>
          </Panel>
          <Panel title={t("values.RANK")}>
            <p className="mb-4 text-sm text-slate-500">{t("rankedDescription")}</p>
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={config.ranked.enabled} onChange={e=>setConfig(current=>({...current,ranked:{...current.ranked,enabled:e.target.checked}}))}/>{t("enabled")}
            </label>
            <h3 className="mb-3 text-sm font-bold text-slate-800">{t("rulesTitle")}</h3>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {numericField("ranked","questionCount",1,50)}
              {numericField("ranked","timePerQuestion",5,120)}
              {numericField("ranked","readyTimeout",5,120)}
            </div>
            <h3 className="mb-3 border-t border-slate-100 pt-5 text-sm font-bold text-slate-800">{t("ratingTitle")}</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {numericField("ranked","defaultRating",0,10000)}
              {numericField("ranked","kFactor",1,128)}
              {numericField("ranked","ratingRange",0,2000)}
              {numericField("ranked","reconnectGrace",5,120)}
            </div>
          </Panel>
          <Panel title={t("hintsTitle")}>
            <p className="mb-2 text-sm text-slate-500">{t("hintDescription")}</p>
            <p className="mb-4 text-xs text-slate-500">{t("hintsHint")}</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {([['startAfterSeconds',0,119],['intervalSeconds',1,60],['maxPercent',0,100]] as const).map(([key,min,max]) => (
                <label key={key} className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-sm font-semibold text-slate-800">{t(`hints.${key}`)}</span>
                  <span className="min-h-9 text-xs leading-5 text-slate-500">{t(`fieldHelp.${key}`)}</span>
                  <input className={control} type="number" required step={1} min={min}
                    max={key==='startAfterSeconds' && config.hints.maxPercent>0 ? Math.min(max, config.ranked.timePerQuestion-1):max}
                    value={config.hints[key]} onChange={e=>setConfig(current=>({...current,hints:{...current.hints,[key]:Number(e.target.value)}}))}/>
                  <span className="text-xs text-slate-400">{min}–{max}</span>
                </label>
              ))}
            </div>
            {config.hints.maxPercent > 0 && config.hints.startAfterSeconds >= config.ranked.timePerQuestion && (
              <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="size-4"/>{t("hintsHint")}</p>
            )}
          </Panel>
          <Panel title={t("connectionTitle")}>
            <p className="mb-4 text-sm leading-6 text-slate-500">{t("connectionHint")}</p>
            <label className="mb-5 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-900">
              <input type="checkbox" checked={config.rankedConnection.rankedPauseEnabled} onChange={e=>setConfig(current=>({...current, rankedConnection:{...current.rankedConnection,rankedPauseEnabled:e.target.checked}}))}/>
              {t("rankedPauseEnabled")}
            </label>
            <h3 className="mb-3 text-sm font-bold text-slate-800">{t("connectionRulesTitle")}</h3>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {numericConnectionField("reloadGraceSeconds",0,15)}
              {numericConnectionField("disconnectTimeoutSeconds",10,300)}
              {numericConnectionField("resumeCountdownSeconds",0,10)}
            </div>
            <h3 className="mb-3 border-t border-slate-100 pt-5 text-sm font-bold text-slate-800">{t("connectionLimitsTitle")}</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {numericConnectionField("maxTotalPauseSeconds",10,900)}
              {numericConnectionField("maxPauseCount",1,10)}
            </div>
            <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <p>{t("bothDisconnectedHint")}</p><p>{t("onlineAfkDisabled")}</p>
            </div>
          </Panel>
          {(["friendly","group"] as const).map(section => (
            <Panel key={section} title={t(section === 'friendly' ? 'values.FRIEND':'values.ROOM')}>
              <p className="mb-4 text-sm text-slate-500">{t(section === 'friendly' ? 'friendlyDescription':'groupDescription')}</p>
              <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={config[section].enabled} onChange={e=>setConfig(current=>({...current,[section]:{...current[section],enabled:e.target.checked}}))}/>{t("enabled")}
              </label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {fields.find(g=>g.section===section)?.items.map(([key,min,max])=>numericField(section,key,min,max))}
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800"><ShieldCheck className="size-4" />{t("previewTitle")}</h3>
            <div className="grid gap-2 text-slate-600 sm:grid-cols-2">
              <span>{t("previewTime",{count:config.ranked.timePerQuestion})}</span>
              <span>{t("previewHints",{count:config.hints.maxPercent})}</span>
              <span>{t("previewReconnect",{count:config.rankedConnection.disconnectTimeoutSeconds})}</span>
              <span>{t("previewPlayers",{count:config.group.maxPlayers})}</span>
            </div>
            <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">{t("fixedRules")}</p>
          </div>
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <span className="text-xs font-medium text-slate-600">{t(changed ? "unsavedChanges" : "unchanged")}</span>
            <div className="flex gap-2">
              <button type="button" className={button} disabled={!changed} onClick={()=>setConfig(structuredClone(initial.config))}>
                <RotateCcw className="size-4" />{t("resetChanges")}
              </button>
              <button className={primary} type="submit" disabled={!changed}>
              {t("save")}
              </button>
            </div>
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
