"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { isAxiosError } from "axios";
import {
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import LanguageSwitcher from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { logout } from "@/redux/features/auth/authSlice";
import { authService } from "@/services/auth.service";

type PasswordFields = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};
function ChangePasswordDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation("common");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFields>({
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  });
  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      await authService.changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      onChanged();
    } catch (cause) {
      const code = isAxiosError(cause)
        ? cause.response?.data?.message
        : undefined;
      setError(
        t(
          code === "ADMIN_PASSWORD_INCORRECT"
            ? "account.incorrectPassword"
            : code === "ADMIN_PASSWORD_UNCHANGED"
              ? "account.samePassword"
              : "account.changeError",
        ),
      );
    }
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
    >
      <DialogContent
        className="rounded-2xl border-slate-200 p-5 sm:max-w-md sm:p-6"
        onEscapeKeyDown={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
      >
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>{t("account.changePassword")}</DialogTitle>
          <DialogDescription>{t("account.passwordHelp")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {(["oldPassword", "newPassword", "confirmPassword"] as const).map(
            (field) => (
              <div key={field} className="space-y-1.5">
                <label
                  htmlFor={`admin-${field}`}
                  className="text-sm font-medium text-slate-700"
                >
                  {t(`account.${field}`)}
                </label>
                <Input
                  id={`admin-${field}`}
                  type={visible ? "text" : "password"}
                  autoComplete={
                    field === "oldPassword"
                      ? "current-password"
                      : "new-password"
                  }
                  disabled={isSubmitting}
                  aria-invalid={!!errors[field]}
                  aria-describedby={
                    errors[field]
                      ? `${field}-error`
                      : field === "newPassword"
                        ? "password-rules"
                        : undefined
                  }
                  {...register(field, {
                    required: t("account.required"),
                    ...(field === "newPassword"
                      ? {
                          validate: (value) =>
                            (value.length >= 12 &&
                              new TextEncoder().encode(value).length <= 72 &&
                              value.trim() === value &&
                              /[a-z]/.test(value) &&
                              /[A-Z]/.test(value) &&
                              /[0-9]/.test(value)) ||
                            t("account.passwordRules"),
                        }
                      : field === "confirmPassword"
                        ? {
                            validate: (value) =>
                              value === getValues("newPassword") ||
                              t("account.mismatch"),
                          }
                        : {}),
                  })}
                />
                {field === "newPassword" && (
                  <p
                    id="password-rules"
                    className="text-xs leading-5 text-slate-500"
                  >
                    {t("account.passwordRules")}
                  </p>
                )}
                {errors[field] && (
                  <p
                    id={`${field}-error`}
                    role="alert"
                    className="text-xs text-red-700"
                  >
                    {errors[field]?.message}
                  </p>
                )}
              </div>
            ),
          )}
          <button
            type="button"
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-medium text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
            {t(visible ? "account.hidePassword" : "account.showPassword")}
          </button>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              {t("account.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2
                  aria-hidden="true"
                  className="mr-2 size-4 motion-safe:animate-spin"
                />
              )}
              {t(isSubmitting ? "account.saving" : "account.changePassword")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminHeaderActions() {
  const { t } = useTranslation("common");
  const { locale } = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [dialog, setDialog] = useState<"profile" | "password" | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const exit = (passwordChanged = false) => {
    if (passwordChanged) sessionStorage.setItem("adminPasswordChanged", "1");
    dispatch(logout());
    router.replace(
      `/${locale || "vi"}/login${passwordChanged ? "?passwordChanged=1" : ""}`,
    );
  };
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
    } finally {
      exit();
    }
  };
  const name = user?.username || t("admin");
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <LanguageSwitcher />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={loggingOut}
            aria-label={t("account.openMenu", { name })}
            className="group flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-1.5 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 data-[state=open]:bg-slate-50 sm:pl-2 sm:pr-3"
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-200"
            >
              {loggingOut ? (
                <Loader2 className="size-4 motion-safe:animate-spin" />
              ) : (
                name[0]?.toUpperCase()
              )}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-36 truncate text-[13px] font-semibold leading-5 text-slate-800">
                {name}
              </span>
              <span className="block max-w-36 truncate text-[11px] leading-4 text-slate-500">
                {user?.email || t("admin")}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="hidden size-3.5 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none sm:block"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-64 rounded-2xl border-slate-200 p-1.5 shadow-lg"
        >
          <DropdownMenuLabel className="mb-1 rounded-xl bg-slate-50 px-3 py-3">
            <p className="break-words text-sm font-semibold text-slate-900">
              {name}
            </p>
            <p className="mt-1 break-all text-xs font-normal text-slate-500">
              {user?.email}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-11 cursor-pointer gap-3 rounded-lg px-3 text-[13px] font-medium"
            onSelect={() => setDialog("profile")}
          >
            <UserRound aria-hidden="true" className="size-4 text-slate-500" />
            {t("account.profile")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11 cursor-pointer gap-3 rounded-lg px-3 text-[13px] font-medium"
            onSelect={() => setDialog("password")}
          >
            <KeyRound aria-hidden="true" className="size-4 text-slate-500" />
            {t("account.changePassword")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-11 cursor-pointer gap-3 rounded-lg px-3 text-[13px] font-medium text-red-700 focus:bg-red-50 focus:text-red-800"
            disabled={loggingOut}
            onSelect={() => {
              void handleLogout().catch(() => undefined);
            }}
          >
            <LogOut aria-hidden="true" className="size-4" />
            {t("logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={dialog === "profile"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="rounded-2xl border-slate-200 p-5 sm:max-w-md sm:p-6">
          <DialogHeader className="pr-6 text-left">
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck
                aria-hidden="true"
                className="size-5 text-blue-600"
              />
              {t("account.profile")}
            </DialogTitle>
            <DialogDescription>{t("account.profileHelp")}</DialogDescription>
          </DialogHeader>
          <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4 text-sm">
            {[
              [t("account.username"), user?.username],
              [t("account.email"), user?.email],
              [t("account.roles"), user?.roleCodes?.join(", ") || t("admin")],
            ].map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-3 py-3.5"
              >
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="font-medium text-slate-800 [overflow-wrap:anywhere]">
                  {value || "—"}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDialog(null)}>
              {t("account.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {dialog === "password" && (
        <ChangePasswordDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onChanged={() => exit(true)}
        />
      )}
    </div>
  );
}
