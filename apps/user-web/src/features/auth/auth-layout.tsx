import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[.9fr_1.1fr]">
      <section className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <Logo />
        <div className="mx-auto my-auto w-full max-w-md py-12">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-slate-500">{subtitle}</p>
          {children}
        </div>
        <Link
          href="/"
          className="text-sm font-semibold text-slate-500 hover:text-blue-600"
        >
          ← Back to home
        </Link>
      </section>
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0f2a66] via-blue-800 to-blue-600 p-16 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="grid-dots absolute inset-0 opacity-10" />
        <div className="relative max-w-xl">
          <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
            LISTEN • PRACTICE • PROGRESS
          </div>
          <h2 className="mt-6 text-4xl font-extrabold leading-tight">
            Build listening confidence one focused lesson at a time.
          </h2>
          <div className="mt-8 space-y-4">
            {[
              "Guided dictation with word-level feedback",
              "TOEIC Listening practice for Parts 1–4",
              "Clear progress, goals, and learning streaks",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-cyan-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="surface mt-10 max-w-md p-5 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">
                  WEEKLY LISTENING GOAL
                </p>
                <strong className="text-2xl">78%</strong>
              </div>
              <div className="grid size-14 place-items-center rounded-full border-[6px] border-blue-500 border-t-blue-100 text-xs font-bold">
                5/7
              </div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
