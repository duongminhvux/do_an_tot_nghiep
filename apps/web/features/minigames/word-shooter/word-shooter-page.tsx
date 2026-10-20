"use client";
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crosshair, Loader2 } from "lucide-react";
import { wordShooterService, gameErrorCode } from "./service";
import { WordShooterSetup } from "./components/word-shooter-setup";
import { WordShooterGame } from "./components/word-shooter-game";
import type { GameSession, StartRequest } from "./types";
export function WordShooterPage() {
  const params = useParams(),
    locale = params.locale === "en" ? "en" : "vi";
  const { t } = useTranslation("minigames");
  const [selected, setSelected] = useState<string[]>([]);
  const [session, setSession] = useState<{
    data: GameSession;
    key: number;
  } | null>(null);
  const [starting, setStarting] = useState(false),
    [error, setError] = useState("");
  const sources = useQuery({
    queryKey: ["word-shooter-sources"],
    queryFn: wordShooterService.sources,
    enabled: !session,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: session ? false : 30000,
  });
  const stats = useQuery({
    queryKey: ["word-shooter-stats"],
    queryFn: wordShooterService.stats,
    enabled: !session,
    refetchOnWindowFocus: false,
  });
  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError("");
    const request: StartRequest = {
      difficulty: "NORMAL",
      sources: selected.map((key) => {
        const [type, id] = key.split(":");
        return { type: type as "SYSTEM" | "USER", id: id! };
      }),
    };
    try {
      const data = await wordShooterService.start(request);
      setSession({ data, key: Date.now() });
    } catch (e) {
      const code = gameErrorCode(e);
      const refreshed =
        code === "WORD_SHOOTER_MIN_WORDS" ? await sources.refetch() : null;
      setError(
        code === "MINIGAME_DISABLED"
          ? t("disabled")
          : code === "WORD_SHOOTER_MIN_WORDS"
            ? t("shooter_minimum_words", {
                count:
                  refreshed?.data?.settings?.minWordCount ??
                  sources.data?.settings?.minWordCount ??
                  10,
              })
            : code === "MINIGAME_SOURCE_UNAVAILABLE"
              ? t("source_unavailable")
              : t("request_failed"),
      );
    } finally {
      setStarting(false);
    }
  };
  return (
    <main
      className={
        session
          ? "flex h-[calc(100dvh-3.5rem)] min-h-0 w-full min-w-0 flex-col gap-2 overflow-hidden p-2 sm:p-3"
          : "w-full min-w-0 space-y-4 p-4 sm:p-6"
      }
    >
      {!session && (
        <Link
          href={"/" + locale + "/games"}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="size-4" />
          {t("back_games")}
        </Link>
      )}
      <header className="flex shrink-0 items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Crosshair className="size-4" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 sm:text-lg">
            {t("shooter_title")}
          </h1>
          <p className="text-xs text-slate-500">{t("shooter_subtitle")}</p>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      {session ? (
        <WordShooterGame
          key={session.key}
          session={session.data}
          locale={locale}
          starting={starting}
          onAgain={() => void start()}
          onChange={() => {
            setSession(null);
            setError("");
          }}
        />
      ) : sources.isPending ? (
        <div
          role="status"
          className="flex min-h-64 items-center justify-center gap-2 text-slate-500"
        >
          <Loader2 className="size-5 animate-spin" />
          {t("loading_sources")}
        </div>
      ) : sources.isError ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-white p-6"
        >
          <p className="text-sm text-rose-600">{t("sources_failed")}</p>
          <button
            onClick={() => void sources.refetch()}
            className="mt-3 text-sm font-semibold text-indigo-600"
          >
            {t("retry")}
          </button>
        </div>
      ) : (
        <WordShooterSetup
          sources={sources.data!}
          stats={stats.data}
          selected={selected}
          onSelect={setSelected}
          busy={starting}
          onStart={() => void start()}
        />
      )}
    </main>
  );
}
