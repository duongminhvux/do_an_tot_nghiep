"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Copy, Edit3, Eye, MoreHorizontal, Plus } from "lucide-react";
import type { AdminCourseDto } from "@listenup/domain";
import { adminCoursesApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { DataTable, type Column } from "@/components/table/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { PermissionGate } from "@/components/ui/permission-gate";
const columns: Column<AdminCourseDto>[] = [
  {
    key: "course",
    header: "Course",
    cell: (r) => (
      <div className="flex items-center gap-3">
        <span className="admin-photo h-10 w-16 rounded-md" />
        <div>
          <strong>{r.title}</strong>
          <span className="block text-xs text-slate-500">
            Updated {new Date(r.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    ),
  },
  { key: "level", header: "Level", cell: (r) => r.level },
  {
    key: "lessons",
    header: "Lessons",
    cell: (r) => <strong>{r.lessons}</strong>,
  },
  {
    key: "students",
    header: "Students",
    cell: (r) => r.students.toLocaleString(),
  },
  {
    key: "status",
    header: "Status",
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "teachers",
    header: "Assigned teachers",
    cell: (r) => (
      <span className="block max-w-40 truncate">
        {r.assignedTeachers.map((teacher) => teacher.fullName).join(", ") ||
          "Unassigned"}
      </span>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    cell: (r) => (
      <div className="flex">
        <Link
          href={`/courses/${r.id}`}
          className="grid size-9 place-items-center rounded-lg hover:bg-blue-50"
          aria-label="View course"
        >
          <Eye className="size-4" />
        </Link>
        <Link
          href={`/courses/${r.id}/edit`}
          className="grid size-9 place-items-center rounded-lg hover:bg-blue-50"
          aria-label="Edit course"
        >
          <Edit3 className="size-4" />
        </Link>
        <button
          disabled
          title="Course duplication is not available yet."
          className="grid size-9 place-items-center rounded-lg text-slate-300"
          aria-label="Duplicate course unavailable"
        >
          <Copy className="size-4" />
        </button>
        <button
          disabled
          title="Additional actions are not available yet."
          className="grid size-9 place-items-center rounded-lg text-slate-300"
          aria-label="More actions unavailable"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
    ),
  },
];
export function CoursesPage() {
  const user = useAdminSession((s) => s.user)!;
  const query = useQuery({
    queryKey: ["admin-courses", user.id],
    queryFn: () => adminCoursesApi.list(user),
  });
  return (
    <div>
      <PageHeader
        title="Course & Lesson Management"
        description="Create, assign, publish, and monitor your listening curriculum."
        action={
          <PermissionGate permission="course:create">
            <Link href="/courses/new">
              <Button>
                <Plus className="size-4" />
                New Course
              </Button>
            </Link>
          </PermissionGate>
        }
      />
      {query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => query.refetch()}
        />
      ) : (
        <DataTable
          data={query.data ?? []}
          columns={columns}
          searchText={(r) =>
            `${r.title} ${r.level} ${r.assignedTeachers.map((teacher) => teacher.fullName).join(" ")}`
          }
          loading={query.isLoading}
          filter={
            <>
              <select className="h-10 rounded-lg border border-slate-200 px-3 text-xs">
                <option>All levels</option>
                <option>Beginner</option>
                <option>Intermediate</option>
              </select>
              <select className="h-10 rounded-lg border border-slate-200 px-3 text-xs">
                <option>All status</option>
                <option>PUBLISHED</option>
                <option>DRAFT</option>
              </select>
            </>
          }
        />
      )}
    </div>
  );
}
