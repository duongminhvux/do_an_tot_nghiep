"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { passwordRecoveryApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await passwordRecoveryApi.forgot(email);
      setSent(true);
    } catch (value) {
      setError(errorMessage(value));
    } finally {
      setSubmitting(false);
    }
  };
  if (sent) {
    return (
      <p
        role="status"
        className="mt-7 rounded-xl bg-green-50 p-4 text-sm text-green-800"
      >
        If the account exists, password reset instructions have been created.
      </p>
    );
  }
  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <label className="block">
        <span className="text-sm font-semibold">Email address</span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4"
          autoComplete="email"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button className="w-full" size="lg" disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </Button>
      <Link
        href="/login"
        className="block text-center text-sm font-bold text-blue-600"
      >
        Back to login
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 10)
      return setError("Password must have at least 10 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    setError("");
    try {
      await passwordRecoveryApi.reset(token, password);
      router.replace("/login?reset=success");
    } catch (value) {
      setError(errorMessage(value));
      setSubmitting(false);
    }
  };
  if (!token) {
    return (
      <p
        role="alert"
        className="mt-7 rounded-xl bg-red-50 p-4 text-sm text-red-700"
      >
        This reset link is missing its token.
      </p>
    );
  }
  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <PasswordInput
        label="New password"
        value={password}
        onChange={setPassword}
      />
      <PasswordInput
        label="Confirm password"
        value={confirm}
        onChange={setConfirm}
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button className="w-full" size="lg" disabled={submitting}>
        {submitting ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}

function PasswordInput({
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
        minLength={10}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4"
        autoComplete="new-password"
      />
    </label>
  );
}
