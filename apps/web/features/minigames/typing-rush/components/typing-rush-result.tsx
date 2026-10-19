"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trophy, Loader2 } from "lucide-react";
import { typingRushService } from "../service";
import type { GameState } from "../types";
export function TypingRushResult({
  state,
  locale,
  onAgain,
  onChange,
  starting,
}: {
  state: GameState;
  locale: string;
  onAgain: () => void;
  onChange: () => void;
  starting: boolean;
}) {
  const { t } = useTranslation("minigames");
  const sent = useRef(false);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "failed">(
    "saving",
  );
  const [best, setBest] = useState<number | null>(null);
  const save = async () => {
    setSaveState("saving");
    try {
      await typingRushService.save(state.score);
      setSaveState("saved");
    } catch {
      setSaveState("failed");
      return;
    }
    try {
      setBest((await typingRushService.stats()).bestScore);
    } catch {
      /* A stats outage must not turn a successful save into a retry. */
    }
  };
  useEffect(() => {
    if (!sent.current) {
      sent.current = true;
      void save();
    }
  }, []);
  return (
    <section className="w-full rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-900 shadow-sm sm:p-10">
      <Trophy className="mx-auto size-12 text-amber-500" />
      <h2 className="mt-4 text-2xl font-bold">{t("game_over")}</h2>
      <p className="mt-5 text-5xl font-black text-blue-600">
        {state.score.toLocaleString(locale)}
      </p>
      <p className="mt-2 text-sm text-slate-500">{t("score")}</p>
      <div className="my-5 flex justify-center gap-5 text-sm text-slate-600">
        <span>{t("appeared_count", { count: state.wordsAppeared })}</span>
        <span>{t("best_combo", { count: state.bestCombo })}</span>
      </div>
      {best !== null && (
        <p className="text-sm text-amber-600">
          {t("personal_best")}: {best.toLocaleString(locale)}
        </p>
      )}
      <p role="status" className="mt-3 text-sm text-slate-500">
        {saveState === "saving"
          ? t("saving")
          : saveState === "saved"
            ? t("saved")
            : t("save_failed")}
      </p>
      {saveState === "failed" && (
        <button
          onClick={() => void save()}
          className="mt-2 text-sm font-semibold text-blue-600 underline"
        >
          {t("retry_save")}
        </button>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:items-center">
        <button
          disabled={starting || saveState === "saving"}
          onClick={onAgain}
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {starting && <Loader2 className="size-4 animate-spin" />}
          {t("play_again")}
        </button>
        <button
          disabled={saveState === "saving"}
          onClick={onChange}
          className="rounded-lg border border-slate-200 px-5 py-3 font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          {t("change_sources")}
        </button>
        <Link
          href={"/" + locale + "/games"}
          className="py-2 text-sm text-slate-500 hover:text-indigo-600"
        >
          {t("back_games")}
        </Link>
      </div>
    </section>
  );
}
