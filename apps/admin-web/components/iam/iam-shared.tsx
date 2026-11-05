"use client";
import { useLayoutEffect, useRef } from "react";
import { useAppSelector } from "@/redux/hooks";
import { canManageIam } from "@/lib/admin-permissions";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { KeyRound, Loader2, ShieldCheck, UserCog } from "lucide-react";
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
  "rounded-xl border border-slate-200 bg-white shadow-2xs";
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
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-lg border p-4 text-sm ${error ? "border-destructive/30 bg-destructive/5 text-red-700" : "border-border bg-muted text-foreground"}`}
    >
      {children}
    </div>
  );
}
export function StatusBadge({ status }: { status: AdminStatus }) {
  const { t } = useTranslation("iam");
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : status === "PENDING_ACTIVATION" ? "bg-amber-50 text-amber-900" : status === "SUSPENDED" ? "bg-orange-50 text-orange-900" : "bg-slate-100 text-slate-700"}`}
    >
      {t("statuses." + status)}
    </span>
  );
}
export function DeliveryNotice({ delivery }: { delivery: Delivery }) {
  const { t, i18n } = useTranslation("iam");
  return (
    <Notice>
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
        <p className="mt-1 text-muted-foreground">{t("queuedHelp")}</p>
      )}
      <p className="mt-1 text-xs">
        {t("expires", {
          date: new Date(delivery.expiresAt).toLocaleString(i18n.language),
        })}
      </p>
    </Notice>
  );
}
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
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
          <Button disabled={busy} onClick={onConfirm}>
            {busy && <Loader2 className="motion-safe:animate-spin" />}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
