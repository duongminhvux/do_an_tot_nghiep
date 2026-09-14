import { LessonEditor } from "@/features/lessons/lesson-editor";
export default async function Page({params}:{params:Promise<{courseId:string}>}){return <LessonEditor courseId={(await params).courseId}/>}
