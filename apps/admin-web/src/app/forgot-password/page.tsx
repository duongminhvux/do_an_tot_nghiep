"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminPasswordRecoveryApi } from "@/lib/api/client";
import { messageOf } from "@/lib/api/errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("submitting");
    try {
      await adminPasswordRecoveryApi.forgot(email);
      setStatus("sent");
    } catch (value) {
      setStatus("idle");
      setError(messageOf(value));
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-blue-700 to-[#071f33] p-4">
      <section className="admin-surface w-full max-w-md p-7 shadow-2xl">
        <span className="grid size-11 place-items-center rounded-lg bg-blue-50 text-blue-600">
          <Mail />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter your admin or teacher email address.
        </p>
        {status === "sent" ? (
          <p
            role="status"
            className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-800"
          >
            If the account exists, password reset instructions have been
            created.
          </p>
        ) : (
          <form onSubmit={submit}>
            <label className="mt-6 block">
              <span className="text-sm font-semibold">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3"
                autoComplete="email"
              />
            </label>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}
            <Button className="mt-5 w-full" disabled={status === "submitting"}>
              {status === "submitting" ? "Sending…" : "Send reset link"}
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
