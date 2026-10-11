"use client";

import Link from "next/link";
import { Gamepad2, Swords } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";

export default function GamesPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "vi";
  const { t } = useTranslation("common");

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-5 xl:p-8">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Gamepad2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t("nav.game_list_title", "Danh sách trò chơi")}
          </h1>
          <p className="mt-1 text-slate-500">
            {t(
              "nav.game_list_desc",
              "Chọn một trò chơi để luyện tập từ vựng và cải thiện thứ hạng của bạn."
            )}
          </p>
        </div>
      </header>

      <Link
        href={`/${locale}/arena`}
        className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/40"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Swords className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">
            {t("nav.arena", "Đấu trường từ vựng")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("nav.arena_desc", "Thi đấu và luyện tập từ vựng cùng bạn bè.")}
          </p>
        </div>
      </Link>
    </main>
  );
}
