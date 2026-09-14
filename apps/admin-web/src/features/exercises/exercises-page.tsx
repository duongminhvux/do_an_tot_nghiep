"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Edit3,Eye,Plus } from "lucide-react";
import type { AdminExerciseDto } from "@listenup/domain";
import { adminExercisesApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { DataTable,type Column } from "@/components/table/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
const columns:Column<AdminExerciseDto>[]=[{key:"title",header:"Exercise",cell:(r)=><strong>{r.title}</strong>},{key:"type",header:"Type",cell:(r)=><StatusBadge status={r.type}/>},{key:"status",header:"Content status",cell:(r)=><StatusBadge status={r.status}/>},{key:"tts",header:"Audio / TTS",cell:(r)=><StatusBadge status={r.ttsStatus}/>},{key:"attempts",header:"Attempts",cell:(r)=>r.attempts.toLocaleString()},{key:"pass",header:"Pass rate",cell:(r)=><strong>{r.passRate}%</strong>},{key:"actions",header:"Actions",cell:(r)=><div className="flex"><Link href={`/exercises/${r.id}/preview`} className="grid size-9 place-items-center rounded-lg hover:bg-blue-50"><Eye className="size-4"/></Link><Link href={`/exercises/${r.id}/edit?step=basic`} className="grid size-9 place-items-center rounded-lg hover:bg-blue-50"><Edit3 className="size-4"/></Link></div>}];
export function ExercisesPage(){const user=useAdminSession((s)=>s.user)!;const query=useQuery({queryKey:["admin-exercises",user.id],queryFn:()=>adminExercisesApi.list(user)});return <div><PageHeader title="Listening Exercises" description="Build Dictation and TOEIC practice with audio, questions, and publishing rules." action={<Link href="/exercises/new?step=basic"><Button><Plus className="size-4"/>New Exercise</Button></Link>}/>{query.error?<ErrorState message={query.error.message}/>:<DataTable data={query.data??[]} columns={columns} searchText={(r)=>`${r.title} ${r.type} ${r.status}`} loading={query.isLoading}/>}</div>}
