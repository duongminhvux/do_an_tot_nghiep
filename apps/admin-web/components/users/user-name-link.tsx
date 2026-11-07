"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { hasPermissions } from "@/lib/admin-permissions";

/** IDs are only used for navigation; the visible label always describes the learner. */
export function UserNameLink({
  userId,
  name,
}: {
  userId?: string | null;
  name?: string | null;
}) {
  const { locale } = useParams<{ locale: string }>();
  const viewer = useAppSelector((state) => state.auth.user);
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const candidate = name?.trim();
  const label =
    candidate && candidate !== userId && !uuid.test(candidate)
      ? candidate
      : locale === "en"
        ? "Name unavailable"
        : "Người dùng chưa có tên";
  if (!userId || !uuid.test(userId) || !hasPermissions(viewer, "users.read")) {
    return (
      <span className="font-semibold text-slate-800 [overflow-wrap:anywhere]">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/${locale || "vi"}/users/${encodeURIComponent(userId)}`}
      title={
        locale === "en" ? `View details for ${label}` : `Xem chi tiết ${label}`
      }
      className="inline-flex min-h-8 items-center rounded-sm py-1 font-semibold text-blue-700 underline-offset-4 outline-none hover:text-blue-800 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 [overflow-wrap:anywhere]"
    >
      {label}
    </Link>
  );
}
