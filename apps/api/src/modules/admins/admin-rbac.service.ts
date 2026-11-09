import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PERMISSION_CATALOGUE, type AdminPermissionCode } from './permission-catalogue.js';
import { RbacRepository } from './rbac.repository.js';

const supported = new Set<string>(PERMISSION_CATALOGUE.map(permission => permission.code));
export interface EffectiveAdminAccess {
  adminId: string; email: string; username: string; avatarUrl: string | null; status: string; canAuthenticate: boolean; authVersion: number; roleCodes: string[];
  isSuperAdmin: boolean; permissions: AdminPermissionCode[];
}

@Injectable()
export class AdminRbacService {
  constructor(private readonly repository: RbacRepository) {}

  async resolveAdminAccess(adminId: string): Promise<EffectiveAdminAccess | null> {
    const snapshot = await this.repository.getAdminAccessSnapshot(adminId);
    if (!snapshot) return null;
    const active = snapshot.canAuthenticate && Number.isInteger(snapshot.authVersion) && snapshot.authVersion > 0;
    return {
      adminId: snapshot.adminId, email: snapshot.email, username: snapshot.username, avatarUrl: snapshot.avatarUrl,
      status: snapshot.status, canAuthenticate: active, authVersion: snapshot.authVersion,
      roleCodes: active ? snapshot.roleCodes : [],
      isSuperAdmin: active && snapshot.isSuperAdmin,
      permissions: active ? snapshot.permissions.filter((code): code is AdminPermissionCode => supported.has(code)) : [],
    };
  }
  async authenticateToken(claims: any) {
    if (claims?.role!=='ADMIN' || typeof claims._id!=='string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims._id)
      || !Number.isInteger(claims.auth_version) || claims.auth_version<1) throw new UnauthorizedException('ADMIN_REAUTH_REQUIRED');
    const access=await this.resolveAdminAccess(claims._id);
    if (!access?.canAuthenticate || access.authVersion!==claims.auth_version) throw new UnauthorizedException('ADMIN_REAUTH_REQUIRED');
    return {_id:access.adminId,email:access.email,username:access.username,avatarUrl:access.avatarUrl,
      role:'ADMIN' as const,status:access.status,authVersion:access.authVersion,auth_version:access.authVersion,
      permissions:access.permissions,roleCodes:access.roleCodes,isSuperAdmin:access.isSuperAdmin};
  }
  async getEffectivePermissions(adminId: string): Promise<AdminPermissionCode[]> {
    return (await this.resolveAdminAccess(adminId))?.permissions ?? [];
  }
}
