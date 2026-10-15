"use client";

import { useParams } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { ClassicMatch } from "../../components/classic-match";
import { useRankedMatch } from "../../hooks/use-ranked-match";
import { useMatchExit } from "../../hooks/use-match-exit";

export default function RankedGame() {
  const params = useParams();
  const matchId = typeof params.matchId === "string" ? params.matchId : "";
  const user = useAppSelector((state) => state.auth.user);
  const game = useRankedMatch(matchId, user?._id ? String(user._id) : "");
  useMatchExit(matchId, game.matchStatus === "PLAYING" && !game.finished);
  return <ClassicMatch game={game} />;
}
