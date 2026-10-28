import { Body,Controller,Headers,Param,Post } from '@nestjs/common';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { readContentRows,readWordSample,type ContentKind,type ContentRead,type WordSample } from '../modules/vocabulary/content-reader.js';
import { InjectPgConnection,type PgConnection } from '../postgres/connection.js';
import { authorizeInternal } from './authorize.js';
@Controller('_internal/content')
export class ContentReadsController {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}
  @Public() @Post('sample-words')
  sample(@Headers('x-internal-token') token:string,@Body() input:WordSample){authorizeInternal(token,['content']);return readWordSample(this.db,input);}
  @Public() @Post(':kind')
  read(@Headers('x-internal-token') token: string, @Param('kind') kind: ContentKind, @Body() input: ContentRead) {
    authorizeInternal(token, ['content']); return readContentRows(this.db, kind, input);
  }
}
