import { StudentDetailPage } from "@/features/students/student-detail-page";
export default async function Page({params}:{params:Promise<{studentId:string}>}){return <StudentDetailPage id={(await params).studentId}/>}
