"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { isAxiosError } from "axios";
import {
  AlertCircle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  PageHeader,
  PageShell,
  ErrorState,
  LoadingState,
} from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/auth.service";
import { userService } from "@/services/user.service";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setUser } from "@/redux/features/auth/authSlice";
import type { UserProfile } from "@/types";

/** One name field: it is both the full name and the public display name. */
type ProfileFields = { name: string };
const values = (user: UserProfile): ProfileFields => ({
  name: user.fullName || user.username || "",
});
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const inputClass =
  "h-11 rounded-lg border-slate-200 bg-white text-base shadow-none sm:text-sm";

function AvatarCard({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: (profile: UserProfile) => void;
}) {
  const { t, i18n } = useTranslation("common");
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [broken, setBroken] = useState(false);
  const name = profile.fullName || profile.username || profile.email;
  const avatar = !broken && profile.avatarUrl ? profile.avatarUrl : null;
  const joined = profile.createdAt
    ? new Intl.DateTimeFormat(i18n.language === "en" ? "en-US" : "vi-VN", {
        dateStyle: "medium",
      }).format(new Date(profile.createdAt))
    : null;

  const upload = async (file: File) => {
    setMessage(null);
    if (!AVATAR_TYPES.includes(file.type)) {
      setMessage({ tone: "error", text: t("profilePage.avatarTypeError") });
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setMessage({ tone: "error", text: t("profilePage.avatarSizeError") });
      return;
    }
    setBusy("upload");
    try {
      const response = await userService.uploadAvatar(file);
      setBroken(false);
      onSaved(response.data.profile);
      setMessage({ tone: "success", text: t("profilePage.avatarSaved") });
    } catch (cause) {
      const status = isAxiosError(cause) ? cause.response?.status : undefined;
      setMessage({
        tone: "error",
        text: t(
          status === 413
            ? "profilePage.avatarSizeError"
            : status === 400
              ? "profilePage.avatarTypeError"
              : "profilePage.avatarError",
        ),
      });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setMessage(null);
    setBusy("remove");
    try {
      const response = await userService.updateProfile({ avatarUrl: "" });
      onSaved(response.data.profile);
      setMessage({ tone: "success", text: t("profilePage.avatarRemoved") });
    } catch {
      setMessage({ tone: "error", text: t("profilePage.avatarError") });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-labelledby="avatar-title"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <h2 id="avatar-title" className="sr-only">
        {t("profilePage.avatarTitle")}
      </h2>
      <div className="flex items-center gap-4 lg:flex-col lg:text-center">
        <div className="relative shrink-0">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => fileInput.current?.click()}
            aria-label={t("profilePage.changeAvatar")}
            className="group relative block size-20 overflow-hidden rounded-full bg-blue-50 outline-none ring-4 ring-white shadow-[0_0_0_1px_rgb(226_232_240)] focus-visible:ring-blue-500 disabled:cursor-wait lg:size-28"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="size-full object-cover"
                onError={() => setBroken(true)}
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-full items-center justify-center text-2xl font-semibold text-blue-700 lg:text-4xl"
              >
                {name[0]?.toUpperCase()}
              </span>
            )}
            <span
              aria-hidden="true"
              className={`absolute inset-0 flex items-center justify-center bg-slate-900/45 text-white transition-opacity ${busy === "upload" ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}
            >
              {busy === "upload" ? (
                <Loader2 className="size-6 motion-safe:animate-spin" />
              ) : (
                <Camera className="size-6" />
              )}
            </span>
          </button>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0.5 right-0.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white lg:bottom-1.5 lg:right-1.5"
          >
            <Camera className="size-3.5" />
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900 [overflow-wrap:anywhere]">
            {profile.fullName || profile.username}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{t("student")}</p>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={AVATAR_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <div className="mt-5 flex flex-wrap gap-2 lg:justify-center">
        <Button
          type="button"
          variant="outline"
          className="min-h-10 flex-1 lg:flex-none"
          disabled={!!busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy === "upload" ? (
            <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
          ) : (
            <Camera aria-hidden="true" className="size-4" />
          )}
          {t(profile.avatarUrl ? "profilePage.changeAvatar" : "profilePage.uploadAvatar")}
        </Button>
        {profile.avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-10 text-slate-600 hover:bg-red-50 hover:text-red-700"
            disabled={!!busy}
            onClick={() => void remove()}
          >
            {busy === "remove" ? (
              <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
            {t("profilePage.removeAvatar")}
          </Button>
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500 lg:text-center">
        {t("profilePage.avatarHelp")}
      </p>
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mt-3 flex items-start gap-2 rounded-lg p-2.5 text-xs leading-5 ${message.tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}
        >
          {message.tone === "error" ? (
            <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          )}
          {message.text}
        </p>
      )}

      <dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
        <div className="flex items-start gap-2">
          <dt className="sr-only">{t("account.email")}</dt>
          <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <dd className="[overflow-wrap:anywhere]">{profile.email}</dd>
        </div>
        {joined && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">{t("profilePage.joined")}</dt>
            <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <dd>{t("profilePage.joinedOn", { date: joined })}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: (profile: UserProfile) => void;
}) {
  const { t } = useTranslation("common");
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFields>({ defaultValues: values(profile) });
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
  const submit = handleSubmit(async (input) => {
    setSaved(false);
    try {
      const response = await userService.updateProfile({
        fullName: input.name.trim(),
        username: input.name.trim(),
      });
      const updated = response.data.profile;
      onSaved(updated);
      reset(values(updated));
      setSaved(true);
    } catch {
      setError("root", { message: t("profilePage.saveError") });
    }
  });
  return (
    <form
      onSubmit={submit}
      noValidate
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
    >
      <div className="flex items-start gap-3 border-b border-slate-100 p-5 sm:p-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <UserRound aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {t("profilePage.basicTitle")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {t("profilePage.basicHelp")}
          </p>
        </div>
      </div>
      <fieldset
        disabled={isSubmitting}
        className="min-w-0 space-y-5 p-5 sm:p-6"
      >
        <legend className="sr-only">{t("profilePage.basicTitle")}</legend>
        {saved && !isDirty && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800"
          >
            <CheckCircle2 aria-hidden="true" className="mt-1 size-4 shrink-0" />
            {t("profilePage.saved")}
          </p>
        )}
        {errors.root && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700"
          >
            <AlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0" />
            {errors.root.message}
          </p>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="profile-name"
              className="block text-sm font-medium text-slate-700"
            >
              {t("profilePage.fullName")}{" "}
              <span aria-hidden="true" className="text-red-600">
                *
              </span>
            </label>
            <Input
              id="profile-name"
              autoComplete="name"
              maxLength={50}
              required
              className={inputClass}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : "name-help"}
              {...register("name", {
                validate: (value) =>
                  (value.trim().length >= 2 && value.trim().length <= 50) ||
                  t("profilePage.nameError"),
              })}
            />
            <p id="name-help" className="text-xs leading-5 text-slate-500">
              {t("profilePage.nameHelp")}
            </p>
            {errors.name && (
              <p id="name-error" role="alert" className="text-xs text-red-700">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label
              htmlFor="profile-email"
              className="block text-sm font-medium text-slate-700"
            >
              {t("account.email")}
            </label>
            <Input
              id="profile-email"
              type="email"
              value={profile.email}
              readOnly
              aria-describedby="email-help"
              className={`${inputClass} bg-slate-50 text-slate-500`}
            />
            <p id="email-help" className="text-xs leading-5 text-slate-500">
              {t("profilePage.emailHelp")}
            </p>
          </div>
        </div>
      </fieldset>
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p aria-live="polite" className="text-xs text-slate-500">
          {t(isDirty ? "profilePage.unsaved" : "profilePage.upToDate")}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={!isDirty || isSubmitting}
            onClick={() => {
              reset();
              setSaved(false);
            }}
          >
            {t("profilePage.reset")}
          </Button>
          <Button
            type="submit"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={!isDirty || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2
                aria-hidden="true"
                className="size-4 motion-safe:animate-spin"
              />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            {t(isSubmitting ? "account.saving" : "profilePage.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function AccountPage() {
  const { t } = useTranslation("common");
  const { locale } = useParams();
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["user-profile", user?._id],
    queryFn: async () => (await authService.getProfile()).data as UserProfile,
    enabled: !!user?._id,
    staleTime: 30000,
  });
  const profile = query.data;
  const save = (updated: UserProfile) => {
    dispatch(setUser(updated));
    cache.setQueryData(["user-profile", updated._id], updated);
  };
  return (
    <PageShell>
      <PageHeader
        title={t("account.profile")}
        description={t("profilePage.description")}
        back={{ href: `/${locale}`, label: t("profilePage.back") }}
      />
      {query.isLoading ? (
        <LoadingState label={t("loading")} />
      ) : query.isError || !profile ? (
        <ErrorState
          message={t("profilePage.loadError")}
          retryLabel={t("profilePage.retry")}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
          <aside className="min-w-0 space-y-4">
            <AvatarCard profile={profile} onSaved={save} />
            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-blue-600"
              />
              <p className="text-xs leading-6 text-slate-600">
                {t("profilePage.privacy")}
              </p>
            </div>
          </aside>
          <ProfileForm key={profile._id} profile={profile} onSaved={save} />
        </div>
      )}
    </PageShell>
  );
}
