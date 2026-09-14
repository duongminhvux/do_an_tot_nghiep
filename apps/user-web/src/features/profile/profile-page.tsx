"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Mail, UserRound } from "lucide-react";
import { profileApi } from "@/lib/api/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingSkeleton } from "@/components/ui/states";
import { useSessionStore } from "@/stores/session-store";

export const targetLevelOptions = [
  { value: "BEGINNER", label: "A1 — Beginner" },
  { value: "ELEMENTARY", label: "A2 — Elementary" },
  { value: "PRE_INTERMEDIATE", label: "A2+ — Pre-intermediate" },
  { value: "INTERMEDIATE", label: "B1 — Intermediate" },
  { value: "UPPER_INTERMEDIATE", label: "B2 — Upper-intermediate" },
  { value: "ADVANCED", label: "C1 — Advanced" },
] as const;

export function ProfilePage() {
  const query = useQuery({ queryKey: ["profile"], queryFn: profileApi.get });
  const client = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [targetLevel, setTargetLevel] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (query.data) {
      setFullName(query.data.fullName);
      setTargetLevel(query.data.targetLevel);
      setLearningGoal(query.data.learningGoal);
    }
  }, [query.data]);
  if (query.isLoading) return <LoadingSkeleton rows={2} />;
  if (query.error || !query.data)
    return (
      <ErrorState
        message="Profile could not be loaded."
        onRetry={() => query.refetch()}
      />
    );
  const save = async () => {
    if (fullName.trim().length < 2) return;
    setSaving(true);
    const profile = await profileApi.update({
      fullName: fullName.trim(),
      ...(targetLevel ? { targetLevel } : {}),
      learningGoal,
    });
    const session = useSessionStore.getState();
    if (session.token) session.setSession(session.token, profile);
    await client.invalidateQueries({ queryKey: ["profile"] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Profile"
        description="Keep your learning goals and personal details up to date."
      />
      <div className="grid gap-5 md:grid-cols-[260px_1fr]">
        <aside className="surface p-6 text-center">
          <div className="relative mx-auto grid size-28 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 text-4xl font-extrabold text-slate-800">
            {query.data.fullName.charAt(0)}
            <button
              aria-label="Change profile picture"
              disabled
              title="Profile picture changes are not available yet."
              className="absolute bottom-0 right-0 grid size-10 place-items-center rounded-full border-2 border-white bg-slate-400 text-white"
            >
              <Camera className="size-4" />
            </button>
          </div>
          <h2 className="mt-4 text-lg font-bold">{query.data.fullName}</h2>
          <p className="text-sm text-slate-500">Student learner</p>
        </aside>
        <section className="surface p-5 md:p-7">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <UserRound className="size-5 text-blue-600" />
            Personal Information
          </h2>
          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold">Full name</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-500"
              />
              {fullName.trim().length < 2 && (
                <span className="mt-1 block text-xs text-red-600">
                  Enter at least 2 characters.
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Email address</span>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query.data.email}
                  readOnly
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-slate-500"
                />
              </div>
              <span className="mt-1 block text-xs text-slate-400">
                Email changes require account verification.
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-semibold">
                Target English level
              </span>
              <select
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4"
              >
                <option value="">Not set</option>
                {targetLevelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Learning goal</span>
              <textarea
                value={learningGoal}
                onChange={(e) => setLearningGoal(e.target.value)}
                className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-blue-500"
              />
            </label>
            <div className="flex items-center justify-end gap-3">
              {saved && (
                <span
                  className="flex items-center gap-1 text-sm font-semibold text-green-600"
                  role="status"
                >
                  <CheckCircle2 className="size-4" />
                  Saved
                </span>
              )}
              <Button
                onClick={save}
                disabled={saving || fullName.trim().length < 2}
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
