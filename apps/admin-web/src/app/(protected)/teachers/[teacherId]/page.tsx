import { TeacherForm } from "@/features/management/teacher-form";
export default async function Page({params}:{params:Promise<{teacherId:string}>}){return <TeacherForm id={(await params).teacherId}/>}
