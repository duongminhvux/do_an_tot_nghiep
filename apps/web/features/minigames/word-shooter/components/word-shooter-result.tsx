"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trophy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wordShooterService } from "../service";
import type { GameState } from "../types";
export function WordShooterResult({
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
      await wordShooterService.save(state.score);
      setSaveState("saved");
    } catch {
      setSaveState("failed");
      return;
    }
    try {
      setBest((await wordShooterService.stats()).bestScore);
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
    <section className="min-h-0 flex-1 overflow-y-auto w-full rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-900 shadow-sm sm:p-10">
      <span className="mx-auto flex size-14 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
        <Trophy className="size-7" />
      </span>
      <h2 className="mt-4 text-2xl font-bold">{t("game_over")}</h2>
      <p className="mt-5 text-5xl font-bold tracking-tight text-blue-600">
        {state.score.toLocaleString(locale)}
      </p>
      <p className="mt-2 text-sm text-slate-500">{t("score")}</p>
      <div className="my-5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-slate-600">
        <span>{t("shooter_correct", { count: state.correct })}</span>
        <span>{t("shooter_wrong", { count: state.wrong })}</span>
      </div>
      {best !== null && (
        <p className="text-sm font-semibold text-amber-600">
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
        <Button variant="link" size="sm" onClick={() => void save()}>
          {t("retry_save")}
        </Button>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:items-center">
        <Button
          size="lg"
          disabled={starting || saveState === "saving"}
          onClick={onAgain}
        >
          {starting && <Loader2 className="animate-spin" />}
          {t("play_again")}
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={saveState === "saving"}
          onClick={onChange}
        >
          {t("change_sources")}
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href={"/" + locale + "/games"}>{t("back_games")}</Link>
        </Button>
      </div>
    </section>
  );
}
