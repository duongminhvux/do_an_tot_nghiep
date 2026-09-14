"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { InlineLoader } from "@/components/ui/states";
import { authApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useSessionStore } from "@/stores/session-store";
const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must have at least 8 characters"),
});
type Values = z.infer<typeof schema>;
export function LoginForm({ next = "/app/dashboard" }: { next?: string }) {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const submit = async (values: Values) => {
    try {
      const session = await authApi.login(values.email, values.password);
      setSession(session.accessToken, session.user);
      router.replace(next.startsWith("/app") ? next : "/app/dashboard");
    } catch (error) {
      setError("root", { message: errorMessage(error) });
    }
  };
  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit(submit)} noValidate>
      <label className="block">
        <span className="text-sm font-semibold">Email address</span>
        <input
          {...register("email")}
          className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-500"
          autoComplete="email"
        />
        {errors.email && (
          <span className="mt-1 block text-sm text-red-600">
            {errors.email.message}
          </span>
        )}
      </label>
      <label className="block">
        <div className="flex justify-between">
          <span className="text-sm font-semibold">Password</span>
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-blue-600"
          >
            Forgot password?
          </Link>
        </div>
        <input
          {...register("password")}
          type="password"
          className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-500"
          autoComplete="current-password"
        />
        {errors.password && (
          <span className="mt-1 block text-sm text-red-600">
            {errors.password.message}
          </span>
        )}
      </label>
      {errors.root && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {errors.root.message}
        </div>
      )}
      <Button className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting && <InlineLoader />}Log in
      </Button>
      <p className="text-center text-sm text-slate-500">
        New to ListenUp?{" "}
        <Link href="/register" className="font-bold text-blue-600">
          Create an account
        </Link>
      </p>
    </form>
  );
}
