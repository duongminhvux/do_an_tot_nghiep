"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { isAxiosError } from "axios";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
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
import { AccountDropdown } from "@/components/account-dropdown";
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
        typeof code === "string" && !code.startsWith("auth.")
          ? code
          : t("account.changeError"),
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
                            value.length >= 6 || t("account.passwordRules"),
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

export function UserHeaderActions() {
  const { t } = useTranslation("common");
  const { locale } = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [dialog, setDialog] = useState<"password" | "success" | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const exit = () => {
    dispatch(logout());
    router.replace(`/${locale || "vi"}/welcome`);
  };
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
    } finally {
      exit();
    }
  };
  const name =
    user?.fullName ||
    user?.username ||
    user?.email?.split("@")[0] ||
    t("student");
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <LanguageSwitcher />
      <AccountDropdown
        name={name}
        email={user?.email}
        avatarUrl={user?.avatarUrl}
        subtitle={user?.email || t("student")}
        label={t("account.openMenu", { name })}
        busy={loggingOut}
      >
        <button
          type="button"
          role="menuitem"
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium outline-none hover:bg-slate-100 focus-visible:bg-slate-100"
          onClick={() => router.push(`/${locale || "vi"}/account`)}
        >
          <UserRound
            aria-hidden="true"
            className="size-4 shrink-0 text-slate-500"
          />
          {t("account.profile")}
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium outline-none hover:bg-slate-100 focus-visible:bg-slate-100"
          onClick={() => setDialog("password")}
        >
          <KeyRound
            aria-hidden="true"
            className="size-4 shrink-0 text-slate-500"
          />
          {t("account.changePassword")}
        </button>
        <div role="separator" className="my-1 h-px bg-slate-100" />
        <button
          type="button"
          role="menuitem"
          disabled={loggingOut}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium text-red-700 outline-none hover:bg-red-50 focus-visible:bg-red-50 disabled:opacity-50"
          onClick={() => {
            void handleLogout().catch(() => undefined);
          }}
        >
          <LogOut aria-hidden="true" className="size-4 shrink-0" />
          {t("logout")}
        </button>
      </AccountDropdown>
      <Dialog
        open={dialog === "success"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="rounded-2xl border-slate-200 p-5 sm:max-w-md sm:p-6">
          <DialogHeader className="pr-6 text-left">
            <DialogTitle>{t("account.passwordChangedTitle")}</DialogTitle>
            <DialogDescription>
              {t("account.passwordChanged")}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setDialog(null)}>{t("account.close")}</Button>
        </DialogContent>
      </Dialog>
      {dialog === "password" && (
        <ChangePasswordDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onChanged={() => setDialog("success")}
        />
      )}
    </div>
  );
}
