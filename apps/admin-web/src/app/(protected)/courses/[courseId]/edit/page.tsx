import { CourseForm } from "@/features/courses/course-form";
export default async function Page({params}:{params:Promise<{courseId:string}>}){return <CourseForm id={(await params).courseId}/>}
