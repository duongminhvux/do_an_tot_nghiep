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
import { PageShell } from "@/components/ui/page";

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
    <PageShell className="@container/arena min-w-0 space-y-4 sm:space-y-6">
      <ArenaHero {...data} />
      <ArenaModes {...data} />
      <ArenaStats {...data} />
      <div className="grid min-w-0 items-stretch gap-4 @min-[900px]/arena:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-6">
        <RecentMatches {...data} />
        <ArenaLeaderboard {...data} />
      </div>
      <ArenaFooter {...data} />
      <ArenaDialog {...data} />
    </PageShell>
  );
}
