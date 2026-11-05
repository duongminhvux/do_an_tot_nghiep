import { SetMetadata } from '@nestjs/common';
import { PERMISSION_CATALOGUE, type AdminPermissionCode } from '../../admins/permission-catalogue.js';
export const PERMISSIONS_KEY = 'admin-iam:permissions';
export const CONDITION_KEY = 'admin-iam:condition';
export const EXEMPTION_KEY = 'admin-iam:exemption';
export const ADMIN_CONTROLLER_KEY = 'admin-iam:controller';
export type PermissionConditionCode = 'C1'|'C2'|'C3'|'C4'|'C5';
export type PermissionExemptionCode = 'E1'|'E2'|'E3'|'E4'|'E5'|'E6'|'E7';
const supported = new Set<string>(PERMISSION_CATALOGUE.map(item=>item.code));
export function RequirePermissions(...permissions: AdminPermissionCode[]) {
  if (!permissions.length || permissions.some(code=>!supported.has(code))) throw new Error('Explicit supported permissions required');
  return SetMetadata(PERMISSIONS_KEY, permissions);
}
export const PermissionCondition = (code: PermissionConditionCode) => SetMetadata(CONDITION_KEY, code);
export const PermissionExemption = (code: PermissionExemptionCode) => SetMetadata(EXEMPTION_KEY, code);
