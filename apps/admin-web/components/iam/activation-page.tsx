"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, CircleCheck, Link2Off } from "lucide-react";
import { useActivationToken } from "./activation-token-context";
import LanguageSwitcher from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activationService, iamErrorCode } from "@/services/iam.service";
import { Loading, Notice, panelClass } from "./iam-shared";

export default function ActivationPage() {
  const { t } = useTranslation("iam"),
    token = useActivationToken(),
    captured = useRef(false);
  const [state, setState] = useState<
      "loading" | "valid" | "invalid" | "success" | "error"
    >("loading"),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loginUrl, setLoginUrl] = useState("");
  useEffect(() => {
    if (!captured.current) {
      token.current =
        new URLSearchParams(window.location.hash.slice(1)).get("token") ||
        token.current;
      captured.current = true;
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
    let alive = true;
    if (!token.current) {
      setState("invalid");
      return;
    }
    void activationService
      .status(token.current)
      .then((result) => {
        if (alive) setState(result.valid ? "valid" : "invalid");
      })
      .catch((e) => {
        if (alive) {
          const code = iamErrorCode(e);
          setError(code);
          setState(code === "invalidInput" ? "invalid" : "error");
        }
      });
    return () => {
      alive = false;
    };
  }, [token]);
  const validPassword =
    password === password.trim() &&
    password.length >= 12 &&
    password.length <= 72 &&
    new TextEncoder().encode(password).length <= 72 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    password === confirm;
  const activate = async () => {
    if (!validPassword) {
      setError("passwordError");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await activationService.activate(
        token.current,
        password,
        confirm,
      );
      token.current = "";
      setPassword("");
      setConfirm("");
      const target = new URL(result.loginUrl, window.location.origin);
      if (
        target.protocol !== "https:" &&
        target.origin !== window.location.origin
      )
        throw Error("Invalid login URL");
      setLoginUrl(target.href);
      setState("success");
      window.location.assign(target.href);
    } catch (e) {
      const code = iamErrorCode(e);
      if (code === "invalidInput") setState("invalid");
      else setError(code);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <section className={`${panelClass} w-full max-w-md p-6 shadow-sm sm:p-8`}>
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        {state === "loading" ? (
          <Loading />
        ) : state === "error" ? (
          <div className="space-y-4">
            <Notice error>{t(error)}</Notice>
            <Button
              onClick={() => {
                setState("loading");
                void activationService
                  .status(token.current)
                  .then((result) =>
                    setState(result.valid ? "valid" : "invalid"),
                  )
                  .catch((e) => {
                    const code = iamErrorCode(e);
                    setError(code);
                    setState(code === "invalidInput" ? "invalid" : "error");
                  });
              }}
            >
              {t("retry")}
            </Button>
          </div>
        ) : state === "invalid" ? (
          <div className="space-y-4">
            <Link2Off
              className="size-7 text-muted-foreground"
              aria-hidden="true"
            />
            <h1 className="text-xl font-semibold">{t("invalidLink")}</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {t("invalidLinkHelp")}
            </p>
          </div>
        ) : state === "success" ? (
          <div className="space-y-4" role="status">
            <CircleCheck className="size-8 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-semibold">{t("activated")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("activatedHelp")}
            </p>
            <Button asChild className="w-full">
              <a href={loginUrl}>{t("login")}</a>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              {t("activateTitle")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("activateHelp")}
            </p>
            <form
              className="mt-6 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void activate();
              }}
            >
              {error && <Notice error>{t(error)}</Notice>}
              <div>
                <label
                  htmlFor="activation-password"
                  className="mb-2 block text-sm font-medium"
                >
                  {t("password")}
                </label>
                <Input
                  id="activation-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  minLength={12}
                  maxLength={72}
                  required
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                  aria-describedby="password-help"
                />
                <p
                  id="password-help"
                  className="mt-2 text-xs leading-5 text-muted-foreground"
                >
                  {t("passwordHelp")}
                </p>
              </div>
              <div>
                <label
                  htmlFor="activation-confirm"
                  className="mb-2 block text-sm font-medium"
                >
                  {t("confirmPassword")}
                </label>
                <Input
                  id="activation-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  required
                  disabled={busy}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-11"
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {busy ? t("loading") : t("activate")}
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
