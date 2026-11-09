import { AdminActivationService } from './admin-activation.service.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { type PgConnection } from '../../postgres/connection.js';
import { AdminAuthorizationService } from './admin-authorization.service.js';
import { RbacRepository } from './rbac.repository.js';
import { ADMIN_STATUSES } from './admin.types.js';
import {
  iamObject,
  iamText,
  iamId,
  iamIds,
  iamEmail,
  iamUsername,
  iamFullName,
  usernameBaseFromEmail,
  iamAvatar,
  iamDescription,
  iamPage,
} from './admin-iam.validation.js';

// Deliberately omit password_hash, payload and activation token/hash from every API projection.
const profile = `a.id,a.email,a.username,NULLIF(a.payload->>'fullName','') AS "fullName",a.avatar_url AS "avatarUrl",a.status,a.auth_version AS "authVersion",
  a.created_by AS "createdBy",a.activated_at AS "activatedAt",a.last_login_at AS "lastLoginAt",
  a.created_at AS "createdAt",a.updated_at AS "updatedAt",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'isSystem',r.is_system) ORDER BY r.code)
    FROM public.admin_roles ar JOIN public.roles r ON r.id=ar.role_id WHERE ar.admin_id=a.id),'[]'::jsonb) AS roles`;

@Injectable()
export class AdminManagementService {
  constructor(
    private readonly authorization: AdminAuthorizationService,
    private readonly activationDelivery: AdminActivationService,
  ) {}

  /** Picks `base`, `base2`, `base3`… — the first handle not taken (case-insensitive). */
  private async freeUsername(db: PgConnection, email: string): Promise<string> {
    const base = usernameBaseFromEmail(email);
    // Literal prefix match (no LIKE wildcards from user data).
    const { rows } = await db.query(
      'SELECT lower(username) AS name FROM public.admins WHERE left(lower(username),length($1))=$1',
      [base],
    );
    const taken = new Set(rows.map((row: { name: string }) => row.name));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(base + n)) return base + n;
  }
  private async unique<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new ConflictException('IAM identity or role already exists');
      throw error;
    }
  }
  private async detail(db: PgConnection, id: string) {
    const {
      rows: [admin],
    } = await db.query(
      `SELECT ${profile} FROM public.admins a WHERE a.id=$1::uuid AND NOT a.is_deleted`,
      [id],
    );
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }
  private async ordinaryRoles(db: PgConnection, ids: string[]) {
    const { rows } = await db.query(
      'SELECT id,is_system FROM public.roles WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
      [ids],
    );
    if (rows.length !== ids.length)
      throw new BadRequestException('Unknown role');
    if (rows.some((role) => role.is_system))
      throw new ForbiddenException(
        'System membership requires explicit operator bootstrap',
      );
  }
  private async activation(db: PgConnection, adminId: string, actorId: string) {
    if (this.activationDelivery.enabled())
      return this.activationDelivery.issue(db, adminId, actorId);
    // Legacy feature-off behavior; no producer until consumer rollout is confirmed.
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256')
      .update(rawToken, 'utf8')
      .digest('hex');
    await db.query(
      'UPDATE public.admin_activation_tokens SET revoked_at=now() WHERE admin_id=$1::uuid AND used_at IS NULL AND revoked_at IS NULL',
      [adminId],
    );
    const {
      rows: [token],
    } = await db.query(
      `INSERT INTO public.admin_activation_tokens(admin_id,token_hash,created_by)
      VALUES($1::uuid,$2,$3::uuid) RETURNING id,expires_at AS "expiresAt"`,
      [adminId, tokenHash, actorId],
    );
    return token;
  }

  async listAdmins(actor: unknown, query: unknown) {
    const input = iamObject(query, [
      'search',
      'status',
      'roleId',
      'page',
      'limit',
    ]);
    const page = iamPage(input.page, 1, 1000000),
      limit = iamPage(input.limit, 20, 100);
    const search =
      input.search === undefined ? '' : iamText(input.search, 'search', 200);
    const status =
      input.status === undefined ? null : iamText(input.status, 'status', 30);
    if (status && !ADMIN_STATUSES.some((value) => value === status))
      throw new BadRequestException('Invalid status');
    const roleId = input.roleId === undefined ? null : iamId(input.roleId);
    return this.authorization.runIamTransaction(
      actor,
      'admins.read',
      async (db) => {
        // Literal substring search, not a client-supplied SQL wildcard pattern.
        const filter = `NOT a.is_deleted AND ($1='' OR strpos(lower(a.email),lower($1))>0 OR strpos(lower(a.username),lower($1))>0 OR strpos(lower(coalesce(a.payload->>'fullName','')),lower($1))>0)
        AND ($2::text IS NULL OR a.status=$2) AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM public.admin_roles ar WHERE ar.admin_id=a.id AND ar.role_id=$3))`;
        const params = [search, status, roleId];
        const total = Number(
          (
            await db.query(
              `SELECT count(*) AS total FROM public.admins a WHERE ${filter}`,
              params,
            )
          ).rows[0].total,
        );
        const { rows: items } = await db.query(
          `SELECT ${profile} FROM public.admins a WHERE ${filter} ORDER BY a.created_at DESC,a.id LIMIT $4 OFFSET $5`,
          [...params, limit, (page - 1) * limit],
        );
        return { items, total, page, limit };
      },
    );
  }
  getAdmin(actor: unknown, id: string) {
    iamId(id);
    return this.authorization.runIamTransaction(actor, 'admins.read', (db) =>
      this.detail(db, id),
    );
  }
  async createAdmin(actor: any, body: unknown) {
    const input = iamObject(body, [
      'email',
      'fullName',
      'username',
      'avatarUrl',
      'roleIds',
    ]);
    const email = iamEmail(input.email),
      fullName = iamFullName(input.fullName),
      requestedUsername =
        input.username === undefined ? null : iamUsername(input.username);
    const avatar =
      input.avatarUrl === undefined ? null : iamAvatar(input.avatarUrl);
    const ids = input.roleIds === undefined ? [] : iamIds(input.roleIds);
    return this.unique(() =>
      this.authorization.runIamTransaction(
        actor,
        'admins.create',
        async (db) => {
          await this.ordinaryRoles(db, ids);
          const id = randomUUID();
          const username =
            requestedUsername ?? (await this.freeUsername(db, email));
          await db.query(
            `INSERT INTO public.admins(id,email,username,avatar_url,status,password_hash,created_by,payload)
        VALUES($1,$2,$3,$4,'PENDING_ACTIVATION',NULL,$5,jsonb_build_object('fullName',$6::text))`,
            [id, email, username, avatar, actor._id, fullName],
          );
          await db.query(
            `INSERT INTO public.admin_roles(admin_id,role_id,assigned_by)
        SELECT $1::uuid,id,$3::uuid FROM public.roles WHERE id=ANY($2::uuid[])`,
            [id, ids, actor._id],
          );
          const activation = await this.activation(db, id, actor._id);
          const admin = await this.detail(db, id);
          await this.authorization.recordAudit(
            db,
            actor,
            'ADMIN_INVITED',
            id,
            null,
            {
              admin,
              activationTokenId: activation.id,
              expiresAt: activation.expiresAt,
              delivery:
                'delivery' in activation
                  ? activation.delivery
                  : 'NOT_SCHEDULED',
            },
          );
          return {
            admin,
            activation: {
              expiresAt: activation.expiresAt,
              delivery:
                'delivery' in activation
                  ? activation.delivery
                  : 'NOT_SCHEDULED',
            },
          };
        },
      ),
    );
  }
  async updateAdmin(actor: any, id: string, body: unknown) {
    iamId(id);
    const input = iamObject(body, ['email', 'fullName', 'username', 'avatarUrl']);
    if (!Object.keys(input).length)
      throw new BadRequestException('Empty update');
    const email = input.email === undefined ? undefined : iamEmail(input.email);
    const fullName =
      input.fullName === undefined ? undefined : iamFullName(input.fullName);
    const username =
      input.username === undefined ? undefined : iamUsername(input.username);
    const avatar =
      input.avatarUrl === undefined ? undefined : iamAvatar(input.avatarUrl);
    return this.unique(() =>
      this.authorization.runIamTransaction(
        actor,
        'admins.update',
        async (db) => {
          await db.query(
            'SELECT id FROM public.admins WHERE id=$1::uuid FOR UPDATE',
            [id],
          );
          const before = await this.detail(db, id);
          const next = {
            email: email ?? before.email,
            username: username ?? before.username,
            fullName: fullName ?? before.fullName,
            avatarUrl: avatar === undefined ? before.avatarUrl : avatar,
          };
          const identityChanged =
            next.email !== before.email ||
            next.username !== before.username ||
            next.avatarUrl !== before.avatarUrl;
          if (!identityChanged && next.fullName === before.fullName)
            return before;
          if (identityChanged)
            await db.query(
              'UPDATE public.admins SET email=$2,username=$3,avatar_url=$4,auth_version=auth_version+1 WHERE id=$1::uuid',
              [id, next.email, next.username, next.avatarUrl],
            );
          // A display-name change does not affect credentials, so sessions stay valid.
          if (next.fullName !== before.fullName)
            await db.query(
              `UPDATE public.admins SET payload=jsonb_set(payload,'{fullName}',to_jsonb($2::text)) WHERE id=$1::uuid`,
              [id, next.fullName],
            );
          // Changing a pending recipient invalidates its existing invitation atomically.
          if (
            before.status === 'PENDING_ACTIVATION' &&
            next.email !== before.email
          )
            await this.activation(db, id, actor._id);
          const after = await this.detail(db, id);
          await this.authorization.recordAudit(
            db,
            actor,
            'ADMIN_PROFILE_CHANGED',
            id,
            before,
            after,
          );
          return after;
        },
      ),
    );
  }
  setAdminRoles(actor: any, id: string, body: unknown) {
    const input = iamObject(body, ['roleIds']);
    return this.authorization.setAdminRoles(
      actor,
      iamId(id),
      iamIds(input.roleIds),
    );
  }
  setStatus(actor: any, id: string, body: unknown) {
    const input = iamObject(body, ['status']);
    if (!['ACTIVE', 'SUSPENDED', 'DISABLED'].includes(input.status as string))
      throw new BadRequestException('Invalid status');
    return this.authorization.setStatus(
      actor,
      iamId(id),
      input.status as 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
    );
  }
  listRoles(actor: unknown) {
    return this.authorization.runIamTransaction(actor, 'roles.read', (db) =>
      new RbacRepository(db).listRoles(),
    );
  }
  listPermissions(actor: unknown) {
    return this.authorization.runIamTransaction(actor, 'roles.read', (db) =>
      new RbacRepository(db).listPermissions(),
    );
  }
  matrix(actor: unknown) {
    return this.authorization.runIamTransaction(
      actor,
      'roles.read',
      async (db) => ({
        roles: await new RbacRepository(db).listRoles(),
        permissions: await new RbacRepository(db).listPermissions(),
        grants: (
          await db.query(
            `SELECT rp.role_id AS "roleId",p.code AS permission FROM public.role_permissions rp JOIN public.permissions p ON p.id=rp.permission_id ORDER BY rp.role_id,p.code`,
          )
        ).rows,
      }),
    );
  }
  async createRole(actor: any, body: unknown) {
    const input = iamObject(body, ['code', 'name', 'description']);
    const code = iamText(input.code, 'code', 100),
      name = iamText(input.name, 'name', 200);
    if (!/^[A-Z][A-Z0-9_]*$/.test(code))
      throw new BadRequestException('Invalid role code');
    if (code === 'SUPER_ADMIN')
      throw new ForbiddenException('Reserved system role');
    const description =
      input.description === undefined
        ? null
        : iamDescription(input.description);
    return this.unique(() =>
      this.authorization.runIamTransaction(
        actor,
        'roles.manage',
        async (db) => {
          const {
            rows: [role],
          } = await db.query(
            `INSERT INTO public.roles(code,name,description,is_system) VALUES($1,$2,$3,false)
        RETURNING id,code,name,description,is_system AS "isSystem"`,
            [code, name, description],
          );
          await this.authorization.recordAudit(
            db,
            actor,
            'ROLE_CREATED',
            role.id,
            null,
            role,
          );
          return role;
        },
      ),
    );
  }
  async updateRole(actor: any, id: string, body: unknown) {
    iamId(id);
    const input = iamObject(body, ['name', 'description']);
    if (!Object.keys(input).length)
      throw new BadRequestException('Empty update');
    const name =
      input.name === undefined ? undefined : iamText(input.name, 'name', 200);
    const description =
      input.description === undefined
        ? undefined
        : iamDescription(input.description);
    return this.authorization.runIamTransaction(
      actor,
      'roles.manage',
      async (db) => {
        const {
          rows: [before],
        } = await db.query(
          'SELECT id,code,name,description,is_system AS "isSystem" FROM public.roles WHERE id=$1::uuid FOR UPDATE',
          [id],
        );
        if (!before) throw new NotFoundException('Role not found');
        if (before.isSystem)
          throw new ForbiddenException('System role is immutable');
        const {
          rows: [after],
        } = await db.query(
          `UPDATE public.roles SET name=$2,description=$3 WHERE id=$1::uuid RETURNING id,code,name,description,is_system AS "isSystem"`,
          [
            id,
            name ?? before.name,
            description === undefined ? before.description : description,
          ],
        );
        await this.authorization.recordAudit(
          db,
          actor,
          'ROLE_PROFILE_CHANGED',
          id,
          before,
          after,
        );
        return after;
      },
    );
  }
  setRolePermissions(actor: any, id: string, body: unknown) {
    const input = iamObject(body, ['permissionCodes']);
    if (
      !Array.isArray(input.permissionCodes) ||
      input.permissionCodes.length > 70 ||
      input.permissionCodes.some((code) => typeof code !== 'string')
    )
      throw new BadRequestException('Invalid permissions');
    return this.authorization.setRolePermissions(
      actor,
      iamId(id),
      input.permissionCodes as string[],
    );
  }
}
