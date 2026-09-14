import { AttemptDetail } from "@/features/management/attempt-detail";
export default async function Page({params}:{params:Promise<{attemptId:string}>}){return <AttemptDetail id={(await params).attemptId}/>}
