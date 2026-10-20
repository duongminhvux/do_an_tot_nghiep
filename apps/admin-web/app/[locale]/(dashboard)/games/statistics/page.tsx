"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { minigamesAdminService } from "@/services/minigames-admin.service";

export default function GameStatisticsPage() {
  const { t } = useTranslation("games");
  const query = useQuery({ queryKey: ["minigame-statistics"], queryFn: minigamesAdminService.statistics });
  const data = query.data;
  return (
    <main className="w-full space-y-5 p-4 sm:p-6 xl:p-8">
      <div><h1 className="text-2xl font-bold text-slate-900">{t("statisticsTitle")}</h1><p className="mt-1 text-sm text-slate-500">{t("statisticsSubtitle")}</p></div>
      {query.isPending ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">{t("loading")}</p> : query.isError || !data ? <p className="rounded-xl border border-red-100 bg-red-50 p-8 text-center text-red-700">{t("error")}</p> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">{[[t("totalPlays"), data.totalPlays], [t("playsToday"), data.playsToday], [t("uniquePlayers"), data.uniquePlayers]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{Number(value).toLocaleString()}</p></div>)}</div>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><h2 className="border-b border-slate-100 p-4 font-semibold">{t("playsByGame")}</h2><div className="divide-y divide-slate-100">{data.games.map((game) => <div className="flex items-center justify-between px-4 py-3 text-sm" key={game.gameType}><span>{game.gameType}</span><span className="font-semibold">{game.plays.toLocaleString()} {t("plays")} · {t("best")}: {game.bestScore.toLocaleString()}</span></div>)}{!data.games.length && <p className="p-8 text-center text-slate-500">{t("empty")}</p>}</div></section>
        </>
      )}
    </main>
  );
}
