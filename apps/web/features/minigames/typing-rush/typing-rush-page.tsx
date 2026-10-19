"use client";
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Keyboard, Loader2 } from "lucide-react";
import { typingRushService, gameErrorCode } from "./service";
import { TypingRushSetup } from "./components/typing-rush-setup";
import { TypingRushGame } from "./components/typing-rush-game";
import type { GameSession, StartRequest } from "./types";
export function TypingRushPage() {
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
    queryKey: ["minigame-sources"],
    queryFn: typingRushService.sources,
    enabled: !session,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: session ? false : 30000,
  });
  const stats = useQuery({
    queryKey: ["typing-rush-stats"],
    queryFn: typingRushService.stats,
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
      const data = await typingRushService.start(request);
      setSession({ data, key: Date.now() });
    } catch (e) {
      const code = gameErrorCode(e);
      const refreshed =
        code === "TYPING_RUSH_MIN_WORDS" ? await sources.refetch() : null;
      setError(
        code === "MINIGAME_DISABLED"
          ? t("disabled")
          : code === "TYPING_RUSH_MIN_WORDS"
            ? t("minimum_words", {
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
    <main className="w-full min-w-0 space-y-5 p-4 sm:p-6 xl:p-8">
      {!session && (
        <Link
          href={"/" + locale + "/games"}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="size-4" />
          {t("back_games")}
        </Link>
      )}
      <header className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Keyboard className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
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
        <TypingRushGame
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
        <TypingRushSetup
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
