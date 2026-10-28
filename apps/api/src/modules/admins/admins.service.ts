import { Injectable,UnauthorizedException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { comparePassword } from '../../common/bcrypt.js';
import {
InjectPgConnection,
type PgConnection,
} from '../../postgres/connection.js';
import { first,rowData,sql,type Sql } from '../../postgres/sql.js';
import type { AdminRecord } from './admin.types.js';

@Injectable()
export class AdminsService {
  constructor(
    @InjectPgConnection() private readonly connection: PgConnection,
    private readonly i18n: I18nService,
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

  async validateAdmin(identifier: string, pass: string): Promise<AdminRecord> {
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

    const isMatch = await comparePassword(pass, admin.password);
    if (!isMatch) {
      throw new UnauthorizedException(
        await this.i18n.t('auth.INVALID_CREDENTIALS'),
      );
    }

    const { password: _password, ...safeAdmin } = admin;
    return safeAdmin as AdminRecord;
  }
}
