import { LessonEditor } from "@/features/lessons/lesson-editor";
export default async function Page({params}:{params:Promise<{courseId:string;lessonId:string}>}){const p=await params;return <LessonEditor courseId={p.courseId} lessonId={p.lessonId}/>}
