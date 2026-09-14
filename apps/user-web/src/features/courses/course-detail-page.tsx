"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Lock,
  PlayCircle,
} from "lucide-react";
import { coursesApi } from "@/lib/api/client";
import { CourseVisual } from "@/components/course/course-visual";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingSkeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
export function CourseDetailPage({ slug }: { slug: string }) {
  const [tab, setTab] = useState("Lessons");
  const query = useQuery({
    queryKey: ["course", slug],
    queryFn: () => coursesApi.get(slug),
  });
  if (query.isLoading) return <LoadingSkeleton rows={4} />;
  if (query.error || !query.data)
    return (
      <ErrorState
        message="This course could not be loaded."
        onRetry={() => query.refetch()}
      />
    );
  const c = query.data;
  const current =
    c.lessons.find((l) => l.state === "CURRENT") ??
    c.lessons.find((l) => l.state !== "LOCKED");
  return (
    <div>
      <Link
        href="/app/courses"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft className="size-4" />
        Back to courses
      </Link>
      <section className="relative overflow-hidden rounded-2xl bg-[#0f2a66] text-white">
        <CourseVisual
          theme={c.theme}
          className="absolute inset-0 min-h-full rounded-none opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#071a42] via-[#0f2a66]/90 to-transparent" />
        <div className="relative max-w-2xl p-6 md:p-10">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
            {c.level}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold md:text-4xl">
            {c.title}
          </h1>
          <p className="mt-3 text-blue-100">{c.description}</p>
          <div className="mt-5 flex flex-wrap gap-5 text-sm">
            <span className="flex items-center gap-2">
              <BookOpen className="size-4" />
              {c.lessonCount} lessons
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              {c.completedLessons} completed
            </span>
          </div>
          <div className="mt-6 max-w-md">
            <div className="mb-2 flex justify-between text-xs font-semibold">
              <span>Course progress</span>
              <span>{c.progress}%</span>
            </div>
            <ProgressBar value={c.progress} className="bg-white/20" />
          </div>
          {current && (
            <Link href={`/app/courses/${slug}/lessons/${current.slug}`}>
              <Button className="mt-6 bg-white text-blue-700 hover:bg-blue-50">
                Continue course
              </Button>
            </Link>
          )}
        </div>
      </section>
      <div className="mt-5 flex overflow-x-auto border-b border-slate-200">
        {["Overview", "Lessons", "Practice", "Resources"].map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={cn(
              "min-h-12 min-w-28 border-b-2 px-5 text-sm font-semibold",
              tab === item
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "Lessons" ? (
        <div className="mt-5 grid gap-3">
          {c.lessons.map((lesson) => (
            <Link
              aria-disabled={lesson.state === "LOCKED"}
              href={
                lesson.state === "LOCKED"
                  ? "#"
                  : `/app/courses/${slug}/lessons/${lesson.slug}`
              }
              key={lesson.id}
              className={cn(
                "surface flex items-center gap-4 p-4",
                lesson.state !== "LOCKED" && "card-hover",
                lesson.state === "CURRENT" && "border-blue-300 bg-blue-50/50",
                lesson.state === "LOCKED" && "cursor-not-allowed opacity-65",
              )}
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full",
                  lesson.state === "COMPLETED"
                    ? "bg-green-50 text-green-600"
                    : lesson.state === "CURRENT"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-slate-100 text-slate-400",
                )}
              >
                {lesson.state === "COMPLETED" ? (
                  <CheckCircle2 className="size-5" />
                ) : lesson.state === "LOCKED" ? (
                  <Lock className="size-5" />
                ) : (
                  <PlayCircle className="size-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold">
                  {lesson.order}. {lesson.title}
                </h3>
                <p className="text-sm text-slate-500">
                  {lesson.duration} min • {lesson.exerciseCount} practice
                  activities
                </p>
              </div>
              <span className="hidden text-xs font-bold text-slate-500 sm:block">
                {lesson.state.replace("_", " ")}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="surface mt-5 p-8">
          <h2 className="text-xl font-bold">{tab}</h2>
          <p className="mt-2 text-slate-500">
            {tab === "Overview"
              ? c.description
              : tab === "Practice"
                ? "Practice activities are listed inside the lessons that contain them."
                : "No course-level downloadable resources are configured."}
          </p>
        </div>
      )}
    </div>
  );
}
