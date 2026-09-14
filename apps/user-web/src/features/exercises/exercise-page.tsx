"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { exercisesApi } from "@/lib/api/client";
import { ErrorState, LoadingSkeleton } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExerciseType } from "@/domain/enums";
import { DictationPractice } from "./dictation-practice";
import { ToeicPractice } from "./toeic-practice";
export function ExercisePage({ exerciseId }: { exerciseId: string }) { const query = useQuery({ queryKey: ["exercise", exerciseId], queryFn: () => exercisesApi.get(exerciseId), retry: false }); if (query.isLoading) return <LoadingSkeleton rows={3} />; if (query.error || !query.data) return <ErrorState message={query.error instanceof Error ? query.error.message : "Exercise unavailable."} onRetry={() => query.refetch()} />; const exercise = query.data; return <div className="mx-auto max-w-5xl"><Link href={`/app/courses/${exercise.courseSlug}/lessons/${exercise.lessonSlug}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-blue-600"><ArrowLeft className="size-4" />Back to lesson</Link><header className="surface mb-5 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex gap-2"><StatusBadge status={exercise.type === ExerciseType.DICTATION ? "Dictation" : "TOEIC"} />{exercise.toeicPart && <StatusBadge status={exercise.toeicPart.replace("_", " ")} />}</div><h1 className="mt-3 text-2xl font-extrabold md:text-3xl">{exercise.title}</h1><p className="mt-1 text-sm text-slate-500">Attempt {exercise.attempt.attemptNumber} of {exercise.maxAttemptCount}</p></div><span className="text-sm font-bold text-blue-600">{exercise.progressLabel}</span></div></header>{exercise.type === ExerciseType.DICTATION ? <DictationPractice exercise={exercise} /> : <ToeicPractice exercise={exercise} />}</div>; }
