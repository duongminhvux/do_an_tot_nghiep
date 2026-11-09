import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  InjectPgConnection,
  withPgTransaction,
  type PgConnection,
} from '../../postgres/connection.js';
import { AdminRbacService } from './admin-rbac.service.js';
import { RbacRepository } from './rbac.repository.js';
import { PERMISSION_CATALOGUE } from './permission-catalogue.js';

const supported = new Set<string>(
  PERMISSION_CATALOGUE.map((item) => item.code),
);
const uuid = (id: string) =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
/** Shared IAM transaction boundary. Call only with a signature-verified server principal. */
@Injectable()
export class AdminAuthorizationService {
  constructor(
    @InjectPgConnection() private readonly connection: PgConnection,
  ) {}
  async runIamTransaction<T>(
    actorClaims: any,
    permission: string,
    work: (db: PgConnection) => Promise<T>,
  ): Promise<T> {
    if (!uuid(actorClaims?._id))
      throw new UnauthorizedException('ADMIN_REAUTH_REQUIRED');
    return withPgTransaction(this.connection, async (db) => {
      await db.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('vocalearn.admin-iam',0))",
      );
      await db.query(
        'SELECT id FROM public.admins WHERE id=$1::uuid FOR UPDATE',
        [actorClaims._id],
      );
      // Re-resolve actor under the same transaction/lock; never accept frontend permissions.
      const actor = await new AdminRbacService(
        new RbacRepository(db),
      ).authenticateToken(actorClaims);
      if (
        !actor.isSuperAdmin ||
        !actor.permissions.some((code) => code === permission)
      )
        throw new ForbiddenException('Current Super Admin required');
      return work(db);
    });
  }
  async recordAudit(
    db: PgConnection,
    actor: any,
    action: string,
    target: string,
    before: unknown,
    after: unknown,
  ) {
    await db.query(
      `INSERT INTO public.outbox_events(event_id,event_type,aggregate_type,aggregate_id,payload)
      VALUES($1,'identity.admin.authorization_changed.v1','admin-iam',$2::uuid,$3::jsonb)`,
      [
        randomUUID(),
        target,
        JSON.stringify({
          actorId: actor._id,
          action,
          targetId: target,
          before,
          after,
        }),
      ],
    );
  }
  async setAdminRoles(actor: any, adminId: string, roleIds: readonly string[]) {
    if (!uuid(adminId) || roleIds.some((id) => !uuid(id)))
      throw new BadRequestException('Invalid identity');
    const ids = [...new Set(roleIds)].sort();
    return this.runIamTransaction(actor, 'admins.update', async (db) => {
      const {
        rows: [admin],
      } = await db.query(
        'SELECT id FROM public.admins WHERE id=$1::uuid FOR UPDATE',
        [adminId],
      );
      if (!admin) throw new NotFoundException('Admin not found');
      const { rows: roles } = await db.query(
        'SELECT id,code,is_system FROM public.roles WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [ids],
      );
      if (roles.length !== ids.length)
        throw new BadRequestException('Unknown role');
      const { rows: before } = await db.query(
        `SELECT r.id,r.code,r.is_system FROM public.admin_roles ar JOIN public.roles r ON r.id=ar.role_id WHERE ar.admin_id=$1::uuid ORDER BY r.id`,
        [adminId],
      );
      const systemBefore = before
        .filter((r) => r.is_system)
        .map((r) => r.id)
        .sort();
      const systemAfter = roles
        .filter((r) => r.is_system)
        .map((r) => r.id)
        .sort();
      if (JSON.stringify(systemBefore) !== JSON.stringify(systemAfter))
        throw new ForbiddenException(
          'System membership requires explicit operator bootstrap',
        );
      if (
        JSON.stringify(before.map((r) => r.id).sort()) === JSON.stringify(ids)
      )
        return { changed: false };
      await db.query('DELETE FROM public.admin_roles WHERE admin_id=$1::uuid', [
        adminId,
      ]);
      await db.query(
        'INSERT INTO public.admin_roles(admin_id,role_id,assigned_by) SELECT $1::uuid,id,$3::uuid FROM public.roles WHERE id=ANY($2::uuid[])',
        [adminId, ids, actor._id],
      );
      await db.query(
        'UPDATE public.admins SET auth_version=auth_version+1 WHERE id=$1::uuid',
        [adminId],
      );
      await this.recordAudit(
        db,
        actor,
        'ADMIN_ROLES_CHANGED',
        adminId,
        before.map((r) => r.id),
        ids,
      );
      return { changed: true };
    });
  }
  async setRolePermissions(
    actor: any,
    roleId: string,
    permissionCodes: readonly string[],
  ) {
    if (!uuid(roleId) || permissionCodes.some((code) => !supported.has(code)))
      throw new BadRequestException('Unknown role or permission');
    if (permissionCodes.some((code) => /^(admins|roles)\./.test(code)))
      throw new ForbiddenException(
        'IAM permissions are reserved for the system role',
      );
    const codes = [...new Set(permissionCodes)].sort();
    return this.runIamTransaction(actor, 'roles.manage', async (db) => {
      const {
        rows: [role],
      } = await db.query(
        'SELECT id,is_system FROM public.roles WHERE id=$1::uuid FOR UPDATE',
        [roleId],
      );
      if (!role) throw new NotFoundException('Role not found');
      if (role.is_system)
        throw new ForbiddenException('System role is immutable');
      const { rows: before } = await db.query(
        'SELECT p.code FROM public.role_permissions rp JOIN public.permissions p ON p.id=rp.permission_id WHERE rp.role_id=$1::uuid ORDER BY p.code',
        [roleId],
      );
      if (JSON.stringify(before.map((p) => p.code)) === JSON.stringify(codes))
        return { changed: false };
      const { rows: affected } = await db.query(
        'SELECT a.id FROM public.admins a JOIN public.admin_roles ar ON ar.admin_id=a.id WHERE ar.role_id=$1::uuid ORDER BY a.id FOR UPDATE OF a',
        [roleId],
      );
      await db.query(
        'DELETE FROM public.role_permissions WHERE role_id=$1::uuid',
        [roleId],
      );
      await db.query(
        'INSERT INTO public.role_permissions(role_id,permission_id) SELECT $1::uuid,id FROM public.permissions WHERE code=ANY($2::text[])',
        [roleId, codes],
      );
      await db.query(
        'UPDATE public.admins SET auth_version=auth_version+1 WHERE id=ANY($1::uuid[])',
        [affected.map((a) => a.id)],
      );
      await this.recordAudit(
        db,
        actor,
        'ROLE_PERMISSIONS_CHANGED',
        roleId,
        before.map((p) => p.code),
        codes,
      );
      return { changed: true, affectedAdmins: affected.map((a) => a.id) };
    });
  }
  async setStatus(
    actor: any,
    adminId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
  ) {
    if (!uuid(adminId) || !['ACTIVE', 'SUSPENDED', 'DISABLED'].includes(status))
      throw new BadRequestException('Invalid lifecycle transition');
    return this.runIamTransaction(actor, 'admins.lock', async (db) => {
      const {
        rows: [admin],
      } = await db.query(
        'SELECT id,status,is_deleted,password_hash IS NOT NULL AS has_password FROM public.admins WHERE id=$1::uuid FOR UPDATE',
        [adminId],
      );
      if (!admin) throw new NotFoundException('Admin not found');
      if (admin.status === status) return { changed: false };
      if (
        status === 'ACTIVE' &&
        (admin.is_deleted ||
          !admin.has_password ||
          admin.status === 'PENDING_ACTIVATION')
      )
        throw new BadRequestException(
          'Unlock cannot activate an invitation or restore a deleted admin',
        );
      if (status !== 'ACTIVE') {
        const { rows: supers } =
          await db.query(`SELECT a.id FROM public.admins a JOIN public.admin_roles ar ON ar.admin_id=a.id
          JOIN public.roles r ON r.id=ar.role_id WHERE r.code='SUPER_ADMIN' AND r.is_system AND a.status='ACTIVE' AND NOT a.is_deleted ORDER BY a.id FOR UPDATE OF a`);
        if (supers.some((a) => a.id === adminId) && supers.length <= 1)
          throw new ForbiddenException(
            'Cannot disable the last ACTIVE Super Admin',
          );
      }
      await db.query(
        'UPDATE public.admins SET status=$2,auth_version=auth_version+1 WHERE id=$1::uuid',
        [adminId, status],
      );
      await this.recordAudit(
        db,
        actor,
        'ADMIN_STATUS_CHANGED',
        adminId,
        admin.status,
        status,
      );
      return { changed: true };
    });
  }
}
