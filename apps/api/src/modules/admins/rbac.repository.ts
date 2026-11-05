import { Injectable } from '@nestjs/common';
import { InjectPgConnection, type PgConnection } from '../../postgres/connection.js';
import { first, rows, sql } from '../../postgres/sql.js';
import type { AdminStatus } from './admin.types.js';

export interface RoleRecord {
  id: string; code: string; name: string; description: string | null; isSystem: boolean;
}
export interface PermissionRecord {
  id: string; code: string; resource: string; action: string; description: string;
}
export interface AdminAccessSnapshot {
  adminId: string; email: string; username: string; avatarUrl: string | null; status: AdminStatus; authVersion: number;
  canAuthenticate: boolean; isSuperAdmin: boolean; roleCodes: string[]; permissions: string[];
}

/** Identity-owned native SQL; composite join tables are not generic JSONB records. */
@Injectable()
export class RbacRepository {
  constructor(@InjectPgConnection() private readonly connection: PgConnection) {}

  listRoles(): Promise<RoleRecord[]> {
    return rows(this.connection, sql`SELECT id,code,name,description,is_system AS "isSystem" FROM public.roles ORDER BY code`);
  }
  findRoleByCode(code: string): Promise<RoleRecord | null> {
    return first(this.connection, sql`SELECT id,code,name,description,is_system AS "isSystem" FROM public.roles WHERE code=${code}`);
  }
  listPermissions(): Promise<PermissionRecord[]> {
    return rows(this.connection, sql`SELECT id,code,resource,action,description FROM public.permissions ORDER BY code`);
  }
  listAdminRoles(adminId: string): Promise<RoleRecord[]> {
    return rows(this.connection, sql`SELECT r.id,r.code,r.name,r.description,r.is_system AS "isSystem"
      FROM public.admin_roles ar JOIN public.roles r ON r.id=ar.role_id
      WHERE ar.admin_id=${adminId}::uuid ORDER BY r.code`);
  }
  getAdminAccessSnapshot(adminId: string): Promise<AdminAccessSnapshot | null> {
    // One statement gives lifecycle, membership and permissions one consistent MVCC snapshot.
    return first(this.connection, sql`SELECT a.id AS "adminId", a.email, a.username, a.avatar_url AS "avatarUrl", a.status, a.auth_version AS "authVersion",
      (NOT a.is_deleted AND a.status='ACTIVE' AND a.password_hash IS NOT NULL AND btrim(a.password_hash)<>'') AS "canAuthenticate",
      EXISTS(SELECT 1 FROM public.admin_roles ar JOIN public.roles r ON r.id=ar.role_id
        WHERE ar.admin_id=a.id AND r.code='SUPER_ADMIN' AND r.is_system) AS "isSuperAdmin",
      ARRAY(SELECT r.code FROM public.admin_roles ar JOIN public.roles r ON r.id=ar.role_id
        WHERE ar.admin_id=a.id ORDER BY r.code) AS "roleCodes",
      ARRAY(SELECT DISTINCT p.code FROM public.admin_roles ar
        JOIN public.role_permissions rp ON rp.role_id=ar.role_id
        JOIN public.permissions p ON p.id=rp.permission_id WHERE ar.admin_id=a.id ORDER BY p.code) AS permissions
      FROM public.admins a WHERE a.id=${adminId}::uuid`);
  }
}
