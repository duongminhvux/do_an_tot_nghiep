"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { logout, setUser } from "@/redux/features/auth/authSlice";
import { authService } from "@/services/auth.service";
import { canVisit, firstAllowedPath } from "@/lib/admin-permissions";
import { Button } from "@/components/ui/button";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter(),
    pathname = usePathname(),
    params = useParams();
  const locale = String(params.locale || "vi"),
    dispatch = useAppDispatch(),
    { t } = useTranslation("iam");
  const { isAuthenticated, isInitialized, user, permissionsVerified } =
    useAppSelector((state) => state.auth);
  const [error, setError] = useState(false),
    [checkedPath, setCheckedPath] = useState("");
  const verify = useCallback(async () => {
    try {
      const res = await authService.getProfile();
      dispatch(setUser(res.data));
      setError(false);
      setCheckedPath(pathname);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 403) {
        dispatch(logout());
        router.replace(`/${locale}/login`);
      } else setError(true);
    }
  }, [dispatch, locale, pathname, router]);
  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated) {
      router.replace(`/${locale}/login`);
      return;
    }
    void verify();
    const refresh = () => {
      if (document.visibilityState === "visible") void verify();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("admin-permissions-refresh", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("admin-permissions-refresh", refresh);
    };
  }, [isInitialized, isAuthenticated, locale, router, verify]);
  if (error)
    return (
      <div className="grid min-h-dvh place-content-center gap-4 p-6 text-center">
        <p role="alert">{t("sessionError")}</p>
        <Button onClick={() => void verify()}>{t("retry")}</Button>
      </div>
    );
  if (
    !isInitialized ||
    !isAuthenticated ||
    !permissionsVerified ||
    checkedPath !== pathname
  )
    return (
      <div
        className="flex min-h-dvh items-center justify-center gap-3"
        role="status"
      >
        <Loader2 className="size-5 motion-safe:animate-spin" />
        {t("verifying")}
      </div>
    );
  const path = pathname.replace(/^\/(vi|en)(?=\/|$)/, "") || "/";
  if (!canVisit(user, path)) {
    const home = firstAllowedPath(user);
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t("forbidden")}</h1>
        <p className="text-muted-foreground">{t("forbiddenHelp")}</p>
        {home && (
          <Button
            onClick={() =>
              router.replace(`/${locale}${home === "/" ? "" : home}`)
            }
          >
            {t("back")}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={async () => {
            await authService.logout().catch(() => {});
            dispatch(logout());
            router.replace(`/${locale}/login`);
          }}
        >
          {t("logout")}
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
