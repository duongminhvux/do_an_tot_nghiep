"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { BookOpen, Download, Headphones, Target, Users } from "lucide-react";
import { adminReportsApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, TableSkeleton } from "@/components/ui/states";

export function ReportsPage({ section = "overview" }: { section?: string }) {
  const user = useAdminSession((state) => state.user)!;
  const query = useQuery({
    queryKey: ["reports", user.id],
    queryFn: () => adminReportsApi.get(user),
  });
  if (query.isLoading) return <TableSkeleton />;
  if (query.error) return <ErrorState message={query.error.message} />;
  const report = query.data!;
  const passRate = Math.max(0, Math.min(100, report.performance.passRate));
  const performance = [
    { name: "Passed", value: passRate, color: "#22c55e" },
    { name: "Needs work", value: 100 - passRate, color: "#ef4444" },
  ];
  const exportCsv = () => {
    const rows = [
      ["metric", "value"],
      ["students", report.system.students],
      ["courses", report.system.courses],
      ["exercises", report.system.exercises],
      ["graded_attempts", report.system.attempts],
      ["average_score", report.performance.averageScore],
      ["pass_rate", report.performance.passRate],
      ...report.tts.map((item) => [`tts_${item.status.toLowerCase()}`, item.count]),
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `listenup-${section}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const metrics = [
    { label: "Students in scope", value: report.system.students, icon: Users },
    { label: "Courses in scope", value: report.system.courses, icon: BookOpen },
    {
      label: "Listening exercises",
      value: report.system.exercises,
      icon: Headphones,
    },
    {
      label: "Average score",
      value: `${report.performance.averageScore.toFixed(1)}%`,
      icon: Target,
    },
  ];
  return (
    <div>
      <PageHeader
        title={
          section === "overview"
            ? "Analytics & Reports"
            : `${section.charAt(0).toUpperCase() + section.slice(1)} Report`
        }
        description="Live operational learning outcomes from PostgreSQL."
        action={
          <Button onClick={exportCsv}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
        {["overview", "students", "courses", "exercises", "tts"].map((item) => (
          <Link
            key={item}
            href={item === "overview" ? "/reports" : `/reports/${item}`}
            className={`min-w-28 rounded-md px-4 py-2 text-center text-xs font-bold ${
              section === item ? "bg-blue-600 text-white" : "text-slate-500"
            }`}
          >
            {item.toUpperCase()}
          </Link>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div className="admin-surface p-4" key={label}>
            <Icon className="size-5 text-blue-600" />
            <p className="mt-3 text-xs text-slate-500">{label}</p>
            <strong className="text-2xl">{value}</strong>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <section className="admin-surface p-4">
          <h2 className="font-bold">Pass rate</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={performance}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={82}
                >
                  {performance.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-sm font-semibold">
            {passRate.toFixed(1)}% across {report.system.attempts} graded attempts
          </p>
        </section>
        <section className="admin-surface p-4">
          <h2 className="font-bold">TTS job status</h2>
          <p className="mt-1 text-sm text-slate-500">
            Zero totals are expected while the provider is disabled.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {report.tts.length ? (
              report.tts.map((item) => (
                <div
                  key={item.status}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <p className="text-xs font-bold text-slate-500">
                    {item.status}
                  </p>
                  <strong className="text-2xl">{item.count}</strong>
                </div>
              ))
            ) : (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                No TTS jobs have been created.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
