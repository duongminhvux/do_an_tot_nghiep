"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Eye,Link2,MoreHorizontal,UserRound } from "lucide-react";
import { format } from "date-fns";
import type { AdminStudentDto } from "@listenup/domain";
import { adminStudentsApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { DataTable,type Column } from "@/components/table/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
const columns:Column<AdminStudentDto>[]=[{key:"student",header:"Student",cell:(row)=><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-blue-50 font-bold text-blue-600">{row.fullName.charAt(0)}</span><span><strong className="block">{row.fullName}</strong><span className="block text-xs text-slate-500">{row.email}</span></span></div>},{key:"level",header:"Target level",cell:(row)=>row.targetLevel},{key:"goal",header:"Learning goal",cell:(row)=><span className="block max-w-44 truncate">{row.learningGoal}</span>},{key:"status",header:"Status",cell:(row)=><StatusBadge status={row.status}/>},{key:"active",header:"Last active",cell:(row)=>format(new Date(row.lastActive),"MMM d, h:mm a")},{key:"score",header:"Avg. score",cell:(row)=><strong>{row.averageScore}%</strong>},{key:"actions",header:"Actions",cell:(row)=><div className="flex gap-1"><Link href={`/students/${row.id}`} aria-label={`View ${row.fullName}`} className="grid size-9 place-items-center rounded-lg text-blue-600 hover:bg-blue-50"><Eye className="size-4"/></Link><button aria-label="Copy student link" className="grid size-9 place-items-center rounded-lg hover:bg-slate-100"><Link2 className="size-4"/></button><button aria-label="More actions" className="grid size-9 place-items-center rounded-lg hover:bg-slate-100"><MoreHorizontal className="size-4"/></button></div>}];
export function StudentsPage(){const user=useAdminSession((s)=>s.user)!;const query=useQuery({queryKey:["admin-students",user.id],queryFn:()=>adminStudentsApi.list(user)});return <div><PageHeader title="Students" description="Monitor learners, enrollments, outcomes, and account activity." action={<Button><UserRound className="size-4"/>Enroll Student</Button>}/>{query.error?<ErrorState message={query.error.message} onRetry={()=>query.refetch()}/>:<DataTable data={query.data??[]} columns={columns} searchText={(row)=>`${row.fullName} ${row.email} ${row.learningGoal}`} loading={query.isLoading} filter={<><select className="h-10 rounded-lg border border-slate-200 px-3 text-xs"><option>All levels</option><option>B1</option><option>B2</option></select><select className="h-10 rounded-lg border border-slate-200 px-3 text-xs"><option>All status</option><option>Active</option><option>Blocked</option></select></>}/>}</div>}
