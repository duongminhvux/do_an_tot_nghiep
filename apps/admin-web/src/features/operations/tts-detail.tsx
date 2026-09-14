"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, RefreshCcw } from "lucide-react";
import { adminTtsApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, TableSkeleton } from "@/components/ui/states";

interface TtsDetailRecord {
  id: string;
  status: string;
  provider: string;
  voiceId: string;
  language: string;
  speed: string | number;
  retryCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  exercise?: { title?: string } | null;
}

export function TtsDetail({ id }: { id: string }) {
  const user = useAdminSession((state) => state.user)!;
  const [retryMessage, setRetryMessage] = useState("");
  const query = useQuery({
    queryKey: ["tts-job", id],
    queryFn: () => adminTtsApi.get(user, id) as Promise<unknown> as Promise<TtsDetailRecord>,
  });
  if (query.isLoading) return <TableSkeleton />;
  if (query.error) return <ErrorState message={query.error.message} />;
  const job = query.data!;
  const retry = async () => {
    try {
      await adminTtsApi.retry(user, id);
    } catch (error) {
      setRetryMessage(
        error instanceof Error ? error.message : "TTS retry is unavailable.",
      );
    }
  };
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/tts-jobs"
        className="mb-4 inline-flex items-center gap-1 font-semibold text-slate-500"
      >
        <ArrowLeft className="size-4" />
        Back to TTS jobs
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-blue-600">JOB {job.id}</p>
          <h1 className="text-2xl font-extrabold">
            {job.exercise?.title ?? "TTS job"}
          </h1>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <section className="admin-surface mt-5 p-5">
        {(job.errorCode || retryMessage) && (
          <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4">
            <AlertTriangle className="size-5 text-red-600" />
            <div>
              <strong className="text-red-800">
                {job.errorCode ?? "TTS_PROVIDER_NOT_CONFIGURED"}
              </strong>
              <p className="mt-1 text-sm text-red-700">
                {retryMessage || job.errorMessage}
              </p>
            </div>
          </div>
        )}
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Detail label="Provider" value={job.provider} />
          <Detail label="Voice" value={job.voiceId || "Not configured"} />
          <Detail label="Language" value={job.language} />
          <Detail label="Speed" value={`${job.speed}x`} />
          <Detail label="Retry count" value={String(job.retryCount)} />
        </dl>
        <Button className="mt-6" onClick={() => void retry()}>
          <RefreshCcw className="size-4" />
          Retry job
        </Button>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
