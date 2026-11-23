"use client";
import { useLayoutEffect, useRef } from "react";
import { useAppSelector } from "@/redux/hooks";
import { canManageIam } from "@/lib/admin-permissions";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  KeyRound,
  Loader2,
  MailCheck,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Delivery, AdminStatus } from "@/services/iam.service";

export const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
export const panelClass =
  "rounded-xl border border-slate-200 bg-white shadow-xs";
export const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";
export function IamFrame({
  kind,
  children,
  action,
}: {
  kind: "admins" | "roles";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { t } = useTranslation("iam"),
    { locale } = useParams();
  const user = useAppSelector((state) => state.auth.user);
  const tabs = (["admins", "roles"] as const).filter((key) =>
    key === "admins"
      ? canManageIam(user, "admins.read", "roles.read")
      : canManageIam(user, "roles.read"),
  );
  return (
    <section
      data-testid="iam-page"
      className="w-full space-y-6 px-4 py-8 sm:px-6 lg:px-8"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {t("group")}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t(kind)}
          </h1>
          <p className="max-w-2xl text-sm text-slate-500">
            {t(kind + "Help")}
          </p>
        </div>
        {action && <div className="flex shrink-0 gap-2">{action}</div>}
      </header>
      {tabs.length > 1 && (
        <nav
          aria-label={t("group")}
          className="flex gap-1 border-b border-slate-200 text-sm font-medium"
        >
          {tabs.map((key) => {
            const Icon = key === "admins" ? UserCog : KeyRound;
            return (
              <Link
                key={key}
                href={`/${locale}/iam/${key}`}
                aria-current={kind === key ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center gap-2 rounded-t-md border-b-2 px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${kind === key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(key)}
              </Link>
            );
          })}
        </nav>
      )}
      {children}
    </section>
  );
}
export function Loading() {
  const { t } = useTranslation("iam");
  return (
    <div
      className="flex min-h-48 items-center justify-center gap-3"
      role="status"
    >
      <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden="true" />
      {t("loading")}
    </div>
  );
}
export function Notice({
  children,
  error = false,
  tone,
}: {
  children: React.ReactNode;
  error?: boolean;
  tone?: "info" | "success" | "error";
}) {
  const kind = tone ?? (error ? "error" : "info");
  const Icon =
    kind === "error" ? AlertCircle : kind === "success" ? CheckCircle2 : Info;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${
        kind === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : kind === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-blue-200 bg-blue-50/70 text-slate-800"
      }`}
    >
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${kind === "info" ? "text-blue-600" : ""}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
const statusStyles: Record<AdminStatus, { badge: string; dot: string }> = {
  ACTIVE: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  PENDING_ACTIVATION: {
    badge: "bg-amber-50 text-amber-800 ring-amber-600/20",
    dot: "bg-amber-500",
  },
  SUSPENDED: {
    badge: "bg-orange-50 text-orange-800 ring-orange-600/20",
    dot: "bg-orange-500",
  },
  DISABLED: {
    badge: "bg-slate-100 text-slate-600 ring-slate-500/20",
    dot: "bg-slate-400",
  },
};
export function StatusBadge({ status }: { status: AdminStatus }) {
  const { t } = useTranslation("iam");
  const style = statusStyles[status] ?? statusStyles.DISABLED;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.badge}`}
    >
      <span
        className={`size-1.5 rounded-full ${style.dot}`}
        aria-hidden="true"
      />
      {t("statuses." + status)}
    </span>
  );
}
const avatarPalette = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-800",
];
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : "";
  return (first + last).toUpperCase();
}
/** Deterministic initials avatar; uses the uploaded image when one exists. */
export function AdminAvatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "md" | "lg";
}) {
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const box = size === "lg" ? "size-14 text-lg" : "size-9 text-xs";
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${box} shrink-0 rounded-full object-cover ring-1 ring-slate-200`}
      />
    );
  return (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-full font-semibold ${avatarPalette[hash % avatarPalette.length]}`}
    >
      {initials(name)}
    </span>
  );
}
export function DeliveryNotice({ delivery }: { delivery: Delivery }) {
  const { t, i18n } = useTranslation("iam");
  const ok = delivery.delivery !== "NOT_SCHEDULED";
  return (
    <div
      role="status"
      className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${ok ? "border-blue-200 bg-blue-50/70 text-slate-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}
    >
      {ok ? (
        <MailCheck
          className="mt-0.5 size-4 shrink-0 text-blue-600"
          aria-hidden="true"
        />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {t(
            delivery.delivery === "SENT"
              ? "sent"
              : delivery.delivery === "QUEUED"
                ? "queued"
                : "notScheduled",
          )}
        </p>
        {delivery.delivery === "QUEUED" && (
          <p className="mt-0.5 text-slate-600">{t("queuedHelp")}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          {t("expires", {
            date: new Date(delivery.expiresAt).toLocaleString(i18n.language),
          })}
        </p>
      </div>
    </div>
  );
}
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  destructive = false,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy: boolean;
}) {
  const { t } = useTranslation("iam");
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement;
  }, [open]);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (opener.current?.isConnected) opener.current.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title || t("confirmTitle")}</DialogTitle>
          <DialogDescription>
            {description || t("confirmHelp")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy && <Loader2 className="motion-safe:animate-spin" />}
            {confirmLabel || t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
