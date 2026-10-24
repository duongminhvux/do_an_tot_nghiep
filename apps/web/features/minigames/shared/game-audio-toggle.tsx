"use client";

import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getAudioMuted,
  setAudioMuted,
  subscribeAudioMuted,
} from "./audio-preference";

export function GameAudioToggle({ enabled = true }: { enabled?: boolean }) {
  const { t } = useTranslation("minigames");
  const muted = useSyncExternalStore(
    subscribeAudioMuted,
    getAudioMuted,
    () => false,
  );
  const label = t(
    !enabled ? "audio_admin_disabled" : muted ? "audio_unmute" : "audio_mute",
  );
  const Icon = muted || !enabled ? VolumeX : Volume2;
  return (
    <button
      type="button"
      disabled={!enabled}
      aria-pressed={muted || !enabled}
      aria-label={label}
      title={label}
      onClick={() => setAudioMuted(!getAudioMuted())}
      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
