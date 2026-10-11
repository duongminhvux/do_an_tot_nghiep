"use client";

import { useArenaController } from "./hooks/use-arena-controller";
import { ArenaHero } from "./components/arena-hero";
import { ArenaModes } from "./components/arena-modes";
import { ArenaStats } from "./components/arena-stats";
import { RecentMatches } from "./components/recent-matches";
import { ArenaLeaderboard } from "./components/arena-leaderboard";
import { ArenaFooter } from "./components/arena-footer";
import { ArenaDialog } from "./components/arena-dialog";

export default function ArenaPage() {
  const data = useArenaController();
  return (
    <main className="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6 lg:p-7">
      <ArenaHero {...data} />
      <ArenaModes {...data} />
      <ArenaStats {...data} />
      <div className="grid items-stretch gap-4 lg:grid-cols-[1.55fr_1fr]">
        <RecentMatches {...data} />
        <ArenaLeaderboard {...data} />
      </div>
      <ArenaFooter {...data} />
      <ArenaDialog {...data} />
    </main>
  );
}
