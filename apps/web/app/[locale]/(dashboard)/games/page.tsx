"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, Keyboard } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getGameCatalog } from "@/features/minigames/catalog";
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
    <main className="w-full min-w-0 space-y-6 p-4 sm:p-6 xl:p-8">
      <GamesBanner />
      {query.isPending ? (
        <p role="status" className="p-8 text-center text-slate-500">
          {t("games_page.loading")}
        </p>
      ) : query.isError ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-8 text-center"
        >
          <p>{t("games_page.load_error")}</p>
          <button
            onClick={() => void query.refetch()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
          >
            {t("games_page.retry")}
          </button>
        </div>
      ) : !query.data.length ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          {t("games_page.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {query.data.map((game) => (
            <article
              key={game._id}
              className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              {game.imageUrl ? (
                <img
                  src={game.imageUrl}
                  alt=""
                  className="aspect-video w-full rounded-lg bg-slate-50 object-cover"
                />
              ) : (
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
                  <Keyboard className="size-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-blue-600">
                  {t(
                    game.category === "SOLO"
                      ? "games_page.solo"
                      : "games_page.multiplayer",
                  )}
                </span>
                <h2 className="mt-1 text-base font-bold text-slate-900">
                  {locale === "en" && game.nameEn ? game.nameEn : game.name}
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-500">
                  {locale === "en" && game.descriptionEn
                    ? game.descriptionEn
                    : game.description}
                </p>
              </div>
              <Link
                href={
                  "/" +
                  locale +
                  game.destination.replace(/^\/(vi|en)(?=\/)/, "")
                }
                className="inline-flex w-full items-center justify-between gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {t("games_page.play")}
                <ArrowRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
