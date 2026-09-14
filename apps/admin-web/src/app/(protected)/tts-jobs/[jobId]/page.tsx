import { TtsDetail } from "@/features/operations/tts-detail";
export default async function Page({params}:{params:Promise<{jobId:string}>}){return <TtsDetail id={(await params).jobId}/>}
