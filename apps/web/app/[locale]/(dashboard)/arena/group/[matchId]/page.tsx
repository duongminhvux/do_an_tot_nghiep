"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";

export default function GroupMatchPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "vi";
  const matchId = (params?.matchId as string) || "";

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f5f9ff] px-4 py-8 flex flex-col items-center justify-center text-slate-900">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-xs">
          <Swords className="size-8 animate-pulse" />
        </div>

        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          {locale === "vi" ? "Đang khởi tạo trận đấu" : "Initializing Match"}
        </h1>
        <p className="mt-2 text-xs text-blue-600 font-mono font-bold tracking-widest">
          {locale === "vi" ? "Mã phòng" : "Room Code"}: {matchId}
        </p>

        <p className="mt-4 text-sm text-slate-500 leading-relaxed">
          {locale === "vi"
            ? "Phòng đấu nhóm đang chuẩn bị bộ câu hỏi và đồng bộ lượt chơi giữa các thành viên..."
            : "Preparing questions and synchronizing players for the group match..."}
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={() => router.push(`/${locale}/arena/group`)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-95"
          >
            <ArrowLeft className="size-4" />
            <span>{locale === "vi" ? "Trở về phòng chờ" : "Back to Lobby"}</span>
          </button>
        </div>
      </div>
    </main>
  );
}
