"use client";

import { cn } from "@/lib/utils";

const avatarColors: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700",
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-800",
  violet: "bg-violet-100 text-violet-700",
  teal: "bg-teal-100 text-teal-700",
};

export function Avatar({
  initials,
  color,
  className,
}: {
  initials: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-white",
        avatarColors[color],
        className,
      )}
    >
      {initials}
    </span>
  );
}
