import { LessonDetailPage } from "@/features/lessons/lesson-detail-page";
export default async function Page({ params }: { params: Promise<{ courseSlug: string; lessonSlug: string }> }) { const p = await params; return <LessonDetailPage courseSlug={p.courseSlug} lessonSlug={p.lessonSlug} />; }
