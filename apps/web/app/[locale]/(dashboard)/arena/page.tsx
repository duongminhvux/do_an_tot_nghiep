"use client";

import { useArenaController } from "./hooks/use-arena-controller";
import { ArenaHero } from "./components/arena-hero";
import { ArenaModes } from "./components/arena-modes";
import { ArenaStats } from "./components/arena-stats";
import { RecentMatches } from "./components/recent-matches";
import { ArenaLeaderboard } from "./components/arena-leaderboard";
import { ArenaFooter } from "./components/arena-footer";
import { ArenaDialog } from "./components/arena-dialog";
import { useQuery } from "@tanstack/react-query";
import { arenaService } from "@/services/arena.service";
import { useEffect } from "react";

export default function ArenaPage() {
  const data = useArenaController();
  const { data: profileData } = useQuery({
    queryKey: ["arena-profile", data.currentUserId],
    enabled: !!data.currentUserId,
    queryFn: async () => {
      const data = await arenaService.getProfile();
      return data;
    },
  });
  useEffect(() => {
    if (profileData) {
      data.setProfile(profileData.data);
    }
  }, [profileData, data.setProfile]);
  return (
    <main className="@container/arena mx-auto w-full min-w-0 max-w-[1400px] space-y-3 p-3 sm:space-y-4 sm:p-5 xl:p-6">
      <ArenaHero {...data} />
      <ArenaModes {...data} />
      <ArenaStats {...data} />
      <div className="grid min-w-0 items-stretch gap-3 @min-[900px]/arena:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-4">
        <RecentMatches {...data} />
        <ArenaLeaderboard {...data} />
      </div>
      <ArenaFooter {...data} />
      <ArenaDialog {...data} />
    </main>
  );
}
