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
  image,
}: {
  initials: string;
  color: string;
  className?: string;
  image?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold ring-2 ring-white",
        avatarColors[color],
        className,
      )}
    >
      {initials}
      {image && (
        <img
          src={image}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
    </span>
  );
}
