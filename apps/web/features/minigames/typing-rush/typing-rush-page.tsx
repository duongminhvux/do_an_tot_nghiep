"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Keyboard } from "lucide-react";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  PageShell,
} from "@/components/ui/page";
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
  if (session)
    return (
      <main className="flex h-[calc(100dvh-3.5rem)] min-h-0 w-full min-w-0 flex-col gap-2 overflow-hidden bg-background p-2 sm:p-3">
        <header className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Keyboard className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900">
              {t("title")}
            </h1>
            <p className="truncate text-xs text-slate-500">{t("subtitle")}</p>
          </div>
        </header>
        {error && <ErrorState message={error} className="shrink-0 py-2" />}
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
      </main>
    );
  return (
    <PageShell>
      <PageHeader
        back={{ href: "/" + locale + "/games", label: t("back_games") }}
        icon={Keyboard}
        title={t("title")}
        description={t("subtitle")}
      />
      {error && <ErrorState message={error} />}
      {sources.isPending ? (
        <LoadingState label={t("loading_sources")} />
      ) : sources.isError ? (
        <ErrorState
          message={t("sources_failed")}
          onRetry={() => void sources.refetch()}
          retryLabel={t("retry")}
        />
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
    </PageShell>
  );
}
