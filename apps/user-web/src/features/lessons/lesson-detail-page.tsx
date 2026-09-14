"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpenText,
  Clock3,
  FileAudio,
  Headphones,
  HelpCircle,
  Mic2,
  PlayCircle,
  Volume2,
} from "lucide-react";
import { lessonsApi } from "@/lib/api/client";
import { LessonNavigation } from "@/components/lesson/lesson-navigation";
import { LoadingSkeleton, ErrorState } from "@/components/ui/states";
import { UnifiedAudioPlayer } from "@/components/audio/unified-audio-player";
import type { LessonResourceDto } from "@/domain/dto";
import { cn } from "@/lib/utils";
import { useProtectedMediaUrl } from "@/lib/use-protected-media-url";
const icons = {
  DICTATION: Mic2,
  TOEIC: FileAudio,
  QUIZ: HelpCircle,
  SHADOWING: Volume2,
};

function LessonAudioResource({ resource }: { resource: LessonResourceDto }) {
  const audio = useProtectedMediaUrl(resource.url);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{resource.title}</p>
      <UnifiedAudioPlayer
        id={`lesson-resource-${resource.id}`}
        sourceUrl={audio.url}
        duration={resource.duration ?? 0}
        disabled={!resource.url || audio.loading || Boolean(audio.error)}
      />
      {audio.error && (
        <p className="mt-2 text-sm text-red-600">{audio.error}</p>
      )}
    </div>
  );
}
export function LessonDetailPage({
  courseSlug,
  lessonSlug,
}: {
  courseSlug: string;
  lessonSlug: string;
}) {
  const query = useQuery({
    queryKey: ["lesson", courseSlug, lessonSlug],
    queryFn: () => lessonsApi.get(courseSlug, lessonSlug),
  });
  if (query.isLoading) return <LoadingSkeleton rows={4} />;
  if (query.error || !query.data)
    return (
      <ErrorState
        message="Lesson details are unavailable."
        onRetry={() => query.refetch()}
      />
    );
  const lesson = query.data;
  const audioResources = lesson.resources.filter(
    (resource) => resource.type === "AUDIO" && resource.url,
  );
  return (
    <div>
      <Link
        href={`/app/courses/${courseSlug}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft className="size-4" />
        Back to course
      </Link>
      <div className="mb-5 lg:hidden">
        <details className="surface">
          <summary className="cursor-pointer px-4 py-3 font-semibold">
            View all course lessons
          </summary>
          <div className="border-t border-slate-200">
            <LessonNavigation
              courseSlug={courseSlug}
              lessons={lesson.lessons}
              activeSlug={lessonSlug}
            />
          </div>
        </details>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
        <div className="sticky top-24 hidden lg:block">
          <LessonNavigation
            courseSlug={courseSlug}
            lessons={lesson.lessons}
            activeSlug={lessonSlug}
          />
        </div>
        <div className="space-y-5">
          <section className="surface p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-sm font-bold text-blue-600">
                  LESSON{" "}
                  {lesson.lessons.find((l) => l.slug === lessonSlug)?.order}
                </span>
                <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">
                  {lesson.title}
                </h1>
                <p className="mt-2 max-w-3xl text-slate-600">
                  {lesson.description}
                </p>
              </div>
              <span className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                <Clock3 className="size-4" />
                {lesson.duration} min
              </span>
            </div>
          </section>
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="surface p-5">
              <div className="flex items-center gap-2">
                <BookOpenText className="size-5 text-blue-600" />
                <h2 className="font-bold">Key Vocabulary</h2>
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {lesson.vocabulary.map((item) => (
                  <div key={item.term} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm capitalize">
                        {item.term}
                      </strong>
                      <span className="text-xs text-slate-400">
                        {item.pronunciation}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.definition}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            <section className="surface p-5">
              <div className="flex items-center gap-2">
                <PlayCircle className="size-5 text-blue-600" />
                <h2 className="font-bold">Useful Expressions</h2>
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {lesson.expressions.map((item) => (
                  <div key={item.phrase} className="py-3">
                    <strong className="text-sm">{item.phrase}</strong>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.meaning}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
          {audioResources.length > 0 && (
            <section className="surface p-5">
              <div className="mb-4 flex items-center gap-2">
                <Headphones className="size-5 text-blue-600" />
                <h2 className="font-bold">Lesson Audio</h2>
              </div>
              <div className="space-y-4">
                {audioResources.map((resource) => (
                  <LessonAudioResource key={resource.id} resource={resource} />
                ))}
              </div>
            </section>
          )}
          <section className="surface p-5">
            <h2 className="font-bold">Practice This Lesson</h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose an activity to check your understanding.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {lesson.exercises.map((exercise) => {
                const Icon = icons[exercise.type];
                const content = (
                  <>
                    <span
                      className={cn(
                        "grid size-11 place-items-center rounded-xl",
                        exercise.available
                          ? "bg-blue-50 text-blue-600"
                          : "bg-slate-100 text-slate-400",
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span>
                      <strong className="block text-sm">
                        {exercise.type === "DICTATION"
                          ? "Dictation"
                          : exercise.type === "TOEIC"
                            ? "TOEIC Practice"
                            : exercise.type === "QUIZ"
                              ? "Quiz"
                              : "Shadowing"}
                      </strong>
                      <span className="text-xs text-slate-500">
                        {exercise.available ? exercise.title : "Coming soon"}
                      </span>
                    </span>
                  </>
                );
                return exercise.available ? (
                  <Link
                    key={exercise.id}
                    href={`/app/exercises/${exercise.id}`}
                    className="flex min-h-20 items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50/30"
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={exercise.id}
                    className="flex min-h-20 items-center gap-3 rounded-xl border border-slate-200 p-4 opacity-70"
                    aria-disabled
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
