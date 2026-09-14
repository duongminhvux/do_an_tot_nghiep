"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  FileAudio,
  GraduationCap,
  Mic2,
  Plus,
  RefreshCcw,
  Target,
  Users,
} from "lucide-react";
import { adminDashboardApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { ErrorState, TableSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionGate } from "@/components/ui/permission-gate";
const icons = [
  Users,
  Users,
  BookOpen,
  GraduationCap,
  FileAudio,
  Activity,
  Target,
  Mic2,
  AlertTriangle,
];
const tones = {
  blue: "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
  green: "bg-green-50 text-green-600",
  amber: "bg-amber-50 text-amber-600",
  cyan: "bg-cyan-50 text-cyan-600",
  red: "bg-red-50 text-red-600",
};
export function DashboardPage() {
  const user = useAdminSession((s) => s.user)!;
  const query = useQuery({
    queryKey: ["admin-dashboard", user.id],
    queryFn: () => adminDashboardApi.get(user),
  });
  if (query.isLoading)
    return (
      <div className="space-y-5">
        <TableSkeleton rows={3} />
        <TableSkeleton rows={3} />
      </div>
    );
  if (query.error || !query.data)
    return (
      <ErrorState
        message="The administration dashboard is temporarily unavailable."
        onRetry={() => query.refetch()}
      />
    );
  const data = query.data;
  const ttsMetric = data.metrics.find(
    (metric) =>
      (metric.label as string) === "Failed TTS Jobs" ||
      metric.label === "TTS Provider",
  );
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
            {user.role} workspace
          </p>
          <h1 className="mt-1 text-2xl font-extrabold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor learning operations and content health.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => query.refetch()}>
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
          <PermissionGate permission="course:create">
            <Link href="/courses/new">
              <Button>
                <Plus className="size-4" />
                New Course
              </Button>
            </Link>
          </PermissionGate>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {data.metrics.map((metric, index) => {
          const Icon = icons[index % icons.length];
          return (
            <div className="admin-surface p-4" key={metric.label}>
              <div className="flex items-start justify-between">
                <span
                  className={`grid size-10 place-items-center rounded-lg ${tones[metric.tone]}`}
                >
                  <Icon className="size-5" />
                </span>
                <span
                  className={`text-xs font-bold ${metric.tone === "red" ? "text-red-600" : "text-green-600"}`}
                >
                  {metric.change}
                </span>
              </div>
              <p className="mt-4 text-xs font-semibold text-slate-500">
                {metric.label}
              </p>
              <strong className="mt-1 block text-2xl">{metric.value}</strong>
            </div>
          );
        })}
      </div>
      <section className="admin-surface mt-4 p-5">
        <h2 className="font-bold">Activity trends</h2>
        <p className="mt-2 text-sm text-slate-500">
          Detailed daily and weekly activity history is not available yet.
          Aggregate metrics above reflect current database data.
        </p>
      </section>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <section className="admin-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <h2 className="font-bold">Recent attempts</h2>
            <Link href="/attempts" className="text-xs font-bold text-blue-600">
              View all attempts <ArrowRight className="inline size-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Exercise</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.activity.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold">{item.student}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.exercise}
                    </td>
                    <td className="px-4 py-3 font-bold">{item.score}%</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {item.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="space-y-4">
          <section className="admin-surface p-4">
            <h2 className="font-bold">Quick actions</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <PermissionGate permission="course:create">
                <Link
                  href="/courses/new"
                  className="rounded-lg border border-slate-200 p-3 hover:bg-blue-50"
                >
                  <BookOpen className="size-5 text-blue-600" />
                  <strong className="mt-2 block text-xs">New course</strong>
                </Link>
              </PermissionGate>
              <Link
                href="/exercises/new"
                className="rounded-lg border border-slate-200 p-3 hover:bg-blue-50"
              >
                <FileAudio className="size-5 text-purple-600" />
                <strong className="mt-2 block text-xs">New exercise</strong>
              </Link>
              <Link
                href="/tts-jobs"
                className="rounded-lg border border-slate-200 p-3 hover:bg-blue-50"
              >
                <Mic2 className="size-5 text-cyan-600" />
                <strong className="mt-2 block text-xs">TTS jobs</strong>
              </Link>
              <Link
                href="/reports"
                className="rounded-lg border border-slate-200 p-3 hover:bg-blue-50"
              >
                <Activity className="size-5 text-green-600" />
                <strong className="mt-2 block text-xs">Reports</strong>
              </Link>
            </div>
          </section>
          <section className="admin-surface p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              <h2 className="font-bold">Needs attention</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {ttsMetric
                ? `${ttsMetric.label}: ${ttsMetric.value}. ${ttsMetric.change}`
                : "No operational alerts are available."}
            </p>
            <Link
              href="/tts-jobs"
              className="mt-3 inline-flex text-xs font-bold text-blue-600"
            >
              Review issues →
            </Link>
          </section>
        </div>
      </div>
      <section className="admin-surface mt-4 p-4">
        <h2 className="font-bold">Top courses</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {data.topCourses.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="admin-card-hover rounded-lg border border-slate-200 p-4"
            >
              <div className="admin-photo h-20 rounded-lg" />
              <h3 className="mt-3 font-bold">{course.title}</h3>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{course.students} students</span>
                <StatusBadge status={course.status} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
