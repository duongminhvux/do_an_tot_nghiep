"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, Gamepad2, Keyboard } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getGameCatalog } from "@/features/minigames/catalog";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  PageShell,
  surface,
} from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GamesBanner } from "./components/games-banner";
export default function GamesPage() {
  const params = useParams();
  const locale = params.locale === "en" ? "en" : "vi";
  const { t } = useTranslation("common");
  const query = useQuery({
    queryKey: ["game-catalog"],
    queryFn: getGameCatalog,
    staleTime: 0,
    refetchInterval: 30000,
  });
  return (
    <PageShell>
      <GamesBanner />
      {query.isPending ? (
        <LoadingState label={t("games_page.loading")} />
      ) : query.isError ? (
        <ErrorState
          message={t("games_page.load_error")}
          onRetry={() => void query.refetch()}
          retryLabel={t("games_page.retry")}
        />
      ) : !query.data.length ? (
        <EmptyState icon={Gamepad2} title={t("games_page.empty")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {query.data.map((game) => (
            <article
              key={game._id}
              className={cn(
                surface,
                "flex min-w-0 flex-col gap-4 overflow-hidden p-5",
              )}
            >
              {game.imageUrl ? (
                <img
                  src={game.imageUrl}
                  alt=""
                  className="aspect-video w-full rounded-lg bg-slate-50 object-cover"
                />
              ) : (
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Keyboard className="size-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Badge tone={game.category === "SOLO" ? "blue" : "violet"}>
                  {t(
                    game.category === "SOLO"
                      ? "games_page.solo"
                      : "games_page.multiplayer",
                  )}
                </Badge>
                <h2 className="mt-2 text-base font-semibold text-slate-900">
                  {locale === "en" && game.nameEn ? game.nameEn : game.name}
                </h2>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-500">
                  {locale === "en" && game.descriptionEn
                    ? game.descriptionEn
                    : game.description}
                </p>
              </div>
              <Button asChild className="w-full justify-between">
                <Link
                  href={
                    "/" +
                    locale +
                    game.destination.replace(/^\/(vi|en)(?=\/)/, "")
                  }
                >
                  {t("games_page.play")}
                  <ArrowRight />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
