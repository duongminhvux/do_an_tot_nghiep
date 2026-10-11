"use client";

import type { DashboardData } from "../hooks/use-dashboard-data";

type Props = Pick<DashboardData, "t">;

export function DashboardQuote({ t }: Props) {
  return (
    <div className="rounded border border-amber-200/60 bg-amber-50/30 p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
      <div className="flex items-start justify-between">
        {/* Cute Reading Character SVG matching screenshot */}
        <div className="w-16 h-16 shrink-0 relative">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full drop-shadow-xs"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Hair */}
            <path
              d="M35 30C35 20 45 15 55 15C65 15 70 22 70 30C70 35 68 40 68 40L32 40C32 40 35 35 35 30Z"
              fill="#1E293B"
            />
            {/* Head */}
            <circle cx="50" cy="38" r="16" fill="#FBCFE8" />
            {/* Body / Shirt */}
            <path
              d="M32 60C32 50 40 48 50 48C60 48 68 50 68 60L72 85H28L32 60Z"
              fill="#3B82F6"
            />
            {/* Book */}
            <path
              d="M20 72C20 68 32 66 50 70C68 66 80 68 80 72L76 86C60 82 40 82 24 86L20 72Z"
              fill="#2563EB"
            />
            <path
              d="M50 70V84M26 73C34 71 42 71 50 72M50 72C58 71 66 71 74 73"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Hands */}
            <circle cx="32" cy="74" r="4" fill="#FBCFE8" />
            <circle cx="68" cy="74" r="4" fill="#FBCFE8" />
          </svg>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-base font-bold text-slate-900 leading-snug">
          {t("quote.title")}
        </h3>
        <p className="text-xs text-slate-500 italic mt-2 leading-relaxed">
          &ldquo;{t("quote.text")}&rdquo;
        </p>
      </div>
    </div>
  );
}
