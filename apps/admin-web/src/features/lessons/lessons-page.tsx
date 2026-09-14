"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit3, Plus } from "lucide-react";
import {
  adminCoursesApi,
  adminLessonsApi,
} from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, TableSkeleton } from "@/components/ui/states";

export function LessonsPage() {
  const user = useAdminSession((state) => state.user)!;
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["all-admin-lessons", user.id],
    queryFn: async () => {
      const courses = await adminCoursesApi.list(user);
      const lessons = await Promise.all(
        courses.map(async (course) => ({
          course,
          lessons: await adminLessonsApi.list(user, course.id),
        })),
      );
      return lessons.flatMap(({ course, lessons: items }) =>
        items.map((lesson) => ({ course, lesson })),
      );
    },
  });
  const rows = (query.data ?? []).filter(({ lesson, course }) =>
    `${lesson.title} ${course.title}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const firstCourse = query.data?.[0]?.course;

  return (
    <div>
      <PageHeader
        title="Lessons"
        description="Manage structured lesson content across assigned courses."
        action={
          firstCourse ? (
            <Link href={`/courses/${firstCourse.id}/lessons/new`}>
              <Button>
                <Plus className="size-4" />
                New Lesson
              </Button>
            </Link>
          ) : null
        }
      />
      <section className="admin-surface overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full max-w-lg rounded-lg border border-slate-200 px-3"
            placeholder="Search lessons..."
          />
        </div>
        {query.isLoading ? (
          <TableSkeleton />
        ) : query.error ? (
          <ErrorState message={query.error.message} />
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map(({ lesson, course }, index) => (
              <Link
                href={`/courses/${course.id}/lessons/${lesson.id}/edit`}
                key={lesson.id}
                className="flex items-center gap-4 p-4 hover:bg-slate-50"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-blue-50 font-bold text-blue-600">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <strong>{lesson.title}</strong>
                  <p className="text-xs text-slate-500">{course.title}</p>
                </div>
                <StatusBadge status={lesson.status} />
                <Edit3 className="size-4 text-slate-400" />
              </Link>
            ))}
            {!rows.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                No lessons found.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
