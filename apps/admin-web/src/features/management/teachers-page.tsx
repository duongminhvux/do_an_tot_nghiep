"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Edit3,Plus } from "lucide-react";
import type { AdminTeacherDto } from "@listenup/domain";
import { adminTeachersApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { DataTable,type Column } from "@/components/table/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
const columns:Column<AdminTeacherDto>[]=[{key:"name",header:"Teacher",cell:(row)=><div><strong>{row.fullName}</strong><span className="block text-xs text-slate-500">{row.email}</span></div>},{key:"status",header:"Status",cell:(row)=><StatusBadge status={row.status}/>},{key:"courses",header:"Assigned courses",cell:(row)=><strong>{row.assignedCourseIds.length}</strong>},{key:"notes",header:"Notes",cell:(row)=><span className="block max-w-64 truncate">{row.notes}</span>},{key:"actions",header:"Actions",cell:(row)=><Link href={`/teachers/${row.id}`} className="grid size-9 place-items-center rounded-lg text-blue-600 hover:bg-blue-50"><Edit3 className="size-4"/></Link>}];
export function TeachersPage(){const user=useAdminSession((s)=>s.user)!;const query=useQuery({queryKey:["teachers"],queryFn:()=>adminTeachersApi.list(user),retry:false});return <div><PageHeader title="Teachers" description="Invite teachers and manage assigned course scope." action={<Link href="/teachers/new"><Button><Plus className="size-4"/>Invite Teacher</Button></Link>}/>{query.error?<ErrorState message={query.error.message}/>:<DataTable data={query.data??[]} columns={columns} searchText={(r)=>`${r.fullName} ${r.email}`} loading={query.isLoading}/>}</div>}
