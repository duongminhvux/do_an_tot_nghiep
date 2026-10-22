"use client";
import Image from "next/image";
import { UserRound } from "lucide-react";
export function FriendlyAvatar({
  avatar,
  name,
}: {
  avatar?: string;
  name: string;
}) {
  return avatar ? (
    <Image
      src={avatar}
      alt={name}
      width={80}
      height={80}
      unoptimized
      className="size-full rounded-full object-cover"
    />
  ) : (
    <span className="flex size-full items-center justify-center rounded-full bg-blue-50 text-blue-600">
      <UserRound className="size-[60%]" />
    </span>
  );
}
