import { Body,Controller,Headers,Param,Post } from '@nestjs/common';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { readDashboard,type DashboardPeriod } from '../modules/dashboard/dashboard-reader.js';
import { InjectPgConnection,type PgConnection } from '../postgres/connection.js';
import { authorizeInternal } from './authorize.js';
@Controller('_internal/dashboard')
export class DashboardReadsController {
  constructor(@InjectPgConnection() private readonly db:PgConnection){}
  @Public() @Post(':owner') read(@Headers('x-internal-token') token:string,@Param('owner') owner:string,@Body() input:DashboardPeriod){authorizeInternal(token,[owner]);return readDashboard(this.db,owner,input);}
}
