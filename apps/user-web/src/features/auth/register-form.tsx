"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/session-store";
import { authApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
const schema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.email("Enter a valid email"),
    password: z.string().min(10, "Use at least 10 characters"),
    confirmPassword: z.string(),
    targetLevel: z.string().min(1),
    learningGoal: z.string().min(1),
    terms: z.boolean().refine(Boolean, "Please accept the terms"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
type Values = z.infer<typeof schema>;
export function RegisterForm() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      targetLevel: "INTERMEDIATE",
      learningGoal: "Improve everyday listening",
      terms: false,
    },
  });
  const submit = async (values: Values) => {
    try {
      const session = await authApi.register({
        email: values.email,
        fullName: values.fullName,
        password: values.password,
        targetLevel: values.targetLevel,
        learningGoal: values.learningGoal,
      });
      setSession(session.accessToken, session.user);
      router.replace("/app/dashboard");
    } catch (error) {
      setError("root", { message: errorMessage(error) });
    }
  };
  const field =
    "mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500";
  return (
    <form
      className="mt-7 grid gap-4 sm:grid-cols-2"
      onSubmit={handleSubmit(submit)}
    >
      <label className="sm:col-span-2">
        <span className="text-sm font-semibold">Full name</span>
        <input
          {...register("fullName")}
          className={field}
          placeholder="Your full name"
        />
        {errors.fullName && (
          <small className="text-red-600">{errors.fullName.message}</small>
        )}
      </label>
      <label className="sm:col-span-2">
        <span className="text-sm font-semibold">Email</span>
        <input
          {...register("email")}
          className={field}
          placeholder="you@example.com"
        />
        {errors.email && (
          <small className="text-red-600">{errors.email.message}</small>
        )}
      </label>
      <label>
        <span className="text-sm font-semibold">Password</span>
        <input {...register("password")} type="password" className={field} />
        {errors.password && (
          <small className="text-red-600">{errors.password.message}</small>
        )}
      </label>
      <label>
        <span className="text-sm font-semibold">Confirm password</span>
        <input
          {...register("confirmPassword")}
          type="password"
          className={field}
        />
        {errors.confirmPassword && (
          <small className="text-red-600">
            {errors.confirmPassword.message}
          </small>
        )}
      </label>
      <label>
        <span className="text-sm font-semibold">English level</span>
        <select {...register("targetLevel")} className={field}>
          <option value="ELEMENTARY">A2 — Elementary</option>
          <option value="INTERMEDIATE">B1 — Intermediate</option>
          <option value="UPPER_INTERMEDIATE">B2 — Upper intermediate</option>
          <option value="ADVANCED">C1 — Advanced</option>
        </select>
      </label>
      <label>
        <span className="text-sm font-semibold">Learning goal</span>
        <select {...register("learningGoal")} className={field}>
          <option>Improve everyday listening</option>
          <option>Prepare for TOEIC</option>
          <option>Speak confidently at work</option>
          <option>Travel with confidence</option>
        </select>
      </label>
      <label className="flex items-start gap-3 sm:col-span-2">
        <input
          {...register("terms")}
          type="checkbox"
          className="mt-1 size-4 accent-blue-600"
        />
        <span className="text-sm text-slate-600">
          I agree to the Terms of Service and Privacy Policy.
          {errors.terms && (
            <small className="block text-red-600">{errors.terms.message}</small>
          )}
        </span>
      </label>
      {errors.root?.message && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2"
        >
          {errors.root.message}
        </p>
      )}
      <Button className="sm:col-span-2" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-slate-500 sm:col-span-2">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-blue-600">
          Log in
        </Link>
      </p>
    </form>
  );
}
