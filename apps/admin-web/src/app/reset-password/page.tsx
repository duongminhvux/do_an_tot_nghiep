"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminPasswordRecoveryApi } from "@/lib/api/client";
import { messageOf } from "@/lib/api/errors";

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 10) {
      setError("Password must have at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await adminPasswordRecoveryApi.reset(token, password);
      router.replace("/login?reset=success");
    } catch (value) {
      setError(messageOf(value));
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-blue-700 to-[#071f33] p-4">
      <section className="admin-surface w-full max-w-md p-7 shadow-2xl">
        <LockKeyhole className="size-10 text-blue-600" />
        <h1 className="mt-5 text-2xl font-extrabold">Choose a new password</h1>
        {!token ? (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700"
          >
            This reset link is missing its token.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <PasswordField
              label="New password"
              value={password}
              onChange={setPassword}
            />
            <PasswordField
              label="Confirm password"
              value={confirm}
              onChange={setConfirm}
            />
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <Button className="w-full" disabled={submitting}>
              {submitting ? "Resetting…" : "Reset password"}
            </Button>
          </form>
        )}
        <Link
          href="/login"
          className="mt-5 block text-center text-sm font-semibold text-blue-600"
        >
          Back to login
        </Link>
      </section>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input
        type="password"
        required
        minLength={10}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3"
        autoComplete="new-password"
      />
    </label>
  );
}
