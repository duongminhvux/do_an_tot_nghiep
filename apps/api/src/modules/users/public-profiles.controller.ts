import { Body, Controller, Header, Headers, Post } from '@nestjs/common';
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { authorizeInternal } from '../../internal/authorize.js';
import {
  InjectPgConnection,
  type PgConnection,
} from '../../postgres/connection.js';
import { Public } from '../auth/decorators/public.decorator.js';
export class PublicProfilesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
/** Bounded public-display projection for community pages. Never return user rows. */
@Controller('_internal/exam-community')
export class PublicProfilesController {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}
  @Public()
  @Post('profiles')
  @Header('Cache-Control', 'private, no-store')
  async profiles(
    @Headers('x-internal-token') token: string,
    @Body() dto: PublicProfilesDto,
  ) {
    authorizeInternal(token, ['identity']);
    const { rows } = await this.db.query(
      `SELECT id,CASE WHEN is_deleted IS NOT TRUE AND is_banned IS NOT TRUE THEN username ELSE NULL END AS username FROM public.users WHERE id=ANY($1::uuid[])`,
      [dto.ids],
    );
    const names = new Map(rows.map((row) => [row.id, row.username]));
    return Object.fromEntries(dto.ids.map((id) => [id, names.get(id) ?? null]));
  }
}
