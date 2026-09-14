"use client";
import { useEffect,type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Permission } from "@listenup/domain";
import { can,type PermissionResource } from "@listenup/domain/permissions";
import { useAdminSession } from "@/stores/admin-session";
export function RequirePermission({permission,resource,children}:{permission:Permission;resource?:PermissionResource;children:ReactNode}){const user=useAdminSession((s)=>s.user);const router=useRouter();const allowed=can(user,permission,resource);useEffect(()=>{if(user&&!allowed)router.replace("/403")},[allowed,router,user]);return allowed?children:<div className="admin-surface animate-pulse p-8">Checking permission…</div>}
