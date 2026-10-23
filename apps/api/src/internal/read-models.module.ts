import { BadRequestException, Controller, ForbiddenException, Get, Headers, Module, Param } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { InjectPgConnection, type PgConnection } from '../postgres/compat.js';
import { OWNED_TABLES, serviceRole } from '../postgres/ownership.js';
import { Public } from '../modules/auth/decorators/public.decorator.js';

/** Transitional read API for existing document-shaped queries. No SQL or writes accepted. */
@Controller('_internal/read-models')
export class ReadModelsController {
  constructor(@InjectPgConnection() private readonly connection: PgConnection) {}

  @Public()
  @Get(':table')
  async rows(@Headers('x-internal-token') token: string, @Param('table') table: string) {
    const expected = Buffer.from(process.env.INTERNAL_SERVICE_TOKEN || '');
    const actual = Buffer.from(token || '');
    if (expected.length < 24 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new ForbiddenException();
    }
    // Admin credentials and the PDF correction delivery payload never leave their owner.
    if (!OWNED_TABLES[serviceRole() || '']?.includes(table)
      || ['admins', 'pdf_ai_correction_events'].includes(table)) throw new BadRequestException('Unknown read model');
    const result = await this.connection.query(`SELECT * FROM public."${table}"`);
    if (table !== 'users') return result.rows;
    return result.rows.map(row => {
      const { password_hash, code, code_expires_at, ...safe } = row;
      const { password, passwordHash, code: payloadCode, codeExpiresAt, refreshToken, ...payload } = safe.payload || {};
      return { ...safe, payload };
    });
  }
}

@Module({ controllers: [ReadModelsController] })
export class ReadModelsModule {}
