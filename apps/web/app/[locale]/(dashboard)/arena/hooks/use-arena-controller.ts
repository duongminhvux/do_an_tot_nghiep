"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  demoQuestions,
  friends,
  leaderboard,
  type ArenaMatch,
} from "../arena-data";
import { arenaSocket } from "@/lib/arena-socket";

type Panel = "rank" | "friends" | "room" | "match" | "game" | null;
type Period = "week" | "month" | "all";

export function useArenaController() {
  const { locale } = useParams();

  const en = locale === "en";

  const text = (vi: string, english: string) => (en ? english : vi);

  const number = (value: number) => value.toLocaleString("en-US");

  const [panel, setPanel] = useState<Panel>(null);

  const [period, setPeriod] = useState<Period>("week");

  const [showAll, setShowAll] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<ArenaMatch | null>(null);

  const [search, setSearch] = useState("");

  const [opponent, setOpponent] = useState("Lê Hoàng Minh");

  const [found, setFound] = useState(false);

  const [invited, setInvited] = useState(false);

  const [roomName, setRoomName] = useState("");

  const [capacity, setCapacity] = useState("4");

  const [roomCode, setRoomCode] = useState("");

  const [copied, setCopied] = useState(false);

  const [question, setQuestion] = useState(0);

  const [answer, setAnswer] = useState<number | null>(null);

  const [score, setScore] = useState(0);

  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (panel !== "rank") return;
    const timer = setTimeout(() => setFound(true), 12000);
    return () => clearTimeout(timer);
  }, [panel]);

  const rankings = useMemo(
    () => [...leaderboard].sort((a, b) => b[period] - a[period]),
    [period],
  );

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  const modeLabel = (mode: string) =>
    mode === "rank"
      ? text("Xếp hạng", "Ranked")
      : mode === "friend"
        ? text("Đấu với bạn bè", "Friend match")
        : text("Phòng đấu", "Battle room");

  const timeLabel = (minutes: number) =>
    minutes < 60
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

  const handleFindMatch = () => {
    arenaSocket.emit(
      'ranked:join-queue',
      {},
      (response: unknown) => {
        console.log('join queue:', response);
      },
    );
  };

  function openPanel(next: Panel) {
    setFound(false);
    setInvited(false);
    setSearch("");
    setRoomCode("");
    setCopied(false);
    if(next === "rank") handleFindMatch();
    setPanel(next);
  }

  function startGame() {
    setQuestion(0);
    setAnswer(null);
    setScore(0);
    setFinished(false);
    setPanel("game");
  }

  function chooseAnswer(index: number) {
    if (answer !== null) return;
    setAnswer(index);
    if (index === demoQuestions[question]!.answer)
      setScore((value) => value + 1);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const button =
    "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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
    openPanel,
    button,
    number,
    setPanel,
    showAll,
    setShowAll,
    setSelectedMatch,
    modeLabel,
    timeLabel,
    period,
    setPeriod,
    rankings,
    panel,
    setOpponent,
    found,
    startGame,
    search,
    setSearch,
    opponent,
    invited,
    setInvited,
    filteredFriends,
    roomName,
    setRoomName,
    capacity,
    setCapacity,
    roomCode,
    setRoomCode,
    copied,
    copyCode,
    selectedMatch,
    question,
    setQuestion,
    answer,
    setAnswer,
    score,
    finished,
    setFinished,
    chooseAnswer,
    dialogTitle,
  };
}

export type ArenaController = ReturnType<typeof useArenaController>;
