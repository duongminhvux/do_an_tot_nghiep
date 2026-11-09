export const ADMIN_STATUSES = ['PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'DISABLED'] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

export interface AdminRecord {
  _id: string;
  id: string;
  email: string;
  username: string;
  password: string | null;
  status: AdminStatus;
  authVersion: number;
  createdBy: string | null;
  activatedAt: Date | null;
  lastLoginAt: Date | null;
  avatarUrl?: string;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type SafeAdminRecord = Omit<AdminRecord, 'password'>;

/** Lifecycle only. JWT epoch enforcement and PermissionGuard belong to Phase 2. */
export function isAdminAuthenticatable(admin: AdminRecord | null | undefined): admin is AdminRecord & { password: string } {
  return !!admin && !admin.isDeleted && admin.status === 'ACTIVE'
    && typeof admin.password === 'string' && admin.password.trim().length > 0;
}
