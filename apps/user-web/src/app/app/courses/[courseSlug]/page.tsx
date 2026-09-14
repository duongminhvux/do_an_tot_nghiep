import { CourseDetailPage } from "@/features/courses/course-detail-page";
export default async function Page({ params }: { params: Promise<{ courseSlug: string }> }) { return <CourseDetailPage slug={(await params).courseSlug} />; }
