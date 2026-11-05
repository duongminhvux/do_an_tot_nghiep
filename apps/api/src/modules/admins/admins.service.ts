import { AdminRbacService } from './admin-rbac.service.js';
import { Injectable,UnauthorizedException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { comparePassword } from '../../common/bcrypt.js';
import {
InjectPgConnection,
type PgConnection,
} from '../../postgres/connection.js';
import { first,rowData,sql,type Sql } from '../../postgres/sql.js';
import { isAdminAuthenticatable, type AdminRecord, type SafeAdminRecord } from './admin.types.js';

@Injectable()
export class AdminsService {
  constructor(
    @InjectPgConnection() private readonly connection: PgConnection,
    private readonly i18n: I18nService,
    private readonly rbac: AdminRbacService,
  ) {}

  private async read(where: Sql): Promise<AdminRecord | null> {
    const row = await first(
      this.connection,
      sql`SELECT * FROM public.admins WHERE ${where} LIMIT 1`,
    );
    return row ? rowData<AdminRecord>(row) : null;
  }
  findByEmail(email: string) {
    return this.read(sql`email = ${email.toLowerCase()}`);
  }
  findById(id: string) {
    return this.read(sql`id = ${id}::uuid`);
  }
  findByUsername(username: string) {
    return this.read(sql`username = ${username}`);
  }

  authenticateToken(claims: any) { return this.rbac.authenticateToken(claims); }

  async revokeToken(claims: any): Promise<boolean> {
    if (claims?.role!=='ADMIN' || typeof claims._id!=='string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims._id) || !Number.isInteger(claims.auth_version) || claims.auth_version<1) return false;
    const result=await this.connection.query(`UPDATE public.admins SET auth_version=auth_version+1
      WHERE id=$1::uuid AND auth_version=$2 AND status='ACTIVE' AND NOT is_deleted AND auth_version<2147483647 RETURNING id`,
      [claims._id,claims.auth_version]);
    return result.rows.length===1;
  }

  async getAuthVersion(id: string): Promise<number | null> {
    const row = await first<{ auth_version: number }>(this.connection,
      sql`SELECT auth_version FROM public.admins WHERE id = ${id}::uuid`);
    return row?.auth_version ?? null;
  }

  async validateAdmin(identifier: string, pass: string): Promise<SafeAdminRecord> {
    const trimmed = identifier.trim();
    const admin = await this.read(
      sql`email = ${trimmed.toLowerCase()} OR username = ${trimmed}`,
    );

    if (!admin) {
      throw new UnauthorizedException(
        await this.i18n.t('auth.INVALID_CREDENTIALS'),
      );
    }

    if (admin.isDeleted) {
      throw new UnauthorizedException(
        await this.i18n.t('auth.ACCOUNT_DELETED'),
      );
    }

    if (!isAdminAuthenticatable(admin)) {
      throw new UnauthorizedException(await this.i18n.t('auth.INVALID_CREDENTIALS'));
    }

    const isMatch = await comparePassword(pass, admin.password);
    if (!isMatch) {
      throw new UnauthorizedException(
        await this.i18n.t('auth.INVALID_CREDENTIALS'),
      );
    }

    const { password: _password, ...safeAdmin } = admin;
    return safeAdmin;
  }
}
