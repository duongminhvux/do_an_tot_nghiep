"use client";

import { useEffect, useMemo, useState } from "react";

import { useParams, useRouter } from "next/navigation";

import { demoQuestions, friends, type ArenaMatch } from "../arena-data";

import { arenaSocket } from "@/lib/arena-socket";

import {
  arenaService,
  type ArenaProfile,
  type ArenaRankingEntry,
} from "@/services/arena.service";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/redux/hooks";

type Panel = "rank" | "friends" | "room" | "match" | "game" | null;

type Period = "week" | "month" | "all";

export type RankedPlayer = {
  userId: string;
  rating: number;

  username?: string;
  avatar?: string;
};

export type RankedMatchFoundPayload = {
  matchId: string;
  opponent: RankedPlayer;
};

export type RankedStatus = "IDLE" | "SEARCHING" | "FOUND";

export function useArenaController() {
  const params = useParams();
  const router = useRouter();

  const locale = typeof params.locale === "string" ? params.locale : "vi";

  const en = locale === "en";

  const text = (vi: string, english: string) => {
    return en ? english : vi;
  };

  const number = (value: number) => {
    return value.toLocaleString("en-US");
  };

  /*
   * Arena profile
   */
  const [profile, setProfile] = useState<ArenaProfile | null>(null);

  /*
   * Common UI
   */
  const [panel, setPanel] = useState<Panel>(null);

  const [period, setPeriod] = useState<Period>("week");
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id ? String(currentUser._id) : "";
  const matchesQuery = useQuery({
    queryKey: ["arena-matches", currentUserId],
    queryFn: () => arenaService.getRecentMatches(),
    enabled: !!currentUserId,
  });
  const rankingsQuery = useQuery({
    queryKey: ["arena-leaderboard", currentUserId, period],
    queryFn: () => arenaService.getLeaderboard(period),
    enabled: !!currentUserId,
  });
  const decoratePlayer = (player: ArenaRankingEntry) => ({
    ...player,
    initials:
      player.name
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "?",
    color: "blue",
  });
  const recentMatches = useMemo<ArenaMatch[]>(
    () =>
      (matchesQuery.data?.data ?? []).map((match) => ({
        ...match,
        initials:
          match.name
            .trim()
            .split(/\s+/)
            .slice(-2)
            .map((part) => part[0])
            .join("")
            .toUpperCase() || "?",
        color: "blue",
        won: match.result === "WIN",
        draw: match.result === "DRAW",
        minutes: Math.max(
          0,
          Math.floor((Date.now() - Date.parse(match.finishedAt)) / 60000),
        ),
      })),
    [matchesQuery.data],
  );

  const [showAll, setShowAll] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<ArenaMatch | null>(null);

  /*
   * Ranked matchmaking
   */
  const [rankedStatus, setRankedStatus] = useState<RankedStatus>("IDLE");

  const [rankedMatch, setRankedMatch] =
    useState<RankedMatchFoundPayload | null>(null);

  const [matchCountdown, setMatchCountdown] = useState(5);

  /*
   * Old states / friend / room
   */
  const [search, setSearch] = useState("");

  const [opponent, setOpponent] = useState("");

  const [invited, setInvited] = useState(false);

  const [roomName, setRoomName] = useState("");

  const [capacity, setCapacity] = useState("4");

  const [roomCode, setRoomCode] = useState("");

  const [copied, setCopied] = useState(false);

  /*
   * Demo game state
   */
  const [question, setQuestion] = useState(0);

  const [answer, setAnswer] = useState<number | null>(null);

  const [score, setScore] = useState(0);

  const [finished, setFinished] = useState(false);

  /*
   * ============================================
   * LISTEN RANKED MATCH FOUND
   * ============================================
   */
  useEffect(() => {
    const handleMatchFound = (data: RankedMatchFoundPayload) => {
      try {
        sessionStorage.setItem("arena-ranked-match", JSON.stringify(data));
      } catch {
        // Match navigation still works when browser storage is unavailable.
      }
      console.log("[Arena] ranked:match-found", data);

      setRankedMatch(data);

      setRankedStatus("FOUND");

      setMatchCountdown(5);
    };

    arenaSocket.on("ranked:match-found", handleMatchFound);

    return () => {
      arenaSocket.off("ranked:match-found", handleMatchFound);
    };
  }, []);

  /*
   * ============================================
   * COUNTDOWN AFTER MATCH FOUND
   * ============================================
   */
  useEffect(() => {
    if (rankedStatus !== "FOUND") {
      return;
    }

    setMatchCountdown(5);

    const interval = window.setInterval(() => {
      setMatchCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(interval);

          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [rankedStatus]);

  /*
   * ============================================
   * REDIRECT AFTER 5 SECONDS
   * ============================================
   */
  useEffect(() => {
    if (rankedStatus !== "FOUND" || !rankedMatch) {
      return;
    }

    const timer = window.setTimeout(() => {
      router.push(`/${locale}/arena/rank/${rankedMatch.matchId}`);
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [rankedStatus, rankedMatch, router, locale]);

  /*
   * Tìm opponent trong match
   */
  const rankedOpponent = useMemo(() => {
    if (!rankedMatch) {
      return null;
    }

    /*
     * Nên dùng userId từ auth hiện tại.
     *
     * Nếu ArenaProfile của bạn có userId
     * thì đoạn này dùng được.
     */
    const myUserId = profile?.userId;

    if (!myUserId) {
      return null;
    }

    return rankedMatch.opponent.userId === myUserId
      ? null
      : rankedMatch.opponent;
  }, [rankedMatch, profile]);

  /*
   * ============================================
   * JOIN RANKED QUEUE
   * ============================================
   */
  function handleFindMatch() {
    if (!arenaSocket.connected) {
      console.error("[Arena] socket chưa kết nối");

      return;
    }

    setRankedMatch(null);

    setRankedStatus("SEARCHING");

    setMatchCountdown(5);

    arenaSocket.emit(
      "ranked:join-queue",
      {},
      (response: {
        matched?: boolean;
        status?: string;
        matchId?: string;
        error?: string;
      }) => {
        console.log("[Arena] join queue ack:", response);

        /*
         * FE đã set SEARCHING trước rồi.
         * ACK chủ yếu để debug / xử lý lỗi.
         */
        if (response?.error) {
          console.error("[Arena] join queue error:", response.error);

          setRankedStatus("IDLE");
        }
      },
    );
  }

  /*
   * ============================================
   * CANCEL RANKED QUEUE
   * ============================================
   */
  function cancelRankedQueue() {
    /*
     * Nếu match đã FOUND thì không còn trong queue.
     * Không cho cancel matchmaking nữa.
     */
    if (rankedStatus === "FOUND") {
      return;
    }

    arenaSocket.emit(
      "ranked:leave-queue",
      {},
      (response: { success?: boolean }) => {
        console.log("[Arena] leave queue:", response);
      },
    );

    setRankedStatus("IDLE");

    setRankedMatch(null);

    setMatchCountdown(5);

    setPanel(null);
  }

  /*
   * ============================================
   * OPEN PANEL
   * ============================================
   */
  function openPanel(next: Panel) {
    setInvited(false);
    setSearch("");
    setRoomCode("");
    setCopied(false);

    setPanel(next);

    if (next === "rank") {
      handleFindMatch();
    }
  }

  /*
   * ============================================
   * LEADERBOARD
   * ============================================
   */
  const rankings = (rankingsQuery.data?.data.players ?? []).map(decoratePlayer);
  const leaderboardMe = rankingsQuery.data?.data.me
    ? decoratePlayer(rankingsQuery.data.data.me)
    : null;

  /*
   * ============================================
   * FRIENDS
   * ============================================
   */
  const filteredFriends = friends.filter((friend) =>
    friend.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  /*
   * ============================================
   * LABEL HELPERS
   * ============================================
   */
  const modeLabel = (mode: string) =>
    mode === "rank"
      ? text("Xếp hạng", "Ranked")
      : mode === "friend"
        ? text("Đấu với bạn bè", "Friend match")
        : text("Phòng đấu", "Battle room");

  const timeLabel = (minutes: number) =>
    minutes === 0
      ? text("Vừa xong", "Just now")
      : minutes < 60
        ? text(`${minutes} phút trước`, `${minutes} minutes ago`)
        : minutes < 1440
          ? text(
              `${Math.floor(minutes / 60)} giờ trước`,
              `${Math.floor(minutes / 60)} hours ago`,
            )
          : text(
              `${Math.floor(minutes / 1440)} ngày trước`,
              `${Math.floor(minutes / 1440)} days ago`,
            );

  /*
   * ============================================
   * OLD DEMO GAME
   * ============================================
   */
  function startGame() {
    setQuestion(0);
    setAnswer(null);
    setScore(0);
    setFinished(false);

    setPanel("game");
  }

  function chooseAnswer(index: number) {
    if (answer !== null) {
      return;
    }

    setAnswer(index);

    if (index === demoQuestions[question]?.answer) {
      setScore((value) => value + 1);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);

      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  /*
   * ============================================
   * SHARED BUTTON CLASS
   * ============================================
   */
  const button =
    "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  /*
   * ============================================
   * DIALOG TITLE
   * ============================================
   */
  const dialogTitle =
    panel === "rank"
      ? text("Tìm đối thủ", "Find an opponent")
      : panel === "friends"
        ? text("Thách đấu bạn bè", "Challenge a friend")
        : panel === "room"
          ? text("Tạo phòng đấu", "Create a battle room")
          : panel === "match"
            ? text("Chi tiết trận đấu", "Match details")
            : text("Đấu trường từ vựng", "Vocabulary Arena");

  return {
    text,
    number,

    panel,
    setPanel,
    openPanel,

    button,

    profile,
    setProfile,

    showAll,
    setShowAll,

    selectedMatch,
    setSelectedMatch,

    modeLabel,
    timeLabel,

    period,
    setPeriod,

    rankings,
    leaderboardMe,
    currentUser,
    currentUserId,
    recentMatches,
    matchesLoading: matchesQuery.isPending,
    matchesError: matchesQuery.isError,
    retryMatches: matchesQuery.refetch,
    rankingsLoading: rankingsQuery.isPending,
    rankingsError: rankingsQuery.isError,
    retryRankings: rankingsQuery.refetch,

    /*
     * Ranked
     */
    rankedStatus,
    rankedMatch,
    rankedOpponent,
    matchCountdown,

    handleFindMatch,
    cancelRankedQueue,

    /*
     * Friends
     */
    search,
    setSearch,

    opponent,
    setOpponent,

    invited,
    setInvited,

    filteredFriends,

    /*
     * Room
     */
    roomName,
    setRoomName,

    capacity,
    setCapacity,

    roomCode,
    setRoomCode,

    copied,
    copyCode,

    /*
     * Game
     */
    question,
    setQuestion,

    answer,
    setAnswer,

    score,

    finished,
    setFinished,

    chooseAnswer,
    startGame,

    dialogTitle,
  };
}

export type ArenaController = ReturnType<typeof useArenaController>;
