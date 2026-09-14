"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { format } from "date-fns";
import type { AdminAttemptDto } from "@listenup/domain";
import { adminAttemptsApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { DataTable, type Column } from "@/components/table/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/states";
const columns: Column<AdminAttemptDto>[] = [
  {
    key: "student",
    header: "Student",
    cell: (r) => <strong>{r.studentName}</strong>,
  },
  {
    key: "exercise",
    header: "Exercise",
    cell: (r) => (
      <div>
        <strong>{r.exerciseTitle}</strong>
        <span className="block text-xs text-slate-500">{r.courseTitle}</span>
      </div>
    ),
  },
  { key: "type", header: "Type", cell: (r) => <StatusBadge status={r.type} /> },
  {
    key: "score",
    header: "Score",
    cell: (r) => <strong className="text-base">{r.score}%</strong>,
  },
  {
    key: "result",
    header: "Result",
    cell: (r) => <StatusBadge status={r.passed ? "PASS" : "FAIL"} />,
  },
  { key: "listens", header: "Plays", cell: (r) => r.listenCount },
  { key: "attempt", header: "Attempt", cell: (r) => `#${r.attemptNumber}` },
  {
    key: "time",
    header: "Submitted",
    cell: (r) => format(new Date(r.submittedAt), "MMM d, h:mm a"),
  },
  {
    key: "actions",
    header: "Actions",
    cell: (r) => (
      <Link
        href={`/attempts/${r.id}`}
        className="grid size-9 place-items-center rounded-lg text-blue-600 hover:bg-blue-50"
      >
        <Eye className="size-4" />
      </Link>
    ),
  },
];
export function AttemptsPage() {
  const user = useAdminSession((s) => s.user)!;
  const query = useQuery({
    queryKey: ["attempts", user.id],
    queryFn: () => adminAttemptsApi.list(user),
  });
  return (
    <div>
      <PageHeader
        title="Attempts"
        description="Read-only review of submitted listening attempts and outcomes."
      />
      {query.error ? (
        <ErrorState message={query.error.message} />
      ) : (
        <DataTable
          data={query.data ?? []}
          columns={columns}
          searchText={(r) =>
            `${r.studentName} ${r.exerciseTitle} ${r.courseTitle}`
          }
          loading={query.isLoading}
          filter={
            <>
              <select className="h-10 rounded-lg border border-slate-200 px-3 text-xs">
                <option>All results</option>
                <option>PASS</option>
                <option>FAIL</option>
              </select>
              <select className="h-10 rounded-lg border border-slate-200 px-3 text-xs">
                <option>All types</option>
                <option>DICTATION</option>
                <option>TOEIC</option>
              </select>
            </>
          }
        />
      )}
    </div>
  );
}
