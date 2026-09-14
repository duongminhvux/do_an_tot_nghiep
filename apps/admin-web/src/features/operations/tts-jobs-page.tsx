"use client";
import Link from "next/link";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import { Eye,RefreshCcw } from "lucide-react";
import type { TtsJobDto } from "@listenup/domain";
import { adminTtsApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { DataTable,type Column } from "@/components/table/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/states";
export function TtsJobsPage(){const user=useAdminSession((s)=>s.user)!;const client=useQueryClient();const query=useQuery({queryKey:["tts-jobs",user.id],queryFn:()=>adminTtsApi.list(user),refetchInterval:2000});const retry=async(id:string)=>{await adminTtsApi.retry(user,id);await client.invalidateQueries({queryKey:["tts-jobs"]})};const columns:Column<TtsJobDto>[]=[{key:"id",header:"Job ID",cell:(r)=><strong>{r.id}</strong>},{key:"exercise",header:"Exercise",cell:(r)=><div><strong>{r.exerciseTitle}</strong><span className="block text-xs text-slate-500">{r.provider} • {r.voice}</span></div>},{key:"lang",header:"Language",cell:(r)=>`${r.language} • ${r.speed}x`},{key:"status",header:"Status",cell:(r)=><StatusBadge status={r.status}/>},{key:"creator",header:"Created by",cell:(r)=>r.createdBy},{key:"retry",header:"Retries",cell:(r)=>r.retryCount},{key:"actions",header:"Actions",cell:(r)=><div className="flex"><Link href={`/tts-jobs/${r.id}`} className="grid size-9 place-items-center rounded-lg hover:bg-blue-50"><Eye className="size-4"/></Link>{r.status==="FAILED"&&<button onClick={()=>retry(r.id)} className="grid size-9 place-items-center rounded-lg text-blue-600 hover:bg-blue-50" aria-label="Retry TTS job"><RefreshCcw className="size-4"/></button>}</div>}];return <div><PageHeader title="TTS Jobs" description="Monitor generation, investigate provider failures, and retry eligible jobs."/>{query.error?<ErrorState message={query.error.message}/>:<DataTable data={query.data??[]} columns={columns} searchText={(r)=>`${r.id} ${r.exerciseTitle} ${r.provider} ${r.status}`} loading={query.isLoading}/>}</div>}
