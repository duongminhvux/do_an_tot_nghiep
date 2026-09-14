"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, Eye, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminAuthApi } from "@/lib/api/client";
import { AdminApiError, messageOf } from "@/lib/api/errors";
import { useAdminSession } from "@/stores/admin-session";
const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must have at least 8 characters"),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;
export function LoginPage({ next = "/dashboard" }: { next?: string }) {
  const router = useRouter();
  const setSession = useAdminSession((s) => s.setSession);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });
  const submit = async (values: Values) => {
    try {
      const session = await adminAuthApi.login(values.email, values.password);
      setSession(session.accessToken, session.user);
      router.replace(next.startsWith("/") ? next : "/dashboard");
    } catch (error) {
      if (error instanceof AdminApiError && error.code === "FORBIDDEN") {
        router.replace("/403");
        return;
      }
      setError("root", { message: messageOf(error) });
    }
  };
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-[#0b2a43] p-4">
      <div className="admin-grid absolute inset-0 opacity-15" />
      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
        <section className="hidden px-10 text-white lg:block">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-white/15">
              <BookOpen className="size-7" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold">ListenUp Admin</h1>
              <p className="text-sm text-blue-100">
                Administration & Teacher Portal
              </p>
            </div>
          </div>
          <h2 className="mt-12 max-w-xl text-5xl font-extrabold leading-tight tracking-tight">
            Manage learning content with confidence.
          </h2>
          <p className="mt-5 max-w-lg text-lg text-blue-100">
            A secure workspace for courses, lessons, listening exercises,
            student progress, TTS, and publishing.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-4">
            {[
              "Role-based access",
              "Isolated admin session",
              "Audited publishing",
              "Assigned teacher scope",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-xl bg-white/10 p-3"
              >
                <ShieldCheck className="size-5 text-cyan-300" />
                <span className="text-sm font-semibold">{item}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-lg bg-blue-600 text-white">
              <BookOpen className="size-5" />
            </span>
            <strong className="text-lg">ListenUp Admin</strong>
          </div>
          <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <LockKeyhole className="size-6" />
          </span>
          <h2 className="mt-5 text-2xl font-extrabold">
            Welcome back <span aria-hidden>👋</span>
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to your secure administration console.
          </p>
          <form
            className="mt-7 space-y-5"
            onSubmit={handleSubmit(submit)}
            noValidate
          >
            <label className="block">
              <span className="text-sm font-semibold">Email address</span>
              <input
                {...register("email")}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-blue-500"
                autoComplete="email"
              />
              {errors.email && (
                <span className="mt-1 block text-xs text-red-600">
                  {errors.email.message}
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Password</span>
              <div className="relative mt-2">
                <input
                  {...register("password")}
                  type="password"
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 pr-10 outline-none focus:border-blue-500"
                  autoComplete="current-password"
                />
                <Eye className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              </div>
              {errors.password && (
                <span className="mt-1 block text-xs text-red-600">
                  {errors.password.message}
                </span>
              )}
            </label>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  {...register("remember")}
                  type="checkbox"
                  className="accent-blue-600"
                />
                Remember me
              </label>
              <a
                href="/forgot-password"
                className="text-sm font-semibold text-blue-600"
              >
                Forgot password?
              </a>
            </div>
            {errors.root && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {errors.root.message}
              </div>
            )}
            <Button className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Log in"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
