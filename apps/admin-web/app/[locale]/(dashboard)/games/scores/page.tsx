"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { minigamesAdminService, type ScoreSort } from "@/services/minigames-admin.service";
import type { GameDefinition } from "@/services/games.service";
import { gamesService } from "@/services/games.service";

const inputClass = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

export default function GameScoresPage() {
  const { t } = useTranslation("games");
  const [gameType, setGameType] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ScoreSort>("newest");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const games = useQuery({ queryKey: ["admin-games"], queryFn: gamesService.list });
  const scores = useQuery({
    queryKey: ["minigame-scores", gameType, search, sort, from, to, minScore, maxScore],
    queryFn: () => minigamesAdminService.scores({
      gameType: gameType || undefined, search: search || undefined, sort,
      from: from || undefined, to: to || undefined,
      minScore: minScore ? Number(minScore) : undefined,
      maxScore: maxScore ? Number(maxScore) : undefined,
    }),
  });
  const rows = scores.data?.items ?? [];
  return (
    <main className="w-full space-y-5 p-4 sm:p-6 xl:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("scoresTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("scoresSubtitle")}</p>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <input className={inputClass} placeholder={t("playerSearch")} value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={inputClass} value={gameType} onChange={(e) => setGameType(e.target.value)}>
            <option value="">{t("allGames")}</option>
            {(games.data ?? []).map((game: GameDefinition) => <option key={game.code} value={game.code}>{game.name}</option>)}
          </select>
          <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value as ScoreSort)}>
            <option value="newest">{t("newest")}</option>
            <option value="oldest">{t("oldest")}</option>
            <option value="score_desc">{t("highest")}</option>
            <option value="score_asc">{t("lowest")}</option>
          </select>
          <input aria-label={t("fromDate")} type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          <input aria-label={t("toDate")} type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          <input aria-label={t("minScore")} type="number" min="0" className={inputClass + " w-32"} placeholder={t("minScore")} value={minScore} onChange={(e) => setMinScore(e.target.value)} />
          <input aria-label={t("maxScore")} type="number" min="0" className={inputClass + " w-32"} placeholder={t("maxScore")} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
        </div>
        {scores.isPending ? <p className="p-8 text-center text-slate-500">{t("loading")}</p> : scores.isError ? <p className="p-8 text-center text-red-600">{t("error")}</p> : (
          <div className="min-w-0 max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500"><tr><th className="px-4 py-3">{t("player")}</th><th className="px-4 py-3">{t("game")}</th><th className="px-4 py-3">{t("score")}</th><th className="px-4 py-3">{t("playedAt")}</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => <tr key={row._id}><td className="px-4 py-3"><p className="font-medium">{row.player?.username || row.userId}</p><p className="text-xs text-slate-500">{row.player?.email}</p></td><td className="px-4 py-3">{row.gameType}</td><td className="px-4 py-3 font-semibold tabular-nums">{row.score.toLocaleString()}</td><td className="px-4 py-3 text-slate-500">{dateFormatter.format(new Date(row.createdAt))}</td></tr>)}
                {!rows.length && <tr><td colSpan={4} className="p-10 text-center text-slate-500">{t("empty")}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
