"use client";
import type { ReactNode } from "react";
import type { Permission } from "@listenup/domain";
import { can,type PermissionResource } from "@listenup/domain/permissions";
import { useAdminSession } from "@/stores/admin-session";
export function PermissionGate({permission,resource,children,fallback=null}:{permission:Permission;resource?:PermissionResource;children:ReactNode;fallback?:ReactNode}){const user=useAdminSession((s)=>s.user);return can(user,permission,resource)?children:fallback}
