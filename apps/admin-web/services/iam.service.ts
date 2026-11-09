import apiClient from "@/lib/axios";
import axios from "axios";
export type AdminStatus =
  "PENDING_ACTIVATION" | "ACTIVE" | "SUSPENDED" | "DISABLED";
export interface IamRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}
export interface IamPermission {
  id: string;
  code: string;
  resource: string;
  action: string;
  description: string;
}
export interface IamAdmin {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  status: AdminStatus;
  authVersion: number;
  createdAt: string;
  activatedAt: string | null;
  lastLoginAt: string | null;
  roles: IamRole[];
}
export interface Delivery {
  expiresAt: string;
  delivery: "QUEUED" | "SENT" | "NOT_SCHEDULED";
}
export interface AdminQuery {
  search?: string;
  status?: string;
  roleId?: string;
  page: number;
  limit: number;
}
export interface PermissionMatrix {
  roles: IamRole[];
  permissions: IamPermission[];
  grants: { roleId: string; permission: string }[];
}
async function data<T>(promise: Promise<{ data: { data: T } }>) {
  return (await promise).data.data;
}
export const iamService = {
  admins: (query: AdminQuery, signal?: AbortSignal) =>
    data<{ items: IamAdmin[]; total: number; page: number; limit: number }>(
      apiClient.get("/admin/admins", {
        signal,
        params: Object.fromEntries(
          Object.entries(query).filter(([, v]) => v !== "" && v !== undefined),
        ),
      }),
    ),
  admin: (id: string) => data<IamAdmin>(apiClient.get(`/admin/admins/${id}`)),
  createAdmin: (body: { email: string; fullName: string; roleIds: string[] }) =>
    data<{ admin: IamAdmin; activation: Delivery }>(
      apiClient.post("/admin/admins", body),
    ),
  updateAdmin: (id: string, body: { email?: string; fullName?: string }) =>
    data<IamAdmin>(apiClient.patch(`/admin/admins/${id}`, body)),
  status: (id: string, status: Exclude<AdminStatus, "PENDING_ACTIVATION">) =>
    data<{ changed: boolean }>(
      apiClient.patch(`/admin/admins/${id}/status`, { status }),
    ),
  assign: (id: string, roleIds: string[]) =>
    data<{ changed: boolean }>(
      apiClient.put(`/admin/admins/${id}/roles`, { roleIds }),
    ),
  reinvite: (id: string) =>
    data<Delivery>(apiClient.post(`/admin/admins/${id}/reinvite`)),
  roles: (signal?: AbortSignal) =>
    data<IamRole[]>(apiClient.get("/admin/roles", { signal })),
  createRole: (body: {
    code: string;
    name: string;
    description: string | null;
  }) => data<IamRole>(apiClient.post("/admin/roles", body)),
  updateRole: (
    id: string,
    body: { name: string; description: string | null },
  ) => data<IamRole>(apiClient.patch(`/admin/roles/${id}`, body)),
  permissions: () => data<IamPermission[]>(apiClient.get("/admin/permissions")),
  matrix: () => data<PermissionMatrix>(apiClient.get("/admin/roles/matrix")),
  savePermissions: (id: string, permissionCodes: string[]) =>
    data<{ changed: boolean }>(
      apiClient.put(`/admin/roles/${id}/permissions`, { permissionCodes }),
    ),
};
// Public activation is deliberately isolated from admin token/refresh interceptors.
const activationClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  withCredentials: false,
});
export const activationService = {
  status: (token: string) =>
    data<{ valid: boolean; expiresAt: string }>(
      activationClient.post("/admin/activation/status", { token }),
    ),
  activate: (token: string, password: string, confirmPassword: string) =>
    data<{ activated: boolean; loginUrl: string }>(
      activationClient.post("/admin/activation/activate", {
        token,
        password,
        confirmPassword,
      }),
    ),
};
export function iamErrorCode(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  return status === 401
    ? "sessionExpired"
    : status === 403
      ? "forbidden"
      : status === 409
        ? "conflict"
        : status === 429
          ? "cooldownError"
          : status === 503
            ? "unavailable"
            : status === 400
              ? "invalidInput"
              : "requestError";
}
