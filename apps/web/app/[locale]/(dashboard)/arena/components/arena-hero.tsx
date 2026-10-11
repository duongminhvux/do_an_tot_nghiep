"use client";

import Image from "next/image";

import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<ArenaController, "text">;

export function ArenaHero({ text }: Props) {
  return (
    <section className="relative isolate min-h-[180px] overflow-hidden rounded bg-gradient-to-r from-[#eef5ff] to-[#dce9ff] px-6 py-7 sm:px-7 lg:min-h-[192px]">
      <div className="relative z-10 max-w-[480px] md:w-[54%]">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-blue-500">
          {text(
            "Học hết mình · Chơi hết sức",
            "Learn together · Play together",
          )}
        </div>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-4xl">
          Vocabulary <span className="text-blue-600">Arena</span>
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-800">
          {text(
            "Thách đấu – Học nhanh – Tiến bộ hơn mỗi ngày!",
            "Challenge yourself. Learn faster. Improve every day!",
          )}
        </p>
        <p className="mt-2 max-w-[430px] text-xs leading-5 text-slate-500">
          {text(
            "So tài vốn từ vựng với người chơi khác, rèn phản xạ và ghi nhớ từ vựng qua những trận đấu thú vị.",
            "Put your vocabulary to the test, sharpen your reflexes, and learn new words through friendly competition.",
          )}
        </p>
      </div>
      <div className="absolute inset-y-0 right-0 hidden w-[46%] md:block">
        <Image
          src="/images/arena/arena-hero.png"
          alt={text(
            "Hai người chơi thách đấu từ vựng",
            "Two students competing in a vocabulary challenge",
          )}
          fill
          priority
          sizes="(min-width: 1024px) 520px, 45vw"
          className="object-cover object-top mix-blend-multiply"
        />
        <div className="absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#e6efff] to-transparent" />
      </div>
    </section>
  );
}
